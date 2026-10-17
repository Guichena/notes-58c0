import java.util.HashMap;
import java.util.Map;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> mp = new HashMap<>();

        for (int i = 0; i < nums.length; i++) {
            long need = (long) target - nums[i];

            if (need >= Integer.MIN_VALUE && need <= Integer.MAX_VALUE
                    && mp.containsKey((int) need)) {
                return new int[]{mp.get((int) need), i};
            }

            mp.put(nums[i], i);
        }

        return new int[0];
    }
}