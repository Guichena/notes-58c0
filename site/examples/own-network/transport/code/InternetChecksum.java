import java.util.Arrays;
import java.util.Random;

public final class InternetChecksum {
    private int sum;
    private int high = -1;

    public void update(byte[] bytes, int off, int len) {
        java.util.Objects.checkFromIndexSize(off, len, bytes.length);
        for (int i = off; i < off + len; i++) {
            int value = bytes[i] & 255;
            if (high < 0) high = value;
            else {
                sum += (high << 8) | value;
                sum = (sum & 65535) + (sum >>> 16);
                high = -1;
            }
        }
    }
    // Non-destructive: a later update still pairs a pending high byte correctly.
    public int value() {
        int s = sum + (high < 0 ? 0 : high << 8);
        while ((s >>> 16) != 0) s = (s & 65535) + (s >>> 16);
        return (~s) & 65535;
    }
    public static int checksum(byte[] bytes) {
        InternetChecksum c = new InternetChecksum();
        c.update(bytes, 0, bytes.length);
        return c.value();
    }
    public static byte[] ipv4UdpCheckedBytes(byte[] src, byte[] dst,
                                            int sport, int dport, byte[] payload) {
        if (src.length != 4 || dst.length != 4 || sport < 0 || sport > 65535
                || dport < 0 || dport > 65535 || payload.length > 65507)
            throw new IllegalArgumentException("ordinary IPv4/UDP bounds");
        int length = 8 + payload.length;
        byte[] b = new byte[12 + length];
        System.arraycopy(src, 0, b, 0, 4);
        System.arraycopy(dst, 0, b, 4, 4);
        b[9] = 17;
        put16(b, 10, length);
        put16(b, 12, sport);
        put16(b, 14, dport);
        put16(b, 16, length);
        System.arraycopy(payload, 0, b, 20, payload.length);
        int c = checksum(b);
        put16(b, 18, c == 0 ? 65535 : c);
        return b; // Pseudo-header plus UDP segment: not an IP packet for transmission.
    }
    static void put16(byte[] b, int p, int value) {
        b[p] = (byte)(value >>> 8); b[p + 1] = (byte)value;
    }
    static int reference(byte[] b) {
        long s = 0;
        for (int i = 0; i < b.length; i += 2)
            s += ((b[i] & 255) << 8) | (i + 1 < b.length ? b[i + 1] & 255 : 0);
        while (s > 65535) s = (s & 65535) + (s >>> 16);
        return (int)(~s & 65535);
    }
    static int checks;
    static void check(boolean b) { if (!b) throw new AssertionError(); checks++; }
    static void bad(Runnable r) {
        try { r.run(); throw new AssertionError("expected rejection"); }
        catch (IllegalArgumentException | IndexOutOfBoundsException e) { checks++; }
    }
    public static void main(String[] args) {
        check(checksum(new byte[0]) == 65535);
        check(checksum(new byte[]{1}) == 0xfeff);
        check(checksum(new byte[]{0,1,(byte)0xf2,3,(byte)0xf4,(byte)0xf5,(byte)0xf6,(byte)0xf7}) == 0x220d);
        check(checksum(new byte[]{-1,-1}) == 0);
        Random random = new Random(8293);
        for (int n = 0; n < 500; n++) {
            byte[] b = new byte[random.nextInt(2049)]; random.nextBytes(b);
            int expected = reference(b);
            check(checksum(b) == expected);
            for (int trial = 0; trial < 20; trial++) {
                int cut = random.nextInt(b.length + 1);
                InternetChecksum c = new InternetChecksum();
                c.update(b, 0, cut); c.value();
                c.update(b, cut, b.length - cut);
                check(c.value() == expected);
            }
        }
        byte[] src = {(byte)192,0,2,1}, dst = {(byte)198,51,100,2};
        byte[] packet = ipv4UdpCheckedBytes(src, dst, 1234, 5678, new byte[]{'h','i','!'});
        check(checksum(packet) == 0);
        for (int i = 0; i < packet.length; i++) for (int bit = 0; bit < 8; bit++) {
            byte[] changed = packet.clone(); changed[i] ^= (byte)(1 << bit);
            check(checksum(changed) != 0);
        }
        byte[] zero = ipv4UdpCheckedBytes(src,dst,1,2,new byte[2]);
        Arrays.fill(zero,18,20,(byte)0);
        int adjustment = checksum(zero);
        byte[] p = {(byte)(adjustment >>> 8),(byte)adjustment};
        byte[] mapped = ipv4UdpCheckedBytes(src,dst,1,2,p);
        check((mapped[18] & 255) == 255 && (mapped[19] & 255) == 255);
        check(checksum(mapped) == 0);
        check(checksum(ipv4UdpCheckedBytes(src,dst,0,65535,new byte[65507])) == 0);
        bad(() -> ipv4UdpCheckedBytes(src,dst,1,2,new byte[65508]));
        bad(() -> ipv4UdpCheckedBytes(new byte[16],dst,1,2,new byte[0]));
        bad(() -> ipv4UdpCheckedBytes(src,dst,-1,2,new byte[0]));
        bad(() -> new InternetChecksum().update(new byte[1],0,2));
        System.out.println("InternetChecksum PASS " + checks + "; arithmetic only, no packets sent");
    }
}

