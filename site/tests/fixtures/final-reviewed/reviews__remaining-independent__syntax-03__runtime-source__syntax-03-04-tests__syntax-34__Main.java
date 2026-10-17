import java.io.*;
import java.util.*;

public class Main {
    static class FastScanner {
        private final BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        private StringTokenizer st;

        String next() throws IOException {
            while (st == null || !st.hasMoreTokens()) {
                String line = br.readLine();
                if (line == null) return null;
                st = new StringTokenizer(line);
            }
            return st.nextToken();
        }

        int nextInt() throws IOException {
            String token = next();
            if (token == null) throw new EOFException("expected number");
            return Integer.parseInt(token);
        }

        long nextLong() throws IOException {
            String token = next();
            if (token == null) throw new EOFException("expected number");
            return Long.parseLong(token);
        }

        double nextDouble() throws IOException {
            String token = next();
            if (token == null) throw new EOFException("expected number");
            return Double.parseDouble(token);
        }
    }

    public static void main(String[] args) throws Exception {
        FastScanner fs = new FastScanner();
        StringBuilder out = new StringBuilder();

        // 示例：读取 n 和数组
        int n = fs.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) {
            nums[i] = fs.nextInt();
        }

        // 在这里写解法，答案追加到 out

        System.out.print(out.toString());
    }
}