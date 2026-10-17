package demo;

import co.elastic.clients.elasticsearch.ElasticsearchAsyncClient;
import co.elastic.clients.elasticsearch._types.FieldValue;
import co.elastic.clients.elasticsearch._types.Refresh;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.VersionType;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch.core.BulkRequest;
import co.elastic.clients.elasticsearch.core.SearchRequest;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.bulk.BulkResponseItem;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.json.JsonData;
import co.elastic.clients.json.jackson.JacksonJsonpMapper;
import co.elastic.clients.transport.rest_client.RestClientTransport;
import co.elastic.clients.transport.TransportUtils;
import org.apache.http.Header;
import org.apache.http.HttpHost;
import org.apache.http.message.BasicHeader;
import org.elasticsearch.client.RestClient;
import java.io.File;
import java.io.StringReader;
import java.net.URI;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;

/** Isolated, single-writer fixture. No production ACL provider or CDC consumer is implied. */
public final class EsInterview {
    private static final int MAX_ITEMS = 2, MAX_BYTES = 64 * 1024, MAX_ATTEMPTS = 3;
    private record Doc(String id, String json) {
        Doc {
            if (!id.matches("[a-z0-9]{1,20}") || json.length() > 8192)
                throw new IllegalArgumentException("bounded fixture document required");
        }
        long wireBudget() { return 6L * json.length() + 1024; }
    }
    private static final class Deadline {
        private final long end;
        Deadline(Duration budget) { end = System.nanoTime() + budget.toNanos(); }
        long remaining() throws TimeoutException {
            long value = end - System.nanoTime();
            if (value <= 0) throw new TimeoutException("operation deadline exceeded");
            return value;
        }
        <T> T await(Supplier<CompletableFuture<T>> call) throws Exception {
            remaining();
            CompletableFuture<T> future = call.get();
            try { return future.get(remaining(), TimeUnit.NANOSECONDS); }
            catch (TimeoutException ex) { future.cancel(true); throw ex; }
            catch (InterruptedException ex) {
                future.cancel(true); Thread.currentThread().interrupt(); throw ex;
            } catch (ExecutionException ex) {
                if (ex.getCause() instanceof Exception cause) throw cause;
                throw ex;
            }
        }
        void pause(long millis) throws Exception {
            if (TimeUnit.MILLISECONDS.toNanos(millis) >= remaining())
                throw new TimeoutException("no retry budget");
            try { Thread.sleep(millis); }
            catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw ex; }
        }
    }
    private static String env(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("missing " + name);
        return value;
    }
    private static Query scope() {
        // Fixed evaluation time and generation; identical in all pages/channels.
        return Query.of(q -> q.withJson(new StringReader("""
            {"bool":{"filter":[
              {"term":{"tenant_id":"demo"}}, {"term":{"acl":"reader"}},
              {"term":{"generation":"r1"}}, {"term":{"deleted":false}},
              {"range":{"created_at":{"lte":"2026-10-10T12:00:00Z"}}}
            ]}}
            """)));
    }
    private static Query textQuery() {
        return Query.of(q -> q.bool(b -> b.filter(scope())
                .must(m -> m.match(t -> t.field("body").query("缓存")))));
    }
    private static void complete(SearchResponse<?> response) {
        if (response.timedOut() || response.shards().failed().intValue() != 0
                || response.shards().total().intValue() != 1
                || response.shards().successful().intValue() != 1)
            throw new IllegalStateException("incomplete fixture search; cursor unchanged");
    }
    private static void bulk(ElasticsearchAsyncClient client, String index,
                             List<Doc> documents, Deadline deadline) throws Exception {
        List<Doc> batch = new ArrayList<>(); long bytes = 0;
        for (Doc document : documents) {
            long cost = document.wireBudget();
            if (cost > MAX_BYTES) throw new IllegalArgumentException("document exceeds batch budget");
            if (!batch.isEmpty() && (batch.size() == MAX_ITEMS || bytes + cost > MAX_BYTES)) {
                writeBatch(client, index, batch, deadline); batch.clear(); bytes = 0;
            }
            batch.add(document); bytes += cost;
        }
        if (!batch.isEmpty()) writeBatch(client, index, batch, deadline);
    }
    private static void writeBatch(ElasticsearchAsyncClient client, String index,
                                    List<Doc> batch, Deadline deadline) throws Exception {
        List<Doc> pending = List.copyOf(batch);
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            BulkRequest.Builder builder = new BulkRequest.Builder().refresh(Refresh.WaitFor);
            for (Doc document : pending) builder.operations(op -> op.index(i -> i
                    .index(index).id(document.id()).version(1L).versionType(VersionType.ExternalGte)
                    .document(JsonData.fromJson(document.json()))));
            var request = builder.build();
            // Any exception here is request-level/unknown outcome. Do not silently retry it.
            var response = deadline.await(() -> client.bulk(request));
            if (response.items().size() != pending.size())
                throw new IllegalStateException("bulk response count mismatch");
            List<Doc> retry = new ArrayList<>(); List<String> fatal = new ArrayList<>();
            for (int i = 0; i < pending.size(); i++) {
                BulkResponseItem item = response.items().get(i); Doc document = pending.get(i);
                if (!document.id().equals(item.id()))
                    throw new IllegalStateException("bulk response identity mismatch");
                boolean success = item.error() == null && item.status() >= 200 && item.status() < 300;
                if (success) continue;
                int status = item.status();
                if (status == 429 || status == 502 || status == 503 || status == 504) retry.add(document);
                else fatal.add(document.id() + ":" + status + ":"
                        + (item.error() == null ? "unknown" : item.error().type()));
            }
            if (!fatal.isEmpty()) {
                System.err.println("bulk terminal items=" + fatal + "; unresolved transient IDs="
                        + retry.stream().map(Doc::id).toList());
                throw new IllegalStateException("bulk requires operator repair");
            }
            if (retry.isEmpty()) return;
            if (attempt == MAX_ATTEMPTS) throw new IllegalStateException("bulk retries exhausted: "
                    + retry.stream().map(Doc::id).toList());
            pending = List.copyOf(retry);
            deadline.pause((100L << (attempt - 1)) + ThreadLocalRandom.current().nextLong(51));
        }
    }
    private static void run(ElasticsearchAsyncClient client, String index, Deadline deadline) throws Exception {
        var info = deadline.await(client::info);
        if (!info.version().number().equals("8.15.3"))
            throw new IllegalStateException("fixture requires Elasticsearch server 8.15.3");
        if (deadline.await(() -> client.indices().exists(e -> e.index(index))).value())
            throw new IllegalStateException("choose a new, unused ES_INDEX");
        var created = deadline.await(() -> client.indices().create(c -> c.index(index)
                .withJson(new StringReader("""
            {"settings":{"number_of_shards":"1","number_of_replicas":"0","refresh_interval":"1s",
              "analysis":{"analyzer":{"cjk_mixed":{"type":"custom","tokenizer":"standard",
                "filter":["cjk_width","lowercase","cjk_bigram"]}}}},
             "mappings":{"dynamic":"strict","properties":{
              "tenant_id":{"type":"keyword"},"doc_id":{"type":"keyword"},
              "acl":{"type":"keyword"},"generation":{"type":"keyword"},
              "deleted":{"type":"boolean"},"version":{"type":"long"},
              "created_at":{"type":"date"},"tags":{"type":"keyword"},
              "body":{"type":"text","analyzer":"cjk_mixed"},
              "embedding":{"type":"dense_vector","dims":3,"index":true,
                "similarity":"cosine","index_options":{"type":"hnsw","m":16,"ef_construction":100}}
             }}}
            """))));
        if (!created.acknowledged() || !created.shardsAcknowledged())
            throw new IllegalStateException("index creation not fully acknowledged; inspect before retry");
        var analyzed = deadline.await(() -> client.indices().analyze(a -> a.index(index)
                .analyzer("cjk_mixed").text("缓存一致性 ES")));
        System.out.println("tokens=" + analyzed.tokens().stream().map(t -> t.token()).toList());
        List<Doc> docs = List.of(
            new Doc("a", "{\"tenant_id\":\"demo\",\"doc_id\":\"a\",\"acl\":[\"reader\"],\"generation\":\"r1\",\"deleted\":false,\"version\":1,\"created_at\":\"2026-10-10T00:00:00Z\",\"tags\":[\"java\"],\"body\":\"缓存一致性\",\"embedding\":[1,0,0]}"),
            new Doc("b", "{\"tenant_id\":\"demo\",\"doc_id\":\"b\",\"acl\":[\"reader\"],\"generation\":\"r1\",\"deleted\":false,\"version\":1,\"created_at\":\"2026-10-10T00:00:00Z\",\"tags\":[\"search\"],\"body\":\"缓存搜索\",\"embedding\":[0.8,0.2,0]}"),
            new Doc("c", "{\"tenant_id\":\"other\",\"doc_id\":\"c\",\"acl\":[\"reader\"],\"generation\":\"r1\",\"deleted\":false,\"version\":1,\"created_at\":\"2026-10-10T00:00:00Z\",\"tags\":[\"private\"],\"body\":\"缓存一致性\",\"embedding\":[1,0,0]}"),
            new Doc("d", "{\"tenant_id\":\"demo\",\"doc_id\":\"d\",\"acl\":[\"reader\"],\"generation\":\"r1\",\"deleted\":true,\"version\":1,\"created_at\":\"2026-10-10T00:00:00Z\",\"tags\":[\"deleted\"],\"body\":\"缓存一致性\",\"embedding\":[1,0,0]}"));
        bulk(client, index, docs, deadline);
        var aggregation = deadline.await(() -> client.search(s -> s.index(index).size(0)
                .allowPartialSearchResults(false).timeout("5s").query(scope())
                .aggregations("by_tag", a -> a.terms(t -> t.field("tags").size(10)
                        .showTermDocCountError(true))), JsonData.class));
        complete(aggregation);
        System.out.println("by_tag=" + aggregation.aggregations().get("by_tag"));
        var vector = deadline.await(() -> client.search(s -> s.index(index).size(2)
                .allowPartialSearchResults(false).timeout("5s")
                .knn(k -> k.field("embedding").queryVector(1.0f, 0.0f, 0.0f)
                        .k(2).numCandidates(10).filter(scope())), JsonData.class));
        complete(vector);
        Set<String> vectorIds = new HashSet<>();
        for (Hit<JsonData> hit : vector.hits().hits()) vectorIds.add(hit.id());
        if (!vectorIds.equals(Set.of("a", "b"))) throw new IllegalStateException("vector fixture mismatch");
        String pit = null;
        try {
            pit = deadline.await(() -> client.openPointInTime(o -> o.index(index)
                    .keepAlive(t -> t.time("1m")))).id();
            List<FieldValue> after = List.of(); List<String> received = new ArrayList<>();
            for (int page = 0; page < 10; page++) {
                SearchRequest.Builder builder = new SearchRequest.Builder();
                final String currentPit = pit;
                builder.pit(p -> p.id(currentPit).keepAlive(t -> t.time("1m")))
                        .size(1).allowPartialSearchResults(false).timeout("5s")
                        .trackTotalHits(t -> t.enabled(false)).query(textQuery())
                        .sort(s -> s.field(f -> f.field("doc_id").order(SortOrder.Asc)))
                        .sort(s -> s.field(f -> f.field("_shard_doc").order(SortOrder.Asc)));
                if (!after.isEmpty()) builder.searchAfter(after);
                var request = builder.build();
                var result = deadline.await(() -> client.search(request, JsonData.class));
                if (result.pitId() != null) pit = result.pitId(); // Also retain latest ID for cleanup.
                complete(result); // Do not advance the sort cursor before validating completeness.
                if (result.hits().hits().isEmpty()) {
                    if (!received.equals(List.of("a", "b"))) throw new IllegalStateException("page fixture mismatch");
                    System.out.println("complete pages=" + received); return;
                }
                for (Hit<JsonData> hit : result.hits().hits()) received.add(hit.id());
                after = List.copyOf(result.hits().hits().getLast().sort());
                if (after.size() != 2) throw new IllegalStateException("missing full sort tuple");
            }
            throw new IllegalStateException("fixture page safety bound reached");
        } finally {
            if (pit != null) {
                final String lastPit = pit;
                try {
                    var closed = new Deadline(Duration.ofSeconds(3)).await(
                            () -> client.closePointInTime(c -> c.id(lastPit)));
                    if (!closed.succeeded()) System.err.println("PIT cleanup incomplete; expires by keep_alive");
                } catch (Exception cleanup) {
                    System.err.println("PIT cleanup failed: " + cleanup.getClass().getSimpleName());
                }
            }
        }
    }
    public static void main(String[] args) throws Exception {
        if (!"yes".equals(env("ES_DEMO_ALLOW_CREATE")))
            throw new IllegalArgumentException("set ES_DEMO_ALLOW_CREATE=yes only for an isolated fixture");
        String url = env("ES_URL"), key = env("ES_API_KEY"), index = env("ES_INDEX");
        URI uri = URI.create(url);
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                || uri.getQuery() != null || uri.getFragment() != null
                || !(uri.getPath().isEmpty() || uri.getPath().equals("/")))
            throw new IllegalArgumentException("ES_URL must be an HTTPS origin without credentials");
        if (!index.matches("interview_java_[a-z0-9_]{1,40}"))
            throw new IllegalArgumentException("ES_INDEX must use isolated interview_java_ prefix");
        var ssl = TransportUtils.sslContextFromHttpCaCrt(new File(env("ES_CA_CERT")));
        RestClient low = RestClient.builder(new HttpHost(uri.getHost(), uri.getPort(), uri.getScheme()))
                .setDefaultHeaders(new Header[]{new BasicHeader("Authorization", "ApiKey " + key)})
                .setRequestConfigCallback(r -> r.setConnectTimeout(2000)
                        .setConnectionRequestTimeout(2000).setSocketTimeout(5000))
                .setHttpClientConfigCallback(h -> h.setSSLContext(ssl)
                        .setMaxConnTotal(2).setMaxConnPerRoute(2)).build();
        RestClientTransport createdTransport;
        try { createdTransport = new RestClientTransport(low, new JacksonJsonpMapper()); }
        catch (RuntimeException | Error constructionFailure) {
            try { low.close(); }
            catch (Throwable closeFailure) {
                if (closeFailure != constructionFailure) constructionFailure.addSuppressed(closeFailure);
            }
            throw constructionFailure;
        }
        try (RestClientTransport transport = createdTransport) {
            var client = new ElasticsearchAsyncClient(transport);
            try { run(client, index, new Deadline(Duration.ofSeconds(30))); }
            catch (Exception failure) {
                // Avoid printing request bodies, authentication headers or full exception messages.
                System.err.println("Stopped: " + failure.getClass().getSimpleName()
                        + "; an in-flight write may have succeeded; inspect the same index before retry.");
                throw new IllegalStateException("fixture did not complete; inspect unresolved writes");
            }
        }
    }

}
