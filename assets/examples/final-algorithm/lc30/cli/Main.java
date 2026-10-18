import java.util.*;

public class Main {
    public static List<Integer> solve(String s, String[] words) {
        return new Solution().findSubstring(s, words);
    }
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String s = sc.nextLine();
        String line = sc.nextLine().trim();
        String[] words = line.isEmpty() ? new String[0] : line.split("\\s+");
        List<Integer> answer = solve(s, words);
        StringJoiner output = new StringJoiner(" ");
        for (int index : answer) output.add(Integer.toString(index));
        System.out.println(output);
    }
}

class Solution {
    public List<Integer> findSubstring(String s, String[] words) {
        List<Integer> answer = new ArrayList<>();
        if (s == null || words == null || words.length == 0) return answer;

        int wordLength = Objects.requireNonNull(words[0]).length();
        if (wordLength == 0) throw new IllegalArgumentException("nonempty words");
        for (String w : words) {
            if (Objects.requireNonNull(w).length() != wordLength) {
                throw new IllegalArgumentException("equal word lengths");
            }
        }
        int wordCount = words.length;
        long totalLength = (long)wordLength * wordCount;
        if (s.length() < totalLength) return answer;

        Map<String, Integer> need = new HashMap<>();
        for (String word : words) {
            need.merge(word, 1, Integer::sum);
        }

        // 不同 offset 代表不同的“按单词长度对齐方式”。
        for (int offset = 0; offset < wordLength; offset++) {
            int left = offset;
            int usedWords = 0;
            Map<String, Integer> window = new HashMap<>();

            for (int right = offset; right <= s.length() - wordLength; right += wordLength) {
                String word = s.substring(right, right + wordLength);

                if (!need.containsKey(word)) {
                    // 只移出当前活动窗口内的词，不扫描 HashMap 保留容量。
                    while (usedWords > 0) {
                        String outgoing = s.substring(left, left + wordLength);
                        decrement(window, outgoing);
                        left += wordLength;
                        usedWords--;
                    }
                    usedWords = 0;
                    left = right + wordLength;
                    continue;
                }

                window.merge(word, 1, Integer::sum);
                usedWords++;

                // 当前单词出现过多，左侧按完整单词收缩。
                while (window.get(word) > need.get(word)) {
                    String outgoing = s.substring(left, left + wordLength);
                    decrement(window, outgoing);
                    left += wordLength;
                    usedWords--;
                }

                if (usedWords == wordCount) {
                    answer.add(left);

                    // 主动移出最左单词，继续寻找可能重叠的下一个答案。
                    String outgoing = s.substring(left, left + wordLength);
                    decrement(window, outgoing);
                    left += wordLength;
                    usedWords--;
                }
            }
        }

        return answer;
    }
    private static void decrement(Map<String, Integer> counts, String word) {
        int count = counts.get(word);
        if (count == 1) counts.remove(word);
        else counts.put(word, count - 1);
    }
}
