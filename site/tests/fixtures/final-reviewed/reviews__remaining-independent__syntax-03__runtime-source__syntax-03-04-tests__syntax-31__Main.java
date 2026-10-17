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
    }

    public static void main(String[] args) throws Exception {
        FastScanner fs = new FastScanner();

        int n = fs.nextInt();
        int target = fs.nextInt();

        int[] nums = new int[n];
        for (int i = 0; i < n; i++) {
            nums[i] = fs.nextInt();
        }

        int[] ans = twoSum(nums, target);
        if (ans.length == 2) {
            System.out.println(ans[0] + " " + ans[1]);
        }
    }

    static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();

        for (int i = 0; i < nums.length; i++) {
            long need = (long) target - nums[i];
            if (need >= Integer.MIN_VALUE && need <= Integer.MAX_VALUE
                    && map.containsKey((int) need)) {
                return new int[]{map.get((int) need), i};
            }
            map.put(nums[i], i);
        }

        return new int[0];
    }
}