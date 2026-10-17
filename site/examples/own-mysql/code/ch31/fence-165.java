import java.util.Arrays;
/** Teaching router: stable logical bucket, immutable physical-owner map; no migration engine. */
public final class ShardRouting {
    private final int[] owners;
    public ShardRouting(int[] owners) {
        if(owners.length==0 || Arrays.stream(owners).anyMatch(x->x<0)) throw new IllegalArgumentException("bad owners");
        this.owners=owners.clone();
    }
    public static long mix(long x) {
        x=(x^(x>>>33))*0xff51afd7ed558ccdL;
        x=(x^(x>>>33))*0xc4ceb9fe1a85ec53L;
        return x^(x>>>33);
    }
    public int bucket(long stableId) { return (int)Math.floorMod(mix(stableId),(long)owners.length); }
    public int owner(long stableId) { return owners[bucket(stableId)]; }
    public ShardRouting movedBucket(int bucket,int newOwner) {
        if(bucket<0 || bucket>=owners.length || newOwner<0) throw new IllegalArgumentException("bad move");
        int[] copy=owners.clone(); copy[bucket]=newOwner; return new ShardRouting(copy);
    }
}
