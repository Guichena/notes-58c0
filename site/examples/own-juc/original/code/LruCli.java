import java.io.*;

/** Teaching input format is documented in the reader; this is not an inferred judge format. */
public final class LruCli {
    public static void main(String[] args) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String first = reader.readLine();
        if (first == null) throw new IllegalArgumentException("capacity missing");
        LruCache<String, String> cache = new LruCache<>(Integer.parseInt(first.trim()));
        for (String line; (line = reader.readLine()) != null;) {
            if (line.isBlank()) continue;
            String[] fields = line.trim().split("\\s+");
            switch (fields[0]) {
                case "GET" -> {
                    if (fields.length != 2) throw new IllegalArgumentException("GET key");
                    String value = cache.get(fields[1]); System.out.println(value == null ? "NULL" : value);
                }
                case "PUT" -> {
                    if (fields.length != 3) throw new IllegalArgumentException("PUT key value");
                    cache.put(fields[1], fields[2]);
                }
                case "EVICT" -> {
                    if (fields.length != 2) throw new IllegalArgumentException("EVICT n");
                    System.out.println(cache.evict(Integer.parseInt(fields[1])));
                }
                default -> throw new IllegalArgumentException("unknown command");
            }
        }
    }
}
