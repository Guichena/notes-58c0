import java.net.http.HttpClient;
import java.util.Map;

/** Fault-injection helper: die after claim and before completion. No task execution. */
public final class CrashWorker {
    public static void main(String[] args)throws Exception {
        try(HttpClient client=HttpClient.newHttpClient()) {
            var j=ScriptService.post(client,ScriptService.loopback(args[0]),"/claim",Map.of("owner","crash-worker"));
            System.out.println(StrictJson.write(j));System.out.flush();
            new java.util.concurrent.CountDownLatch(1).await();
        }
    }
}
