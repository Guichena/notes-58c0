import java.util.*;
import java.util.concurrent.*;

/** 测试原有账户代码，不修改或宣称数据库事务/真实支付已验证。 */
public final class TransferContractTest {
    public static void main(String[] args)throws Exception{
        DeadlockExamples.Account a=new DeadlockExamples.Account(1,10000),b=new DeadlockExamples.Account(2,10000);
        ExecutorService p=Executors.newFixedThreadPool(8);CountDownLatch start=new CountDownLatch(1);
        try{List<Future<?>>fs=new ArrayList<>();for(int k=0;k<8;k++){boolean forward=k%2==0;fs.add(p.submit(()->{start.await();for(int i=0;i<1000;i++)DeadlockExamples.transfer(forward?a:b,forward?b:a,1);return null;}));}
            start.countDown();for(Future<?>f:fs)f.get(4,TimeUnit.SECONDS);
            if(a.balance()+b.balance()!=20000 || a.balance()<0 || b.balance()<0)throw new AssertionError("conservation");
            if(DeadlockExamples.transfer(a,b,30000))throw new AssertionError("overdraw");
            if(!DeadlockExamples.transfer(a,a,1))throw new AssertionError("self");
            try{DeadlockExamples.transfer(a,new DeadlockExamples.Account(1,0),1);throw new AssertionError();}catch(IllegalArgumentException expected){}
            try{DeadlockExamples.transfer(a,b,-1);throw new AssertionError();}catch(IllegalArgumentException expected){}
            DeadlockExamples.Account full=new DeadlockExamples.Account(3,Long.MAX_VALUE);long before=a.balance();
            try{DeadlockExamples.transfer(a,full,1);throw new AssertionError();}catch(ArithmeticException expected){}
            if(a.balance()!=before || full.balance()!=Long.MAX_VALUE)throw new AssertionError("partial overflow debit");
        }finally{p.shutdownNow();if(!p.awaitTermination(2,TimeUnit.SECONDS))throw new AssertionError("leak");}
        System.out.println("TransferContractTest PASS: 8000 opposing transfers, conservation, nonnegative, insufficient, self, duplicate ID, negative, overflow");
    }
}
