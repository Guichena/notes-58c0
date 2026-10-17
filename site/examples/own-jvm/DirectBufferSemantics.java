import java.nio.*;
public final class DirectBufferSemantics {
    public static void main(String[] args) {
        ByteBuffer heap=ByteBuffer.allocate(16);
        ByteBuffer direct=ByteBuffer.allocateDirect(16);
        if(heap.isDirect() || !heap.hasArray() || !direct.isDirect() || direct.hasArray()) throw new AssertionError();
        try { direct.array(); throw new AssertionError(); } catch(UnsupportedOperationException expected) { }
        direct.put(new byte[]{1,2,3,4}).flip();
        if(direct.get()!=1) throw new AssertionError();
        direct.compact(); // keep bytes2,3,4; position3, limit16
        if(direct.position()!=3 || direct.limit()!=16) throw new AssertionError();
        direct.put((byte)5).flip();
        byte[] actual=new byte[4];direct.get(actual);
        if(!java.util.Arrays.equals(actual,new byte[]{2,3,4,5})) throw new AssertionError();
        direct.clear();
        ByteBuffer duplicate=direct.duplicate();
        duplicate.put(0,(byte)9);
        duplicate.position(3);
        if(direct.get(0)!=9 || direct.position()!=0 || duplicate.position()!=3) throw new AssertionError();
        System.out.println("PASS: direct vs heap, absent backing array, flip/compact, shared bytes and independent positions");
    }
}
