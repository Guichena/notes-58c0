import java.util.*;

public class Main {
    static List<List<Integer>> res = new ArrayList<>();
    static List<Integer> path = new ArrayList<>();

    public static List<List<Integer>> permuteUnique(int[] nums) {
        res = new ArrayList<>();
        path.clear();
        Arrays.sort(nums); // 先排序，方便去重
        boolean[] used = new boolean[nums.length];
        backtrack(nums, used);
        return res;
    }

    static void backtrack(int[] nums, boolean[] used) {
        if (path.size() == nums.length) {
            res.add(new ArrayList<>(path));
            return;
        }
        for (int i = 0; i < nums.length; i++) {
            if (used[i]) continue;
            // 前一个相等下标尚不在当前路径，先选后一个会重复；固定同值下标递增使用。
            if (i > 0 && nums[i] == nums[i - 1] && !used[i - 1]) continue;
            used[i] = true;
            path.add(nums[i]);
            backtrack(nums, used);
            path.remove(path.size() - 1);
            used[i] = false;
        }
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();
        List<List<Integer>> ans = permuteUnique(nums);
        for (List<Integer> list : ans) {
            System.out.println(list);
        }
    }
}
