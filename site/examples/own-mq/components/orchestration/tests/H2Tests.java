import java.nio.file.*;
import java.util.Comparator;
/** Runs only fixed tiny scenarios in a newly created temporary database directory. */
public final class H2Tests {
    public static void main(String[] args)throws Exception{
        Path dir=Files.createTempDirectory("mq-h2-test-");
        Throwable testFailure=null;
        try{
            VersionedUnban.main(new String[]{dir.resolve("unban").toString()});
            AlarmSlots.main(new String[]{dir.resolve("slots").toString()});
        }catch(Exception|Error failure){testFailure=failure;throw failure;}finally{FailureTools.cleanup(testFailure, () -> {try(var paths=Files.walk(dir)){for(Path p:paths.sorted(Comparator.reverseOrder()).toList())Files.delete(p);}if(Files.exists(dir))throw new AssertionError("temporary H2 files remain");});}
        System.out.println("PASS H2Tests: both complete JDBC programs; all connections closed and temporary databases removed. Not MySQL integration.");
    }
}
