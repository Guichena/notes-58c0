import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Arrays;
import java.util.HexFormat;

public final class ByteOrderDemo {
    static byte[] big(int x) { return new byte[]{(byte)(x >>> 24),(byte)(x >>> 16),(byte)(x >>> 8),(byte)x}; }
    static int read(byte[] b) {
        if (b == null || b.length != 4) throw new IllegalArgumentException("four bytes required");
        return ((b[0]&255)<<24) | ((b[1]&255)<<16) | ((b[2]&255)<<8) | (b[3]&255);
    }
    static int checks;
    static void check(boolean b) { if (!b) throw new AssertionError(); checks++; }
    public static void main(String[] args) {
        if (args.length == 1 && args[0].equals("vectors")) {
            int x = 17;
            for (int i=0;i<1000;i++) { x=x*1664525+1013904223; System.out.println(HexFormat.of().formatHex(big(x))); }
            return;
        }
        check(Arrays.equals(big(0x12345678), new byte[]{0x12,0x34,0x56,0x78}));
        check(ByteBuffer.allocate(4).order() == ByteOrder.BIG_ENDIAN);
        check(ByteBuffer.wrap(big(0x12345678)).order(ByteOrder.LITTLE_ENDIAN).getInt() == 0x78563412);
        int[] edges = {0,1,-1,Integer.MIN_VALUE,Integer.MAX_VALUE,0x12345678,0x80000001};
        for (int x : edges) { check(read(big(x)) == x); check(ByteBuffer.wrap(big(x)).getInt() == x); }
        int x=17;
        for (int i=0;i<10000;i++) {
            x=x*1664525+1013904223;
            check(read(big(x)) == x);
            check(Arrays.equals(big(x),ByteBuffer.allocate(4).order(ByteOrder.BIG_ENDIAN).putInt(x).array()));
            byte[] little=ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(x).array();
            check(ByteBuffer.wrap(little).order(ByteOrder.LITTLE_ENDIAN).getInt() == x);
        }
        try { read(new byte[3]); throw new AssertionError(); } catch (IllegalArgumentException expected) { checks++; }
        System.out.println("PASS " + checks + "; nativeOrder=" + ByteOrder.nativeOrder() + "; explicit wire order=BIG_ENDIAN");
    }
}

