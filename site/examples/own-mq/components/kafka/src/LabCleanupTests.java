/** No broker: tests failure identity, disabled suppression and interruption. */
public final class LabCleanupTests {
    static final class Disabled extends Exception {
        private static final long serialVersionUID = 1L;
        Disabled(){super("disabled",null,false,true);}
    }
    static void check(boolean ok){if(!ok)throw new AssertionError();}
    public static void main(String[] args)throws Exception {
        Exception first=new Exception("first");LabCleanup c=new LabCleanup();
        c.record(first);c.record(first);c.record(new InterruptedException("secondary"));
        check(Thread.interrupted());
        try{c.rethrow();throw new AssertionError();}catch(Exception actual){check(actual==first&&first.getSuppressed().length==1);}
        Disabled disabled=new Disabled();c=new LabCleanup();c.record(disabled);c.record(new Exception("hidden"));
        try{c.rethrow();throw new AssertionError();}catch(Exception actual){check(actual==disabled&&actual.getSuppressed().length==0);}
        c=new LabCleanup();InterruptedException primary=new InterruptedException("primary");c.record(primary);
        check(Thread.interrupted());
        try{c.rethrow();throw new AssertionError();}catch(InterruptedException actual){check(actual==primary);}
        System.out.println("LabCleanupTests OK; no broker");
    }
}
