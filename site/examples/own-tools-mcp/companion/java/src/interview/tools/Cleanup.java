package interview.tools;

/** Independent cleanup stages; retain the original Throwable object and suppress distinct later failures. */
public final class Cleanup {
    private Cleanup(){}
    @FunctionalInterface public interface Stage { void run() throws Exception; }
    public static Throwable merge(Throwable primary,Throwable later){
        if(primary==null)return later;
        if(primary!=later){boolean seen=false;for(Throwable old:primary.getSuppressed())if(old==later)seen=true;
            if(!seen)primary.addSuppressed(later);}
        return primary;
    }
    public static Throwable collect(Throwable primary,Stage... stages){
        boolean interrupted=Thread.interrupted();
        try{for(Stage stage:stages){try{stage.run();}catch(Throwable e){if(e instanceof InterruptedException)interrupted=true;primary=merge(primary,e);}}}
        finally{if(interrupted)Thread.currentThread().interrupt();}
        return primary;
    }
    public static void rethrow(Throwable failure)throws Exception{
        if(failure instanceof Exception e)throw e;if(failure instanceof Error e)throw e;
        if(failure!=null)throw new AssertionError(failure);
    }
    public static void unchecked(Throwable failure){
        if(failure instanceof RuntimeException e)throw e;if(failure instanceof Error e)throw e;
        if(failure!=null)throw new IllegalStateException("checked cleanup failure",failure);
    }
}
