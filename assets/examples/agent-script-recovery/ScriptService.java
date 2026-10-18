import com.sun.net.httpserver.*;
import java.io.*;
import java.math.BigDecimal;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.LongSupplier;

/** Local trusted demo: one durable coordinator, multiple independent JVM workers. */
public final class ScriptService {
    static final int CAPACITY=128, MAX_ATTEMPTS=3;
    static final long LEASE_MILLIS=1000;
    static final class Conflict extends RuntimeException {
        private static final long serialVersionUID=1L;
        Conflict(String text){super(text);}
    }
    record Job(String id,String request,String template,Object input,String state,String owner,
               long epoch,int attempts,long until,long deadline,Object output) {
        Map<String,Object> json(){Map<String,Object> m=new TreeMap<>();
            m.put("id",id);m.put("request",request);m.put("template",template);m.put("input",StrictJson.parse(StrictJson.write(input)));
            m.put("state",state);m.put("owner",owner);m.put("epoch",epoch);m.put("attempts",attempts);
            m.put("until",until);m.put("deadline",deadline);m.put("output",StrictJson.parse(StrictJson.write(output)));return m;}
        Job changed(String state,String owner,long epoch,int attempts,long until,Object output){return new Job(id,request,template,input,state,owner,epoch,attempts,until,deadline,output);}
        static Job from(Object o){Map<String,Object> m=StrictJson.object(o);
            StrictJson.fields(m,"id","request","template","input","state","owner","epoch","attempts","until","deadline","output");
            Job j=new Job(StrictJson.id(StrictJson.str(m,"id")),StrictJson.str(m,"request"),StrictJson.str(m,"template"),m.get("input"),
                    StrictJson.str(m,"state"),StrictJson.str(m,"owner"),StrictJson.integer(m,"epoch"),Math.toIntExact(StrictJson.integer(m,"attempts")),
                    StrictJson.integer(m,"until"),StrictJson.integer(m,"deadline"),m.get("output"));
            validateInput(j.template,j.input);
            if(!Set.of("QUEUED","RUNNING","SUCCEEDED","FAILED").contains(j.state)||j.epoch<0||j.attempts<0||j.attempts>MAX_ATTEMPTS||j.until<0||j.deadline<0)
                throw new IllegalArgumentException("invalid snapshot job");
            if(!j.owner.isEmpty())StrictJson.id(j.owner);
            Map<String,Object> original=StrictJson.object(StrictJson.parse(j.request));
            StrictJson.fields(original,"id","template","input","ttlMillis");
            long ttl=StrictJson.integer(original,"ttlMillis");
            if(!j.id.equals(original.get("id"))||!j.template.equals(original.get("template"))||
               !StrictJson.write(j.input).equals(StrictJson.write(original.get("input")))||ttl<100||ttl>60000||
               !j.request.equals(StrictJson.write(original))||j.epoch!=j.attempts||j.until>j.deadline)
                throw new IllegalArgumentException("inconsistent snapshot");
            if((j.state.equals("RUNNING")||j.state.equals("SUCCEEDED"))&&(j.owner.isEmpty()||j.epoch==0))
                throw new IllegalArgumentException("missing lease identity");
            if(j.state.equals("SUCCEEDED")&&!StrictJson.write(j.output).equals(StrictJson.write(execute(j.template,j.input))))
                throw new IllegalArgumentException("invalid saved result");
            return j;
        }
    }
    static void validateInput(String template,Object input) {
        switch(template) {
            case "upper-v1" -> {if(!(input instanceof String s)||s.getBytes(StandardCharsets.UTF_8).length>512)throw new IllegalArgumentException("upper-v1 string <=512 bytes");}
            case "sum-v1" -> {
                if(!(input instanceof List<?> xs)||xs.size()>256)throw new IllegalArgumentException("sum-v1 array <=256");
                for(Object x:xs){if(!(x instanceof BigDecimal n))throw new IllegalArgumentException("integer array required");
                    long v;try{v=n.longValueExact();}catch(ArithmeticException e){throw new IllegalArgumentException("integer range");}
                    if(v < -1_000_000_000L||v>1_000_000_000L)throw new IllegalArgumentException("integer range");}
            }
            default -> throw new IllegalArgumentException("unknown template; executable text is not accepted");
        }
    }
    static Object execute(String template,Object input) {
        validateInput(template,input);
        if(template.equals("upper-v1"))return ((String)input).toUpperCase(Locale.ROOT);
        long sum=0;for(Object x:(List<?>)input)sum=Math.addExact(sum,((BigDecimal)x).longValueExact());
        return BigDecimal.valueOf(sum);
    }
    static final class Core implements AutoCloseable {
        private final DurableFile store;
        private final LongSupplier clock;
        private Map<String,Job> jobs=new TreeMap<>();
        private long lastTime;
        Core(Path file,LongSupplier clock)throws IOException {
            this.clock=clock;store=new DurableFile(file);
            try {
                Object raw=store.read();
                if(raw!=null){Map<String,Object> m=StrictJson.object(raw);StrictJson.fields(m,"version","lastTime","jobs");
                    if(StrictJson.integer(m,"version")!=1)throw new IllegalArgumentException("snapshot version");
                    lastTime=StrictJson.integer(m,"lastTime");if(lastTime<0)throw new IllegalArgumentException("snapshot time");
                    if(!(m.get("jobs") instanceof List<?> all)||all.size()>CAPACITY)throw new IllegalArgumentException("snapshot jobs");
                    for(Object x:all){Job j=Job.from(x);if(jobs.put(j.id,j)!=null)throw new IllegalArgumentException("duplicate job");}
                }
            }catch(IOException|RuntimeException|Error e){DurableFile.cleanup(e,store::close);throw e;}
        }
        private long now(){long t=clock.getAsLong();if(t<0)throw new IllegalArgumentException("clock");return Math.max(t,lastTime);}
        private void commit(Map<String,Job> next,long time)throws IOException {
            List<Object> all=new ArrayList<>();for(Job j:next.values())all.add(j.json());
            store.save(Map.of("version",1,"lastTime",time,"jobs",all));jobs=next;lastTime=time;
        }
        synchronized Map<String,Object> submit(Map<String,Object> req)throws IOException {
            StrictJson.fields(req,"id","template","input","ttlMillis");
            String id=StrictJson.id(StrictJson.str(req,"id")),template=StrictJson.str(req,"template");
            validateInput(template,req.get("input"));long ttl=StrictJson.integer(req,"ttlMillis");
            if(ttl<100||ttl>60000)throw new IllegalArgumentException("ttlMillis 100..60000");
            String canonical=StrictJson.write(req);Job old=jobs.get(id);
            if(old!=null){if(!old.request.equals(canonical))throw new Conflict("idempotency payload conflict");return old.json();}
            if(jobs.size()>=CAPACITY)throw new Conflict("capacity");long time=now();
            Object input=StrictJson.parse(StrictJson.write(req.get("input")));
            Job j=new Job(id,canonical,template,input,"QUEUED","",0,0,0,Math.addExact(time,ttl),null);
            Map<String,Job> next=new TreeMap<>(jobs);next.put(id,j);commit(next,time);return j.json();
        }
        synchronized Map<String,Object> claim(String owner)throws IOException {
            StrictJson.id(owner);long time=now();Map<String,Job> next=new TreeMap<>(jobs);boolean dirty=false;
            for(Job j:jobs.values()) {
                if(j.state.equals("QUEUED")||j.state.equals("RUNNING")) {
                    if(time>=j.deadline||(j.state.equals("RUNNING")&&time>=j.until&&j.attempts>=MAX_ATTEMPTS)) {
                        next.put(j.id,j.changed("FAILED",j.owner,j.epoch,j.attempts,j.until,"budget exhausted"));dirty=true;
                    } else if(j.state.equals("RUNNING")&&time>=j.until) {
                        // Safe only because these versioned templates are pure and bounded.
                        next.put(j.id,j.changed("QUEUED",j.owner,j.epoch,j.attempts,j.until,null));dirty=true;
                    }
                }
            }
            for(Job j:next.values())if(j.state.equals("QUEUED")) {
                Job claimed=j.changed("RUNNING",owner,Math.incrementExact(j.epoch),j.attempts+1,
                        Math.min(Math.addExact(time,LEASE_MILLIS),j.deadline),null);
                next.put(j.id,claimed);commit(next,time);return claimed.json();
            }
            if(dirty)commit(next,time);return Map.of("state","EMPTY");
        }
        synchronized Map<String,Object> complete(Map<String,Object> req)throws IOException {
            StrictJson.fields(req,"id","owner","epoch","output");
            String id=StrictJson.id(StrictJson.str(req,"id")),owner=StrictJson.id(StrictJson.str(req,"owner"));
            long epoch=StrictJson.integer(req,"epoch");Job j=jobs.get(id);if(j==null)throw new Conflict("unknown job");
            if(j.epoch!=epoch||!j.owner.equals(owner))throw new Conflict("stale completion");
            Object output=StrictJson.parse(StrictJson.write(req.get("output")));
            if(StrictJson.write(output).getBytes(StandardCharsets.UTF_8).length>4096)throw new IllegalArgumentException("output limit");
            // Recompute the two tiny pure templates to reject malformed/incorrect receipts.
            if(!StrictJson.write(execute(j.template,j.input)).equals(StrictJson.write(output)))throw new Conflict("invalid result");
            if(j.state.equals("SUCCEEDED")){if(!StrictJson.write(j.output).equals(StrictJson.write(output)))throw new Conflict("result conflict");return j.json();}
            long time=now();if(!j.state.equals("RUNNING")||time>=j.until||time>=j.deadline)throw new Conflict("expired or inactive lease");
            Job done=j.changed("SUCCEEDED",owner,epoch,j.attempts,j.until,output);
            Map<String,Job> next=new TreeMap<>(jobs);next.put(id,done);commit(next,time);return done.json();
        }
        synchronized Map<String,Object> get(String id) {
            Job j=jobs.get(StrictJson.id(id));if(j==null)throw new Conflict("unknown job");return j.json();
        }
        public synchronized void close()throws IOException {store.close();}
    }
    static final class Server implements AutoCloseable {
        private final Core core;
        private final HttpServer server;
        private final ThreadPoolExecutor pool;
        Server(Path file,int port)throws IOException {
            core=new Core(file,System::currentTimeMillis);
            HttpServer candidate;
            try{candidate=HttpServer.create(new InetSocketAddress("127.0.0.1",port),16);}
            catch(IOException|RuntimeException|Error e){DurableFile.cleanup(e,core::close);throw e;}
            server=candidate;
            pool=new ThreadPoolExecutor(4,4,0,TimeUnit.MILLISECONDS,new ArrayBlockingQueue<>(32),new ThreadPoolExecutor.AbortPolicy());
            server.setExecutor(pool);server.createContext("/",this::handle);server.start();
        }
        int port(){return server.getAddress().getPort();}
        private void handle(HttpExchange ex)throws IOException {
            int status=200;Object response;
            try {
                if(!ex.getRequestMethod().equals("POST"))throw new IllegalArgumentException("POST required");
                if(ex.getRequestURI().getRawQuery()!=null)throw new IllegalArgumentException("no query parameters");
                if(!"application/json".equals(ex.getRequestHeaders().getFirst("Content-Type")))throw new IllegalArgumentException("application/json required");
                byte[] bytes=ex.getRequestBody().readNBytes(8193);if(bytes.length>8192)throw new IllegalArgumentException("request byte limit");
                Map<String,Object> req=StrictJson.object(StrictJson.decode(bytes));
                response=switch(ex.getRequestURI().getPath()) {
                    case "/submit" -> core.submit(req);
                    case "/claim" -> {StrictJson.fields(req,"owner");yield core.claim(StrictJson.str(req,"owner"));}
                    case "/complete" -> core.complete(req);
                    case "/get" -> {StrictJson.fields(req,"id");yield core.get(StrictJson.str(req,"id"));}
                    default -> throw new IllegalArgumentException("unknown route");
                };
            }catch(Conflict e){status=409;response=Map.of("error",e.getMessage());}
            catch(IllegalArgumentException|java.nio.charset.CharacterCodingException e){status=400;response=Map.of("error","invalid request");}
            catch(IOException e){status=503;response=Map.of("error","storage unavailable");}
            catch(RuntimeException e){status=500;response=Map.of("error","internal failure");}
            byte[] out=StrictJson.write(response).getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().set("Content-Type","application/json; charset=utf-8");
            try{ex.sendResponseHeaders(status,out.length);ex.getResponseBody().write(out);}finally{ex.close();}
        }
        public void close()throws IOException {
            Throwable primary=null;
            try{server.stop(0);pool.shutdownNow();}catch(RuntimeException|Error e){primary=e;throw e;}
            finally{DurableFile.cleanup(primary,core::close);}
        }
    }
    static Map<String,Object> post(HttpClient client,URI base,String path,Object value)throws Exception {
        HttpRequest req=HttpRequest.newBuilder(base.resolve(path)).timeout(Duration.ofSeconds(3))
                .header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(StrictJson.write(value))).build();
        HttpResponse<byte[]> res=client.send(req,HttpResponse.BodyHandlers.ofByteArray());
        if(res.statusCode()!=200)throw new IOException("HTTP "+res.statusCode()+": "+new String(res.body(),StandardCharsets.UTF_8));
        return StrictJson.object(StrictJson.decode(res.body()));
    }
    static URI loopback(String value) {
        URI u=URI.create(value);
        if(!"http".equals(u.getScheme())||!"127.0.0.1".equals(u.getHost())||u.getPort()<1||u.getPort()>65535||u.getRawUserInfo()!=null||u.getRawQuery()!=null||u.getRawFragment()!=null||!Set.of("","/").contains(u.getPath()))
            throw new IllegalArgumentException("only http://127.0.0.1:port is allowed");
        return u;
    }
    public static void main(String[] args)throws Exception {
        if(args.length==3&&args[0].equals("server")) {
            try(Server server=new Server(Path.of(args[1]),Integer.parseInt(args[2]))) {
                System.out.println("PORT "+server.port());System.out.flush();
                // Send a newline for graceful shutdown; a killed process is recovered from its snapshot.
                System.in.read();
            }return;
        }
        if(args.length==3&&args[0].equals("worker")) {
            URI base=loopback(args[1]);String owner=StrictJson.id(args[2]);
            try(HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build()) {
                Map<String,Object> j=post(client,base,"/claim",Map.of("owner",owner));
                if("EMPTY".equals(j.get("state"))){System.out.println("EMPTY");return;}
                Object out=execute(StrictJson.str(j,"template"),j.get("input"));
                Map<String,Object> receipt=new TreeMap<>();receipt.put("id",j.get("id"));receipt.put("owner",owner);receipt.put("epoch",j.get("epoch"));receipt.put("output",out);
                System.out.println(StrictJson.write(post(client,base,"/complete",receipt)));
            }return;
        }
        if(args.length==4&&args[0].equals("request")) {
            URI base=loopback(args[1]);
            if(!Set.of("/submit","/claim","/complete","/get").contains(args[2]))throw new IllegalArgumentException("route");
            try(HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build()) {
                System.out.println(StrictJson.write(post(client,base,args[2],StrictJson.parse(args[3]))));
            }return;
        }
        throw new IllegalArgumentException("server snapshot.json port | worker base owner | request base route JSON");
    }
}
