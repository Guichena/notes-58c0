import java.util.*;

class Solution {
    public List<List<Integer>> permuteUnique(int[] nums) {
        Arrays.sort(nums);

        List<List<Integer>> answer = new ArrayList<>();
        List<Integer> path = new ArrayList<>();
        boolean[] used = new boolean[nums.length];

        backtrack(nums, used, path, answer);
        return answer;
    }

    private void backtrack(int[] nums, boolean[] used,
                           List<Integer> path, List<List<Integer>> answer) {
        if (path.size() == nums.length) {
            answer.add(new ArrayList<>(path));
            return;
        }

        for (int i = 0; i < nums.length; i++) {
            if (used[i]) continue;

            // 前一个相等下标尚不在当前路径，先选后一个会重复；固定同值下标递增使用。
            if (i > 0 && nums[i] == nums[i - 1] && !used[i - 1]) {
                continue;
            }

            used[i] = true;
            path.add(nums[i]);

            backtrack(nums, used, path, answer);

            path.remove(path.size() - 1);
            used[i] = false;
        }
    }
}
