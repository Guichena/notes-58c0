import java.util.OptionalInt;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;
public final class BoundedIntQueue {
    private final ReentrantLock lock=new ReentrantLock();
    private final Condition notEmpty=lock.newCondition(),notFull=lock.newCondition();
    private final int[] items;
    private int head,tail,size;
    private boolean closed;
    public BoundedIntQueue(int capacity) {
        if(capacity<1 || capacity>4096)throw new IllegalArgumentException("capacity 1..4096");
        items=new int[capacity];
    }
    public boolean put(int value) throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while(!closed && size==items.length)notFull.await();
            if(closed)return false;
            items[tail]=value;tail=(tail+1)%items.length;size++;
            notEmpty.signal();return true;
        }finally{lock.unlock();}
    }
    public OptionalInt take() throws InterruptedException {
        lock.lockInterruptibly();
        try {
            while(!closed && size==0)notEmpty.await();
            if(size==0)return OptionalInt.empty();
            int value=items[head];head=(head+1)%items.length;size--;
            notFull.signal();return OptionalInt.of(value);
        }finally{lock.unlock();}
    }
    public void close() {
        lock.lock();
        try{closed=true;notEmpty.signalAll();notFull.signalAll();}
        finally{lock.unlock();}
    }
}

