;
const TRACES = (() => {
/* ==========================================================================
   算法逐步演示（第 1 部分：工具函数 + 哈希 / 双指针 / 滑窗 / 前缀和 / 字符串 / 数组 / 区间 / 矩阵）
   每个演示用小规模真实输入执行算法本身，逐帧记录状态；最后一帧带 ans，构建前会自动校验。
   说明文字支持 `代码` 与 **加粗** 两种标记。
   ========================================================================== */
const TRACES = {};
const T = (key, title, input, expect, run) => { TRACES[key] = { title, input, expect, run }; };
const A = (v, o = {}) => Object.assign({ t: 'arr' }, o, { v: v.slice() });
const M = (entries, o = {}) => Object.assign({ t: 'map' }, o, { e: entries.map((x) => (Array.isArray(x) ? [x[0], Array.isArray(x[1]) ? x[1].slice() : x[1]] : [x])) });
const S = (v, o = {}) => Object.assign({ t: 'stack' }, o, { v: v.slice() });
const Q = (v, o = {}) => Object.assign({ t: 'stack', q: true, label: '队列' }, o, { v: v.slice() });
const V = (...pairs) => ({ t: 'vars', v: pairs.filter(Boolean) });
const TX = (v, cls) => ({ t: 'text', v, cls });
const G = (g, o = {}) => Object.assign({ t: 'grid' }, o, { g: g.map((r) => r.slice()) });
const BARS = (v, o = {}) => Object.assign({ t: 'bars' }, o, { v: v.slice() });
const IV = (v, o = {}) => Object.assign({ t: 'iv' }, o, { v: v.map((x) => x.slice()) });
const hl = (...pairs) => { const o = {}; for (let i = 0; i < pairs.length; i += 2) [].concat(pairs[i]).forEach((k) => { if (k != null && k !== -1) o[k] = pairs[i + 1]; }); return o; };
const rng = (l, r, c, base) => { const o = Object.assign({}, base || {}); for (let i = l; i <= r; i++) o[i] = c; return o; };
const fmt = (a) => JSON.stringify(a).replace(/"/g, '');
// 链表：vals → 节点 [{k,v}] + next 映射
const LNODES = (vals, pre = 'n') => vals.map((v, i) => ({ k: pre + i, v }));
const LNEXT = (nodes) => { const nx = {}; nodes.forEach((n, i) => { nx[n.k] = nodes[i + 1] ? nodes[i + 1].k : null; }); return nx; };
const LST = (nodes, nx, o = {}) => Object.assign({ t: 'list' }, o, { n: nodes.slice(), nx: Object.assign({}, nx) });
// 二叉树：LeetCode 层序数组 → 带层序下标 i 的节点
function BT(arr) {
  if (!arr.length || arr[0] == null) return null;
  const root = { v: arr[0], i: 0, left: null, right: null };
  const q = [root]; let k = 1;
  while (q.length && k < arr.length) {
    const cur = q.shift();
    for (const side of ['left', 'right']) {
      if (k >= arr.length) break;
      if (arr[k] != null) { cur[side] = { v: arr[k], i: k, left: null, right: null }; q.push(cur[side]); }
      k++;
    }
  }
  return root;
}
const TREE = (v, o = {}) => Object.assign({ t: 'tree' }, o, { v: v.slice(), hl: Object.assign({}, o.hl || {}), tag: o.tag ? Object.assign({}, o.tag) : undefined });

/* ============================== 哈希 ============================== */
T('1', '一次遍历：先查补数，再登记自己', 'nums = [3,2,4,7,11], target = 11', [2, 3], (F) => {
  const nums = [3, 2, 4, 7, 11], target = 11, m = new Map();
  F({ cap: '从左到右扫描，哈希表记录 **值 → 下标**；每个数先查「我需要的另一半」是否出现过', blocks: [A(nums), M([])] });
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    F({ cap: `i=${i}：need = ${target} − ${nums[i]} = **${need}**，到表里查`, blocks: [A(nums, { hl: hl(i, 'cur'), p: { i } }), M([...m], { hl: need }), V(['need', need, 'cur'])] });
    if (m.has(need)) {
      const j = m.get(need);
      F({ cap: `命中：${need} 在下标 ${j} → 返回 **[${j}, ${i}]**，只扫了一遍`, blocks: [A(nums, { hl: hl([j, i], 'ok'), p: { i } }), M([...m], { hl: need, hlCls: 'ok' }), TX(`return [${j}, ${i}]`)], done: true, ans: [j, i] });
      return;
    }
    m.set(nums[i], i);
    F({ cap: `没找到 → 登记 \`${nums[i]} → ${i}\`（先查后放，避免和自己配对）`, blocks: [A(nums, { hl: hl(i, 'sel'), p: { i } }), M([...m], { hl: nums[i] })] });
  }
});

T('49', '排序后的字符串作 key，同 key 归为一组', 'strs = ["eat","tea","tan","ate","nat","bat"]', [['eat', 'tea', 'ate'], ['tan', 'nat'], ['bat']], (F) => {
  const strs = ['eat', 'tea', 'tan', 'ate', 'nat', 'bat'], m = new Map();
  F({ cap: '异位词排序后完全相同，所以用「排序后的字符串」当分组 key', blocks: [A(strs, { cw: 56 }), M([])] });
  strs.forEach((s, i) => {
    const key = s.split('').sort().join('');
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(s);
    F({ cap: `"${s}" 排序得 key = **"${key}"**，放进该组（getOrDefault / computeIfAbsent）`, blocks: [A(strs, { cw: 56, hl: hl(i, 'cur'), p: { i } }), M([...m], { hl: key })] });
  });
  const ans = [...m.values()];
  F({ cap: `遍历结束，哈希表的 values 就是答案：共 ${ans.length} 组`, blocks: [A(strs, { cw: 56, hl: rng(0, 5, 'ok') }), M([...m], { hl: [...m.keys()], hlCls: 'ok' })], done: true, ans });
});

T('128', '只从「序列起点」往后数，每个数最多被访问两次', 'nums = [100,4,200,1,3,2]', 4, (F) => {
  const nums = [100, 4, 200, 1, 3, 2], set = new Set(nums);
  let best = 0;
  F({ cap: '先全部放进 HashSet，之后 O(1) 判断存在', blocks: [A(nums), V(['best', 0])] });
  nums.forEach((x, i) => {
    if (set.has(x - 1)) { F({ cap: `${x}：存在 ${x - 1}，说明不是起点 → **跳过**（这是 O(n) 的关键）`, blocks: [A(nums, { hl: hl(i, 'dim'), p: { i } }), V(['best', best])] }); return; }
    let y = x, len = 1;
    const run = [i];
    F({ cap: `${x}：${x - 1} 不存在 → 它是某段连续序列的起点，开始往后数`, blocks: [A(nums, { hl: hl(i, 'cur'), p: { i } }), V(['cur', x, 'cur'], ['len', 1], ['best', best])] });
    while (set.has(y + 1)) {
      y++; len++;
      run.push(nums.indexOf(y));
      F({ cap: `找到 ${y}，长度 = ${len}`, blocks: [A(nums, { hl: hl(run, 'ok', i, 'cur'), p: { i } }), V(['cur', y, 'cur'], ['len', len], ['best', best])] });
    }
    best = Math.max(best, len);
    F({ cap: `以 ${x} 为起点的序列长度 ${len}，best = **${best}**`, blocks: [A(nums, { hl: hl(run, 'ok'), p: { i } }), V(['best', best, 'ok'])] });
  });
  F({ cap: `答案 **${best}**（1,2,3,4）。每个数只在「作为起点往后数」时被访问一次，总 O(n)`, blocks: [A(nums, { hl: hl([1, 3, 4, 5], 'ok') }), TX('return ' + best)], done: true, ans: best });
});

/* ============================== 双指针 ============================== */
T('283', '慢指针写、快指针读：非零元素依次交换到前面', 'nums = [0,1,0,3,12]', [1, 3, 12, 0, 0], (F) => {
  const a = [0, 1, 0, 3, 12];
  let slow = 0;
  F({ cap: '不变量：`[0, slow)` 全是非零且保持原顺序；`[slow, fast)` 全是 0', blocks: [A(a, { p: { slow: 0, fast: 0 } })] });
  for (let fast = 0; fast < a.length; fast++) {
    if (a[fast] !== 0) {
      [a[slow], a[fast]] = [a[fast], a[slow]];
      F({ cap: `a[${fast}] = ${a[slow]} ≠ 0 → 与 a[${slow}] 交换，slow++`, blocks: [A(a, { hl: Object.assign(rng(0, slow - 1, 'ok'), hl([slow, fast], 'cur')), p: { slow, fast } })] });
      slow++;
    } else {
      F({ cap: `a[${fast}] = 0 → 只移动 fast`, blocks: [A(a, { hl: Object.assign(rng(0, slow - 1, 'ok'), hl(fast, 'dim')), p: { slow, fast } })] });
    }
  }
  F({ cap: '完成：原地、稳定、只扫一遍', blocks: [A(a, { hl: Object.assign(rng(0, slow - 1, 'ok'), rng(slow, a.length - 1, 'dim')) })], done: true, ans: a.slice() });
});

T('11', '对撞指针：每次移动较短的那根板', 'height = [1,8,6,2,5,4,8,3,7]', 49, (F) => {
  const h = [1, 8, 6, 2, 5, 4, 8, 3, 7];
  let l = 0, r = h.length - 1, best = 0, bl = 0, br = 0;
  while (l < r) {
    const area = Math.min(h[l], h[r]) * (r - l);
    const nb = area > best;
    if (nb) { best = area; bl = l; br = r; }
    F({ cap: `面积 = min(${h[l]}, ${h[r]}) × (${r} − ${l}) = **${area}**${nb ? '，刷新最大值' : ''}。移动较短的 ${h[l] <= h[r] ? 'l' : 'r'}：留着它，宽度只会变小、高度也不会超过它`, blocks: [BARS(h, { hl: hl([l, r], 'cur'), p: { l, r }, area: [l, r, Math.min(h[l], h[r])] }), V(['area', area, nb ? 'ok' : ''], ['best', best, 'ok'])] });
    if (h[l] <= h[r]) l++; else r--;
  }
  F({ cap: `指针相遇，最大面积 **${best}**（下标 ${bl} 与 ${br}）`, blocks: [BARS(h, { hl: hl([bl, br], 'ok'), area: [bl, br, Math.min(h[bl], h[br])] }), TX('return ' + best)], done: true, ans: best });
});

T('15', '排序 + 固定一个数 + 对撞指针，三处去重', 'nums = [-1,0,1,2,-1,-4]', [[-1, -1, 2], [-1, 0, 1]], (F) => {
  const a = [-1, 0, 1, 2, -1, -4].sort((x, y) => x - y);
  const res = [];
  F({ cap: `先排序：${fmt(a)}，这样才能用对撞指针并方便跳过重复值`, blocks: [A(a), V(['结果', '[]'])] });
  for (let i = 0; i < a.length - 2; i++) {
    if (a[i] > 0) { F({ cap: `a[i] = ${a[i]} > 0，后面都更大，不可能凑出 0 → 结束`, blocks: [A(a, { hl: hl(i, 'bad'), p: { i } })] }); break; }
    if (i > 0 && a[i] === a[i - 1]) { F({ cap: `a[${i}] 与前一个相同 → 跳过，避免重复三元组`, blocks: [A(a, { hl: hl(i, 'dim'), p: { i } })] }); continue; }
    let l = i + 1, r = a.length - 1;
    while (l < r) {
      const s = a[i] + a[l] + a[r];
      if (s === 0) {
        res.push([a[i], a[l], a[r]]);
        F({ cap: `${a[i]} + ${a[l]} + ${a[r]} = 0 ✓ 记录；然后 l、r 同时跳过重复值`, blocks: [A(a, { hl: hl([i, l, r], 'ok'), p: { i, l, r } }), V(['sum', 0, 'ok'], ['结果', fmt(res)])] });
        while (l < r && a[l] === a[l + 1]) l++;
        while (l < r && a[r] === a[r - 1]) r--;
        l++; r--;
      } else {
        F({ cap: `sum = ${s} ${s < 0 ? '< 0 → 需要更大，l++' : '> 0 → 需要更小，r--'}`, blocks: [A(a, { hl: hl(i, 'cur', [l, r], 'sel'), p: { i, l, r } }), V(['sum', s, s < 0 ? 'cur' : 'bad'], ['结果', fmt(res)])] });
        if (s < 0) l++; else r--;
      }
    }
  }
  F({ cap: `共 ${res.length} 个不重复三元组，时间 O(n²)`, blocks: [A(a), TX(fmt(res))], done: true, ans: res });
});

T('42', '双指针：哪边的最高挡板更矮，哪边的水位就确定了', 'height = [0,1,0,2,1,0,1,3,2,1,2,1]', 6, (F) => {
  const h = [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1], w = h.map(() => 0);
  let l = 0, r = h.length - 1, lm = 0, rm = 0, sum = 0;
  F({ cap: '每列能存的水 = min(左侧最高, 右侧最高) − 自身高度', blocks: [BARS(h, { p: { l, r }, water: w }), V(['lMax', 0], ['rMax', 0], ['sum', 0])] });
  while (l < r) {
    if (h[l] < h[r]) {
      lm = Math.max(lm, h[l]); w[l] = lm - h[l]; sum += w[l];
      F({ cap: `h[l]=${h[l]} < h[r]=${h[r]}：右边一定有比 lMax 更高的挡板，所以第 ${l} 列水位 = lMax = ${lm}，存水 **${w[l]}**`, blocks: [BARS(h, { hl: hl(l, 'cur'), p: { l, r }, water: w }), V(['lMax', lm, 'cur'], ['rMax', rm], ['sum', sum, 'ok'])] });
      l++;
    } else {
      rm = Math.max(rm, h[r]); w[r] = rm - h[r]; sum += w[r];
      F({ cap: `h[l]=${h[l]} ≥ h[r]=${h[r]}：左边足够高，第 ${r} 列水位 = rMax = ${rm}，存水 **${w[r]}**`, blocks: [BARS(h, { hl: hl(r, 'warn'), p: { l, r }, water: w }), V(['lMax', lm], ['rMax', rm, 'cur'], ['sum', sum, 'ok'])] });
      r--;
    }
  }
  F({ cap: `相遇，总积水 **${sum}**；O(n) 时间 O(1) 空间`, blocks: [BARS(h, { water: w }), TX('return ' + sum)], done: true, ans: sum });
});

T('88', '从后往前填：大的先放到末尾，不会覆盖未处理元素', 'nums1 = [1,2,3,0,0,0], m = 3, nums2 = [2,5,6], n = 3', [1, 2, 2, 3, 5, 6], (F) => {
  const a = [1, 2, 3, 0, 0, 0], b = [2, 5, 6];
  let i = 2, j = 2, k = 5;
  F({ cap: 'nums1 尾部有空位，从后往前比较两数组的最大值', blocks: [A(a, { id: 'a', label: 'nums1', p: { i, k } }), A(b, { id: 'b', label: 'nums2', p: { j } })] });
  while (j >= 0) {
    if (i >= 0 && a[i] > b[j]) {
      a[k] = a[i];
      F({ cap: `nums1[i]=${a[i]} > nums2[j]=${b[j]} → 放到 k=${k}`, blocks: [A(a, { id: 'a', label: 'nums1', hl: hl(k, 'ok', i, 'cur'), p: { i, k } }), A(b, { id: 'b', label: 'nums2', p: { j } })] });
      i--;
    } else {
      a[k] = b[j];
      F({ cap: `nums2[j]=${b[j]} ≥ ${i >= 0 ? 'nums1[i]=' + a[i] : '（nums1 已用完）'} → 放到 k=${k}`, blocks: [A(a, { id: 'a', label: 'nums1', hl: hl(k, 'ok'), p: { i: i >= 0 ? i : null, k } }), A(b, { id: 'b', label: 'nums2', hl: hl(j, 'cur'), p: { j } })] });
      j--;
    }
    k--;
  }
  F({ cap: 'nums2 用完即结束；nums1 剩余部分本来就在正确位置', blocks: [A(a, { id: 'a', label: 'nums1', hl: rng(0, 5, 'ok') })], done: true, ans: a.slice() });
});

T('611', '排序后固定最长边 c，用双指针数 a + b > c 的对数', 'nums = [2,2,3,4]', 3, (F) => {
  const a = [2, 2, 3, 4].sort((x, y) => x - y);
  let cnt = 0;
  for (let k = a.length - 1; k >= 2; k--) {
    let l = 0, r = k - 1;
    while (l < r) {
      if (a[l] + a[r] > a[k]) {
        cnt += r - l;
        F({ cap: `${a[l]} + ${a[r]} > ${a[k]}：l 换成 [l, r) 中任何数都更大，一次计入 **${r - l}** 个，然后 r--`, blocks: [A(a, { hl: Object.assign(rng(l, r - 1, 'ok'), hl(r, 'ok', k, 'cur')), p: { l, r, k } }), V(['count', cnt, 'ok'])] });
        r--;
      } else {
        F({ cap: `${a[l]} + ${a[r]} ≤ ${a[k]}：需要更大的 a[l]，l++`, blocks: [A(a, { hl: hl([l, r], 'sel', k, 'cur'), p: { l, r, k } }), V(['count', cnt])] });
        l++;
      }
    }
  }
  F({ cap: `共 **${cnt}** 组能构成三角形，O(n²)`, blocks: [A(a), TX('return ' + cnt)], done: true, ans: cnt });
});

T('977', '两端平方最大：从后往前填结果数组', 'nums = [-4,-1,0,3,10]', [0, 1, 9, 16, 100], (F) => {
  const a = [-4, -1, 0, 3, 10], res = [null, null, null, null, null];
  let l = 0, r = 4, k = 4;
  while (l <= r) {
    const L = a[l] * a[l], R = a[r] * a[r];
    if (L > R) { res[k] = L; F({ cap: `${a[l]}² = ${L} > ${a[r]}² = ${R} → 放到末尾位置 ${k}，l++`, blocks: [A(a, { id: 'a', label: 'nums', hl: hl(l, 'cur'), p: { l, r } }), A(res, { id: 'r', label: 'result', hl: hl(k, 'ok'), p: { k } })] }); l++; }
    else { res[k] = R; F({ cap: `${a[r]}² = ${R} ≥ ${a[l]}² = ${L} → 放到位置 ${k}，r--`, blocks: [A(a, { id: 'a', label: 'nums', hl: hl(r, 'cur'), p: { l, r } }), A(res, { id: 'r', label: 'result', hl: hl(k, 'ok'), p: { k } })] }); r--; }
    k--;
  }
  F({ cap: '结果天然有序，O(n)', blocks: [A(a, { id: 'a', label: 'nums' }), A(res, { id: 'r', label: 'result', hl: rng(0, 4, 'ok') })], done: true, ans: res.slice() });
});

T('125', '左右指针跳过非字母数字，忽略大小写比较', 's = "Ab,c;BA"', true, (F) => {
  const s = 'Ab,c;BA'.split('');
  let l = 0, r = s.length - 1;
  const ok = (c) => /[a-z0-9]/i.test(c);
  while (l < r) {
    if (!ok(s[l])) { F({ cap: `'${s[l]}' 不是字母数字 → l++`, blocks: [A(s, { hl: hl(l, 'dim'), p: { l, r } })] }); l++; continue; }
    if (!ok(s[r])) { F({ cap: `'${s[r]}' 不是字母数字 → r--`, blocks: [A(s, { hl: hl(r, 'dim'), p: { l, r } })] }); r--; continue; }
    const same = s[l].toLowerCase() === s[r].toLowerCase();
    F({ cap: `比较 '${s[l]}' 与 '${s[r]}'（忽略大小写）${same ? '相同 → 两边收缩' : '不同 → 不是回文'}`, blocks: [A(s, { hl: hl([l, r], same ? 'ok' : 'bad'), p: { l, r } })] });
    if (!same) { F({ cap: '返回 false', blocks: [A(s)], done: true, ans: false }); return; }
    l++; r--;
  }
  F({ cap: '指针相遇，全部匹配 → **true**', blocks: [A(s, { hl: hl([0, 1, 3, 5, 6], 'ok') }), TX('return true')], done: true, ans: true });
});

/* ============================== 滑动窗口 ============================== */
T('3', '窗口内无重复：遇到重复字符，左边界直接跳到它上次出现位置 + 1', 's = "abcabcbb"', 3, (F) => {
  const s = 'abcabcbb'.split(''), last = new Map();
  let l = 0, best = 0;
  for (let r = 0; r < s.length; r++) {
    const c = s[r];
    if (last.has(c) && last.get(c) >= l) {
      const nl = last.get(c) + 1;
      F({ cap: `'${c}' 上次出现在 ${last.get(c)}，在窗口内 → l 从 ${l} 跳到 **${nl}**`, blocks: [A(s, { hl: hl(last.get(c), 'bad', r, 'cur'), p: { l, r }, win: [l, r - 1] }), M([...last], { hl: c, hlCls: 'bad' }), V(['best', best])] });
      l = nl;
    }
    last.set(c, r);
    const len = r - l + 1;
    if (len > best) best = len;
    F({ cap: `窗口 [${l}, ${r}] = "${s.slice(l, r + 1).join('')}"，长度 ${len}${len === best ? '，best = ' + best : ''}`, blocks: [A(s, { hl: hl(r, 'cur'), p: { l, r }, win: [l, r], winCls: 'ok' }), M([...last], { hl: c }), V(['len', len], ['best', best, 'ok'])] });
  }
  F({ cap: `最长无重复子串长度 **${best}**；每个下标最多进出窗口一次`, blocks: [A(s), TX('return ' + best)], done: true, ans: best });
});

T('438', '固定长度窗口，维护字符计数差', 's = "cbaebabacd", p = "abc"', [0, 6], (F) => {
  const s = 'cbaebabacd'.split(''), k = 3;
  const need = { a: 1, b: 1, c: 1 }, win = {};
  const res = [];
  const eq = () => Object.keys(need).every((ch) => (win[ch] || 0) === need[ch]) && Object.keys(win).every((ch) => !win[ch] || need[ch]);
  for (let r = 0; r < s.length; r++) {
    win[s[r]] = (win[s[r]] || 0) + 1;
    const l = r - k + 1;
    if (l > 0) win[s[l - 1]]--;
    if (l >= 0) {
      const match = eq();
      if (match) res.push(l);
      F({ cap: `窗口 [${l}, ${r}] = "${s.slice(l, r + 1).join('')}"：计数${match ? '与 p 完全一致 → 记录起点 **' + l + '**' : '不一致'}`, blocks: [A(s, { p: { l, r }, win: [l, r], winCls: match ? 'ok' : '' }), M(Object.entries(win).filter((x) => x[1]), { label: '窗口计数' }), M(Object.entries(need), { id: 'need', label: 'p 的计数' }), V(['结果', fmt(res)])] });
    } else {
      F({ cap: `先把窗口扩到长度 ${k}：加入 '${s[r]}'`, blocks: [A(s, { p: { r }, win: [0, r] }), M(Object.entries(win).filter((x) => x[1]), { label: '窗口计数' }), M(Object.entries(need), { id: 'need', label: 'p 的计数' })] });
    }
  }
  F({ cap: `所有异位词起点：**${fmt(res)}**，O(n·Σ)`, blocks: [A(s, { hl: hl([0, 1, 2, 6, 7, 8], 'ok') }), TX(fmt(res))], done: true, ans: res });
});

T('904', '窗口内最多两种水果：超了就收缩左边界', 'fruits = [1,2,1,2,3,3,2]', 4, (F) => {
  const a = [1, 2, 1, 2, 3, 3, 2], cnt = new Map();
  let l = 0, best = 0;
  for (let r = 0; r < a.length; r++) {
    cnt.set(a[r], (cnt.get(a[r]) || 0) + 1);
    while (cnt.size > 2) {
      F({ cap: `加入 ${a[r]} 后有 ${cnt.size} 种 → 移出 a[${l}] = ${a[l]}`, blocks: [A(a, { hl: hl(l, 'bad'), p: { l, r }, win: [l, r], winCls: 'bad' }), M([...cnt], { label: '种类 → 个数', hl: a[l], hlCls: 'bad' }), V(['best', best])] });
      cnt.set(a[l], cnt.get(a[l]) - 1);
      if (cnt.get(a[l]) === 0) cnt.delete(a[l]);
      l++;
    }
    best = Math.max(best, r - l + 1);
    F({ cap: `窗口 [${l}, ${r}] 合法，长度 ${r - l + 1}，best = **${best}**`, blocks: [A(a, { hl: hl(r, 'cur'), p: { l, r }, win: [l, r], winCls: 'ok' }), M([...cnt], { label: '种类 → 个数' }), V(['best', best, 'ok'])] });
  }
  F({ cap: `最多采摘 **${best}** 个`, blocks: [A(a), TX('return ' + best)], done: true, ans: best });
});

/* ============================== 前缀和 ============================== */
T('560', '前缀和 + 哈希：找之前出现过多少个 sum − k', 'nums = [1,2,1,-1,2], k = 3', 3, (F) => {
  const a = [1, 2, 1, -1, 2], k = 3, m = new Map([[0, 1]]);
  let sum = 0, cnt = 0;
  F({ cap: '区间和 = prefix[j] − prefix[i]；预置 `0 → 1` 表示「从下标 0 开始的子数组」', blocks: [A(a), M([...m], { label: '前缀和 → 出现次数' }), V(['sum', 0], ['count', 0])] });
  a.forEach((x, i) => {
    sum += x;
    const need = sum - k, c = m.get(need) || 0;
    cnt += c;
    F({ cap: `i=${i}：sum = ${sum}，查 sum − k = **${need}** 出现 ${c} 次 → count += ${c}`, blocks: [A(a, { p: { i }, win: [0, i] }), M([...m], { label: '前缀和 → 出现次数', hl: need, hlCls: c ? 'ok' : 'cur' }), V(['sum', sum, 'cur'], ['need', need], ['count', cnt, c ? 'ok' : ''])] });
    m.set(sum, (m.get(sum) || 0) + 1);
  });
  F({ cap: `共 **${cnt}** 个和为 ${k} 的子数组；负数也成立（滑窗做不到）`, blocks: [A(a), TX('return ' + cnt)], done: true, ans: cnt });
});

T('862', '前缀和 + 单调递增双端队列', 'nums = [2,-1,2], k = 3', 3, (F) => {
  const a = [2, -1, 2], k = 3, P = [0];
  a.forEach((x) => P.push(P[P.length - 1] + x));
  const dq = [];
  let best = Infinity;
  F({ cap: `前缀和 P = ${fmt(P)}；求最短 j − i 使 P[j] − P[i] ≥ k`, blocks: [A(P, { label: '前缀和 P' }), S([], { label: '队列（存下标，P 单调递增）', q: true })] });
  for (let j = 0; j < P.length; j++) {
    while (dq.length && P[j] - P[dq[0]] >= k) {
      best = Math.min(best, j - dq[0]);
      F({ cap: `P[${j}] − P[${dq[0]}] = ${P[j] - P[dq[0]]} ≥ ${k} → 长度 ${j - dq[0]}，更新答案并弹出队首（之后的 j 只会更长）`, blocks: [A(P, { label: '前缀和 P', hl: hl(j, 'cur', dq[0], 'ok'), p: { j } }), S(dq, { label: '队列', q: true, hl: hl(0, 'ok') }), V(['best', best, 'ok'])] });
      dq.shift();
    }
    while (dq.length && P[dq[dq.length - 1]] >= P[j]) {
      F({ cap: `P[${dq[dq.length - 1]}] ≥ P[${j}]：更晚且更小的 j 做左端点一定更优 → 弹出队尾`, blocks: [A(P, { label: '前缀和 P', hl: hl(j, 'cur', dq[dq.length - 1], 'bad'), p: { j } }), S(dq, { label: '队列', q: true, hl: hl(dq.length - 1, 'bad') })] });
      dq.pop();
    }
    dq.push(j);
    F({ cap: `下标 ${j} 入队`, blocks: [A(P, { label: '前缀和 P', hl: hl(j, 'cur'), p: { j } }), S(dq, { label: '队列', q: true, hl: hl(dq.length - 1, 'cur') }), V(['best', best === Infinity ? '∞' : best])] });
  }
  const ans = best === Infinity ? -1 : best;
  F({ cap: `最短长度 **${ans}**；每个下标最多进出队一次，O(n)`, blocks: [A(P, { label: '前缀和 P' }), TX('return ' + ans)], done: true, ans });
});

/* ============================== 子串 ============================== */
T('239', '单调递减队列：队首永远是窗口最大值', 'nums = [1,3,-1,-3,5,3,6,7], k = 3', [3, 3, 5, 5, 6, 7], (F) => {
  const a = [1, 3, -1, -3, 5, 3, 6, 7], k = 3, dq = [], res = [];
  for (let i = 0; i < a.length; i++) {
    while (dq.length && a[dq[dq.length - 1]] <= a[i]) {
      F({ cap: `a[${i}] = ${a[i]} ≥ 队尾 a[${dq[dq.length - 1]}] = ${a[dq[dq.length - 1]]}：队尾不可能再成为最大值 → 弹出`, blocks: [A(a, { hl: hl(i, 'cur', dq[dq.length - 1], 'bad'), p: { i }, win: [Math.max(0, i - k + 1), i] }), S(dq.map((x) => `${x}:${a[x]}`), { label: '队列（下标:值）', q: true, hl: hl(dq.length - 1, 'bad') }), V(['结果', fmt(res)])] });
      dq.pop();
    }
    dq.push(i);
    if (dq[0] <= i - k) dq.shift();
    if (i >= k - 1) res.push(a[dq[0]]);
    F({ cap: i >= k - 1 ? `窗口 [${i - k + 1}, ${i}] 的最大值 = 队首 a[${dq[0]}] = **${a[dq[0]]}**` : `下标 ${i} 入队，窗口还没满`, blocks: [A(a, { hl: hl(dq[0], 'ok', i, 'cur'), p: { i }, win: [Math.max(0, i - k + 1), i] }), S(dq.map((x) => `${x}:${a[x]}`), { label: '队列（下标:值）', q: true, hl: hl(0, 'ok') }), V(['结果', fmt(res), 'ok'])] });
  }
  F({ cap: `结果 ${fmt(res)}；每个下标进出队列各一次，O(n)`, blocks: [A(a), TX(fmt(res))], done: true, ans: res });
});

T('76', '右扩到覆盖全部需求，再左缩到不能再缩', 's = "ADOBECODEBANC", t = "ABC"', 'BANC', (F) => {
  const s = 'ADOBECODEBANC'.split(''), need = { A: 1, B: 1, C: 1 }, win = {};
  let l = 0, formed = 0, best = [Infinity, 0, 0];
  const req = 3;
  for (let r = 0; r < s.length; r++) {
    const c = s[r];
    win[c] = (win[c] || 0) + 1;
    if (need[c] && win[c] === need[c]) formed++;
    if (formed < req) { F({ cap: `加入 '${c}'，已满足 ${formed}/${req} 种需求，继续右扩`, blocks: [A(s, { hl: hl(r, 'cur'), p: { l, r }, win: [l, r] }), M(Object.entries(need).map(([k2, v]) => [k2, `${win[k2] || 0}/${v}`]), { label: '需求 已有/需要', hl: need[c] ? c : null }), V(['formed', formed + '/3'], ['best', best[0] === Infinity ? '—' : s.slice(best[1], best[2] + 1).join('')])] }); continue; }
    while (formed === req) {
      if (r - l + 1 < best[0]) best = [r - l + 1, l, r];
      F({ cap: `[${l}, ${r}] = "${s.slice(l, r + 1).join('')}" 覆盖了 t，长度 ${r - l + 1}${best[1] === l && best[2] === r ? '，刷新最短' : ''} → 尝试移出 '${s[l]}'`, blocks: [A(s, { hl: hl(l, 'warn'), p: { l, r }, win: [l, r], winCls: 'ok' }), M(Object.entries(need).map(([k2, v]) => [k2, `${win[k2] || 0}/${v}`]), { label: '需求 已有/需要', hl: need[s[l]] ? s[l] : null }), V(['formed', '3/3', 'ok'], ['best', s.slice(best[1], best[2] + 1).join(''), 'ok'])] });
      const lc = s[l];
      win[lc]--;
      if (need[lc] && win[lc] < need[lc]) formed--;
      l++;
    }
  }
  const ans = s.slice(best[1], best[2] + 1).join('');
  F({ cap: `最小覆盖子串 **"${ans}"**；l、r 都只向右走，O(|s| + |t|)`, blocks: [A(s, { win: [best[1], best[2]], winCls: 'ok', hl: rng(best[1], best[2], 'ok') }), TX(`return "${ans}"`)], done: true, ans });
});

/* ============================== 字符串 ============================== */
T('415', '从个位开始逐位相加，维护进位', 'num1 = "456", num2 = "77"', '533', (F) => {
  const a = '456'.split(''), b = '77'.split('');
  let i = a.length - 1, j = b.length - 1, carry = 0;
  const out = [];
  while (i >= 0 || j >= 0 || carry) {
    const x = i >= 0 ? +a[i] : 0, y = j >= 0 ? +b[j] : 0, s = x + y + carry;
    out.unshift(s % 10);
    F({ cap: `${x} + ${y} + 进位 ${carry} = ${s} → 写 **${s % 10}**，进位 ${Math.floor(s / 10)}`, blocks: [A(a, { id: 'a', label: 'num1', hl: hl(i, 'cur'), p: { i: i >= 0 ? i : null } }), A(b, { id: 'b', label: 'num2', hl: hl(j, 'cur'), p: { j: j >= 0 ? j : null } }), A(out, { id: 'o', label: '结果（头插 / 最后反转）', hl: hl(0, 'ok') }), V(['carry', Math.floor(s / 10)])] });
    carry = Math.floor(s / 10); i--; j--;
  }
  const ans = out.join('');
  F({ cap: `结果 **"${ans}"**；实际写法用 StringBuilder 追加后 reverse`, blocks: [A(out, { id: 'o', label: '结果', hl: rng(0, out.length - 1, 'ok') })], done: true, ans });
});

T('8', '状态机：跳空格 → 读符号 → 读数字 → 溢出截断', 's = "   -042abc"', -42, (F) => {
  const s = '   -042abc'.split('');
  let i = 0, sign = 1, num = 0;
  while (i < s.length && s[i] === ' ') { F({ cap: `跳过前导空格（下标 ${i}）`, blocks: [A(s, { hl: hl(i, 'dim'), p: { i } }), V(['sign', sign], ['num', num])] }); i++; }
  if (s[i] === '-' || s[i] === '+') { sign = s[i] === '-' ? -1 : 1; F({ cap: `读到符号 '${s[i]}' → sign = ${sign}`, blocks: [A(s, { hl: hl(i, 'cur'), p: { i } }), V(['sign', sign, 'cur'], ['num', num])] }); i++; }
  while (i < s.length && /\d/.test(s[i])) {
    num = num * 10 + (+s[i]);
    F({ cap: `数字 '${s[i]}'：num = num × 10 + ${s[i]} = ${num}（真实代码先判断是否会超过 Integer.MAX_VALUE）`, blocks: [A(s, { hl: rng(0, i, 'ok'), p: { i } }), V(['sign', sign], ['num', num, 'ok'])] });
    i++;
  }
  F({ cap: `遇到非数字 '${s[i]}' → 停止。结果 **${sign * num}**`, blocks: [A(s, { hl: hl(i, 'bad'), p: { i } }), TX('return ' + sign * num)], done: true, ans: sign * num });
});

T('43', 'num1[i] × num2[j] 的结果落在 res[i+j] 与 res[i+j+1]', 'num1 = "123", num2 = "45"', '5535', (F) => {
  const a = '123', b = '45', res = Array(a.length + b.length).fill(0);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const mul = +a[i] * +b[j], sum = mul + res[i + j + 1];
      res[i + j + 1] = sum % 10;
      res[i + j] += Math.floor(sum / 10);
      F({ cap: `${a[i]} × ${b[j]} = ${mul}，加上 res[${i + j + 1}] 原值得 ${sum} → res[${i + j + 1}] = ${sum % 10}，进位 ${Math.floor(sum / 10)} 加到 res[${i + j}]`, blocks: [A(a.split(''), { id: 'a', label: 'num1', hl: hl(i, 'cur'), p: { i } }), A(b.split(''), { id: 'b', label: 'num2', hl: hl(j, 'cur'), p: { j } }), A(res, { id: 'r', label: 'res（长度 m+n）', hl: hl(i + j + 1, 'ok', i + j, 'warn') })] });
    }
  }
  const ans = res.join('').replace(/^0+(?=\d)/, '');
  F({ cap: `去掉前导 0 得 **"${ans}"**；O(m·n)`, blocks: [A(res, { id: 'r', label: 'res', hl: rng(0, res.length - 1, 'ok') }), TX(`"${ans}"`)], done: true, ans });
});

T('151', '从后往前扫出每个单词，跳过多余空格', 's = "  the sky  is blue "', 'blue is sky the', (F) => {
  const s = '  the sky  is blue ';
  const ch = s.split('').map((c) => (c === ' ' ? '␣' : c));
  const words = [];
  let i = s.length - 1;
  while (i >= 0) {
    while (i >= 0 && s[i] === ' ') i--;
    if (i < 0) break;
    const end = i;
    while (i >= 0 && s[i] !== ' ') i--;
    words.push(s.slice(i + 1, end + 1));
    F({ cap: `找到单词 [${i + 1}, ${end}] = "${s.slice(i + 1, end + 1)}"，追加到结果`, blocks: [A(ch, { cw: 30, win: [i + 1, end], winCls: 'ok', p: { i: Math.max(i, 0), end } }), V(['结果', '"' + words.join(' ') + '"', 'ok'])] });
  }
  const ans = words.join(' ');
  F({ cap: `结果 **"${ans}"**（Java 中 StringBuilder 拼接，单词间只放一个空格）`, blocks: [A(ch, { cw: 30 }), TX(`"${ans}"`)], done: true, ans });
});

T('165', '双指针逐段解析整数比较，忽略前导 0', 'version1 = "1.01.3", version2 = "1.001.2"', 1, (F) => {
  const v1 = '1.01.3'.split('.').map(Number), v2 = '1.001.2'.split('.').map(Number);
  const r1 = '1.01.3'.split('.'), r2 = '1.001.2'.split('.');
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const x = v1[i] || 0, y = v2[i] || 0;
    F({ cap: `第 ${i + 1} 段："${r1[i]}" → ${x}，"${r2[i]}" → ${y}${x === y ? '，相等继续' : x > y ? '，前者大 → 返回 1' : '，后者大 → 返回 -1'}`, blocks: [A(r1, { id: 'a', label: 'version1', hl: hl(i, x === y ? 'ok' : 'cur') }), A(r2, { id: 'b', label: 'version2', hl: hl(i, x === y ? 'ok' : 'cur') })] });
    if (x !== y) { F({ cap: `返回 **${x > y ? 1 : -1}**；实现时边扫边累加数字，不用 split 也可以`, blocks: [TX('return ' + (x > y ? 1 : -1))], done: true, ans: x > y ? 1 : -1 }); return; }
  }
  F({ cap: '全部相等 → 0', blocks: [], done: true, ans: 0 });
});

/* ============================== 普通数组 ============================== */
T('53', 'Kadane：前面的和为负就丢掉，从当前重新开始', 'nums = [-2,1,-3,4,-1,2,1,-5,4]', 6, (F) => {
  const a = [-2, 1, -3, 4, -1, 2, 1, -5, 4];
  let cur = 0, best = -Infinity, st = 0, bs = 0, be = 0;
  a.forEach((x, i) => {
    let restart = false;
    if (cur < 0) { cur = x; st = i; restart = true; } else cur += x;
    if (cur > best) { best = cur; bs = st; be = i; }
    F({ cap: restart ? `之前的和为负，拖后腿 → 从 ${x} 重新开始，cur = ${cur}` : `cur = cur + ${x} = ${cur}`, blocks: [A(a, { hl: hl(i, 'cur'), p: { i }, win: [st, i], winCls: cur === best ? 'ok' : '' }), V(['cur', cur, 'cur'], ['best', best, 'ok'])] });
  });
  F({ cap: `最大子数组和 **${best}**，区间 [${bs}, ${be}]；dp[i] = max(dp[i−1] + x, x)`, blocks: [A(a, { win: [bs, be], winCls: 'ok', hl: rng(bs, be, 'ok') }), TX('return ' + best)], done: true, ans: best });
});

T('189', '三次反转：整体反转 → 反转前 k 个 → 反转后 n−k 个', 'nums = [1,2,3,4,5,6,7], k = 3', [5, 6, 7, 1, 2, 3, 4], (F) => {
  const a = [1, 2, 3, 4, 5, 6, 7], k = 3;
  const rev = (l, r, label) => {
    F({ cap: `${label}：反转区间 [${l}, ${r}]`, blocks: [A(a, { win: [l, r], p: { l, r } })] });
    while (l < r) { [a[l], a[r]] = [a[r], a[l]]; F({ cap: `交换 a[${l}] 与 a[${r}]`, blocks: [A(a, { win: [l, r], hl: hl([l, r], 'cur'), p: { l, r } })] }); l++; r--; }
  };
  rev(0, 6, '① 整体反转');
  rev(0, k - 1, '② 反转前 k=3 个');
  rev(k, 6, '③ 反转剩余部分');
  F({ cap: '完成：O(n) 时间、O(1) 空间（k 先对 n 取模）', blocks: [A(a, { hl: rng(0, 6, 'ok') })], done: true, ans: a.slice() });
});

T('238', '左侧乘积 × 右侧乘积，不用除法', 'nums = [1,2,3,4]', [24, 12, 8, 6], (F) => {
  const a = [1, 2, 3, 4], n = 4, ans = Array(n).fill(1);
  for (let i = 1; i < n; i++) { ans[i] = ans[i - 1] * a[i - 1]; F({ cap: `第一遍：ans[${i}] = 左侧乘积 = ans[${i - 1}] × a[${i - 1}] = ${ans[i]}`, blocks: [A(a, { id: 'a', label: 'nums', win: [0, i - 1] }), A(ans, { id: 'r', label: 'ans', hl: hl(i, 'cur'), p: { i } })] }); }
  let R = 1;
  for (let i = n - 1; i >= 0; i--) { ans[i] *= R; F({ cap: `第二遍：ans[${i}] ×= 右侧乘积 R(${R}) → ${ans[i]}，然后 R ×= a[${i}]`, blocks: [A(a, { id: 'a', label: 'nums', win: i < n - 1 ? [i + 1, n - 1] : null, hl: hl(i, 'cur') }), A(ans, { id: 'r', label: 'ans', hl: hl(i, 'ok'), p: { i } }), V(['R', R * a[i]])] }); R *= a[i]; }
  F({ cap: `结果 ${fmt(ans)}；输出数组不计入额外空间，O(1)`, blocks: [A(ans, { id: 'r', label: 'ans', hl: rng(0, n - 1, 'ok') })], done: true, ans: ans.slice() });
});

T('41', '原地哈希：把值 v 交换到下标 v−1', 'nums = [3,4,-1,1]', 2, (F) => {
  const a = [3, 4, -1, 1], n = 4;
  F({ cap: '答案一定在 [1, n+1]；目标是让 a[i] == i+1', blocks: [A(a)] });
  for (let i = 0; i < n; i++) {
    while (a[i] > 0 && a[i] <= n && a[a[i] - 1] !== a[i]) {
      const v = a[i], j = v - 1;
      [a[i], a[j]] = [a[j], a[i]];
      F({ cap: `a[${i}] = ${v} 应该放在下标 ${j} → 交换`, blocks: [A(a, { hl: hl(j, 'ok', i, 'cur'), p: { i } })] });
    }
    F({ cap: `下标 ${i} 处理完（${a[i] > 0 && a[i] <= n ? '已归位或重复' : '越界值不管'}）`, blocks: [A(a, { hl: hl(i, a[i] === i + 1 ? 'ok' : 'dim'), p: { i } })] });
  }
  let ans = n + 1;
  for (let i = 0; i < n; i++) if (a[i] !== i + 1) { ans = i + 1; break; }
  F({ cap: `第一个 a[i] ≠ i+1 的位置是 ${ans - 1} → 缺失 **${ans}**`, blocks: [A(a, { hl: hl(ans - 1, 'bad'), p: { i: ans - 1 } }), TX('return ' + ans)], done: true, ans });
});

T('442', '取负标记：访问到已是负数的位置，说明出现了两次', 'nums = [4,3,2,7,8,2,3,1]', [2, 3], (F) => {
  const a = [4, 3, 2, 7, 8, 2, 3, 1], res = [];
  a.forEach((_, i) => {
    const v = Math.abs(a[i]), j = v - 1;
    if (a[j] < 0) { res.push(v); F({ cap: `|a[${i}]| = ${v}，a[${j}] 已经是负数 → ${v} 是重复的`, blocks: [A(a, { hl: hl(j, 'bad', i, 'cur'), p: { i } }), V(['结果', fmt(res), 'ok'])] }); }
    else { a[j] = -a[j]; F({ cap: `|a[${i}]| = ${v} → 把 a[${j}] 取负，标记「${v} 出现过」`, blocks: [A(a, { hl: hl(j, 'warn', i, 'cur'), p: { i } }), V(['结果', fmt(res)])] }); }
  });
  F({ cap: `重复元素 ${fmt(res)}；O(n) 时间 O(1) 额外空间`, blocks: [TX(fmt(res))], done: true, ans: res });
});

/* ============================== 区间 ============================== */
T('56', '按左端点排序，重叠就延长右端点', 'intervals = [[1,3],[8,10],[2,6],[15,18]]', [[1, 6], [8, 10], [15, 18]], (F) => {
  const iv = [[1, 3], [8, 10], [2, 6], [15, 18]].sort((x, y) => x[0] - y[0]);
  const out = [];
  F({ cap: '先按左端点排序，重叠的区间就一定相邻', blocks: [IV(iv, { out: [] })] });
  iv.forEach(([s, e], i) => {
    const last = out[out.length - 1];
    if (last && s <= last[1]) { last[1] = Math.max(last[1], e); F({ cap: `[${s},${e}] 的左端 ${s} ≤ 当前右端 → 合并，右端 = ${last[1]}`, blocks: [IV(iv, { hl: hl(i, 'cur'), out: out.map((x) => x.slice()) })] }); }
    else { out.push([s, e]); F({ cap: `[${s},${e}] 与上一段不重叠 → 新开一段`, blocks: [IV(iv, { hl: hl(i, 'cur'), out: out.map((x) => x.slice()) })] }); }
  });
  F({ cap: `结果 ${fmt(out)}，O(n log n)`, blocks: [IV(iv, { out: out.map((x) => x.slice()) })], done: true, ans: out.map((x) => x.slice()) });
});

T('228', '连续段：下一个数不等于当前 + 1 时收尾', 'nums = [0,1,2,4,5,7]', ['0->2', '4->5', '7'], (F) => {
  const a = [0, 1, 2, 4, 5, 7], res = [];
  let i = 0;
  while (i < a.length) {
    const st = i;
    while (i + 1 < a.length && a[i + 1] === a[i] + 1) i++;
    res.push(st === i ? `${a[st]}` : `${a[st]}->${a[i]}`);
    F({ cap: `从 ${a[st]} 开始连续到 ${a[i]} → "${res[res.length - 1]}"`, blocks: [A(a, { win: [st, i], winCls: 'ok', p: { st, i } }), V(['结果', res.join(', '), 'ok'])] });
    i++;
  }
  F({ cap: '一次遍历 O(n)', blocks: [TX(res.join(', '))], done: true, ans: res });
});

T('253', '按开始时间排序，最小堆记录各会议室的结束时间', 'intervals = [[0,30],[5,10],[15,20],[20,25]]', 2, (F) => {
  const iv = [[0, 30], [5, 10], [15, 20], [20, 25]].sort((x, y) => x[0] - y[0]);
  const heap = [];
  let best = 0;
  iv.forEach(([s, e], i) => {
    heap.sort((x, y) => x - y);
    if (heap.length && heap[0] <= s) { F({ cap: `会议 [${s},${e}]：最早结束的会议室在 ${heap[0]} 空出 ≤ ${s} → 复用（弹出堆顶）`, blocks: [IV(iv, { hl: hl(i, 'cur') }), S(heap, { label: '最小堆：各会议室结束时间', hl: hl(0, 'ok') }), V(['rooms', heap.length])] }); heap.shift(); }
    heap.push(e); heap.sort((x, y) => x - y);
    best = Math.max(best, heap.length);
    F({ cap: `把结束时间 ${e} 放入堆，当前占用 ${heap.length} 间`, blocks: [IV(iv, { hl: hl(i, 'ok') }), S(heap, { label: '最小堆：各会议室结束时间', hl: hl(heap.indexOf(e), 'cur') }), V(['rooms', heap.length, 'cur'], ['max', best, 'ok'])] });
  });
  F({ cap: `最少需要 **${best}** 间会议室；堆大小的峰值就是答案`, blocks: [IV(iv), TX('return ' + best)], done: true, ans: best });
});

/* ============================== 矩阵 ============================== */
T('73', '用第一行 / 第一列做标记位（另存它们自身是否含 0）', 'matrix = [[1,1,1],[1,0,1],[1,1,1]]', [[1, 0, 1], [0, 0, 0], [1, 0, 1]], (F) => {
  const g = [[1, 1, 1], [1, 0, 1], [1, 1, 1]];
  const zs = [];
  g.forEach((row, r) => row.forEach((v, c) => { if (!v) zs.push([r, c]); }));
  F({ cap: '找到 0 的位置 (1,1)；在第 0 行 / 第 0 列对应位置打标记', blocks: [G(g, { hl: { '1,1': 'bad' } })] });
  zs.forEach(([r, c]) => { g[r][0] = 0; g[0][c] = 0; });
  F({ cap: '标记：matrix[1][0] = 0、matrix[0][1] = 0', blocks: [G(g, { hl: { '1,0': 'warn', '0,1': 'warn', '1,1': 'bad' } })] });
  for (let r = 1; r < 3; r++) for (let c = 1; c < 3; c++) if (g[r][0] === 0 || g[0][c] === 0) g[r][c] = 0;
  F({ cap: '根据标记把内部格子置 0（第 0 行 / 列最后单独处理）', blocks: [G(g, { hl: { '1,1': 'bad', '1,2': 'cur', '2,1': 'cur' } })] });
  F({ cap: '第 0 行 / 列原本没有 0，保持不变。O(1) 额外空间', blocks: [G(g, { hl: { '0,1': 'ok', '1,0': 'ok', '1,1': 'ok', '1,2': 'ok', '2,1': 'ok' } })], done: true, ans: g.map((r) => r.slice()) });
});

T('54', '按层遍历：上 → 右 → 下 → 左，每走完一边收缩边界', 'matrix = [[1,2,3],[4,5,6],[7,8,9]]', [1, 2, 3, 6, 9, 8, 7, 4, 5], (F) => {
  const g = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
  let top = 0, bot = 2, left = 0, right = 2;
  const res = [], seen = {};
  const push = (r, c, why) => { res.push(g[r][c]); seen[r + ',' + c] = 'ok'; F({ cap: `${why}：取 ${g[r][c]}`, blocks: [G(g, { hl: Object.assign({}, seen, { [r + ',' + c]: 'cur' }) }), V(['top', top], ['bottom', bot], ['left', left], ['right', right]), A(res, { id: 'r', label: '输出', cw: 32 })] }); };
  while (top <= bot && left <= right) {
    for (let c = left; c <= right; c++) push(top, c, '上边从左到右');
    top++;
    for (let r = top; r <= bot; r++) push(r, right, '右边从上到下');
    right--;
    if (top <= bot) { for (let c = right; c >= left; c--) push(bot, c, '下边从右到左'); bot--; }
    if (left <= right) { for (let r = bot; r >= top; r--) push(r, left, '左边从下到上'); left++; }
  }
  F({ cap: `输出 ${fmt(res)}`, blocks: [G(g, { hl: seen }), A(res, { id: 'r', label: '输出', cw: 32, hl: rng(0, 8, 'ok') })], done: true, ans: res });
});

T('48', '顺时针 90° = 先沿主对角线转置，再左右翻转每一行', 'matrix = [[1,2,3],[4,5,6],[7,8,9]]', [[7, 4, 1], [8, 5, 2], [9, 6, 3]], (F) => {
  const g = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
  F({ cap: '原矩阵', blocks: [G(g)] });
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { [g[i][j], g[j][i]] = [g[j][i], g[i][j]]; F({ cap: `转置：交换 (${i},${j}) 与 (${j},${i})`, blocks: [G(g, { hl: { [i + ',' + j]: 'cur', [j + ',' + i]: 'cur' } })] }); }
  for (let i = 0; i < 3; i++) { g[i].reverse(); F({ cap: `翻转第 ${i} 行`, blocks: [G(g, { hl: { [i + ',0']: 'ok', [i + ',1']: 'ok', [i + ',2']: 'ok' } })] }); }
  F({ cap: '完成，原地 O(1) 空间', blocks: [G(g)], done: true, ans: g.map((r) => r.slice()) });
});

T('240', '从右上角出发：大了往左，小了往下', 'matrix 5×5，target = 5', true, (F) => {
  const g = [[1, 4, 7, 11, 15], [2, 5, 8, 12, 19], [3, 6, 9, 16, 22], [10, 13, 14, 17, 24], [18, 21, 23, 26, 30]];
  let r = 0, c = 4;
  const path = {};
  while (r < 5 && c >= 0) {
    const v = g[r][c];
    path[r + ',' + c] = 'dim';
    if (v === 5) { F({ cap: `g[${r}][${c}] = 5，找到`, blocks: [G(g, { hl: Object.assign({}, path, { [r + ',' + c]: 'ok' }), p: { '★': r + ',' + c } })], done: true, ans: true }); return; }
    F({ cap: `g[${r}][${c}] = ${v} ${v > 5 ? '> 5：这一列下面更大，整列排除 → 左移' : '< 5：这一行左边更小，整行排除 → 下移'}`, blocks: [G(g, { hl: Object.assign({}, path, { [r + ',' + c]: 'cur' }), p: { '●': r + ',' + c } })] });
    if (v > 5) c--; else r++;
  }
  F({ cap: '越界，未找到', blocks: [G(g, { hl: path })], done: true, ans: false });
});

T('498', '按对角线编号 d = r + c，奇偶决定方向', 'mat = [[1,2,3],[4,5,6],[7,8,9]]', [1, 2, 4, 7, 5, 3, 6, 8, 9], (F) => {
  const g = [[1, 2, 3], [4, 5, 6], [7, 8, 9]], res = [], seen = {};
  for (let d = 0; d <= 4; d++) {
    const cells = [];
    for (let r = 0; r < 3; r++) { const c = d - r; if (c >= 0 && c < 3) cells.push([r, c]); }
    if (d % 2 === 0) cells.reverse();
    cells.forEach(([r, c]) => { res.push(g[r][c]); seen[r + ',' + c] = 'ok'; });
    F({ cap: `对角线 d=${d}（${d % 2 === 0 ? '偶数：从左下往右上' : '奇数：从右上往左下'}）：${cells.map(([r, c]) => g[r][c]).join(' → ')}`, blocks: [G(g, { hl: Object.assign({}, seen, Object.fromEntries(cells.map(([r, c]) => [r + ',' + c, 'cur']))) }), A(res, { id: 'r', label: '输出', cw: 32 })] });
  }
  F({ cap: `输出 ${fmt(res)}`, blocks: [G(g, { hl: seen }), A(res, { id: 'r', label: '输出', cw: 32, hl: rng(0, 8, 'ok') })], done: true, ans: res });
});

;
/* ==========================================================================
   算法逐步演示（第 2 部分：链表 / 二叉树）
   ========================================================================== */
// ---- 链表辅助 ----
const LV = (nodes) => { const m = {}; nodes.forEach((n) => { m[n.k] = n.v; }); return m; };
const walkL = (head, nx) => { const out = []; let c = head, g = 0; while (c && g++ < 50) { out.push(c); c = nx[c]; } return out; };
const reflow = (nodes, head, nx) => { const byK = Object.fromEntries(nodes.map((n) => [n.k, n])); const ord = walkL(head, nx).map((k) => byK[k]); nodes.forEach((n) => { if (!ord.includes(n)) ord.push(n); }); return ord; };

// ---- 树辅助：节点对象 {v, id, left, right}，id 用层序下标 ----
function BTO(arr) {
  if (!arr.length || arr[0] == null) return null;
  const root = { v: arr[0], id: 'i0', left: null, right: null };
  const q = [root]; let k = 1;
  while (q.length && k < arr.length) {
    const cur = q.shift();
    for (const side of ['left', 'right']) {
      if (k >= arr.length) break;
      if (arr[k] != null) { cur[side] = { v: arr[k], id: 'i' + k, left: null, right: null }; q.push(cur[side]); }
      k++;
    }
  }
  return root;
}
const snap = (n) => (n ? { v: n.v, id: n.id, left: snap(n.left), right: snap(n.right) } : null);
const TRO = (root, o = {}) => Object.assign({ t: 'tree' }, o, { root: snap(root), hl: Object.assign({}, o.hl || {}), tag: o.tag ? Object.assign({}, o.tag) : undefined });
function ser(root) {
  const out = [], q = [root];
  while (q.length) { const n = q.shift(); if (n) { out.push(n.v); q.push(n.left, n.right); } else out.push(null); }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}
const allIds = (n, acc = []) => { if (n) { acc.push(n.id); allIds(n.left, acc); allIds(n.right, acc); } return acc; };
const hlOf = (ids, cls, base) => { const o = Object.assign({}, base || {}); ids.forEach((i) => { o[i] = cls; }); return o; };

/* ============================== 链表 ============================== */
T('206', '三指针迭代：先存 next，再反转指向，最后整体前进', 'head = [1,2,3,4,5]', [5, 4, 3, 2, 1], (F) => {
  const nodes = LNODES([1, 2, 3, 4, 5]), nx = LNEXT(nodes), val = LV(nodes);
  let prev = null, cur = 'n0';
  F({ cap: 'prev = null，cur = head；每一轮只改一根指针', blocks: [LST(nodes, nx, { p: { cur } })] });
  while (cur) {
    const nxt = nx[cur];
    F({ cap: `先保存 next = ${nxt ? val[nxt] : 'null'}，否则改完指针就找不到后面的链了`, blocks: [LST(nodes, nx, { p: { prev, cur, next: nxt }, hl: { [cur]: 'cur' } })] });
    nx[cur] = prev;
    F({ cap: `cur.next = prev：${val[cur]} 改为指向 ${prev ? val[prev] : 'null'}`, blocks: [LST(nodes, nx, { p: { prev, cur, next: nxt }, hl: { [cur]: 'cur' }, ehl: { [cur]: 'on' } })] });
    prev = cur; cur = nxt;
    F({ cap: 'prev、cur 各向前一步', blocks: [LST(nodes, nx, { p: { prev, cur }, hl: prev ? { [prev]: 'ok' } : {} })] });
  }
  const ans = walkL(prev, nx).map((k) => val[k]);
  F({ cap: `cur 为 null，prev 就是新头：${ans.join(' → ')}`, blocks: [LST(reflow(nodes, prev, nx), nx, { p: { head: prev }, hl: Object.fromEntries(nodes.map((n) => [n.k, 'ok'])) })], done: true, ans });
});

T('234', '快慢指针找中点 → 反转后半段 → 两头同步比较', 'head = [1,2,2,1]', true, (F) => {
  const nodes = LNODES([1, 2, 2, 1]), nx = LNEXT(nodes), val = LV(nodes);
  let slow = 'n0', fast = 'n0';
  F({ cap: 'slow 一次走 1 步，fast 一次走 2 步', blocks: [LST(nodes, nx, { p: { slow, fast } })] });
  while (nx[fast] && nx[nx[fast]]) { slow = nx[slow]; fast = nx[nx[fast]]; F({ cap: `slow → ${val[slow]}，fast → ${val[fast]}`, blocks: [LST(nodes, nx, { p: { slow, fast } })] }); }
  F({ cap: `fast 到头，slow 停在前半段末尾；后半段从 slow.next 开始`, blocks: [LST(nodes, nx, { p: { slow }, hl: { n2: 'warn', n3: 'warn' } })] });
  let prev = null, cur = nx[slow];
  while (cur) { const t = nx[cur]; nx[cur] = prev; prev = cur; cur = t; }
  nx[slow] = null;
  F({ cap: '反转后半段：2 → 1 变成 1 → 2（原地，O(1) 空间）', blocks: [LST(nodes, nx, { p: { p1: 'n0', p2: prev }, hl: { n2: 'warn', n3: 'warn' }, ehl: { n3: 'on' } })] });
  let p1 = 'n0', p2 = prev, ok = true;
  while (p2) {
    const same = val[p1] === val[p2];
    F({ cap: `比较 ${val[p1]} 与 ${val[p2]}：${same ? '相同' : '不同 → false'}`, blocks: [LST(nodes, nx, { p: { p1, p2 }, hl: { [p1]: same ? 'ok' : 'bad', [p2]: same ? 'ok' : 'bad' } })] });
    if (!same) { ok = false; break; }
    p1 = nx[p1]; p2 = nx[p2];
  }
  F({ cap: `全部匹配 → **${ok}**（面试可补一句：比较完把后半段再反转回去，恢复原链表）`, blocks: [LST(nodes, nx, { hl: Object.fromEntries(nodes.map((n) => [n.k, 'ok'])) })], done: true, ans: ok });
});

T('141', 'Floyd 判环：快指针每次多走一步，有环必相遇', 'head = [3,2,0,-4]，尾节点连回下标 1', true, (F) => {
  const nodes = LNODES([3, 2, 0, -4]), nx = LNEXT(nodes), val = LV(nodes);
  nx.n3 = 'n1';
  let slow = 'n0', fast = 'n0';
  F({ cap: '尾节点 -4 指回 2，形成环', blocks: [LST(nodes, nx, { p: { slow, fast }, ehl: { n3: 'on' } })] });
  while (fast && nx[fast]) {
    slow = nx[slow]; fast = nx[nx[fast]];
    const meet = slow === fast;
    F({ cap: `slow → ${val[slow]}，fast → ${val[fast]}${meet ? '：相遇 → 有环' : ''}`, blocks: [LST(nodes, nx, { p: { slow, fast }, hl: meet ? { [slow]: 'ok' } : { [slow]: 'cur', [fast]: 'warn' } })] });
    if (meet) { F({ cap: '进入环后快指针每轮追近 1 步，一定能追上；无环时 fast 会先走到 null', blocks: [LST(nodes, nx, { hl: { [slow]: 'ok' } })], done: true, ans: true }); return; }
  }
  F({ cap: 'fast 走到 null → 无环', blocks: [], done: true, ans: false });
});

T('142', '相遇后一个指针回到头，两者同速前进，再次相遇处就是入环点', 'head = [3,2,0,-4]，尾节点连回下标 1', 1, (F) => {
  const nodes = LNODES([3, 2, 0, -4]), nx = LNEXT(nodes), val = LV(nodes);
  nx.n3 = 'n1';
  let slow = 'n0', fast = 'n0';
  do { slow = nx[slow]; fast = nx[nx[fast]]; F({ cap: `第一阶段：slow → ${val[slow]}，fast → ${val[fast]}`, blocks: [LST(nodes, nx, { p: { slow, fast }, hl: { [slow]: 'cur', [fast]: 'warn' } })] }); } while (slow !== fast);
  F({ cap: `在 ${val[slow]} 相遇。设头到入口 a、入口到相遇点 b，则 a = (环长 − b) + k 圈`, blocks: [LST(nodes, nx, { p: { meet: slow }, hl: { [slow]: 'ok' } })] });
  let p = 'n0', q = slow;
  F({ cap: '第二阶段：p 回到头，q 留在相遇点，都每次走 1 步', blocks: [LST(nodes, nx, { p: { p, q }, hl: { [p]: 'cur', [q]: 'warn' } })] });
  while (p !== q) { p = nx[p]; q = nx[q]; F({ cap: `p → ${val[p]}，q → ${val[q]}${p === q ? '：相遇' : ''}`, blocks: [LST(nodes, nx, { p: { p, q }, hl: p === q ? { [p]: 'ok' } : { [p]: 'cur', [q]: 'warn' } })] }); }
  const idx = nodes.findIndex((n) => n.k === p);
  F({ cap: `入环点是值为 ${val[p]} 的节点（下标 **${idx}**）`, blocks: [LST(nodes, nx, { hl: { [p]: 'ok' }, ehl: { n3: 'on' } })], done: true, ans: idx });
});

T('160', '双指针走完自己再走对方：路程都是 a + b + c，同时到达交点', 'A = [4,1,8,4,5]，B = [5,6,1,8,4,5]，交点 8', 8, (F) => {
  const pos = { a1: [0.06, 0], a2: [0.22, 0], b1: [0, 1], b2: [0.13, 1], b3: [0.26, 1], c1: [0.46, 0.5], c2: [0.68, 0.5], c3: [0.9, 0.5] };
  const val = { a1: 4, a2: 1, b1: 5, b2: 6, b3: 1, c1: 8, c2: 4, c3: 5 };
  const nx = { a1: 'a2', a2: 'c1', b1: 'b2', b2: 'b3', b3: 'c1', c1: 'c2', c2: 'c3', c3: null };
  const gnodes = Object.keys(pos).map((k) => ({ k, x: pos[k][0], y: pos[k][1], label: val[k] }));
  const edges = Object.entries(nx).filter(([, t]) => t).map(([a, b]) => [a, b]);
  const draw = (pa, pb, cap, done) => {
    const hlm = {}, tag = {};
    if (pa) { hlm[pa] = 'cur'; tag[pa] = 'pa'; }
    if (pb) { hlm[pb] = pa === pb ? 'ok' : 'warn'; tag[pb] = pa === pb ? 'pa=pb' : (tag[pb] ? tag[pb] + ' pb' : 'pb'); }
    F({ cap, blocks: [{ t: 'graph', nodes: gnodes, edges, directed: true, hl: hlm, tag, h: 170 }, V(['pa', pa ? val[pa] : 'null', 'cur'], ['pb', pb ? val[pb] : 'null'])], done, ans: done ? val[pa] : undefined });
  };
  let pa = 'a1', pb = 'b1';
  draw(pa, pb, 'pa 从 A 出发，pb 从 B 出发；走到 null 就换到另一条链的头');
  let g = 0;
  while (pa !== pb && g++ < 20) {
    pa = pa ? nx[pa] : 'b1';
    pb = pb ? nx[pb] : 'a1';
    draw(pa, pb, pa === pb ? `同时到达 **${val[pa]}**：pa 走了 A 全程 + B 的独有部分，pb 走了 B 全程 + A 的独有部分` : `pa → ${pa ? val[pa] : 'null（下一步切到 B 头）'}，pb → ${pb ? val[pb] : 'null（下一步切到 A 头）'}`, pa === pb);
  }
});

T('21', '哑节点 + 双指针，每次接上较小的节点', 'l1 = [1,2,4], l2 = [1,3,4]', [1, 1, 2, 3, 4, 4], (F) => {
  const A = LNODES([1, 2, 4], 'a'), B = LNODES([1, 3, 4], 'b');
  const nxA = LNEXT(A), nxB = LNEXT(B);
  const res = [{ k: 'd', v: 'dummy' }];
  let i = 0, j = 0;
  const draw = (cap, done) => F({ cap, blocks: [LST(A, nxA, { id: 'la', label: 'l1', p: { p1: A[i] ? A[i].k : null }, hl: Object.fromEntries(A.slice(0, i).map((n) => [n.k, 'dim'])) }), LST(B, nxB, { id: 'lb', label: 'l2', p: { p2: B[j] ? B[j].k : null }, hl: Object.fromEntries(B.slice(0, j).map((n) => [n.k, 'dim'])) }), LST(res, LNEXT(res), { id: 'lr', label: '结果（dummy.next 为头）', p: { tail: res[res.length - 1].k }, hl: Object.fromEntries(res.slice(1).map((n) => [n.k, 'ok'])) })], done, ans: done ? res.slice(1).map((n) => n.v) : undefined });
  draw('dummy 省去「头节点为空」的特判；tail 指向结果链末尾');
  while (i < A.length && j < B.length) {
    if (A[i].v <= B[j].v) { res.push({ k: 'r' + res.length, v: A[i].v }); i++; draw(`${A[i - 1].v} ≤ ${B[j].v} → 接上 l1 的节点`); }
    else { res.push({ k: 'r' + res.length, v: B[j].v }); j++; draw(`${B[j - 1].v} < ${A[i].v} → 接上 l2 的节点`); }
  }
  while (i < A.length) res.push({ k: 'r' + res.length, v: A[i++].v });
  while (j < B.length) res.push({ k: 'r' + res.length, v: B[j++].v });
  draw('一条链用完，另一条剩余部分整体接上（不用逐个复制）', true);
});

T('2', '逐位相加 + 进位，链表天然是低位在前', 'l1 = [2,4,3], l2 = [5,6,4]（342 + 465）', [7, 0, 8], (F) => {
  const A = LNODES([2, 4, 3], 'a'), B = LNODES([5, 6, 4], 'b');
  const res = [];
  let carry = 0;
  for (let i = 0; i < 3 || carry; i++) {
    const x = A[i] ? A[i].v : 0, y = B[i] ? B[i].v : 0, s = x + y + carry;
    res.push({ k: 'r' + i, v: s % 10 });
    F({ cap: `${x} + ${y} + 进位 ${carry} = ${s} → 结果节点 ${s % 10}，进位 ${Math.floor(s / 10)}`, blocks: [LST(A, LNEXT(A), { id: 'la', label: 'l1', p: { p1: A[i] ? A[i].k : null } }), LST(B, LNEXT(B), { id: 'lb', label: 'l2', p: { p2: B[i] ? B[i].k : null } }), LST(res, LNEXT(res), { id: 'lr', label: '结果', hl: { ['r' + i]: 'ok' } }), V(['carry', Math.floor(s / 10)])] });
    carry = Math.floor(s / 10);
  }
  F({ cap: `结果 ${res.map((n) => n.v).join(' → ')}，即 807；循环条件别忘了 carry != 0`, blocks: [LST(res, LNEXT(res), { id: 'lr', label: '结果', hl: Object.fromEntries(res.map((n) => [n.k, 'ok'])) })], done: true, ans: res.map((n) => n.v) });
});

T('19', '快指针先走 n+1 步，慢指针停在待删节点的前一个', 'head = [1,2,3,4,5], n = 2', [1, 2, 3, 5], (F) => {
  const nodes = [{ k: 'd', v: 'D' }, ...LNODES([1, 2, 3, 4, 5])], nx = LNEXT(nodes), val = LV(nodes);
  let fast = 'd', slow = 'd';
  F({ cap: '从 dummy 出发，这样删除头节点也不用特判', blocks: [LST(nodes, nx, { p: { slow, fast } })] });
  for (let i = 0; i <= 2; i++) { fast = nx[fast]; F({ cap: `fast 先走第 ${i + 1} 步 → ${val[fast]}`, blocks: [LST(nodes, nx, { p: { slow, fast }, hl: { [fast]: 'warn' } })] }); }
  while (fast) { fast = nx[fast]; slow = nx[slow]; F({ cap: `两者同步前进：slow → ${val[slow]}，fast → ${fast ? val[fast] : 'null'}`, blocks: [LST(nodes, nx, { p: { slow, fast }, hl: { [slow]: 'cur' } })] }); }
  const del = nx[slow];
  F({ cap: `fast 为 null，slow 的下一个（${val[del]}）就是倒数第 2 个`, blocks: [LST(nodes, nx, { p: { slow }, hl: { [slow]: 'cur', [del]: 'bad' } })] });
  nx[slow] = nx[del]; nx[del] = null;
  const kept = nodes.filter((n) => n.k !== del);
  F({ cap: 'slow.next = slow.next.next，一次遍历完成', blocks: [LST(kept, nx, { hl: { [slow]: 'ok' }, ehl: { [slow]: 'on' } })], done: true, ans: walkL(nx.d, nx).map((k) => val[k]) });
});

T('24', 'prev → a → b → next 改成 prev → b → a → next', 'head = [1,2,3,4]', [2, 1, 4, 3], (F) => {
  let nodes = [{ k: 'd', v: 'D' }, ...LNODES([1, 2, 3, 4])];
  const nx = LNEXT(nodes), val = LV(nodes);
  let prev = 'd';
  while (nx[prev] && nx[nx[prev]]) {
    const a = nx[prev], b = nx[a];
    F({ cap: `待交换的一对：a = ${val[a]}，b = ${val[b]}`, blocks: [LST(nodes, nx, { p: { prev, a, b }, hl: { [a]: 'cur', [b]: 'warn' } })] });
    nx[prev] = b; nx[a] = nx[b]; nx[b] = a;
    F({ cap: '三根指针：prev.next = b；a.next = b.next；b.next = a', blocks: [LST(nodes, nx, { p: { prev, a, b }, hl: { [a]: 'cur', [b]: 'warn' }, ehl: { [prev]: 'on', [a]: 'on', [b]: 'on' } })] });
    nodes = reflow(nodes, 'd', nx);
    F({ cap: '按新的 next 顺序看，这一对已交换；prev 移到 a', blocks: [LST(nodes, nx, { p: { prev: a }, hl: { [a]: 'ok', [b]: 'ok' } })] });
    prev = a;
  }
  F({ cap: `完成：${walkL(nx.d, nx).map((k) => val[k]).join(' → ')}`, blocks: [LST(nodes, nx, {})], done: true, ans: walkL(nx.d, nx).map((k) => val[k]) });
});

T('25', '每 k 个一组做头插法反转，不足 k 个保持原样', 'head = [1,2,3,4,5], k = 3', [3, 2, 1, 4, 5], (F) => {
  let nodes = [{ k: 'd', v: 'D' }, ...LNODES([1, 2, 3, 4, 5])];
  const nx = LNEXT(nodes), val = LV(nodes), k = 3;
  let pre = 'd';
  for (;;) {
    let end = pre;
    for (let i = 0; i < k && end; i++) end = nx[end];
    if (!end) { F({ cap: `从 ${nx[pre] ? val[nx[pre]] : 'null'} 开始不足 ${k} 个 → 保持原样，结束`, blocks: [LST(nodes, nx, { p: { pre } })] }); break; }
    const first = nx[pre];
    F({ cap: `找到一组：${val[first]} … ${val[end]}（先数够 k 个再动手）`, blocks: [LST(nodes, nx, { p: { pre, end }, hl: Object.fromEntries(walkL(first, nx).slice(0, k).map((x) => [x, 'cur'])) })] });
    for (let i = 1; i < k; i++) {
      const cur = nx[first];
      nx[first] = nx[cur]; nx[cur] = nx[pre]; nx[pre] = cur;
      nodes = reflow(nodes, 'd', nx);
      F({ cap: `头插：把 ${val[cur]} 摘下插到 pre 后面`, blocks: [LST(nodes, nx, { p: { pre, first }, hl: { [cur]: 'warn' }, ehl: { [pre]: 'on', [cur]: 'on' } })] });
    }
    pre = first;
    F({ cap: `这一组反转完成，pre 移到组尾 ${val[first]}`, blocks: [LST(nodes, nx, { p: { pre }, hl: { [first]: 'ok' } })] });
  }
  const ans = walkL(nx.d, nx).map((x) => val[x]);
  F({ cap: `结果 ${ans.join(' → ')}；O(n) 时间 O(1) 空间`, blocks: [LST(nodes, nx, {})], done: true, ans });
});

T('92', '找到 left 前一个节点 pre，然后在区间内不断头插', 'head = [1,2,3,4,5], left = 2, right = 4', [1, 4, 3, 2, 5], (F) => {
  let nodes = [{ k: 'd', v: 'D' }, ...LNODES([1, 2, 3, 4, 5])];
  const nx = LNEXT(nodes), val = LV(nodes);
  const pre = 'n0', cur = 'n1';
  F({ cap: 'pre 停在第 left−1 个节点（1），cur 是区间第一个节点（2），cur 始终不动', blocks: [LST(nodes, nx, { p: { pre, cur }, hl: { n1: 'cur', n2: 'sel', n3: 'sel' } })] });
  for (let i = 0; i < 2; i++) {
    const nxt = nx[cur];
    nx[cur] = nx[nxt]; nx[nxt] = nx[pre]; nx[pre] = nxt;
    nodes = reflow(nodes, 'd', nx);
    F({ cap: `把 cur 后面的 ${val[nxt]} 摘下，插到 pre 后面`, blocks: [LST(nodes, nx, { p: { pre, cur }, hl: { [nxt]: 'warn', [cur]: 'cur' }, ehl: { [pre]: 'on', [nxt]: 'on', [cur]: 'on' } })] });
  }
  const ans = walkL(nx.d, nx).map((x) => val[x]);
  F({ cap: `区间 [2, 4] 反转完成：${ans.join(' → ')}，一次遍历`, blocks: [LST(nodes, nx, { hl: { n1: 'ok', n2: 'ok', n3: 'ok' } })], done: true, ans });
});

T('143', '三步：找中点 → 反转后半 → 交替合并', 'head = [1,2,3,4,5]', [1, 5, 2, 4, 3], (F) => {
  let nodes = LNODES([1, 2, 3, 4, 5]);
  const nx = LNEXT(nodes), val = LV(nodes);
  let slow = 'n0', fast = 'n0';
  while (nx[fast] && nx[nx[fast]]) { slow = nx[slow]; fast = nx[nx[fast]]; }
  F({ cap: `① 快慢指针找到中点 ${val[slow]}，前半段 1 → 2 → 3，后半段 4 → 5`, blocks: [LST(nodes, nx, { p: { slow }, hl: { n3: 'warn', n4: 'warn' } })] });
  let prev = null, cur = nx[slow];
  nx[slow] = null;
  while (cur) { const t = nx[cur]; nx[cur] = prev; prev = cur; cur = t; }
  F({ cap: '② 断开并反转后半段：5 → 4', blocks: [LST(nodes, nx, { p: { l1: 'n0', l2: prev }, hl: { n3: 'warn', n4: 'warn' }, ehl: { n4: 'on' } })] });
  let a = 'n0', b = prev;
  while (b) {
    const an = nx[a], bn = nx[b];
    nx[a] = b; nx[b] = an;
    nodes = reflow(nodes, 'n0', nx);
    F({ cap: `③ 交替合并：${val[a]} → ${val[b]} → ${an ? val[an] : 'null'}`, blocks: [LST(nodes, nx, { p: { a, b }, hl: { [a]: 'ok', [b]: 'warn' }, ehl: { [a]: 'on', [b]: 'on' } })] });
    a = an; b = bn;
  }
  const ans = walkL('n0', nx).map((x) => val[x]);
  F({ cap: `结果 ${ans.join(' → ')}；O(n) 时间 O(1) 空间`, blocks: [LST(nodes, nx, {})], done: true, ans });
});

T('82', '哑节点 + 发现重复就整段跳过', 'head = [1,2,3,3,4,4,5]', [1, 2, 5], (F) => {
  const nodes = [{ k: 'd', v: 'D' }, ...LNODES([1, 2, 3, 3, 4, 4, 5])];
  const nx = LNEXT(nodes), val = LV(nodes);
  let prev = 'd';
  const gone = new Set();
  while (nx[prev]) {
    const c = nx[prev];
    if (nx[c] && val[nx[c]] === val[c]) {
      const v = val[c];
      let e = c;
      while (nx[e] && val[nx[e]] === v) e = nx[e];
      walkL(c, nx).slice(0, walkL(c, nx).indexOf(e) + 1).forEach((x) => gone.add(x));
      F({ cap: `${v} 出现多次 → 整段删除，prev.next 直接指向后面的节点`, blocks: [LST(nodes, nx, { p: { prev }, hl: Object.fromEntries([...gone].map((x) => [x, 'bad'])) })] });
      nx[prev] = nx[e];
    } else {
      F({ cap: `${val[c]} 不重复 → 保留，prev 前进`, blocks: [LST(nodes.filter((n) => !gone.has(n.k)), nx, { p: { prev: c }, hl: { [c]: 'ok' } })] });
      prev = c;
    }
  }
  const ans = walkL(nx.d, nx).map((x) => val[x]);
  F({ cap: `结果 ${ans.join(' → ')}`, blocks: [LST(nodes.filter((n) => !gone.has(n.k)), nx, {})], done: true, ans });
});

T('83', '当前节点与下一个相同就跳过下一个', 'head = [1,1,2,3,3]', [1, 2, 3], (F) => {
  const nodes = LNODES([1, 1, 2, 3, 3]), nx = LNEXT(nodes), val = LV(nodes);
  let cur = 'n0';
  const gone = new Set();
  while (cur && nx[cur]) {
    if (val[nx[cur]] === val[cur]) { const d = nx[cur]; gone.add(d); nx[cur] = nx[d]; F({ cap: `下一个也是 ${val[cur]} → cur.next = cur.next.next`, blocks: [LST(nodes, nx, { p: { cur }, hl: { [d]: 'bad', [cur]: 'cur' }, ehl: { [cur]: 'on' } })] }); }
    else { F({ cap: `${val[cur]} ≠ ${val[nx[cur]]} → cur 前进`, blocks: [LST(nodes.filter((n) => !gone.has(n.k)), nx, { p: { cur }, hl: { [cur]: 'ok' } })] }); cur = nx[cur]; }
  }
  const ans = walkL('n0', nx).map((x) => val[x]);
  F({ cap: `结果 ${ans.join(' → ')}`, blocks: [LST(nodes.filter((n) => !gone.has(n.k)), nx, {})], done: true, ans });
});

T('23', '小顶堆里放每条链的当前头，每次弹出最小的接到结果后', 'lists = [[1,4,5],[1,3,4],[2,6]]', [1, 1, 2, 3, 4, 4, 5, 6], (F) => {
  const L = [[1, 4, 5], [1, 3, 4], [2, 6]], ptr = [0, 0, 0], res = [];
  const heapOf = () => L.map((l, i) => (ptr[i] < l.length ? [l[ptr[i]], i] : null)).filter(Boolean).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const draw = (cap, pick, done) => F({ cap, blocks: [...L.map((l, i) => A(l, { id: 'l' + i, label: `list ${i}`, cw: 36, hl: Object.assign(rng(0, ptr[i] - 1, 'dim'), pick === i ? { [ptr[i] - 1]: 'ok' } : {}), p: ptr[i] < l.length ? { ['p' + i]: ptr[i] } : {} })), S(heapOf().map(([v, i]) => `${v}(L${i})`), { label: '小顶堆（值 / 来自哪条链）', hl: { 0: 'cur' } }), A(res, { id: 'r', label: '结果', cw: 30, hl: { [res.length - 1]: 'ok' } })], done, ans: done ? res.slice() : undefined });
  draw('先把每条链的头节点放进小顶堆（堆大小始终 ≤ k）');
  while (heapOf().length) {
    const [v, i] = heapOf()[0];
    ptr[i]++; res.push(v);
    draw(`弹出最小值 ${v}（来自 list ${i}），接到结果后，并把 list ${i} 的下一个节点入堆`, i);
  }
  draw(`合并完成；每个节点进出堆一次，O(N log k)`, -1, true);
});

T('146', 'HashMap 定位 + 双向链表维护访问顺序（头部最新，尾部最旧）', 'capacity = 2；put 1、put 2、get 1、put 3、get 2、put 4、get 1、get 3、get 4', [1, -1, -1, 3, 4], (F) => {
  const cap = 2;
  let order = [];
  const val = {};
  const out = [];
  const draw = (caption, hlKey, cls, done) => {
    const nodes = [{ k: 'H', v: 'head' }, ...order.map((k) => ({ k: 'k' + k, v: `${k}:${val[k]}` })), { k: 'T', v: 'tail' }];
    F({ cap: caption, blocks: [LST(nodes, LNEXT(nodes), { label: '双向链表（左 = 最近使用）', showNull: false, hl: hlKey != null ? { ['k' + hlKey]: cls } : {} }), M(order.map((k) => [k, 'node']), { label: 'HashMap key → 节点', hl: hlKey }), V(['size', `${order.length}/${cap}`], ['get 结果', fmt(out)])], done, ans: done ? out.slice() : undefined });
  };
  const put = (k, v) => {
    if (val[k] !== undefined) { order = [k, ...order.filter((x) => x !== k)]; val[k] = v; draw(`put(${k}, ${v})：已存在 → 更新值并移到头部`, k, 'cur'); return; }
    if (order.length === cap) { const ev = order[order.length - 1]; draw(`put(${k}, ${v})：已满 → 淘汰尾部最久未使用的 ${ev}`, ev, 'bad'); order.pop(); delete val[ev]; }
    order = [k, ...order]; val[k] = v;
    draw(`put(${k}, ${v})：新节点插到头部`, k, 'ok');
  };
  const get = (k) => {
    if (val[k] === undefined) { out.push(-1); draw(`get(${k})：map 里没有 → -1`, null, ''); return; }
    order = [k, ...order.filter((x) => x !== k)];
    out.push(val[k]);
    draw(`get(${k}) = ${val[k]}：命中，移到头部（刚被访问）`, k, 'cur');
  };
  draw('空缓存：head、tail 是哨兵节点，插入 / 删除都不用判空');
  put(1, 1); put(2, 2); get(1); put(3, 3); get(2); put(4, 4); get(1); get(3); get(4);
  draw(`所有操作 O(1)；get 结果 ${fmt(out)}`, null, '', true);
});

T('148', '自底向上归并：子链长度 1、2、4… 两两合并', 'head = [4,2,1,3,6,5]', [1, 2, 3, 4, 5, 6], (F) => {
  let runs = [4, 2, 1, 3, 6, 5].map((x) => [x]);
  F({ cap: '把每个节点看成长度为 1 的有序子链（自底向上无需递归栈，O(1) 空间）', blocks: [{ t: 'map', label: '当前有序子链', e: runs.map((r, i) => [`#${i}`, r]) }] });
  while (runs.length > 1) {
    const next = [];
    for (let i = 0; i < runs.length; i += 2) {
      if (i + 1 >= runs.length) { next.push(runs[i]); continue; }
      const a = runs[i], b = runs[i + 1], m = [];
      let x = 0, y = 0;
      while (x < a.length || y < b.length) m.push(y >= b.length || (x < a.length && a[x] <= b[y]) ? a[x++] : b[y++]);
      next.push(m);
      F({ cap: `合并 ${fmt(a)} 与 ${fmt(b)} → ${fmt(m)}（与「合并两个有序链表」同一段代码）`, blocks: [{ t: 'map', label: '当前有序子链', e: [...next.map((r, j) => [`新#${j}`, r]), ...runs.slice(i + 2).map((r, j) => [`#${i + 2 + j}`, r])], hl: `新#${next.length - 1}`, hlCls: 'ok' }] });
    }
    runs = next;
  }
  F({ cap: `完成：${fmt(runs[0])}，O(n log n)`, blocks: [A(runs[0], { hl: rng(0, 5, 'ok') })], done: true, ans: runs[0] });
});

/* ============================== 二叉树 ============================== */
T('94', '迭代中序：一路向左压栈 → 弹出访问 → 转向右子树', 'root = [4,2,6,1,3,5,7]', [1, 2, 3, 4, 5, 6, 7], (F) => {
  const root = BTO([4, 2, 6, 1, 3, 5, 7]);
  const st = [], res = [], done = [];
  let cur = root;
  while (cur || st.length) {
    while (cur) { st.push(cur); F({ cap: `${cur.v} 入栈，继续往左`, blocks: [TRO(root, { hl: hlOf(done, 'ok', { [cur.id]: 'cur' }) }), S(st.map((n) => n.v), { label: '栈' }), A(res, { id: 'r', label: '输出', cw: 34 })] }); cur = cur.left; }
    cur = st.pop();
    res.push(cur.v); done.push(cur.id);
    F({ cap: `左边到底 → 弹出 ${cur.v} 并访问，然后转向它的右子树`, blocks: [TRO(root, { hl: hlOf(done, 'ok', { [cur.id]: 'warn' }) }), S(st.map((n) => n.v), { label: '栈' }), A(res, { id: 'r', label: '输出', cw: 34, hl: { [res.length - 1]: 'ok' } })] });
    cur = cur.right;
  }
  F({ cap: `中序：${res.join(' ')}；BST 的中序是升序`, blocks: [TRO(root, { hl: hlOf(done, 'ok') }), A(res, { id: 'r', label: '输出', cw: 34, hl: rng(0, 6, 'ok') })], done: true, ans: res });
});

T('104', '后序：左右子树深度算完，当前深度 = max + 1', 'root = [3,9,20,null,null,15,7]', 3, (F) => {
  const root = BTO([3, 9, 20, null, null, 15, 7]);
  const tag = {}, fin = [];
  const dfs = (n) => {
    if (!n) return 0;
    F({ cap: `进入 ${n.v}，先算左右子树`, blocks: [TRO(root, { hl: hlOf(fin, 'ok', { [n.id]: 'cur' }), tag })] });
    const l = dfs(n.left), r = dfs(n.right);
    tag[n.id] = 'd=' + (Math.max(l, r) + 1); fin.push(n.id);
    F({ cap: `${n.v}：max(左 ${l}, 右 ${r}) + 1 = **${Math.max(l, r) + 1}**，返回给父节点`, blocks: [TRO(root, { hl: hlOf(fin, 'ok', { [n.id]: 'warn' }), tag })] });
    return Math.max(l, r) + 1;
  };
  const d = dfs(root);
  F({ cap: `最大深度 **${d}**；递归栈深度等于树高`, blocks: [TRO(root, { hl: hlOf(fin, 'ok'), tag })], done: true, ans: d });
});

T('226', '每个节点交换左右孩子（前序 / 后序都行）', 'root = [4,2,7,1,3,6,9]', [4, 7, 2, 9, 6, 3, 1], (F) => {
  const root = BTO([4, 2, 7, 1, 3, 6, 9]);
  const fin = [];
  F({ cap: '原树', blocks: [TRO(root)] });
  const go = (n) => {
    if (!n) return;
    [n.left, n.right] = [n.right, n.left];
    fin.push(n.id);
    F({ cap: `交换 ${n.v} 的左右孩子`, blocks: [TRO(root, { hl: hlOf(fin, 'ok', { [n.id]: 'cur' }) })] });
    go(n.left); go(n.right);
  };
  go(root);
  F({ cap: '每个节点访问一次，O(n)', blocks: [TRO(root, { hl: hlOf(fin, 'ok') })], done: true, ans: ser(root) });
});

T('101', '同时比较「左的左 vs 右的右」「左的右 vs 右的左」', 'root = [1,2,2,3,4,4,3]', true, (F) => {
  const root = BTO([1, 2, 2, 3, 4, 4, 3]);
  const ok = [];
  const cmp = (a, b) => {
    if (!a && !b) return true;
    if (!a || !b || a.v !== b.v) { F({ cap: '结构或值不同 → false', blocks: [TRO(root, { hl: hlOf([a && a.id, b && b.id].filter(Boolean), 'bad', hlOf(ok, 'ok')) })] }); return false; }
    ok.push(a.id, b.id);
    F({ cap: `镜像位置 ${a.v} 与 ${b.v} 相等，继续比较它们的外侧与内侧`, blocks: [TRO(root, { hl: hlOf(ok, 'ok', { [a.id]: 'cur', [b.id]: 'warn' }) })] });
    return cmp(a.left, b.right) && cmp(a.right, b.left);
  };
  const res = cmp(root.left, root.right);
  F({ cap: `对称：**${res}**`, blocks: [TRO(root, { hl: hlOf(allIds(root), 'ok') })], done: true, ans: res });
});

T('543', '直径 = 某节点左深度 + 右深度 的最大值（不一定经过根）', 'root = [1,2,3,4,5]', 3, (F) => {
  const root = BTO([1, 2, 3, 4, 5]);
  const tag = {}, fin = [];
  let best = 0;
  const dfs = (n) => {
    if (!n) return 0;
    const l = dfs(n.left), r = dfs(n.right);
    best = Math.max(best, l + r);
    tag[n.id] = `深${Math.max(l, r) + 1}`; fin.push(n.id);
    F({ cap: `${n.v}：左深 ${l} + 右深 ${r} = ${l + r}，best = **${best}**；向上返回 max(${l}, ${r}) + 1`, blocks: [TRO(root, { hl: hlOf(fin, 'ok', { [n.id]: 'cur' }), tag }), V(['经过此点的路径边数', l + r, 'cur'], ['best', best, 'ok'])] });
    return Math.max(l, r) + 1;
  };
  dfs(root);
  F({ cap: `直径 **${best}**（4 → 2 → 1 → 3）`, blocks: [TRO(root, { hl: { i3: 'ok', i1: 'ok', i0: 'ok', i2: 'ok' }, tag })], done: true, ans: best });
});

T('102', 'BFS：每轮先记下队列长度，正好是这一层的节点数', 'root = [3,9,20,null,null,15,7]', [[3], [9, 20], [15, 7]], (F) => {
  const root = BTO([3, 9, 20, null, null, 15, 7]);
  const q = [root], res = [], fin = [];
  while (q.length) {
    const size = q.length, level = [];
    F({ cap: `新的一层：队列里有 ${size} 个节点`, blocks: [TRO(root, { hl: hlOf(q.map((n) => n.id), 'cur', hlOf(fin, 'ok')) }), Q(q.map((n) => n.v)), V(['结果', fmt(res)])] });
    for (let i = 0; i < size; i++) {
      const n = q.shift(); level.push(n.v); fin.push(n.id);
      if (n.left) q.push(n.left);
      if (n.right) q.push(n.right);
      F({ cap: `出队 ${n.v}，把它的孩子入队`, blocks: [TRO(root, { hl: hlOf(fin, 'ok', { [n.id]: 'warn' }) }), Q(q.map((x) => x.v)), V(['本层', fmt(level), 'cur'], ['结果', fmt(res)])] });
    }
    res.push(level);
  }
  F({ cap: `层序结果 ${fmt(res)}`, blocks: [TRO(root, { hl: hlOf(fin, 'ok') }), TX(fmt(res))], done: true, ans: res });
});

T('199', '层序遍历时，每层最后一个出队的就是右视图', 'root = [1,2,3,null,5,null,4]', [1, 3, 4], (F) => {
  const root = BTO([1, 2, 3, null, 5, null, 4]);
  const q = [root], res = [], seen = [];
  while (q.length) {
    const size = q.length;
    for (let i = 0; i < size; i++) {
      const n = q.shift();
      if (n.left) q.push(n.left);
      if (n.right) q.push(n.right);
      if (i === size - 1) { res.push(n.v); seen.push(n.id); F({ cap: `这一层最后一个是 ${n.v} → 加入右视图`, blocks: [TRO(root, { hl: hlOf(seen, 'ok') }), V(['右视图', fmt(res), 'ok'])] }); }
    }
  }
  F({ cap: `右视图 ${fmt(res)}；DFS 写法：先右后左，每层第一次到达的节点`, blocks: [TRO(root, { hl: hlOf(seen, 'ok') })], done: true, ans: res });
});

T('103', '层序 + 奇偶层交替方向（本层结果头插 / 尾插）', 'root = [3,9,20,null,null,15,7]', [[3], [20, 9], [15, 7]], (F) => {
  const root = BTO([3, 9, 20, null, null, 15, 7]);
  const q = [root], res = [];
  let ltr = true;
  while (q.length) {
    const size = q.length, lvl = [], ids = [];
    for (let i = 0; i < size; i++) { const n = q.shift(); ids.push(n.id); if (ltr) lvl.push(n.v); else lvl.unshift(n.v); if (n.left) q.push(n.left); if (n.right) q.push(n.right); }
    res.push(lvl);
    F({ cap: `第 ${res.length} 层 ${ltr ? '从左到右' : '从右到左'}：${fmt(lvl)}`, blocks: [TRO(root, { hl: hlOf(ids, 'cur') }), V(['结果', fmt(res), 'ok'])] });
    ltr = !ltr;
  }
  F({ cap: `锯齿层序 ${fmt(res)}`, blocks: [TRO(root)], done: true, ans: res });
});

T('108', '每次取中点作根，左半建左子树、右半建右子树', 'nums = [-10,-3,0,5,9]', [0, -10, 5, null, -3, null, 9], (F) => {
  const a = [-10, -3, 0, 5, 9];
  let root = null;
  const build = (l, r, attach) => {
    if (l > r) return null;
    const m = (l + r) >> 1;
    const n = { v: a[m], id: 'm' + m, left: null, right: null };
    if (!root) root = n; else attach(n);
    F({ cap: `区间 [${l}, ${r}] 取中点下标 ${m} → 值 ${a[m]} 作为根`, blocks: [A(a, { win: [l, r], hl: { [m]: 'cur' }, p: { l, m, r } }), TRO(root, { hl: { [n.id]: 'cur' } })] });
    build(l, m - 1, (c) => { n.left = c; });
    build(m + 1, r, (c) => { n.right = c; });
    return n;
  };
  build(0, a.length - 1);
  F({ cap: '左右子树节点数差 ≤ 1 → 高度平衡；O(n)', blocks: [A(a, { hl: rng(0, 4, 'ok') }), TRO(root, { hl: hlOf(allIds(root), 'ok') })], done: true, ans: ser(root) });
});

T('98', '中序遍历必须严格递增：记住前一个值 prev', 'root = [5,1,4,null,null,3,6]', false, (F) => {
  const root = BTO([5, 1, 4, null, null, 3, 6]);
  const st = [], seen = [];
  let cur = root, prev = null;
  while (cur || st.length) {
    while (cur) { st.push(cur); cur = cur.left; }
    cur = st.pop();
    const bad = prev !== null && cur.v <= prev;
    F({ cap: `中序访问 ${cur.v}，prev = ${prev === null ? '无' : prev}${bad ? ` → ${cur.v} ≤ ${prev}，不是 BST` : ' → 递增，继续'}`, blocks: [TRO(root, { hl: hlOf(seen, 'ok', { [cur.id]: bad ? 'bad' : 'cur' }) }), V(['prev', prev === null ? '—' : prev])] });
    if (bad) { F({ cap: '返回 **false**（4 的左子树里出现了 3 < 5）。注意不能只比较父子，要比较整个区间', blocks: [TRO(root, { hl: { i2: 'bad', i5: 'bad', i0: 'warn' } })], done: true, ans: false }); return; }
    seen.push(cur.id); prev = cur.v; cur = cur.right;
  }
  F({ cap: 'true', blocks: [], done: true, ans: true });
});

T('230', '中序遍历第 k 个就是第 k 小', 'root = [5,3,6,2,4,null,null,1], k = 3', 3, (F) => {
  const root = BTO([5, 3, 6, 2, 4, null, null, 1]);
  const st = [], seen = [];
  let cur = root, cnt = 0;
  while (cur || st.length) {
    while (cur) { st.push(cur); cur = cur.left; }
    cur = st.pop(); cnt++; seen.push(cur.id);
    F({ cap: `第 ${cnt} 个访问：${cur.v}${cnt === 3 ? ' → 就是第 3 小，提前结束' : ''}`, blocks: [TRO(root, { hl: hlOf(seen, 'ok', { [cur.id]: cnt === 3 ? 'ok' : 'cur' }) }), S(st.map((n) => n.v), { label: '栈' }), V(['count', cnt, 'cur'])] });
    if (cnt === 3) { F({ cap: `答案 **${cur.v}**；频繁查询可在节点上维护子树大小`, blocks: [TRO(root, { hl: { [cur.id]: 'ok' } })], done: true, ans: cur.v }); return; }
    cur = cur.right;
  }
});

T('114', '把左子树接到右边：左子树最右节点 → 原右子树', 'root = [1,2,5,3,4,null,6]', [1, null, 2, null, 3, null, 4, null, 5, null, 6], (F) => {
  const root = BTO([1, 2, 5, 3, 4, null, 6]);
  let cur = root;
  F({ cap: '目标：按前序顺序变成只有右指针的链', blocks: [TRO(root)] });
  while (cur) {
    if (cur.left) {
      let pre = cur.left;
      while (pre.right) pre = pre.right;
      F({ cap: `${cur.v} 有左子树：找到左子树的最右节点 ${pre.v}（前序中它正好排在 ${cur.right ? cur.right.v : '右子树'} 之前）`, blocks: [TRO(root, { hl: { [cur.id]: 'cur', [pre.id]: 'warn' } })] });
      pre.right = cur.right; cur.right = cur.left; cur.left = null;
      F({ cap: `${pre.v}.right = 原右子树；${cur.v}.right = 原左子树；${cur.v}.left = null`, blocks: [TRO(root, { hl: { [cur.id]: 'ok', [pre.id]: 'warn' } })] });
    }
    cur = cur.right;
  }
  F({ cap: '完成：O(n) 时间、O(1) 额外空间（类似 Morris）', blocks: [TRO(root, { hl: hlOf(allIds(root), 'ok') })], done: true, ans: ser(root) });
});

T('105', '前序第一个是根，在中序里找到它切出左右子树', 'preorder = [3,9,20,15,7], inorder = [9,3,15,20,7]', [3, 9, 20, null, null, 15, 7], (F) => {
  const pre = [3, 9, 20, 15, 7], ino = [9, 3, 15, 20, 7], idx = new Map(ino.map((v, i) => [v, i]));
  let root = null, pi = 0;
  const build = (l, r, attach) => {
    if (l > r) return null;
    const v = pre[pi++], m = idx.get(v);
    const n = { v, id: 'v' + v, left: null, right: null };
    if (!root) root = n; else attach(n);
    F({ cap: `前序取出 ${v} 作根；中序下标 ${m}：左边 ${m - l} 个属于左子树，右边 ${r - m} 个属于右子树`, blocks: [A(pre, { id: 'p', label: 'preorder', hl: Object.assign(rng(0, pi - 2, 'dim'), { [pi - 1]: 'cur' }) }), A(ino, { id: 'i', label: 'inorder（HashMap 定位根）', win: [l, r], hl: { [m]: 'cur' } }), TRO(root, { hl: { [n.id]: 'cur' } })] });
    build(l, m - 1, (c) => { n.left = c; });
    build(m + 1, r, (c) => { n.right = c; });
    return n;
  };
  build(0, 4);
  F({ cap: '哈希表把「在中序中找根」降到 O(1)，整体 O(n)', blocks: [TRO(root, { hl: hlOf(allIds(root), 'ok') })], done: true, ans: ser(root) });
});

T('437', '路径上的前缀和 + 哈希：和 560 一样，只是换到树上', 'root = [10,5,-3,3,2,null,11,3,-2,null,1], targetSum = 8', 3, (F) => {
  const root = BTO([10, 5, -3, 3, 2, null, 11, 3, -2, null, 1]);
  const m = new Map([[0, 1]]);
  let cnt = 0;
  const path = [];
  const dfs = (n, sum) => {
    if (!n) return;
    sum += n.v; path.push(n.id);
    const c = m.get(sum - 8) || 0;
    cnt += c;
    F({ cap: `到 ${n.v}：路径前缀和 ${sum}，查 ${sum} − 8 = ${sum - 8} 出现 ${c} 次${c ? ' → 找到以 ' + n.v + ' 结尾的路径' : ''}`, blocks: [TRO(root, { hl: hlOf(path, 'sel', { [n.id]: c ? 'ok' : 'cur' }) }), M([...m].filter((x) => x[1]), { label: '当前路径的前缀和 → 次数', hl: sum - 8, hlCls: c ? 'ok' : 'cur' }), V(['count', cnt, c ? 'ok' : ''])] });
    m.set(sum, (m.get(sum) || 0) + 1);
    dfs(n.left, sum); dfs(n.right, sum);
    m.set(sum, m.get(sum) - 1);
    path.pop();
  };
  dfs(root, 0);
  F({ cap: `共 **${cnt}** 条路径；回溯时把当前前缀和的计数减掉，保证只统计祖先链`, blocks: [TRO(root)], done: true, ans: cnt });
});

T('236', '后序：左右各找到一个就是 LCA，只找到一个就把它往上传', 'root = [3,5,1,6,2,0,8,null,null,7,4], p = 5, q = 4', 5, (F) => {
  const root = BTO([3, 5, 1, 6, 2, 0, 8, null, null, 7, 4]);
  const tag = {}, fin = [];
  const dfs = (n) => {
    if (!n) return null;
    if (n.v === 5 || n.v === 4) { tag[n.id] = '命中'; fin.push(n.id); F({ cap: `${n.v} 是 p 或 q → 直接返回自己（不必再往下找）`, blocks: [TRO(root, { hl: hlOf(fin, 'sel', { [n.id]: 'warn' }), tag })] }); return n; }
    const l = dfs(n.left), r = dfs(n.right);
    fin.push(n.id);
    const ret = l && r ? n : l || r;
    tag[n.id] = ret ? '↑' + ret.v : '∅';
    F({ cap: l && r ? `${n.v}：左右各返回一个 → **它就是 LCA**` : `${n.v}：左返回 ${l ? l.v : '空'}，右返回 ${r ? r.v : '空'} → 向上返回 ${ret ? ret.v : '空'}`, blocks: [TRO(root, { hl: hlOf(fin, 'sel', { [n.id]: l && r ? 'ok' : 'cur' }), tag })] });
    return ret;
  };
  const ans = dfs(root);
  F({ cap: `LCA = **${ans.v}**：q 在 p 的子树里，所以 p 本身就是答案`, blocks: [TRO(root, { hl: { [ans.id]: 'ok', i10: 'warn' }, tag })], done: true, ans: ans.v });
});

T('124', '每个节点返回「向下的最大单边贡献」，在节点处用左 + 右 + 自身更新答案', 'root = [-10,9,20,null,null,15,7]', 42, (F) => {
  const root = BTO([-10, 9, 20, null, null, 15, 7]);
  const tag = {}, fin = [];
  let best = -Infinity;
  const gain = (n) => {
    if (!n) return 0;
    const l = Math.max(0, gain(n.left)), r = Math.max(0, gain(n.right));
    best = Math.max(best, n.v + l + r);
    tag[n.id] = '↑' + (n.v + Math.max(l, r)); fin.push(n.id);
    F({ cap: `${n.v}：左贡献 ${l}，右贡献 ${r}（负数取 0 = 不要这边）→ 经过它的路径 ${n.v + l + r}，best = **${best}**；向上只能带一边：${n.v + Math.max(l, r)}`, blocks: [TRO(root, { hl: hlOf(fin, 'sel', { [n.id]: 'cur' }), tag }), V(['best', best, 'ok'])] });
    return n.v + Math.max(l, r);
  };
  gain(root);
  F({ cap: `最大路径和 **${best}**（15 → 20 → 7）`, blocks: [TRO(root, { hl: { i2: 'ok', i5: 'ok', i6: 'ok' }, tag })], done: true, ans: best });
});

T('110', '后序求高度，任一子树不平衡就返回 -1 剪枝', 'root = [3,9,20,null,null,15,7]', true, (F) => {
  const root = BTO([3, 9, 20, null, null, 15, 7]);
  const tag = {}, fin = [];
  const h = (n) => {
    if (!n) return 0;
    const l = h(n.left), r = h(n.right);
    const bad = l < 0 || r < 0 || Math.abs(l - r) > 1;
    const ret = bad ? -1 : Math.max(l, r) + 1;
    tag[n.id] = 'h=' + ret; fin.push(n.id);
    F({ cap: `${n.v}：左高 ${l}，右高 ${r}，差 ${Math.abs(l - r)} ${bad ? '> 1 → 返回 -1' : '≤ 1 → 高度 ' + ret}`, blocks: [TRO(root, { hl: hlOf(fin, 'ok', { [n.id]: bad ? 'bad' : 'cur' }), tag })] });
    return ret;
  };
  const ans = h(root) >= 0;
  F({ cap: `平衡：**${ans}**；自底向上一次遍历 O(n)`, blocks: [TRO(root, { hl: hlOf(fin, 'ok'), tag })], done: true, ans });
});

T('112', '向下传递剩余目标值，叶子处剩余为 0 即成功', 'root = [5,4,8,11,null,13,4,7,2,null,null,null,1], targetSum = 22', true, (F) => {
  const root = BTO([5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1]);
  const tag = {}, path = [];
  let found = false;
  const dfs = (n, rest) => {
    if (!n || found) return;
    rest -= n.v; path.push(n.id); tag[n.id] = '剩' + rest;
    const leaf = !n.left && !n.right;
    F({ cap: `到 ${n.v}，剩余 ${rest}${leaf ? (rest === 0 ? '，是叶子且剩余为 0 → 找到' : '，是叶子但剩余 ≠ 0 → 回溯') : ''}`, blocks: [TRO(root, { hl: hlOf(path, 'sel', { [n.id]: leaf ? (rest === 0 ? 'ok' : 'bad') : 'cur' }), tag })] });
    if (leaf && rest === 0) { found = true; return; }
    dfs(n.left, rest); dfs(n.right, rest);
    if (!found) { path.pop(); delete tag[n.id]; }
  };
  dfs(root, 22);
  F({ cap: `存在路径 5 → 4 → 11 → 2，**true**`, blocks: [TRO(root, { hl: hlOf(path, 'ok'), tag })], done: true, ans: found });
});

T('814', '后序剪枝：子树里没有 1 就整棵剪掉', 'root = [1,null,0,0,1]', [1, null, 0, null, 1], (F) => {
  const root = BTO([1, null, 0, 0, 1]);
  F({ cap: '原树', blocks: [TRO(root)] });
  const prune = (n) => {
    if (!n) return null;
    n.left = prune(n.left); n.right = prune(n.right);
    const drop = n.v === 0 && !n.left && !n.right;
    F({ cap: `${n.v}：左右子树处理完${drop ? '，自己是 0 且没有孩子 → 剪掉' : ' → 保留'}`, blocks: [TRO(root, { hl: { [n.id]: drop ? 'bad' : 'ok' } })] });
    return drop ? null : n;
  };
  const r = prune(root);
  F({ cap: '必须后序：先处理孩子，才知道自己能不能被剪', blocks: [TRO(r, { hl: hlOf(allIds(r), 'ok') })], done: true, ans: ser(r) });
});

;
/* ==========================================================================
   算法逐步演示（第 3 部分：图论 / 回溯 / 二分 / 分治 / 排序）
   ========================================================================== */
const gridHl = (cells, cls, base) => { const o = Object.assign({}, base || {}); cells.forEach(([r, c]) => { o[r + ',' + c] = cls; }); return o; };

/* ============================== 图论 ============================== */
T('200', '遇到陆地就计数 +1，并把整座岛 DFS 淹掉', 'grid 4×5', 3, (F) => {
  const g = [['1', '1', '0', '0', '0'], ['1', '1', '0', '0', '0'], ['0', '0', '1', '0', '0'], ['0', '0', '0', '1', '1']];
  const base = () => { const o = {}; g.forEach((row, r) => row.forEach((v, c) => { o[r + ',' + c] = v === '1' ? 'land' : v === '0' ? 'water' : 'dim'; })); return o; };
  let cnt = 0;
  F({ cap: '绿色是陆地、蓝色是水；按行扫描', blocks: [G(g, { hl: base() }), V(['岛屿数', 0])] });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    if (g[r][c] !== '1') continue;
    cnt++;
    F({ cap: `(${r},${c}) 是未访问的陆地 → 岛屿数 +1 = **${cnt}**，从这里开始淹没整座岛`, blocks: [G(g, { hl: Object.assign(base(), { [r + ',' + c]: 'cur' }), p: { '●': r + ',' + c } }), V(['岛屿数', cnt, 'ok'])] });
    const st = [[r, c]];
    while (st.length) {
      const [x, y] = st.pop();
      if (x < 0 || y < 0 || x >= 4 || y >= 5 || g[x][y] !== '1') continue;
      g[x][y] = '2';
      F({ cap: `淹掉 (${x},${y})，再向上下左右扩散`, blocks: [G(g, { hl: Object.assign(base(), { [x + ',' + y]: 'cur' }), p: { '●': x + ',' + y } }), V(['岛屿数', cnt, 'ok'])] });
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }
  F({ cap: `共 **${cnt}** 座岛；每个格子最多访问一次，O(m·n)`, blocks: [G(g, { hl: base() }), TX('return ' + cnt)], done: true, ans: cnt });
});

T('994', '多源 BFS：所有烂橘子同时入队，一层 = 一分钟', 'grid = [[2,1,1],[1,1,0],[0,1,1]]', 4, (F) => {
  const g = [[2, 1, 1], [1, 1, 0], [0, 1, 1]];
  const base = () => { const o = {}; g.forEach((row, r) => row.forEach((v, c) => { o[r + ',' + c] = v === 2 ? 'rot' : v === 1 ? 'land' : 'dim'; })); return o; };
  let q = [], fresh = 0, t = 0;
  g.forEach((row, r) => row.forEach((v, c) => { if (v === 2) q.push([r, c]); if (v === 1) fresh++; }));
  F({ cap: `初始烂橘子入队；新鲜橘子 ${fresh} 个`, blocks: [G(g, { hl: base() }), V(['分钟', 0], ['新鲜', fresh])] });
  while (q.length && fresh) {
    const nq = [], newly = [];
    for (const [r, c] of q) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = r + dr, y = c + dc;
      if (x >= 0 && y >= 0 && x < 3 && y < 3 && g[x][y] === 1) { g[x][y] = 2; fresh--; nq.push([x, y]); newly.push([x, y]); }
    }
    t++;
    q = nq;
    F({ cap: `第 ${t} 分钟：上一层烂橘子感染相邻的 ${newly.length} 个`, blocks: [G(g, { hl: gridHl(newly, 'bad', base()) }), V(['分钟', t, 'cur'], ['新鲜', fresh])] });
  }
  const ans = fresh ? -1 : t;
  F({ cap: fresh ? '还有新鲜橘子够不到 → -1' : `全部腐烂，用时 **${t}** 分钟`, blocks: [G(g, { hl: base() }), TX('return ' + ans)], done: true, ans });
});

T('207', 'Kahn 拓扑排序：入度为 0 的课先上，能上完所有课就无环', 'numCourses = 4, prerequisites = [[1,0],[2,0],[3,1],[3,2]]', true, (F) => {
  const nodes = [{ k: 0, x: 0, y: 0.5 }, { k: 1, x: 0.4, y: 0 }, { k: 2, x: 0.4, y: 1 }, { k: 3, x: 0.85, y: 0.5 }];
  const edges = [[0, 1], [0, 2], [1, 3], [2, 3]];
  const indeg = [0, 1, 1, 2];
  const q = [0], done = [];
  const draw = (cap, cur, ehl, fin) => F({ cap, blocks: [{ t: 'graph', nodes, edges, directed: true, h: 170, hl: Object.assign(Object.fromEntries(done.map((x) => [x, 'ok'])), cur != null ? { [cur]: 'cur' } : {}), ehl: ehl || {}, tag: Object.fromEntries(indeg.map((d, i) => [i, 'in=' + d])) }, Q(q, { label: '队列（入度为 0）' }), V(['已修', fmt(done)])], done: fin, ans: fin ? done.length === 4 : undefined });
  draw('边 a → b 表示先修 a 才能修 b；先统计每门课的入度');
  while (q.length) {
    const u = q.shift();
    done.push(u);
    const eh = {};
    edges.filter(([a]) => a === u).forEach(([, b]) => { indeg[b]--; eh[u + '-' + b] = 'on'; if (indeg[b] === 0) q.push(b); });
    draw(`修完课程 ${u}，它指向的课入度 −1；减到 0 的入队`, u, eh);
  }
  draw(`修完 ${done.length} / 4 门 → **无环，可以完成**；若有环，环上的课入度永远不为 0`, null, {}, true);
});

T('208', '每个节点 26 个孩子 + isEnd 标记；插入与查找都沿着字符走', 'insert "app", "apple", "bat"；search "app"、startsWith "ba"', true, (F) => {
  const root = { ch: {}, end: false, key: 'root' };
  const layout = () => {
    const list = [];
    const walk = (n, d, label) => { const me = { n, d, label, kids: [] }; list.push(me); Object.keys(n.ch).sort().forEach((c) => me.kids.push(walk(n.ch[c], d + 1, c))); return me; };
    const top = walk(root, 0, '·');
    let x = 0;
    const place = (m) => { if (!m.kids.length) { m.x = x++; return; } m.kids.forEach(place); m.x = (m.kids[0].x + m.kids[m.kids.length - 1].x) / 2; };
    place(top);
    const maxD = Math.max(...list.map((m) => m.d)), maxX = Math.max(1, x - 1);
    const nodes = list.map((m) => ({ k: m.n.key, x: m.x / maxX, y: m.d / Math.max(1, maxD), label: m.label }));
    const edges = [];
    list.forEach((m) => m.kids.forEach((c) => edges.push([m.n.key, c.n.key])));
    return { nodes, edges, ends: list.filter((m) => m.n.end).map((m) => m.n.key) };
  };
  const draw = (cap, path, cls, fin, ans) => { const L = layout(); F({ cap, blocks: [{ t: 'graph', nodes: L.nodes, edges: L.edges, directed: true, h: 230, hl: Object.assign(Object.fromEntries(L.ends.map((k) => [k, 'ok'])), Object.fromEntries(path.map((k) => [k, cls]))), tag: Object.fromEntries(L.ends.map((k) => [k, 'end'])) }], done: fin, ans }); };
  const insert = (w) => {
    let n = root; const path = ['root'];
    for (const c of w) { if (!n.ch[c]) n.ch[c] = { ch: {}, end: false, key: n.key + c }; n = n.ch[c]; path.push(n.key); }
    n.end = true;
    draw(`insert("${w}")：沿字符向下走，没有就新建节点，最后一个节点标记 end`, path, 'cur');
  };
  draw('空 Trie：只有根节点', [], 'cur');
  insert('app'); insert('apple'); insert('bat');
  let n = root; const p1 = ['root'];
  for (const c of 'app') { n = n.ch[c]; p1.push(n.key); }
  draw('search("app")：走到 p 节点且 isEnd = true → **true**', p1, 'warn');
  let m = root; const p2 = ['root'];
  for (const c of 'ba') { m = m.ch[c]; p2.push(m.key); }
  draw('startsWith("ba")：能走完前缀就是 true，不要求 isEnd', p2, 'warn', true, true);
});

/* ============================== 回溯 ============================== */
T('46', '回溯：选一个没用过的数加入路径 → 递归 → 撤销选择', 'nums = [1,2,3]', [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]], (F) => {
  const nums = [1, 2, 3], used = [false, false, false], path = [], res = [];
  const draw = (cap, cur, cls) => F({ cap, blocks: [A(nums, { label: 'nums（灰 = 已在路径中）', hl: Object.assign(Object.fromEntries(used.map((u, i) => [i, u ? 'dim' : ''])), cur != null ? { [cur]: cls } : {}) }), S(path, { label: '路径 path' }), V(['结果数', res.length, 'ok'])] });
  const bt = () => {
    if (path.length === 3) { res.push(path.slice()); draw(`路径长度 = 3 → 收集 ${fmt(path)}`, null); return; }
    for (let i = 0; i < 3; i++) {
      if (used[i]) continue;
      used[i] = true; path.push(nums[i]);
      draw(`选择 ${nums[i]}`, i, 'cur');
      bt();
      used[i] = false; path.pop();
      draw(`撤销 ${nums[i]}，尝试同层下一个`, i, 'warn');
    }
  };
  bt();
  F({ cap: `共 ${res.length} 个排列（n!）；used 数组保证每个数只用一次`, blocks: [TX(fmt(res))], done: true, ans: res });
});

T('78', '每个位置「选或不选」；或者用 start 下标保证不回头', 'nums = [1,2,3]', [[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]], (F) => {
  const nums = [1, 2, 3], path = [], res = [];
  const bt = (st) => {
    res.push(path.slice());
    F({ cap: `进入节点就收集：${fmt(path)}（子集问题每个节点都是答案）`, blocks: [A(nums, { hl: rng(0, st - 1, 'dim'), p: st < 3 ? { start: st } : {} }), S(path, { label: '路径' }), V(['已收集', res.length, 'ok'])] });
    for (let i = st; i < 3; i++) {
      path.push(nums[i]);
      bt(i + 1);
      path.pop();
    }
  };
  bt(0);
  F({ cap: `共 2³ = ${res.length} 个子集`, blocks: [TX(fmt(res))], done: true, ans: res });
});

T('17', '按数字逐位回溯，每位枚举它对应的字母', 'digits = "23"', ['ad', 'ae', 'af', 'bd', 'be', 'bf', 'cd', 'ce', 'cf'], (F) => {
  const map = { 2: 'abc', 3: 'def' }, d = '23', res = [], path = [];
  const bt = (i) => {
    if (i === d.length) { res.push(path.join('')); F({ cap: `凑满 ${d.length} 位 → "${path.join('')}"`, blocks: [A(d.split(''), { label: 'digits', hl: rng(0, 1, 'ok') }), S(path, { label: '路径' }), V(['结果', res.join(' '), 'ok'])] }); return; }
    for (const c of map[d[i]]) {
      path.push(c);
      F({ cap: `第 ${i + 1} 位数字 ${d[i]} → 尝试 '${c}'`, blocks: [A(d.split(''), { label: 'digits', hl: { [i]: 'cur' }, p: { i } }), M(Object.entries(map), { label: '数字 → 字母', hl: d[i] }), S(path, { label: '路径' })] });
      bt(i + 1);
      path.pop();
    }
  };
  bt(0);
  F({ cap: `共 3 × 3 = ${res.length} 个组合`, blocks: [TX(res.join(' '))], done: true, ans: res });
});

T('39', '可以重复选：递归时起点仍是 i；排序后超过目标直接剪枝', 'candidates = [2,3,6,7], target = 7', [[2, 2, 3], [7]], (F) => {
  const a = [2, 3, 6, 7], res = [], path = [];
  const bt = (st, rest) => {
    if (rest === 0) { res.push(path.slice()); F({ cap: `剩余 0 → 收集 ${fmt(path)}`, blocks: [A(a, { p: { start: st } }), S(path, { label: '路径' }), V(['剩余', 0, 'ok'], ['结果', fmt(res), 'ok'])] }); return; }
    for (let i = st; i < a.length; i++) {
      if (a[i] > rest) { F({ cap: `${a[i]} > 剩余 ${rest}，后面更大 → 剪枝`, blocks: [A(a, { hl: rng(i, a.length - 1, 'bad'), p: { i } }), S(path, { label: '路径' }), V(['剩余', rest])] }); break; }
      path.push(a[i]);
      F({ cap: `选 ${a[i]}，剩余 ${rest - a[i]}（下一层仍从 ${a[i]} 开始，允许重复）`, blocks: [A(a, { hl: { [i]: 'cur' }, p: { i } }), S(path, { label: '路径' }), V(['剩余', rest - a[i], 'cur'])] });
      bt(i, rest - a[i]);
      path.pop();
    }
  };
  bt(0, 7);
  F({ cap: `结果 ${fmt(res)}`, blocks: [TX(fmt(res))], done: true, ans: res });
});

T('22', '左括号数 < n 就能放左；右括号数 < 左括号数才能放右', 'n = 3', ['((()))', '(()())', '(())()', '()(())', '()()()'], (F) => {
  const n = 3, res = [], path = [];
  const bt = (l, r) => {
    if (path.length === 2 * n) { res.push(path.join('')); F({ cap: `长度 6 → 收集 "${path.join('')}"`, blocks: [S(path, { label: '路径' }), V(['左', l], ['右', r], ['结果', res.length, 'ok'])] }); return; }
    if (l < n) { path.push('('); F({ cap: `左括号 ${l} < ${n} → 放 '('`, blocks: [S(path, { label: '路径', hl: { [path.length - 1]: 'cur' } }), V(['左', l + 1, 'cur'], ['右', r])] }); bt(l + 1, r); path.pop(); }
    if (r < l) { path.push(')'); F({ cap: `右括号 ${r} < 左括号 ${l} → 放 ')'`, blocks: [S(path, { label: '路径', hl: { [path.length - 1]: 'warn' } }), V(['左', l], ['右', r + 1, 'cur'])] }); bt(l, r + 1); path.pop(); }
  };
  bt(0, 0);
  F({ cap: `共 ${res.length} 种（卡特兰数）；约束保证任意前缀右括号不多于左括号`, blocks: [TX(res.join('  '))], done: true, ans: res });
});

T('79', '网格 DFS：当前格匹配就标记已访问，四个方向继续，失败回溯', 'board = [[A,B,C,E],[S,F,C,S],[A,D,E,E]], word = "ABCCED"', true, (F) => {
  const b = [['A', 'B', 'C', 'E'], ['S', 'F', 'C', 'S'], ['A', 'D', 'E', 'E']], w = 'ABCCED';
  const path = [];
  const dfs = (r, c, k) => {
    if (k === w.length) return true;
    if (r < 0 || c < 0 || r >= 3 || c >= 4 || b[r][c] !== w[k]) return false;
    path.push([r, c]);
    const keep = b[r][c]; b[r][c] = '#';
    F({ cap: `(${r},${c}) = '${keep}' 匹配 word[${k}]，标记为已访问`, blocks: [G(b.map((row) => row.map((x) => (x === '#' ? '·' : x))), { hl: gridHl(path, 'ok', { [r + ',' + c]: 'cur' }) }), A(w.split(''), { label: 'word', hl: Object.assign(rng(0, k - 1, 'ok'), { [k]: 'cur' }) })] });
    const ok = dfs(r + 1, c, k + 1) || dfs(r - 1, c, k + 1) || dfs(r, c + 1, k + 1) || dfs(r, c - 1, k + 1);
    b[r][c] = keep;
    if (!ok) { path.pop(); F({ cap: `(${r},${c}) 四个方向都走不通 → 恢复并回溯`, blocks: [G(b, { hl: gridHl(path, 'ok', { [r + ',' + c]: 'bad' }) }), A(w.split(''), { label: 'word', hl: rng(0, k - 1, 'ok') })] }); }
    return ok;
  };
  let found = false;
  for (let r = 0; r < 3 && !found; r++) for (let c = 0; c < 4 && !found; c++) if (dfs(r, c, 0)) found = true;
  F({ cap: `找到路径 A→B→C→C→E→D，**true**`, blocks: [G(b, { hl: gridHl(path, 'ok') }), A(w.split(''), { label: 'word', hl: rng(0, 5, 'ok') })], done: true, ans: found });
});

T('131', '枚举切割点：前缀是回文才切下，剩余部分递归', 's = "aab"', [['a', 'a', 'b'], ['aa', 'b']], (F) => {
  const s = 'aab', res = [], path = [];
  const pal = (x) => x === x.split('').reverse().join('');
  const bt = (st) => {
    if (st === s.length) { res.push(path.slice()); F({ cap: `切完 → 收集 ${fmt(path)}`, blocks: [A(s.split(''), { hl: rng(0, 2, 'ok') }), S(path, { label: '已切下的回文串' }), V(['结果', fmt(res), 'ok'])] }); return; }
    for (let e = st; e < s.length; e++) {
      const sub = s.slice(st, e + 1);
      const ok = pal(sub);
      F({ cap: `尝试切下 "${sub}"：${ok ? '是回文 → 切' : '不是回文 → 跳过'}`, blocks: [A(s.split(''), { win: [st, e], winCls: ok ? 'ok' : 'bad', hl: rng(0, st - 1, 'dim') }), S(path, { label: '已切下的回文串' })] });
      if (!ok) continue;
      path.push(sub); bt(e + 1); path.pop();
    }
  };
  bt(0);
  F({ cap: `共 ${res.length} 种；可用 dp[i][j] 预处理回文，把判断降到 O(1)`, blocks: [TX(fmt(res))], done: true, ans: res });
});

T('51', '逐行放皇后，用 列 / 主对角 r−c / 副对角 r+c 三个集合剪枝', 'n = 4（展示找到第一个解的过程）', ['.Q..', '...Q', 'Q...', '..Q.'], (F) => {
  const n = 4, cols = new Set(), d1 = new Set(), d2 = new Set(), q = [];
  const board = () => Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (q[r] === c ? '♛' : '')));
  const attacked = () => { const o = {}; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q[r] !== c && (cols.has(c) || d1.has(r - c) || d2.has(r + c))) o[r + ',' + c] = 'dim'; q.forEach((c, r) => { o[r + ',' + c] = 'ok'; }); return o; };
  let sol = null;
  const bt = (r) => {
    if (r === n) { sol = q.map((c) => '.'.repeat(c) + 'Q' + '.'.repeat(n - c - 1)); return true; }
    for (let c = 0; c < n; c++) {
      if (cols.has(c) || d1.has(r - c) || d2.has(r + c)) continue;
      q[r] = c; cols.add(c); d1.add(r - c); d2.add(r + c);
      F({ cap: `第 ${r} 行放在第 ${c} 列（灰色格子已被攻击）`, blocks: [G(board(), { hl: Object.assign(attacked(), { [r + ',' + c]: 'cur' }) }), V(['行', r])] });
      if (bt(r + 1)) return true;
      cols.delete(c); d1.delete(r - c); d2.delete(r + c); q.length = r;
      F({ cap: `第 ${r + 1} 行无处可放 → 撤销第 ${r} 行的皇后（列 ${c}）`, blocks: [G(board(), { hl: Object.assign(attacked(), { [r + ',' + c]: 'bad' }) }), V(['行', r])] });
    }
    return false;
  };
  bt(0);
  F({ cap: `第一个解 ${fmt(sol)}；n = 4 共 2 个解`, blocks: [G(board(), { hl: attacked() })], done: true, ans: sol });
});

T('40', '排序后同层跳过重复值；每个数只能用一次（下一层从 i+1 开始）', 'candidates = [2,5,2,1,2], target = 5', [[1, 2, 2], [5]], (F) => {
  const a = [2, 5, 2, 1, 2].sort((x, y) => x - y), res = [], path = [];
  F({ cap: `排序：${fmt(a)}`, blocks: [A(a)] });
  const bt = (st, rest) => {
    if (rest === 0) { res.push(path.slice()); F({ cap: `收集 ${fmt(path)}`, blocks: [A(a), S(path, { label: '路径' }), V(['结果', fmt(res), 'ok'])] }); return; }
    for (let i = st; i < a.length; i++) {
      if (i > st && a[i] === a[i - 1]) { F({ cap: `同一层 ${a[i]} 已经试过 → 跳过（避免重复组合）`, blocks: [A(a, { hl: { [i]: 'dim' }, p: { i } }), S(path, { label: '路径' })] }); continue; }
      if (a[i] > rest) break;
      path.push(a[i]);
      F({ cap: `选 ${a[i]}，剩余 ${rest - a[i]}`, blocks: [A(a, { hl: { [i]: 'cur' }, p: { i } }), S(path, { label: '路径' }), V(['剩余', rest - a[i]])] });
      bt(i + 1, rest - a[i]);
      path.pop();
    }
  };
  bt(0, 5);
  F({ cap: `结果 ${fmt(res)}`, blocks: [TX(fmt(res))], done: true, ans: res });
});

T('47', '有重复数字：排序 + 「前一个相同的数没用过就跳过」', 'nums = [1,1,2]', [[1, 1, 2], [1, 2, 1], [2, 1, 1]], (F) => {
  const a = [1, 1, 2], used = [false, false, false], path = [], res = [];
  const bt = () => {
    if (path.length === 3) { res.push(path.slice()); F({ cap: `收集 ${fmt(path)}`, blocks: [A(a, { hl: Object.fromEntries(used.map((u, i) => [i, u ? 'dim' : ''])) }), S(path, { label: '路径' }), V(['结果', fmt(res), 'ok'])] }); return; }
    for (let i = 0; i < 3; i++) {
      if (used[i]) continue;
      if (i > 0 && a[i] === a[i - 1] && !used[i - 1]) { F({ cap: `a[${i}] = a[${i - 1}] 且前一个没被用 → 同层重复，跳过`, blocks: [A(a, { hl: { [i]: 'bad' } }), S(path, { label: '路径' })] }); continue; }
      used[i] = true; path.push(a[i]);
      F({ cap: `选 a[${i}] = ${a[i]}`, blocks: [A(a, { hl: Object.assign(Object.fromEntries(used.map((u, j) => [j, u ? 'dim' : ''])), { [i]: 'cur' }) }), S(path, { label: '路径' })] });
      bt();
      used[i] = false; path.pop();
    }
  };
  bt();
  F({ cap: `去重后 ${res.length} 个排列`, blocks: [TX(fmt(res))], done: true, ans: res });
});

/* ============================== 二分查找 ============================== */
const bsFrames = (F, a, target, mode) => {
  let l = 0, r = a.length - 1, ans = mode === 'insert' ? a.length : -1;
  F({ cap: `在 [0, ${a.length - 1}] 上二分；循环不变量：答案始终在 [l, r] 或等于记录值`, blocks: [A(a, { p: { l, r }, win: [l, r] }), V(['target', target])] });
  while (l <= r) {
    const m = l + ((r - l) >> 1);
    let cap;
    if (mode === 'find') {
      if (a[m] === target) { F({ cap: `a[${m}] = ${a[m]} == target → 找到`, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: { [m]: 'ok' } })], done: true, ans: m }); return m; }
      cap = a[m] < target ? `a[${m}] = ${a[m]} < ${target} → 答案在右半，l = m + 1` : `a[${m}] = ${a[m]} > ${target} → 答案在左半，r = m − 1`;
      F({ cap, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: { [m]: 'cur' } })] });
      if (a[m] < target) l = m + 1; else r = m - 1;
    } else if (mode === 'insert') {
      if (a[m] >= target) { ans = m; cap = `a[${m}] = ${a[m]} ≥ ${target} → 记录 ans = ${m}，继续往左找更靠前的位置`; F({ cap, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: { [m]: 'warn' } }), V(['ans', ans, 'ok'])] }); r = m - 1; }
      else { cap = `a[${m}] = ${a[m]} < ${target} → l = m + 1`; F({ cap, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: { [m]: 'cur' } }), V(['ans', ans])] }); l = m + 1; }
    }
  }
  if (mode === 'find') { F({ cap: 'l > r，未找到 → -1', blocks: [A(a)], done: true, ans: -1 }); return -1; }
  F({ cap: `第一个 ≥ ${target} 的位置是 **${ans}**（lower_bound），O(log n)`, blocks: [A(a, { hl: { [ans]: 'ok' }, p: { ans } })], done: true, ans });
  return ans;
};
T('704', '标准二分：闭区间 [l, r]，循环条件 l <= r', 'nums = [-1,0,3,5,9,12], target = 9', 4, (F) => { bsFrames(F, [-1, 0, 3, 5, 9, 12], 9, 'find'); });
T('35', '找第一个 ≥ target 的位置（lower_bound）', 'nums = [1,3,5,6], target = 2', 1, (F) => { bsFrames(F, [1, 3, 5, 6], 2, 'insert'); });

T('34', '两次二分：分别找左边界和右边界', 'nums = [5,7,7,8,8,10], target = 8', [3, 4], (F) => {
  const a = [5, 7, 7, 8, 8, 10];
  const bound = (left) => {
    let l = 0, r = a.length - 1, ans = -1;
    while (l <= r) {
      const m = (l + r) >> 1;
      if (a[m] === 8) { ans = m; F({ cap: `${left ? '找左边界' : '找右边界'}：a[${m}] = 8 → 记录 ${m}，继续向${left ? '左' : '右'}收缩`, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: { [m]: 'ok' } }), V([left ? 'left' : 'right', ans, 'ok'])] }); if (left) r = m - 1; else l = m + 1; }
      else { F({ cap: `${left ? '找左边界' : '找右边界'}：a[${m}] = ${a[m]} ${a[m] < 8 ? '< 8 → l = m + 1' : '> 8 → r = m − 1'}`, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: { [m]: 'cur' } })] }); if (a[m] < 8) l = m + 1; else r = m - 1; }
    }
    return ans;
  };
  const L = bound(true), Rr = bound(false);
  F({ cap: `区间 **[${L}, ${Rr}]**；两次二分 O(log n)`, blocks: [A(a, { win: [L, Rr], winCls: 'ok', hl: rng(L, Rr, 'ok') })], done: true, ans: [L, Rr] });
});

T('33', '旋转数组：mid 两侧至少有一侧有序，判断 target 落在哪一侧', 'nums = [4,5,6,7,0,1,2], target = 0', 4, (F) => {
  const a = [4, 5, 6, 7, 0, 1, 2], t = 0;
  let l = 0, r = 6;
  while (l <= r) {
    const m = (l + r) >> 1;
    if (a[m] === t) { F({ cap: `a[${m}] = ${t}，找到`, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: { [m]: 'ok' } })], done: true, ans: m }); return; }
    if (a[l] <= a[m]) {
      const inLeft = a[l] <= t && t < a[m];
      F({ cap: `左半 [${l}, ${m}] 有序（${a[l]} ≤ ${a[m]}）；target ${inLeft ? '在其中 → r = m − 1' : '不在其中 → l = m + 1'}`, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: Object.assign(rng(l, m, 'sel'), { [m]: 'cur' }) })] });
      if (inLeft) r = m - 1; else l = m + 1;
    } else {
      const inRight = a[m] < t && t <= a[r];
      F({ cap: `右半 [${m}, ${r}] 有序；target ${inRight ? '在其中 → l = m + 1' : '不在其中 → r = m − 1'}`, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: Object.assign(rng(m, r, 'sel'), { [m]: 'cur' }) })] });
      if (inRight) l = m + 1; else r = m - 1;
    }
  }
  F({ cap: '未找到', blocks: [], done: true, ans: -1 });
});

T('153', '和右端点比较：a[m] > a[r] 说明最小值在右边', 'nums = [4,5,6,7,0,1,2]', 0, (F) => {
  const a = [4, 5, 6, 7, 0, 1, 2];
  let l = 0, r = 6;
  while (l < r) {
    const m = (l + r) >> 1;
    F({ cap: a[m] > a[r] ? `a[${m}] = ${a[m]} > a[r] = ${a[r]}：最小值一定在 (m, r] → l = m + 1` : `a[${m}] = ${a[m]} ≤ a[r] = ${a[r]}：[m, r] 有序，最小值在 [l, m] → r = m`, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: { [m]: 'cur' } })] });
    if (a[m] > a[r]) l = m + 1; else r = m;
  }
  F({ cap: `l == r，最小值 **${a[l]}**；用 l < r 与 r = m，不会漏掉答案`, blocks: [A(a, { hl: { [l]: 'ok' }, p: { ans: l } })], done: true, ans: a[l] });
});

T('162', '往上坡方向走一定能找到峰：a[m] < a[m+1] 就去右边', 'nums = [1,2,1,3,5,6,4]', 5, (F) => {
  const a = [1, 2, 1, 3, 5, 6, 4];
  let l = 0, r = 6;
  while (l < r) {
    const m = (l + r) >> 1;
    F({ cap: a[m] < a[m + 1] ? `a[${m}] = ${a[m]} < a[${m + 1}] = ${a[m + 1]}：右边是上坡，峰在右侧 → l = m + 1` : `a[${m}] = ${a[m]} > a[${m + 1}]：下坡，峰在 [l, m] → r = m`, blocks: [BARS(a, { hl: { [m]: 'cur', [m + 1]: 'warn' }, p: { l, m, r } })] });
    if (a[m] < a[m + 1]) l = m + 1; else r = m;
  }
  F({ cap: `峰值下标 **${l}**（值 ${a[l]}）；题目保证两端视为 −∞，所以上坡方向必有峰`, blocks: [BARS(a, { hl: { [l]: 'ok' }, p: { peak: l } })], done: true, ans: l });
});

T('69', '在 [0, x] 上二分最大的 m，使 m·m ≤ x', 'x = 8', 2, (F) => {
  const x = 8;
  let l = 0, r = 8, ans = 0;
  const cells = Array.from({ length: 9 }, (_, i) => i);
  while (l <= r) {
    const m = (l + r) >> 1;
    const ok = m * m <= x;
    if (ok) ans = m;
    F({ cap: `m = ${m}，m² = ${m * m} ${ok ? `≤ 8 → 记录 ans = ${m}，l = m + 1` : '> 8 → r = m − 1'}（Java 用 long 或 m ≤ x / m 防溢出）`, blocks: [A(cells, { p: { l, m, r }, win: [l, r], hl: { [m]: ok ? 'ok' : 'bad' } }), V(['ans', ans, 'ok'])] });
    if (ok) l = m + 1; else r = m - 1;
  }
  F({ cap: `√8 向下取整 = **${ans}**`, blocks: [A(cells, { hl: { [ans]: 'ok' } })], done: true, ans });
});

T('540', '成对出现：偶数下标 m 与 m+1 相等说明单个元素在右边', 'nums = [1,1,2,3,3,4,4,8,8]', 2, (F) => {
  const a = [1, 1, 2, 3, 3, 4, 4, 8, 8];
  let l = 0, r = 8;
  while (l < r) {
    let m = (l + r) >> 1;
    if (m % 2 === 1) m--;
    const pair = a[m] === a[m + 1];
    F({ cap: `把 m 调成偶数 ${m}：a[${m}] ${pair ? '== a[m+1] → 前面都成对，答案在右边，l = m + 2' : '≠ a[m+1] → 配对被打乱，答案在左边（含 m），r = m'}`, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: { [m]: 'cur', [m + 1]: pair ? 'ok' : 'bad' } })] });
    if (pair) l = m + 2; else r = m;
  }
  F({ cap: `单个元素 **${a[l]}**，O(log n)`, blocks: [A(a, { hl: { [l]: 'ok' } })], done: true, ans: a[l] });
});

T('74', '把 m×n 矩阵看成长度 m·n 的有序数组：下标 k → (k / n, k % n)', 'matrix = [[1,3,5,7],[10,11,16,20],[23,30,34,60]], target = 3', true, (F) => {
  const g = [[1, 3, 5, 7], [10, 11, 16, 20], [23, 30, 34, 60]], n = 4;
  let l = 0, r = 11;
  while (l <= r) {
    const m = (l + r) >> 1, rr = Math.floor(m / n), cc = m % n, v = g[rr][cc];
    F({ cap: `mid = ${m} → (${rr}, ${cc}) = ${v}${v === 3 ? ' → 找到' : v < 3 ? ' < 3 → l = mid + 1' : ' > 3 → r = mid − 1'}`, blocks: [G(g, { hl: { [rr + ',' + cc]: v === 3 ? 'ok' : 'cur' } }), V(['l', l], ['mid', m, 'cur'], ['r', r])] });
    if (v === 3) { F({ cap: '**true**，O(log(m·n))', blocks: [G(g, { hl: { [rr + ',' + cc]: 'ok' } })], done: true, ans: true }); return; }
    if (v < 3) l = m + 1; else r = m - 1;
  }
  F({ cap: 'false', blocks: [], done: true, ans: false });
});

T('378', '二分答案值：统计 ≤ mid 的个数（从左下角走一遍），个数 ≥ k 就收缩右界', 'matrix = [[1,5,9],[10,11,13],[12,13,15]], k = 8', 13, (F) => {
  const g = [[1, 5, 9], [10, 11, 13], [12, 13, 15]], k = 8;
  let lo = 1, hi = 15;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    let cnt = 0, r = 2, c = 0;
    const le = {};
    while (r >= 0 && c < 3) { if (g[r][c] <= mid) { cnt += r + 1; for (let x = 0; x <= r; x++) le[x + ',' + c] = 'ok'; c++; } else r--; }
    F({ cap: `mid = ${mid}：≤ mid 的元素有 ${cnt} 个 ${cnt >= k ? `≥ ${k} → 答案 ≤ mid，hi = mid` : `< ${k} → 答案 > mid，lo = mid + 1`}`, blocks: [G(g, { hl: le }), V(['lo', lo], ['mid', mid, 'cur'], ['hi', hi], ['count', cnt, cnt >= k ? 'ok' : 'bad'])] });
    if (cnt >= k) hi = mid; else lo = mid + 1;
  }
  F({ cap: `第 ${k} 小 = **${lo}**；O(n·log(max − min))`, blocks: [G(g, { hl: { '1,2': 'ok', '2,1': 'ok' } })], done: true, ans: lo });
});

T('81', '有重复元素：a[l] == a[m] 时无法判断哪边有序，只能 l++', 'nums = [1,0,1,1,1], target = 0', true, (F) => {
  const a = [1, 0, 1, 1, 1], t = 0;
  let l = 0, r = 4;
  while (l <= r) {
    const m = (l + r) >> 1;
    if (a[m] === t) { F({ cap: `a[${m}] = 0，找到 → true`, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: { [m]: 'ok' } })], done: true, ans: true }); return; }
    if (a[l] === a[m] && a[m] === a[r]) { F({ cap: `a[l] = a[m] = a[r] = ${a[m]}，分不清哪边有序 → l++、r--（最坏退化为 O(n)）`, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: { [l]: 'warn', [m]: 'warn', [r]: 'warn' } })] }); l++; r--; continue; }
    if (a[l] <= a[m]) { const inL = a[l] <= t && t < a[m]; F({ cap: `左半有序，target ${inL ? '在左半' : '不在左半'}`, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: Object.assign(rng(l, m, 'sel'), { [m]: 'cur' }) })] }); if (inL) r = m - 1; else l = m + 1; }
    else { const inR = a[m] < t && t <= a[r]; F({ cap: `右半有序，target ${inR ? '在右半' : '不在右半'}`, blocks: [A(a, { p: { l, m, r }, win: [l, r], hl: Object.assign(rng(m, r, 'sel'), { [m]: 'cur' }) })] }); if (inR) l = m + 1; else r = m - 1; }
  }
  F({ cap: 'false', blocks: [], done: true, ans: false });
});

T('4', '在短数组上二分切分点 i，使左半部分恰好是较小的一半', 'nums1 = [1,3,8], nums2 = [2,4,5,7]', 4, (F) => {
  const A1 = [1, 3, 8], B1 = [2, 4, 5, 7], m = 3, n = 4, half = Math.floor((m + n + 1) / 2);
  let lo = 0, hi = m;
  while (lo <= hi) {
    const i = (lo + hi) >> 1, j = half - i;
    const aL = i ? A1[i - 1] : -Infinity, aR = i < m ? A1[i] : Infinity, bL = j ? B1[j - 1] : -Infinity, bR = j < n ? B1[j] : Infinity;
    const ok = aL <= bR && bL <= aR;
    const fx = (v) => (v === Infinity ? '+∞' : v === -Infinity ? '−∞' : v);
    F({ cap: `i = ${i}、j = ${half} − ${i} = ${j}：左侧最大 {${fx(aL)}, ${fx(bL)}}，右侧最小 {${fx(aR)}, ${fx(bR)}} ${ok ? '→ 交叉满足，切分正确' : aL > bR ? '→ A 左边太大，i 左移' : '→ B 左边太大，i 右移'}`, blocks: [A(A1, { id: 'a', label: 'nums1（竖线左侧 i 个）', hl: Object.assign(rng(0, i - 1, 'sel'), rng(i, m - 1, '')), p: { i } }), A(B1, { id: 'b', label: 'nums2（竖线左侧 j 个）', hl: rng(0, j - 1, 'sel'), p: { j } })] });
    if (ok) {
      const ans = (m + n) % 2 ? Math.max(aL, bL) : (Math.max(aL, bL) + Math.min(aR, bR)) / 2;
      F({ cap: `总数 7 为奇数 → 中位数 = 左侧最大值 max(${fx(aL)}, ${fx(bL)}) = **${ans}**；O(log min(m, n))`, blocks: [A(A1, { id: 'a', label: 'nums1', hl: rng(0, i - 1, 'ok') }), A(B1, { id: 'b', label: 'nums2', hl: rng(0, j - 1, 'ok') })], done: true, ans });
      return;
    }
    if (aL > bR) hi = i - 1; else lo = i + 1;
  }
});

/* ============================== 分治 ============================== */
T('50', '快速幂：n 的二进制每一位决定是否乘上当前的 x^(2^k)', 'x = 2, n = 10', 1024, (F) => {
  let x = 2, n = 10, res = 1;
  const bits = n.toString(2).split('');
  F({ cap: `10 的二进制是 ${n.toString(2)}：2^10 = 2^8 × 2^2`, blocks: [A(bits, { label: 'n 的二进制（高位 → 低位）' }), V(['res', 1], ['x', x])] });
  let k = 0;
  while (n > 0) {
    const bit = n & 1;
    if (bit) res *= x;
    F({ cap: `最低位 ${bit} ${bit ? `→ res ×= ${x}，res = ${res}` : '→ 不乘'}；然后 x = x²、n >>= 1`, blocks: [A(bits, { label: 'n 的二进制', hl: { [bits.length - 1 - k]: bit ? 'ok' : 'dim' } }), V(['res', res, bit ? 'ok' : ''], ['x', x, 'cur'], ['n', n])] });
    x *= x; n >>= 1; k++;
  }
  F({ cap: `结果 **${res}**，只乘了 O(log n) 次；负指数先取倒数，n 取 long 防 Integer.MIN_VALUE 溢出`, blocks: [TX('return ' + res)], done: true, ans: res });
});

T('215', '快速选择：partition 后只递归包含目标下标的一侧', 'nums = [3,2,1,5,6,4], k = 2', 5, (F) => {
  const a = [3, 2, 1, 5, 6, 4], target = a.length - 2;
  let l = 0, r = a.length - 1;
  F({ cap: `第 2 大 = 升序排序后下标 ${target} 的元素；平均 O(n)`, blocks: [A(a, { win: [l, r] })] });
  while (l <= r) {
    const pivot = a[r];
    let i = l;
    for (let j = l; j < r; j++) {
      const v = a[j], less = v < pivot;
      if (less) { [a[i], a[j]] = [a[j], a[i]]; i++; }
      F({ cap: `pivot = ${pivot}：${v} ${less ? '< pivot → 换到左侧，i++' : '≥ pivot → 留在右侧'}（[l, i) 始终都小于 pivot）`, blocks: [A(a, { win: [l, r], hl: Object.assign(rng(l, i - 1, 'sel'), { [r]: 'warn', [j]: 'cur' }), p: { i, j } })] });
    }
    [a[i], a[r]] = [a[r], a[i]];
    F({ cap: `pivot 归位到下标 ${i}；目标下标 ${target} ${i === target ? '正好命中' : i < target ? '在右侧 → 只处理右半' : '在左侧 → 只处理左半'}`, blocks: [A(a, { win: [l, r], hl: { [i]: i === target ? 'ok' : 'warn' }, p: { pivot: i } })] });
    if (i === target) { F({ cap: `第 2 大 = **${a[i]}**（随机选 pivot 可避免有序数组退化为 O(n²)）`, blocks: [A(a, { hl: { [i]: 'ok' } })], done: true, ans: a[i] }); return; }
    if (i < target) l = i + 1; else r = i - 1;
  }
});

/* ============================== 排序 ============================== */
T('排序 1', '插入排序：把 a[i] 插入到前面已排好的有序区', 'nums = [5,2,4,6,1,3]', [1, 2, 3, 4, 5, 6], (F) => {
  const a = [5, 2, 4, 6, 1, 3];
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;
    F({ cap: `取出 key = ${key}，前面 [0, ${i - 1}] 已有序`, blocks: [A(a, { hl: Object.assign(rng(0, i - 1, 'sel'), { [i]: 'cur' }), p: { i } }), V(['key', key, 'cur'])] });
    while (j >= 0 && a[j] > key) { a[j + 1] = a[j]; F({ cap: `${a[j]} > ${key} → 后移一位`, blocks: [A(a, { hl: Object.assign(rng(0, i, 'sel'), { [j + 1]: 'warn' }), p: { j } }), V(['key', key, 'cur'])] }); j--; }
    a[j + 1] = key;
    F({ cap: `把 ${key} 放到下标 ${j + 1}`, blocks: [A(a, { hl: Object.assign(rng(0, i, 'sel'), { [j + 1]: 'ok' }) })] });
  }
  F({ cap: '插入排序：稳定、原地，最好 O(n)（近乎有序时很快），最坏 O(n²)；冒泡 / 选择同为 O(n²)', blocks: [A(a, { hl: rng(0, 5, 'ok') })], done: true, ans: a.slice() });
});

T('排序 2', '快速排序：Lomuto 分区，pivot 左小右大，再递归两侧', 'nums = [3,6,1,8,2,5]', [1, 2, 3, 5, 6, 8], (F) => {
  const a = [3, 6, 1, 8, 2, 5], fin = new Set();
  const qs = (l, r) => {
    if (l > r) return;
    if (l === r) { fin.add(l); return; }
    const p = a[r];
    let i = l;
    for (let j = l; j < r; j++) if (a[j] < p) { [a[i], a[j]] = [a[j], a[i]]; i++; }
    [a[i], a[r]] = [a[r], a[i]];
    fin.add(i);
    F({ cap: `区间 [${l}, ${r}] 以 ${p} 为 pivot 分区：左边都 < ${p}，右边都 ≥ ${p}，${p} 已在最终位置 ${i}`, blocks: [A(a, { win: [l, r], hl: Object.assign(Object.fromEntries([...fin].map((x) => [x, 'ok'])), rng(l, i - 1, 'sel'), { [i]: 'ok' }), p: { pivot: i } })] });
    qs(l, i - 1); qs(i + 1, r);
  };
  qs(0, 5);
  F({ cap: '平均 O(n log n)，最坏 O(n²)，不稳定；工程上随机 pivot / 三数取中 + 小区间插入排序', blocks: [A(a, { hl: rng(0, 5, 'ok') })], done: true, ans: a.slice() });
});

T('排序 3', '归并排序：先拆到单个元素，再两两合并有序段', 'nums = [5,2,4,6,1,3]', [1, 2, 3, 4, 5, 6], (F) => {
  const a = [5, 2, 4, 6, 1, 3];
  const ms = (l, r) => {
    if (l >= r) return;
    const m = (l + r) >> 1;
    ms(l, m); ms(m + 1, r);
    const tmp = [];
    let i = l, j = m + 1;
    while (i <= m || j <= r) tmp.push(j > r || (i <= m && a[i] <= a[j]) ? a[i++] : a[j++]);
    tmp.forEach((v, k) => { a[l + k] = v; });
    F({ cap: `合并 [${l}, ${m}] 与 [${m + 1}, ${r}] → ${fmt(tmp)}（相等时取左边，保证稳定）`, blocks: [A(a, { win: [l, r], winCls: 'ok', hl: rng(l, r, 'ok') })] });
  };
  ms(0, 5);
  F({ cap: '稳定，O(n log n)，需要 O(n) 辅助数组；链表排序、外部排序都用它', blocks: [A(a, { hl: rng(0, 5, 'ok') })], done: true, ans: a.slice() });
});

T('排序 4', '堆排序：建大顶堆，堆顶与末尾交换后下沉', 'nums = [4,10,3,5,1]', [1, 3, 4, 5, 10], (F) => {
  const a = [4, 10, 3, 5, 1];
  const sift = (i, n) => {
    for (;;) {
      let big = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && a[l] > a[big]) big = l;
      if (r < n && a[r] > a[big]) big = r;
      if (big === i) return;
      [a[i], a[big]] = [a[big], a[i]];
      F({ cap: `下沉：${a[big]} 与更大的孩子 ${a[i]} 交换`, blocks: [TREE(a.slice(0, n), { hl: { [i]: 'cur', [big]: 'warn' } }), A(a, { hl: rng(n, a.length - 1, 'ok') })] });
      i = big;
    }
  };
  F({ cap: '数组即完全二叉树：i 的孩子是 2i+1、2i+2', blocks: [TREE(a), A(a)] });
  for (let i = (a.length >> 1) - 1; i >= 0; i--) sift(i, a.length);
  F({ cap: '建堆完成（从最后一个非叶子节点往前下沉，O(n)）', blocks: [TREE(a, { hl: { 0: 'ok' } }), A(a)] });
  for (let end = a.length - 1; end > 0; end--) {
    [a[0], a[end]] = [a[end], a[0]];
    F({ cap: `堆顶最大值 ${a[end]} 换到末尾 ${end}，堆大小减 1`, blocks: [TREE(a.slice(0, end), { hl: { 0: 'cur' } }), A(a, { hl: rng(end, a.length - 1, 'ok') })] });
    sift(0, end);
  }
  F({ cap: '原地、不稳定，O(n log n)；TopK 场景只需要维护大小为 K 的堆', blocks: [A(a, { hl: rng(0, 4, 'ok') })], done: true, ans: a.slice() });
});

;
/* ==========================================================================
   算法逐步演示（第 4 部分：栈 / 堆 / 贪心 / 动态规划 / 技巧 / 随机 / 数学）
   ========================================================================== */
const dpRow = (dp, o = {}) => A(dp.map((x) => (x === Infinity ? '∞' : x === -Infinity ? '−∞' : x === true ? 'T' : x === false ? 'F' : x)), Object.assign({ id: 'dp', label: 'dp' }, o));

/* ============================== 栈 ============================== */
T('20', '左括号入栈，右括号必须和栈顶配对', 's = "([]{})"', true, (F) => {
  const s = '([]{})'.split(''), st = [], pair = { ')': '(', ']': '[', '}': '{' };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!pair[c]) { st.push(c); F({ cap: `'${c}' 是左括号 → 入栈`, blocks: [A(s, { hl: { [i]: 'cur' }, p: { i } }), S(st, { hl: { [st.length - 1]: 'cur' } })] }); continue; }
    const ok = st.length && st[st.length - 1] === pair[c];
    F({ cap: `'${c}' 是右括号，栈顶 ${st.length ? "'" + st[st.length - 1] + "'" : '为空'} ${ok ? '匹配 → 弹出' : '不匹配 → false'}`, blocks: [A(s, { hl: { [i]: ok ? 'ok' : 'bad' }, p: { i } }), S(st, { hl: { [st.length - 1]: ok ? 'ok' : 'bad' } })] });
    if (!ok) { F({ cap: 'false', blocks: [], done: true, ans: false }); return; }
    st.pop();
  }
  F({ cap: `扫描结束栈为空 → **true**（栈不空说明有多余左括号）`, blocks: [A(s, { hl: rng(0, 5, 'ok') }), S(st)], done: true, ans: true });
});

T('155', '辅助栈同步记录「到当前为止的最小值」', 'push -2、push 0、push -3、getMin、pop、top、getMin', [-3, 0, -2], (F) => {
  const st = [], mn = [], out = [];
  const draw = (cap, done) => F({ cap, blocks: [S(st, { id: 'st', label: '数据栈' }), S(mn, { id: 'mn', label: '最小栈（与数据栈等高）', hl: { [mn.length - 1]: 'ok' } }), V(['输出', fmt(out)])], done, ans: done ? out.slice() : undefined });
  const push = (x) => { st.push(x); mn.push(mn.length ? Math.min(mn[mn.length - 1], x) : x); draw(`push(${x})：最小栈压入 min(${x}, 之前的最小值) = ${mn[mn.length - 1]}`); };
  push(-2); push(0); push(-3);
  out.push(mn[mn.length - 1]); draw(`getMin() = 最小栈栈顶 = ${mn[mn.length - 1]}，O(1)`);
  st.pop(); mn.pop(); draw('pop()：两个栈同时弹出');
  out.push(st[st.length - 1]); draw(`top() = ${st[st.length - 1]}`);
  out.push(mn[mn.length - 1]); draw(`getMin() = ${mn[mn.length - 1]}：-3 被弹出后最小值自动恢复为 -2`, true);
});

T('394', '遇到 [ 把「当前串 + 重复次数」压栈，遇到 ] 弹出拼接', 's = "3[a2[c]]"', 'accaccacc', (F) => {
  const s = '3[a2[c]]'.split('');
  const st = [];
  let cur = '', num = 0;
  s.forEach((c, i) => {
    if (/\d/.test(c)) { num = num * 10 + +c; F({ cap: `数字 ${c} → k = ${num}`, blocks: [A(s, { hl: { [i]: 'cur' }, p: { i } }), S(st.map(([k, p]) => `${k}×"${p}"`), { label: '栈（次数 × 之前的串）' }), V(['cur', `"${cur}"`], ['k', num])] }); }
    else if (c === '[') { st.push([num, cur]); F({ cap: `'[' → 把 (k=${num}, 之前的串 "${cur}") 压栈，当前串清空`, blocks: [A(s, { hl: { [i]: 'cur' }, p: { i } }), S(st.map(([k, p]) => `${k}×"${p}"`), { label: '栈（次数 × 之前的串）', hl: { [st.length - 1]: 'cur' } }), V(['cur', '""'], ['k', 0])] }); cur = ''; num = 0; }
    else if (c === ']') { const [k, prev] = st.pop(); const was = cur; cur = prev + cur.repeat(k); F({ cap: `']' → 弹出 (${k}, "${prev}")：cur = "${prev}" + "${was}" × ${k} = "${cur}"`, blocks: [A(s, { hl: { [i]: 'ok' }, p: { i } }), S(st.map(([kk, p]) => `${kk}×"${p}"`), { label: '栈（次数 × 之前的串）' }), V(['cur', `"${cur}"`, 'ok'])] }); }
    else { cur += c; F({ cap: `字母 '${c}' 追加到当前串`, blocks: [A(s, { hl: { [i]: 'cur' }, p: { i } }), S(st.map(([k, p]) => `${k}×"${p}"`), { label: '栈（次数 × 之前的串）' }), V(['cur', `"${cur}"`])] }); }
  });
  F({ cap: `结果 **"${cur}"**`, blocks: [TX(`"${cur}"`)], done: true, ans: cur });
});

T('739', '单调递减栈存下标：遇到更高温度就给栈里的日子结算', 'temperatures = [73,74,75,71,69,72,76,73]', [1, 1, 4, 2, 1, 1, 0, 0], (F) => {
  const t = [73, 74, 75, 71, 69, 72, 76, 73], ans = t.map(() => 0), st = [];
  for (let i = 0; i < t.length; i++) {
    while (st.length && t[st[st.length - 1]] < t[i]) {
      const j = st.pop(); ans[j] = i - j;
      F({ cap: `${t[i]} > 栈顶第 ${j} 天的 ${t[j]} → 第 ${j} 天等了 ${i - j} 天，出栈`, blocks: [BARS(t, { hl: { [i]: 'cur', [j]: 'ok' }, p: { i } }), S(st.map((x) => `${x}:${t[x]}`), { label: '栈（下标:温度，从底到顶递减）' }), A(ans, { id: 'r', label: 'answer', hl: { [j]: 'ok' } })] });
    }
    st.push(i);
    F({ cap: `第 ${i} 天（${t[i]}）入栈，等待更暖的一天`, blocks: [BARS(t, { hl: { [i]: 'cur' }, p: { i } }), S(st.map((x) => `${x}:${t[x]}`), { label: '栈（下标:温度，从底到顶递减）', hl: { [st.length - 1]: 'cur' } }), A(ans, { id: 'r', label: 'answer' })] });
  }
  F({ cap: `栈里剩下的日子之后没有更暖的，保持 0。每个下标进出栈一次，O(n)`, blocks: [A(ans, { id: 'r', label: 'answer', hl: rng(0, 7, 'ok') })], done: true, ans });
});

T('84', '单调递增栈：弹出时，它的左右第一个更矮的柱子就是矩形边界', 'heights = [2,1,5,6,2,3]', 10, (F) => {
  const h = [2, 1, 5, 6, 2, 3, 0], st = [];
  let best = 0, bl = 0, br = 0, bh = 0;
  for (let i = 0; i < h.length; i++) {
    while (st.length && h[st[st.length - 1]] > h[i]) {
      const j = st.pop();
      const left = st.length ? st[st.length - 1] + 1 : 0, w = i - left, area = h[j] * w;
      if (area > best) { best = area; bl = left; br = i - 1; bh = h[j]; }
      F({ cap: `${i < 6 ? h[i] : '哨兵 0'} < 栈顶高度 ${h[j]} → 以 ${h[j]} 为高：左边界 ${left}、右边界 ${i - 1}，面积 ${h[j]} × ${w} = ${area}${area === best ? '（最大）' : ''}`, blocks: [BARS(h.slice(0, 6), { hl: { [j]: 'warn', [Math.min(i, 5)]: i < 6 ? 'cur' : '' }, area: [left, i - 1, h[j]], p: i < 6 ? { i } : {} }), S(st.map((x) => `${x}:${h[x]}`), { label: '栈（高度递增）' }), V(['best', best, 'ok'])] });
    }
    st.push(i);
    if (i < 6) F({ cap: `柱 ${i}（高 ${h[i]}）入栈`, blocks: [BARS(h.slice(0, 6), { hl: { [i]: 'cur' }, p: { i } }), S(st.map((x) => `${x}:${h[x]}`), { label: '栈（高度递增）' }), V(['best', best])] });
  }
  F({ cap: `最大矩形 **${best}**（高 ${bh}，下标 ${bl}~${br}）；末尾补 0 当哨兵，把栈清空`, blocks: [BARS(h.slice(0, 6), { area: [bl, br, bh], hl: rng(bl, br, 'ok') })], done: true, ans: best });
});

T('225', '一个队列实现栈：每次 push 后把前面的元素依次转到队尾', 'push 1、push 2、push 3、top、pop、top', [3, 3, 2], (F) => {
  const q = [], out = [];
  const push = (x) => {
    q.push(x);
    F({ cap: `push(${x})：先入队`, blocks: [Q(q, { hl: { [q.length - 1]: 'cur' } }), V(['输出', fmt(out)])] });
    for (let i = 0; i < q.length - 1; i++) { q.push(q.shift()); }
    F({ cap: `再把前面 ${q.length - 1} 个元素依次出队、入队 → ${x} 转到队头，队头就是「栈顶」`, blocks: [Q(q, { hl: { 0: 'ok' } }), V(['输出', fmt(out)])] });
  };
  push(1); push(2); push(3);
  out.push(q[0]); F({ cap: `top() = 队头 ${q[0]}`, blocks: [Q(q, { hl: { 0: 'ok' } }), V(['输出', fmt(out)])] });
  out.push(q.shift()); F({ cap: `pop() = ${out[out.length - 1]}：直接出队`, blocks: [Q(q), V(['输出', fmt(out)])] });
  out.push(q[0]);
  F({ cap: `top() = ${q[0]}。push O(n)，pop / top O(1)`, blocks: [Q(q, { hl: { 0: 'ok' } }), V(['输出', fmt(out), 'ok'])], done: true, ans: out.slice() });
});

T('227', '乘除立刻和栈顶结合，加减先入栈（带符号），最后求和', 's = "3+2*2-4/2"', 5, (F) => {
  const s = '3+2*2-4/2'.split(''), st = [];
  let num = 0, op = '+';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/\d/.test(c)) num = num * 10 + +c;
    if (!/\d/.test(c) || i === s.length - 1) {
      let desc;
      if (op === '+') { st.push(num); desc = `前一个运算符是 +，把 ${num} 入栈`; }
      else if (op === '-') { st.push(-num); desc = `前一个运算符是 −，把 −${num} 入栈`; }
      else if (op === '*') { const t = st.pop(); st.push(t * num); desc = `前一个运算符是 ×：栈顶 ${t} × ${num} = ${t * num}`; }
      else { const t = st.pop(); st.push(Math.trunc(t / num)); desc = `前一个运算符是 ÷：栈顶 ${t} ÷ ${num} = ${Math.trunc(t / num)}`; }
      F({ cap: desc, blocks: [A(s, { hl: { [i]: 'cur' }, p: { i } }), S(st, { hl: { [st.length - 1]: 'cur' } }), V(['下一个运算符', /\d/.test(c) ? '结束' : c])] });
      op = c; num = 0;
    }
  }
  const ans = st.reduce((x, y) => x + y, 0);
  F({ cap: `栈内求和 ${st.join(' + ')} = **${ans}**`, blocks: [S(st, { hl: rng(0, st.length - 1, 'ok') }), TX('return ' + ans)], done: true, ans });
});

T('32', '栈底放「最后一个未匹配的右括号下标」，长度 = i − 栈顶', 's = ")()())"', 4, (F) => {
  const s = ')()())'.split(''), st = [-1];
  let best = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') { st.push(i); F({ cap: `'(' → 下标 ${i} 入栈`, blocks: [A(s, { hl: { [i]: 'cur' }, p: { i } }), S(st, { label: '栈（存下标，-1 为初始边界）' }), V(['best', best])] }); continue; }
    st.pop();
    if (!st.length) { st.push(i); F({ cap: `')' 无法匹配 → 下标 ${i} 成为新的边界`, blocks: [A(s, { hl: { [i]: 'bad' }, p: { i } }), S(st, { label: '栈（存下标，-1 为初始边界）', hl: { 0: 'warn' } }), V(['best', best])] }); }
    else { const len = i - st[st.length - 1]; best = Math.max(best, len); F({ cap: `')' 匹配成功，当前有效长度 = ${i} − ${st[st.length - 1]} = ${len}`, blocks: [A(s, { win: [st[st.length - 1] + 1, i], winCls: 'ok', p: { i } }), S(st, { label: '栈（存下标，-1 为初始边界）' }), V(['best', best, 'ok'])] }); }
  }
  F({ cap: `最长有效括号 **${best}**`, blocks: [A(s, { win: [1, 4], winCls: 'ok' })], done: true, ans: best });
});

/* ============================== 堆 ============================== */
T('347', '先计数，再维护大小为 k 的小顶堆（按频次）', 'nums = [1,1,1,2,2,3,3,3,3,4], k = 2', [3, 1], (F) => {
  const a = [1, 1, 1, 2, 2, 3, 3, 3, 3, 4], cnt = new Map();
  a.forEach((x) => cnt.set(x, (cnt.get(x) || 0) + 1));
  F({ cap: '第一步：HashMap 统计频次', blocks: [A(a, { cw: 34 }), M([...cnt], { label: '值 → 次数' })] });
  let heap = [];
  for (const [v, c] of cnt) {
    heap.push([v, c]); heap.sort((x, y) => x[1] - y[1]);
    let msg = `(${v}, 频次 ${c}) 入堆`;
    if (heap.length > 2) { const out = heap.shift(); msg += `，超过 k → 弹出频次最小的 (${out[0]}, ${out[1]})`; }
    F({ cap: msg, blocks: [M([...cnt], { label: '值 → 次数', hl: v }), S(heap.map(([x, y]) => `${x}:${y}次`), { label: '小顶堆（按频次，大小 ≤ k）', hl: { 0: 'warn' } })] });
  }
  const ans = heap.slice().sort((x, y) => y[1] - x[1]).map((x) => x[0]);
  F({ cap: `堆里剩下的就是前 k 高频：${fmt(ans)}；O(n log k)，也可用桶排序做到 O(n)`, blocks: [S(heap.map(([x, y]) => `${x}:${y}次`), { label: '小顶堆', hl: { 0: 'ok', 1: 'ok' } })], done: true, ans });
});

T('295', '大顶堆存较小一半，小顶堆存较大一半，大小差 ≤ 1', 'addNum 5、2、8、3、中位数依次查询', [5, 3.5, 5, 4], (F) => {
  const lo = [], hi = [], meds = [];
  const add = (x) => {
    lo.push(x); lo.sort((a, b) => b - a);
    hi.push(lo.shift()); hi.sort((a, b) => a - b);
    if (hi.length > lo.length) { lo.push(hi.shift()); lo.sort((a, b) => b - a); }
    const med = lo.length > hi.length ? lo[0] : (lo[0] + hi[0]) / 2;
    meds.push(med);
    F({ cap: `addNum(${x})：先进大顶堆，把它的堆顶挪到小顶堆，再平衡大小 → 中位数 **${med}**`, blocks: [S(lo, { id: 'lo', label: '大顶堆 small（堆顶在左）', hl: { 0: 'cur' } }), S(hi, { id: 'hi', label: '小顶堆 large（堆顶在左）', hl: { 0: 'warn' } }), V(['中位数', med, 'ok'], ['历史', fmt(meds)])] });
  };
  F({ cap: '保证 small 的所有数 ≤ large 的所有数；奇数个时 small 多一个', blocks: [S(lo, { id: 'lo', label: '大顶堆 small' }), S(hi, { id: 'hi', label: '小顶堆 large' })] });
  [5, 2, 8, 3].forEach(add);
  F({ cap: `addNum O(log n)，findMedian O(1)；结果 ${fmt(meds)}`, blocks: [V(['中位数序列', fmt(meds), 'ok'])], done: true, ans: meds.slice() });
});

T('面试变体 B', '合并 N 个有序数组：小顶堆存 (值, 数组号, 下标)', 'arrays = [[1,4,7],[2,5,8],[3,6,9]]', [1, 2, 3, 4, 5, 6, 7, 8, 9], (F) => {
  const L = [[1, 4, 7], [2, 5, 8], [3, 6, 9]], ptr = [0, 0, 0], res = [];
  const heap = () => L.map((l, i) => (ptr[i] < l.length ? [l[ptr[i]], i] : null)).filter(Boolean).sort((a, b) => a[0] - b[0]);
  const draw = (cap, done) => F({ cap, blocks: [...L.map((l, i) => A(l, { id: 'l' + i, label: `数组 ${i}`, cw: 36, hl: rng(0, ptr[i] - 1, 'dim'), p: ptr[i] < 3 ? { ['p' + i]: ptr[i] } : {} })), S(heap().map(([v, i]) => `${v}(#${i})`), { label: '小顶堆', hl: { 0: 'cur' } }), A(res, { id: 'r', label: '结果', cw: 30, hl: { [res.length - 1]: 'ok' } })], done, ans: done ? res.slice() : undefined });
  draw('每个数组的首元素入堆');
  while (heap().length) { const [v, i] = heap()[0]; ptr[i]++; res.push(v); draw(`弹出 ${v}（数组 ${i}），该数组下一个元素入堆`); }
  draw('O(N log k)，N 为总元素数，k 为数组个数', true);
});

/* ============================== 贪心 ============================== */
T('121', '一次遍历：记录目前为止的最低价，用今天卖出更新最大利润', 'prices = [7,1,5,3,6,4]', 5, (F) => {
  const p = [7, 1, 5, 3, 6, 4];
  let min = Infinity, best = 0, bi = 0, bj = 0, mi = 0;
  p.forEach((x, i) => {
    if (x < min) { min = x; mi = i; }
    if (x - min > best) { best = x - min; bi = mi; bj = i; }
    F({ cap: `第 ${i} 天价格 ${x}：历史最低 ${min}，今天卖出利润 ${x - min}，best = **${best}**`, blocks: [BARS(p, { hl: { [mi]: 'ok', [i]: 'cur' }, p: { i } }), V(['min', min, 'ok'], ['profit', x - min], ['best', best, 'ok'])] });
  });
  F({ cap: `第 ${bi} 天买、第 ${bj} 天卖，利润 **${best}**`, blocks: [BARS(p, { hl: { [bi]: 'ok', [bj]: 'ok' } })], done: true, ans: best });
});

T('55', '维护能到达的最远位置，走到超过最远位置就失败', 'nums = [2,3,1,1,4]', true, (F) => {
  const a = [2, 3, 1, 1, 4];
  let far = 0;
  for (let i = 0; i < a.length; i++) {
    if (i > far) { F({ cap: `下标 ${i} > 最远可达 ${far} → false`, blocks: [A(a, { hl: { [i]: 'bad' } })], done: true, ans: false }); return; }
    far = Math.max(far, i + a[i]);
    F({ cap: `站在 ${i}（能跳 ${a[i]}），最远可达 max(之前, ${i} + ${a[i]}) = **${far}**${far >= a.length - 1 ? ' ≥ 终点 → true' : ''}`, blocks: [A(a, { win: [0, Math.min(far, a.length - 1)], winCls: far >= a.length - 1 ? 'ok' : '', hl: { [i]: 'cur' }, p: { i } }), V(['far', far, 'ok'])] });
    if (far >= a.length - 1) { F({ cap: '能到达最后一个下标', blocks: [A(a, { win: [0, 4], winCls: 'ok' })], done: true, ans: true }); return; }
  }
});

T('45', '按「层」跳：当前这一跳能覆盖的区间走完，才必须再跳一次', 'nums = [2,3,1,1,4]', 2, (F) => {
  const a = [2, 3, 1, 1, 4];
  let end = 0, far = 0, jumps = 0;
  for (let i = 0; i < a.length - 1; i++) {
    far = Math.max(far, i + a[i]);
    F({ cap: `在 ${i}：下一跳最远能到 ${far}`, blocks: [A(a, { win: [i, end], hl: { [i]: 'cur' }, p: { i, end } }), V(['jumps', jumps], ['far', far, 'cur'])] });
    if (i === end) { jumps++; end = far; F({ cap: `走到当前跳的边界 → 必须再跳一次，jumps = ${jumps}，新边界 = ${end}`, blocks: [A(a, { win: [i + 1 <= end ? i + 1 : i, Math.min(end, 4)], winCls: 'ok', p: { end: Math.min(end, 4) } }), V(['jumps', jumps, 'ok'], ['far', far])] }); }
  }
  F({ cap: `最少 **${jumps}** 跳（0 → 1 → 4），O(n)`, blocks: [A(a, { hl: { 0: 'ok', 1: 'ok', 4: 'ok' } })], done: true, ans: jumps });
});

T('763', '先记录每个字母最后出现的位置；片段右端 = 片段内字母最后位置的最大值', 's = "abaccbdeffed"', [6, 6], (F) => {
  const s = 'abaccbdeffed'.split(''), last = {};
  s.forEach((c, i) => { last[c] = i; });
  F({ cap: '第一遍：每个字母最后一次出现的下标', blocks: [A(s), M(Object.entries(last), { label: '字母 → 最后位置' })] });
  const res = [];
  let start = 0, end = 0;
  s.forEach((c, i) => {
    end = Math.max(end, last[c]);
    F({ cap: `'${c}' 最后出现在 ${last[c]}，当前片段必须延伸到 ${end}${i === end ? ' → 走到右端，切一刀' : ''}`, blocks: [A(s, { win: [start, end], winCls: i === end ? 'ok' : '', hl: { [i]: 'cur' }, p: { i } }), M(Object.entries(last), { label: '字母 → 最后位置', hl: c }), V(['结果', fmt(res)])] });
    if (i === end) { res.push(end - start + 1); start = i + 1; }
  });
  F({ cap: `片段长度 ${fmt(res)}`, blocks: [TX(fmt(res))], done: true, ans: res });
});

T('1221', '计数器：R 加一、L 减一，归零时切一刀', 's = "RLRRLLRLRL"', 4, (F) => {
  const s = 'RLRRLLRLRL'.split('');
  let bal = 0, cnt = 0, st = 0;
  s.forEach((c, i) => {
    bal += c === 'R' ? 1 : -1;
    if (bal === 0) cnt++;
    F({ cap: `'${c}' → 平衡值 ${bal}${bal === 0 ? `，归零 → 切出一个平衡串，cnt = ${cnt}` : ''}`, blocks: [A(s, { win: [st, i], winCls: bal === 0 ? 'ok' : '', hl: { [i]: 'cur' }, p: { i } }), V(['balance', bal, bal === 0 ? 'ok' : 'cur'], ['count', cnt, 'ok'])] });
    if (bal === 0) st = i + 1;
  });
  F({ cap: `最多 **${cnt}** 个平衡子串；越早切越多`, blocks: [TX('return ' + cnt)], done: true, ans: cnt });
});

/* ============================== 动态规划（一维） ============================== */
T('70', 'dp[i] = dp[i−1] + dp[i−2]：最后一步跨 1 级或 2 级', 'n = 5', 8, (F) => {
  const dp = [1, 1];
  F({ cap: 'dp[0] = 1（不动也算一种）、dp[1] = 1', blocks: [dpRow(dp, { hl: { 0: 'ok', 1: 'ok' } })] });
  for (let i = 2; i <= 5; i++) { dp[i] = dp[i - 1] + dp[i - 2]; F({ cap: `dp[${i}] = dp[${i - 1}] + dp[${i - 2}] = ${dp[i - 1]} + ${dp[i - 2]} = **${dp[i]}**`, blocks: [dpRow(dp, { hl: { [i]: 'cur', [i - 1]: 'sel', [i - 2]: 'sel' }, p: { i } })] }); }
  F({ cap: `答案 ${dp[5]}；只依赖前两项，可压缩成两个变量 O(1) 空间`, blocks: [dpRow(dp, { hl: { 5: 'ok' } })], done: true, ans: dp[5] });
});

T('118', '每个数等于左上 + 右上，两端为 1', 'numRows = 5', [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1]], (F) => {
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const row = Array(i + 1).fill(1);
    for (let j = 1; j < i; j++) row[j] = rows[i - 1][j - 1] + rows[i - 1][j];
    rows.push(row);
    const g = rows.map((r) => [...r, ...Array(5 - r.length).fill(null)]);
    F({ cap: i < 2 ? `第 ${i} 行全是 1` : `第 ${i} 行：row[j] = 上一行 [j−1] + [j]，例如 ${rows[i - 1][0]} + ${rows[i - 1][1]} = ${row[1]}`, blocks: [G(g, { hl: Object.fromEntries(row.map((_, j) => [i + ',' + j, j === 0 || j === i ? 'sel' : 'cur'])) })] });
  }
  F({ cap: '共 O(n²)', blocks: [G(rows.map((r) => [...r, ...Array(5 - r.length).fill(null)]))], done: true, ans: rows });
});

T('198', 'dp[i] = max(不偷 i：dp[i−1]，偷 i：dp[i−2] + nums[i])', 'nums = [2,7,9,3,1]', 12, (F) => {
  const a = [2, 7, 9, 3, 1], dp = [2, 7];
  F({ cap: 'dp[0] = 2；dp[1] = max(2, 7) = 7', blocks: [A(a, { id: 'a', label: 'nums' }), dpRow(dp, { hl: { 0: 'ok', 1: 'ok' } })] });
  for (let i = 2; i < a.length; i++) {
    const skip = dp[i - 1], take = dp[i - 2] + a[i];
    dp[i] = Math.max(skip, take);
    F({ cap: `第 ${i} 家：不偷 = ${skip}，偷 = dp[${i - 2}] + ${a[i]} = ${take} → dp[${i}] = **${dp[i]}**`, blocks: [A(a, { id: 'a', label: 'nums', hl: { [i]: take >= skip ? 'ok' : 'dim' }, p: { i } }), dpRow(dp, { hl: { [i]: 'cur', [i - 1]: 'sel', [i - 2]: 'sel' } })] });
  }
  F({ cap: `最多偷 **${dp[4]}**（2 + 9 + 1）`, blocks: [A(a, { id: 'a', label: 'nums', hl: { 0: 'ok', 2: 'ok', 4: 'ok' } }), dpRow(dp, { hl: { 4: 'ok' } })], done: true, ans: dp[4] });
});

T('279', '完全背包：dp[i] = min(dp[i − j²]) + 1', 'n = 12', 3, (F) => {
  const n = 12, dp = [0, ...Array(n).fill(Infinity)];
  for (let i = 1; i <= n; i++) {
    let best = Infinity, bj = 1;
    for (let j = 1; j * j <= i; j++) if (dp[i - j * j] + 1 < best) { best = dp[i - j * j] + 1; bj = j; }
    dp[i] = best;
    F({ cap: `dp[${i}]：最后用的平方数是 ${bj}² 时最优 → dp[${i - bj * bj}] + 1 = **${best}**`, blocks: [dpRow(dp, { hl: { [i]: 'cur', [i - bj * bj]: 'sel' }, p: { i } })] });
  }
  F({ cap: `12 = 4 + 4 + 4，最少 **${dp[n]}** 个；O(n√n)`, blocks: [dpRow(dp, { hl: { 12: 'ok' } })], done: true, ans: dp[n] });
});

T('322', '完全背包求最少硬币数：dp[x] = min(dp[x − coin]) + 1', 'coins = [1,2,5], amount = 11', 3, (F) => {
  const coins = [1, 2, 5], n = 11, dp = [0, ...Array(n).fill(Infinity)];
  F({ cap: 'dp[0] = 0，其余初始化为 ∞（凑不出）', blocks: [dpRow(dp, { hl: { 0: 'ok' } }), V(['coins', fmt(coins)])] });
  for (let x = 1; x <= n; x++) {
    let bc = null;
    for (const c of coins) if (c <= x && dp[x - c] + 1 < dp[x]) { dp[x] = dp[x - c] + 1; bc = c; }
    F({ cap: `dp[${x}]：最后一枚用 ${bc} 最优 → dp[${x - bc}] + 1 = **${dp[x]}**`, blocks: [dpRow(dp, { hl: { [x]: 'cur', [x - bc]: 'sel' }, p: { x } })] });
  }
  F({ cap: `11 = 5 + 5 + 1，最少 **${dp[n]}** 枚；dp[n] 仍是 ∞ 时返回 -1`, blocks: [dpRow(dp, { hl: { 11: 'ok' } })], done: true, ans: dp[n] });
});

T('139', 'dp[i] = 存在 j 使 dp[j] 为真且 s[j, i) 在字典中', 's = "leetcode", wordDict = ["leet","code"]', true, (F) => {
  const s = 'leetcode', dict = new Set(['leet', 'code']), dp = [true, ...Array(s.length).fill(false)];
  for (let i = 1; i <= s.length; i++) {
    for (let j = 0; j < i; j++) {
      if (dp[j] && dict.has(s.slice(j, i))) { dp[i] = true; F({ cap: `dp[${j}] 为真，且 "${s.slice(j, i)}" 在字典中 → dp[${i}] = true`, blocks: [A(s.split(''), { id: 's', label: 's', win: [j, i - 1], winCls: 'ok' }), dpRow(dp, { hl: { [i]: 'ok', [j]: 'sel' } })] }); break; }
    }
    if (!dp[i]) F({ cap: `前 ${i} 个字符 "${s.slice(0, i)}" 无法拆分 → dp[${i}] = false`, blocks: [A(s.split(''), { id: 's', label: 's', win: [0, i - 1] }), dpRow(dp, { hl: { [i]: 'bad' } })] });
  }
  F({ cap: `dp[8] = **${dp[8]}**`, blocks: [dpRow(dp, { hl: { 8: 'ok' } })], done: true, ans: dp[8] });
});

T('300', '贪心 + 二分：tails[k] = 长度为 k+1 的递增子序列的最小结尾', 'nums = [10,9,2,5,3,7,101,18]', 4, (F) => {
  const a = [10, 9, 2, 5, 3, 7, 101, 18], tails = [];
  a.forEach((x, i) => {
    let l = 0, r = tails.length;
    while (l < r) { const m = (l + r) >> 1; if (tails[m] < x) l = m + 1; else r = m; }
    const append = l === tails.length;
    const old = tails[l];
    tails[l] = x;
    F({ cap: append ? `${x} 比所有结尾都大 → 追加，长度变为 ${tails.length}` : `二分找到第一个 ≥ ${x} 的位置 ${l}：把结尾 ${old} 换成更小的 ${x}（给后面留更多机会）`, blocks: [A(a, { id: 'a', label: 'nums', hl: { [i]: 'cur' }, p: { i } }), A(tails, { id: 't', label: 'tails', hl: { [l]: append ? 'ok' : 'warn' } })] });
  });
  F({ cap: `LIS 长度 = tails 长度 = **${tails.length}**；O(n log n)（tails 本身不一定是真实子序列）`, blocks: [A(tails, { id: 't', label: 'tails', hl: rng(0, tails.length - 1, 'ok') })], done: true, ans: tails.length });
});

T('152', '负数会让最小变最大：同时维护以 i 结尾的最大积与最小积', 'nums = [2,3,-2,4,-1]', 48, (F) => {
  const a = [2, 3, -2, 4, -1];
  let mx = a[0], mn = a[0], best = a[0];
  F({ cap: '初始 max = min = best = 2', blocks: [A(a, { hl: { 0: 'cur' } }), V(['max', mx], ['min', mn], ['best', best, 'ok'])] });
  for (let i = 1; i < a.length; i++) {
    const x = a[i], c = [x, mx * x, mn * x];
    mx = Math.max(...c); mn = Math.min(...c); best = Math.max(best, mx);
    F({ cap: `x = ${x}：候选 {${c.join(', ')}} → max = ${mx}，min = ${mn}${x < 0 ? '（负数把最小积翻成最大积）' : ''}`, blocks: [A(a, { hl: { [i]: 'cur' }, p: { i } }), V(['max', mx, 'cur'], ['min', mn], ['best', best, 'ok'])] });
  }
  F({ cap: `最大乘积 **${best}**（2 × 3 × −2 × 4 × −1）`, blocks: [A(a, { hl: rng(0, 4, 'ok') })], done: true, ans: best });
});

T('416', '转成 0/1 背包：能否选出若干数凑成 sum / 2；倒序遍历容量', 'nums = [1,5,11,5]', true, (F) => {
  const a = [1, 5, 11, 5], target = 11, dp = [true, ...Array(target).fill(false)];
  F({ cap: `总和 22，目标 11；dp[j] 表示能否凑出 j`, blocks: [A(a, { id: 'a', label: 'nums' }), dpRow(dp, { hl: { 0: 'ok' } })] });
  a.forEach((x, i) => {
    const changed = [];
    for (let j = target; j >= x; j--) if (dp[j - x] && !dp[j]) { dp[j] = true; changed.push(j); }
    F({ cap: `考虑 ${x}：从大到小更新 dp[j] |= dp[j − ${x}]（倒序保证每个数只用一次），新凑出 ${changed.length ? fmt(changed.reverse()) : '无'}`, blocks: [A(a, { id: 'a', label: 'nums', hl: { [i]: 'cur' } }), dpRow(dp, { hl: Object.fromEntries(changed.map((j) => [j, 'ok'])) })] });
  });
  F({ cap: `dp[11] = **${dp[target]}**：{11} 与 {1, 5, 5}`, blocks: [dpRow(dp, { hl: { 11: 'ok' } })], done: true, ans: dp[target] });
});

T('DP 模板 1', '0/1 背包一维写法：容量必须从大到小遍历', 'weight = [1,3,4], value = [15,20,30], W = 4', 35, (F) => {
  const w = [1, 3, 4], v = [15, 20, 30], W = 4, dp = Array(W + 1).fill(0);
  F({ cap: 'dp[j] = 容量 j 时的最大价值', blocks: [dpRow(dp), V(['物品', '(1,15) (3,20) (4,30)'])] });
  w.forEach((wi, i) => {
    for (let j = W; j >= wi; j--) {
      const old = dp[j], take = dp[j - wi] + v[i];
      const up = take > old;
      if (up) dp[j] = take;
      F({ cap: `物品 ${i}（重 ${wi}，值 ${v[i]}），容量 ${j}：不选 ${old} vs 选 dp[${j - wi}] + ${v[i]} = ${take}${up ? ' → 更新为 ' + take : ' → 保持'}`, blocks: [dpRow(dp, { hl: { [j]: up ? 'ok' : 'cur', [j - wi]: 'sel' }, p: { j } }), V(['物品', i, 'cur'])] });
    }
  });
  F({ cap: `最大价值 **${dp[W]}**（物品 0 + 物品 1）。倒序是为了让 dp[j − w] 仍是「上一轮」的值；正序就成了完全背包`, blocks: [dpRow(dp, { hl: { [W]: 'ok' } })], done: true, ans: dp[W] });
});

/* ============================== 动态规划（二维） ============================== */
T('62', 'dp[i][j] = dp[i−1][j] + dp[i][j−1]', 'm = 3, n = 5', 15, (F) => {
  const m = 3, n = 5, dp = Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => (i === 0 || j === 0 ? 1 : null)));
  F({ cap: '第一行只能一直向右、第一列只能一直向下：都只有 1 种走法', blocks: [G(dp, { hl: Object.fromEntries([...Array(n).keys()].map((j) => ['0,' + j, 'sel']).concat([...Array(m).keys()].map((i) => [i + ',0', 'sel']))) })] });
  for (let i = 1; i < m; i++) for (let j = 1; j < n; j++) {
    dp[i][j] = dp[i - 1][j] + dp[i][j - 1];
    F({ cap: `dp[${i}][${j}] = 上方 ${dp[i - 1][j]} + 左方 ${dp[i][j - 1]} = **${dp[i][j]}**`, blocks: [G(dp, { hl: { [i + ',' + j]: 'cur', [(i - 1) + ',' + j]: 'sel', [i + ',' + (j - 1)]: 'sel' } })] });
  }
  F({ cap: `共 **${dp[m - 1][n - 1]}** 条路径（组合数 C(6, 2) = 15）；可滚动成一维`, blocks: [G(dp, { hl: { [(m - 1) + ',' + (n - 1)]: 'ok' } })], done: true, ans: dp[m - 1][n - 1] });
});

T('64', 'dp[i][j] = grid[i][j] + min(上, 左)', 'grid = [[1,3,1],[1,5,1],[4,2,1]]', 7, (F) => {
  const g = [[1, 3, 1], [1, 5, 1], [4, 2, 1]], dp = g.map((r) => r.map(() => null));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const up = i ? dp[i - 1][j] : Infinity, left = j ? dp[i][j - 1] : Infinity;
    dp[i][j] = g[i][j] + (i || j ? Math.min(up, left) : 0);
    F({ cap: i || j ? `dp[${i}][${j}] = ${g[i][j]} + min(上 ${up === Infinity ? '—' : up}, 左 ${left === Infinity ? '—' : left}) = **${dp[i][j]}**` : 'dp[0][0] = grid[0][0] = 1', blocks: [G(g, { id: 'g', label: 'grid', hl: { [i + ',' + j]: 'cur' } }), G(dp, { id: 'd', label: 'dp', hl: Object.assign({ [i + ',' + j]: 'cur' }, up <= left && i ? { [(i - 1) + ',' + j]: 'sel' } : j ? { [i + ',' + (j - 1)]: 'sel' } : {}) })] });
  }
  F({ cap: `最小路径和 **${dp[2][2]}**（1 → 3 → 1 → 1 → 1）`, blocks: [G(g, { id: 'g', label: 'grid', hl: { '0,0': 'ok', '0,1': 'ok', '0,2': 'ok', '1,2': 'ok', '2,2': 'ok' } }), G(dp, { id: 'd', label: 'dp', hl: { '2,2': 'ok' } })], done: true, ans: dp[2][2] });
});

T('63', '障碍格 dp = 0，其余同「不同路径」', 'obstacleGrid = [[0,0,0],[0,1,0],[0,0,0]]', 2, (F) => {
  const o = [[0, 0, 0], [0, 1, 0], [0, 0, 0]], dp = o.map((r) => r.map(() => null));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    if (o[i][j]) { dp[i][j] = 0; F({ cap: `(${i},${j}) 是障碍 → dp = 0`, blocks: [G(dp, { hl: { [i + ',' + j]: 'bad' } })] }); continue; }
    dp[i][j] = i === 0 && j === 0 ? 1 : (i ? dp[i - 1][j] : 0) + (j ? dp[i][j - 1] : 0);
    F({ cap: `dp[${i}][${j}] = 上 + 左 = ${dp[i][j]}`, blocks: [G(dp, { hl: { [i + ',' + j]: 'cur', '1,1': 'bad' } })] });
  }
  F({ cap: `共 **${dp[2][2]}** 条路径`, blocks: [G(dp, { hl: { '2,2': 'ok', '1,1': 'bad' } })], done: true, ans: dp[2][2] });
});

T('221', 'dp[i][j] = min(上, 左, 左上) + 1：以 (i,j) 为右下角的最大正方形边长', 'matrix 4×5', 4, (F) => {
  const m = [[1, 0, 1, 0, 0], [1, 0, 1, 1, 1], [1, 1, 1, 1, 1], [1, 0, 0, 1, 0]];
  const dp = m.map((r) => r.map(() => 0));
  let best = 0, bi = 0, bj = 0;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
    if (!m[i][j]) continue;
    dp[i][j] = i && j ? Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1 : 1;
    if (dp[i][j] > best) { best = dp[i][j]; bi = i; bj = j; }
    if (i && j) F({ cap: `(${i},${j})：min(上 ${dp[i - 1][j]}, 左 ${dp[i][j - 1]}, 左上 ${dp[i - 1][j - 1]}) + 1 = **${dp[i][j]}**`, blocks: [G(m, { id: 'm', label: 'matrix', hl: { [i + ',' + j]: 'cur' } }), G(dp, { id: 'd', label: 'dp（边长）', hl: { [i + ',' + j]: 'cur', [(i - 1) + ',' + j]: 'sel', [i + ',' + (j - 1)]: 'sel', [(i - 1) + ',' + (j - 1)]: 'sel' } }), V(['最大边长', best, 'ok'])] });
  }
  const sq = {};
  for (let i = bi - best + 1; i <= bi; i++) for (let j = bj - best + 1; j <= bj; j++) sq[i + ',' + j] = 'ok';
  F({ cap: `最大边长 ${best}，面积 **${best * best}**`, blocks: [G(m, { id: 'm', label: 'matrix', hl: sq }), G(dp, { id: 'd', label: 'dp', hl: { [bi + ',' + bj]: 'ok' } })], done: true, ans: best * best });
});

T('5', '中心扩展：每个位置（及每两个字符之间）向两边扩', 's = "babad"', 'bab', (F) => {
  const s = 'babad'.split('');
  let bs = 0, be = 0;
  for (let c = 0; c < s.length; c++) {
    for (const [l0, r0] of [[c, c], [c, c + 1]]) {
      let l = l0, r = r0;
      while (l >= 0 && r < s.length && s[l] === s[r]) { l--; r++; }
      const len = r - l - 1;
      if (len > be - bs + 1) { bs = l + 1; be = r - 1; }
      if (len > 0) F({ cap: `以 ${l0 === r0 ? `'${s[c]}'` : `'${s[l0]}${s[r0] || ''}' 之间`} 为中心扩展，得到 "${s.slice(l + 1, r).join('')}"（长 ${len}）`, blocks: [A(s, { win: [l + 1, r - 1], winCls: len === be - bs + 1 ? 'ok' : '', hl: { [c]: 'cur' } }), V(['最长', `"${s.slice(bs, be + 1).join('')}"`, 'ok'])] });
    }
  }
  const ans = s.slice(bs, be + 1).join('');
  F({ cap: `最长回文子串 **"${ans}"**；O(n²) 时间 O(1) 空间`, blocks: [A(s, { win: [bs, be], winCls: 'ok' })], done: true, ans });
});

const lcsLike = (F, a, b, kind) => {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (kind === 'edit' ? (i === 0 ? j : j === 0 ? i : null) : (i === 0 || j === 0 ? 0 : null))));
  const hdr = { rh: ['∅', ...a], ch: ['∅', ...b] };
  let best = 0, bi = 0;
  F({ cap: kind === 'edit' ? '第 0 行 / 列：空串变成长度 k 的串需要 k 次操作' : '第 0 行 / 列为 0（空串）', blocks: [G(dp, Object.assign({ label: 'dp' }, hdr))] });
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const same = a[i - 1] === b[j - 1];
    let cap;
    if (kind === 'lcs') { dp[i][j] = same ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]); cap = same ? `'${a[i - 1]}' 相同 → 左上 + 1 = ${dp[i][j]}` : `'${a[i - 1]}' ≠ '${b[j - 1]}' → max(上, 左) = ${dp[i][j]}`; }
    else if (kind === 'sub') { dp[i][j] = same ? dp[i - 1][j - 1] + 1 : 0; if (dp[i][j] > best) { best = dp[i][j]; bi = i; } cap = same ? `'${a[i - 1]}' 相同 → 左上 + 1 = ${dp[i][j]}（子串必须连续）` : `不同 → 0（连续性断了）`; }
    else { dp[i][j] = same ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]); cap = same ? `'${a[i - 1]}' 相同 → 不操作，取左上 ${dp[i][j]}` : `'${a[i - 1]}' ≠ '${b[j - 1]}' → 1 + min(删 ${dp[i - 1][j]}, 插 ${dp[i][j - 1]}, 换 ${dp[i - 1][j - 1]}) = ${dp[i][j]}`; }
    F({ cap: `dp[${i}][${j}]：${cap}`, blocks: [G(dp, Object.assign({ label: 'dp', hl: { [i + ',' + j]: same ? 'ok' : 'cur', [(i - 1) + ',' + (j - 1)]: 'sel', ...(same ? {} : { [(i - 1) + ',' + j]: 'sel', [i + ',' + (j - 1)]: 'sel' }) } }, hdr))] });
  }
  return kind === 'sub' ? { best, str: a.slice(bi - best, bi).join('') } : dp[m][n];
};
T('1143', 'dp[i][j] = 两个前缀的 LCS 长度', 'text1 = "abcde", text2 = "ace"', 3, (F) => {
  const r = lcsLike(F, 'abcde'.split(''), 'ace'.split(''), 'lcs');
  F({ cap: `LCS 长度 **${r}**（"ace"）；O(m·n)`, blocks: [TX('return ' + r)], done: true, ans: r });
});
T('72', 'dp[i][j] = word1 前 i 个变成 word2 前 j 个的最少操作', 'word1 = "horse", word2 = "ros"', 3, (F) => {
  const r = lcsLike(F, 'horse'.split(''), 'ros'.split(''), 'edit');
  F({ cap: `最少 **${r}** 步：horse → rorse（换）→ rose（删）→ ros（删）`, blocks: [TX('return ' + r)], done: true, ans: r });
});
T('面试 DP B', '最长公共子串：不相等时清零（与 LCS 的区别）', 's1 = "abcdxy", s2 = "xbcdz"', 3, (F) => {
  const r = lcsLike(F, 'abcdxy'.split(''), 'xbcdz'.split(''), 'sub');
  F({ cap: `最长公共子串 "${r.str}"，长度 **${r.best}**；答案取全表最大值而不是右下角`, blocks: [TX(`"${r.str}"`)], done: true, ans: r.best });
});

/* ============================== 技巧 ============================== */
T('136', '异或：a ^ a = 0，a ^ 0 = a，成对的数全部抵消', 'nums = [4,1,2,1,2]', 4, (F) => {
  const a = [4, 1, 2, 1, 2];
  let x = 0;
  a.forEach((v, i) => { x ^= v; F({ cap: `x ^= ${v} → ${x}（二进制 ${x.toString(2).padStart(3, '0')}）`, blocks: [A(a, { hl: { [i]: 'cur' }, p: { i } }), V(['x', x, 'cur'])] }); });
  F({ cap: `只出现一次的是 **${x}**；O(n) 时间 O(1) 空间`, blocks: [A(a, { hl: { 0: 'ok' } })], done: true, ans: x });
});

T('169', 'Boyer–Moore 投票：不同的数两两抵消，剩下的一定是多数', 'nums = [2,2,1,1,1,2,2]', 2, (F) => {
  const a = [2, 2, 1, 1, 1, 2, 2];
  let cand = null, cnt = 0;
  a.forEach((v, i) => {
    let msg;
    if (cnt === 0) { cand = v; cnt = 1; msg = `票数为 0 → 换候选人为 ${v}`; }
    else if (v === cand) { cnt++; msg = `${v} 与候选相同 → 票数 +1`; }
    else { cnt--; msg = `${v} 与候选不同 → 互相抵消，票数 −1`; }
    F({ cap: msg, blocks: [A(a, { hl: { [i]: v === cand ? 'ok' : 'bad' }, p: { i } }), V(['candidate', cand, 'cur'], ['count', cnt])] });
  });
  F({ cap: `多数元素 **${cand}**（题目保证存在，否则还要再数一遍验证）`, blocks: [A(a)], done: true, ans: cand });
});

T('75', '荷兰国旗：[0, p0) 为 0，(p2, n) 为 2，i 扫描中间', 'nums = [2,0,2,1,1,0]', [0, 0, 1, 1, 2, 2], (F) => {
  const a = [2, 0, 2, 1, 1, 0];
  let p0 = 0, i = 0, p2 = a.length - 1;
  const zone = () => Object.assign(rng(0, p0 - 1, 'ok'), rng(p2 + 1, a.length - 1, 'warn'));
  while (i <= p2) {
    if (a[i] === 0) { [a[i], a[p0]] = [a[p0], a[i]]; F({ cap: `a[i] = 0 → 与 p0 交换，p0++、i++`, blocks: [A(a, { hl: Object.assign(zone(), { [i]: 'cur' }), p: { p0, i, p2 } })] }); p0++; i++; }
    else if (a[i] === 2) { [a[i], a[p2]] = [a[p2], a[i]]; F({ cap: `a[i] = 2 → 与 p2 交换，p2--（i 不动：换过来的数还没检查）`, blocks: [A(a, { hl: Object.assign(zone(), { [p2]: 'warn', [i]: 'cur' }), p: { p0, i, p2 } })] }); p2--; }
    else { F({ cap: 'a[i] = 1 → 留在中间，i++', blocks: [A(a, { hl: Object.assign(zone(), { [i]: 'sel' }), p: { p0, i, p2 } })] }); i++; }
  }
  F({ cap: '一次遍历、原地完成', blocks: [A(a, { hl: zone() })], done: true, ans: a.slice() });
});

T('31', '从右找第一个下降点 i，与右侧刚好比它大的数交换，再把右侧反转', 'nums = [1,3,5,4,2]', [1, 4, 2, 3, 5], (F) => {
  const a = [1, 3, 5, 4, 2];
  let i = a.length - 2;
  while (i >= 0 && a[i] >= a[i + 1]) i--;
  F({ cap: `从右往左找第一个 a[i] < a[i+1]：i = ${i}（值 ${a[i]}），它右边 [${i + 1}, 4] 是降序`, blocks: [A(a, { hl: Object.assign(rng(i + 1, 4, 'sel'), { [i]: 'cur' }), p: { i } })] });
  let j = a.length - 1;
  while (a[j] <= a[i]) j--;
  F({ cap: `在右侧从后往前找第一个 > ${a[i]} 的数：a[${j}] = ${a[j]}`, blocks: [A(a, { hl: { [i]: 'cur', [j]: 'warn' }, p: { i, j } })] });
  [a[i], a[j]] = [a[j], a[i]];
  F({ cap: '交换后，右侧仍是降序', blocks: [A(a, { hl: Object.assign(rng(i + 1, 4, 'sel'), { [i]: 'ok' }), p: { i } })] });
  a.splice(i + 1, a.length - i - 1, ...a.slice(i + 1).reverse());
  F({ cap: `把右侧反转成升序，得到刚好大一点的排列 ${fmt(a)}`, blocks: [A(a, { hl: Object.assign(rng(i + 1, 4, 'ok'), { [i]: 'ok' }) })], done: true, ans: a.slice() });
});

T('287', '把 i → nums[i] 看成链表，重复数就是环的入口（Floyd）', 'nums = [1,3,4,2,2]', 2, (F) => {
  const a = [1, 3, 4, 2, 2];
  const nodes = [0, 1, 2, 3, 4].map((i, k) => ({ k: i, x: [0.05, 0.3, 0.9, 0.6, 0.75][k], y: [0.5, 0.2, 0.5, 0.15, 0.85][k], label: i }));
  const edges = a.map((v, i) => [i, v]);
  let slow = 0, fast = 0;
  const draw = (cap, hlm, done, ans) => F({ cap, blocks: [A(a, { label: 'nums（下标 → 值 即边 i → nums[i]）' }), { t: 'graph', nodes, edges, directed: true, h: 170, hl: hlm }], done, ans });
  draw('每个下标 i 连一条边到 nums[i]；有重复值就会有两条边指向同一节点 → 成环', {});
  do { slow = a[slow]; fast = a[a[fast]]; draw(`slow → ${slow}，fast → ${fast}`, { [slow]: 'cur', [fast]: 'warn' }); } while (slow !== fast);
  let p = 0;
  draw(`在 ${slow} 相遇；p 从 0 出发，与 slow 同速前进`, { [slow]: 'ok', 0: 'cur' });
  while (p !== slow) { p = a[p]; slow = a[slow]; draw(`p → ${p}，slow → ${slow}`, { [p]: 'cur', [slow]: 'warn' }); }
  draw(`入口节点 **${p}** 就是重复的数；不修改数组、O(1) 空间`, { [p]: 'ok' }, true, p);
});

T('剑指 Offer 61', '除大小王外无重复，且 max − min < 5 即可组成顺子', 'nums = [0,0,1,2,5]', true, (F) => {
  const a = [0, 0, 1, 2, 5], seen = new Set();
  let mx = -1, mn = 14;
  for (let i = 0; i < 5; i++) {
    const v = a[i];
    if (v === 0) { F({ cap: '0 是大小王，可当任意牌 → 跳过', blocks: [A(a, { hl: { [i]: 'dim' }, p: { i } }), V(['min', mn === 14 ? '—' : mn], ['max', mx < 0 ? '—' : mx])] }); continue; }
    if (seen.has(v)) { F({ cap: `${v} 重复 → 不可能是顺子`, blocks: [A(a, { hl: { [i]: 'bad' } })], done: true, ans: false }); return; }
    seen.add(v); mx = Math.max(mx, v); mn = Math.min(mn, v);
    F({ cap: `记录 ${v}：min = ${mn}，max = ${mx}`, blocks: [A(a, { hl: { [i]: 'cur' }, p: { i } }), V(['min', mn], ['max', mx])] });
  }
  F({ cap: `max − min = ${mx - mn} < 5 → **true**（两张王补 3、4）`, blocks: [A(a, { hl: rng(0, 4, 'ok') })], done: true, ans: mx - mn < 5 });
});

T('191', 'n & (n − 1) 每次消掉最低位的 1', 'n = 11（二进制 1011）', 3, (F) => {
  let n = 11, cnt = 0;
  const bits = (x) => x.toString(2).padStart(4, '0').split('');
  F({ cap: 'n = 1011', blocks: [A(bits(n), { label: 'n 的二进制' }), V(['count', 0])] });
  while (n) { const m = n & (n - 1); cnt++; F({ cap: `${n.toString(2).padStart(4, '0')} & ${(n - 1).toString(2).padStart(4, '0')} = ${m.toString(2).padStart(4, '0')}：消掉最低位的 1，count = ${cnt}`, blocks: [A(bits(m), { label: 'n 的二进制' }), V(['count', cnt, 'ok'])] }); n = m; }
  F({ cap: `共 **${cnt}** 个 1，循环次数 = 1 的个数`, blocks: [TX('return ' + cnt)], done: true, ans: cnt });
});

/* ============================== 随机 / 数学 ============================== */
T('384', 'Fisher–Yates：第 i 步从 [i, n) 中等概率选一个换到 i', 'nums = [1,2,3,4,5]（演示用固定随机序列）', undefined, (F) => {
  const a = [1, 2, 3, 4, 5], picks = [3, 1, 4, 3, 4];
  F({ cap: '每个位置从「还没被确定」的元素里等概率挑一个 → n! 种排列等概率', blocks: [A(a)] });
  for (let i = 0; i < a.length; i++) {
    const j = picks[i];
    [a[i], a[j]] = [a[j], a[i]];
    F({ cap: `i = ${i}：random ∈ [${i}, ${a.length - 1}] 抽到 ${j} → 交换 a[${i}] 与 a[${j}]`, blocks: [A(a, { win: [i, a.length - 1], hl: Object.assign(rng(0, i - 1, 'ok'), { [i]: 'cur', [j]: 'warn' }), p: { i, j } })] });
  }
  F({ cap: `结果 ${fmt(a)}；常见错误：每次从 [0, n) 随机会导致概率不均`, blocks: [A(a, { hl: rng(0, 4, 'ok') })], done: true, ans: a.slice() });
});

T('470', '拒绝采样：两次 rand7 得到 1~49 均匀，只接受 1~40 映射到 1~10', 'rand7 依次返回 (3,5)、(7,6)、(2,1)', undefined, (F) => {
  const g = Array.from({ length: 7 }, (_, r) => Array.from({ length: 7 }, (_, c) => { const idx = r * 7 + c + 1; return idx <= 40 ? ((idx - 1) % 10) + 1 : '×'; }));
  const base = {};
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (r * 7 + c + 1 > 40) base[r + ',' + c] = 'dim';
  F({ cap: 'idx = (rand7() − 1) × 7 + rand7() 均匀分布在 1~49；前 40 个每个结果恰好 4 格', blocks: [G(g, Object.assign({ hl: base, rh: [1, 2, 3, 4, 5, 6, 7], ch: [1, 2, 3, 4, 5, 6, 7] }))] });
  const res = [];
  for (const [a, b] of [[3, 5], [7, 6], [2, 1]]) {
    const idx = (a - 1) * 7 + b;
    if (idx > 40) { F({ cap: `(${a}, ${b}) → idx = ${idx} > 40 → 拒绝，重来`, blocks: [G(g, { hl: Object.assign({}, base, { [(a - 1) + ',' + (b - 1)]: 'bad' }), rh: [1, 2, 3, 4, 5, 6, 7], ch: [1, 2, 3, 4, 5, 6, 7] })] }); continue; }
    res.push(((idx - 1) % 10) + 1);
    F({ cap: `(${a}, ${b}) → idx = ${idx} ≤ 40 → 返回 (idx − 1) % 10 + 1 = **${res[res.length - 1]}**`, blocks: [G(g, { hl: Object.assign({}, base, { [(a - 1) + ',' + (b - 1)]: 'ok' }), rh: [1, 2, 3, 4, 5, 6, 7], ch: [1, 2, 3, 4, 5, 6, 7] }), V(['输出', fmt(res), 'ok'])] });
  }
  F({ cap: '期望调用 rand7 约 2 × 49 / 40 ≈ 2.45 次；可把被拒绝的 41~49 再利用以减少调用', blocks: [V(['输出', fmt(res), 'ok'])], done: true, ans: res });
});

T('LCR / Offer', '约瑟夫环：f(n) = (f(n − 1) + m) % n，从 f(1) = 0 往上推', 'n = 5, m = 3', 3, (F) => {
  const ring = [0, 1, 2, 3, 4];
  let idx = 0;
  const out = [];
  F({ cap: '先模拟：5 人围成一圈，每数到第 3 个出列（模拟是 O(n·m)，用来理解）', blocks: [A(ring, { label: '圈' })] });
  while (ring.length > 1) {
    idx = (idx + 2) % ring.length;
    out.push(ring[idx]);
    F({ cap: `数到 ${ring[idx]} → 出列`, blocks: [A(ring, { label: '圈', hl: { [idx]: 'bad' } }), V(['出列顺序', fmt(out)])] });
    ring.splice(idx, 1);
  }
  const f = [0];
  for (let n = 2; n <= 5; n++) f[n - 1] = (f[n - 2] + 3) % n;
  F({ cap: `最后剩下 ${ring[0]}。公式：从最后一人（下标 0）倒推，每多一个人，胜者下标整体后移 m 位再取模：f = ${fmt(f)}`, blocks: [A(f, { id: 'f', label: 'f(1) … f(5)', hl: { 4: 'ok' } }), TX('return ' + f[4])], done: true, ans: f[4] });
});

;
/* ==========================================================================
   算法逐步演示（第 5 部分：面经变体 / 剩余 LC / 几何 / 概率 / 并发时序 / 机器学习）
   ========================================================================== */
const r3 = (x) => Math.round(x * 1000) / 1000;

/* ---------------- 面经变体 ---------------- */
T('面试变体 1', '排序 + 双指针；命中时按左右重复个数一次性算组合数', 'nums = [1,1,2,2,3,3,4,4,5,5], target = 8', 20, (F) => {
  const a = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5], t = 8;
  let cnt = 0;
  for (let i = 0; i < a.length - 2; i++) {
    let l = i + 1, r = a.length - 1;
    while (l < r) {
      const s = a[i] + a[l] + a[r];
      if (s < t) l++;
      else if (s > t) r--;
      else if (a[l] !== a[r]) {
        let cl = 1, cr = 1;
        while (l + cl < r && a[l + cl] === a[l]) cl++;
        while (r - cr >= l + cl && a[r - cr] === a[r]) cr++;
        cnt += cl * cr;
        F({ cap: `i=${i}：${a[i]} + ${a[l]} + ${a[r]} = 8，左边 ${a[l]} 有 ${cl} 个、右边 ${a[r]} 有 ${cr} 个 → 计入 ${cl} × ${cr} = ${cl * cr}`, blocks: [A(a, { cw: 36, hl: Object.assign(rng(l, l + cl - 1, 'ok'), rng(r - cr + 1, r, 'ok'), { [i]: 'cur' }), p: { i, l, r } }), V(['count', cnt, 'ok'])] });
        l += cl; r -= cr;
      } else {
        const m = r - l + 1;
        cnt += m * (m - 1) / 2;
        F({ cap: `i=${i}：a[l] = a[r] = ${a[l]}，区间内 ${m} 个相同值任取两个 → C(${m}, 2) = ${m * (m - 1) / 2}`, blocks: [A(a, { cw: 36, hl: Object.assign(rng(l, r, 'ok'), { [i]: 'cur' }), p: { i, l, r } }), V(['count', cnt, 'ok'])] });
        break;
      }
    }
  }
  F({ cap: `下标三元组共 **${cnt}** 个；重复值不能跳过，而是按个数相乘（结果通常要对 1e9+7 取模）`, blocks: [TX('return ' + cnt)], done: true, ans: cnt });
});

T('面试数组 1', '预处理右侧最小值，从左往右维护左侧最大值', 'nums = [2,1,3,5,4,6,8,7]', [3, 6], (F) => {
  const a = [2, 1, 3, 5, 4, 6, 8, 7], n = a.length, suf = Array(n).fill(null);
  let m = Infinity;
  for (let i = n - 1; i >= 0; i--) { suf[i] = m === Infinity ? '∞' : m; m = Math.min(m, a[i]); }
  F({ cap: 'suffixMin[i] = i 右侧所有元素的最小值（从右往左一遍）', blocks: [A(a, { id: 'a', label: 'nums' }), A(suf, { id: 's', label: 'suffixMin（不含自身）' })] });
  let lm = -Infinity;
  const res = [];
  a.forEach((x, i) => {
    const rm = suf[i] === '∞' ? Infinity : suf[i];
    const ok = lm < x && x < rm;
    if (ok) res.push(x);
    F({ cap: `nums[${i}] = ${x}：左侧最大 ${lm === -Infinity ? '−∞' : lm}、右侧最小 ${suf[i]} → ${ok ? '满足' : '不满足'}`, blocks: [A(a, { id: 'a', label: 'nums', hl: { [i]: ok ? 'ok' : 'cur' }, p: { i }, win: i ? [0, i - 1] : null }), A(suf, { id: 's', label: 'suffixMin', hl: { [i]: 'sel' } }), V(['leftMax', lm === -Infinity ? '−∞' : lm], ['结果', fmt(res), 'ok'])] });
    lm = Math.max(lm, x);
  });
  F({ cap: `结果 ${fmt(res)}；两遍扫描 O(n)`, blocks: [A(a, { id: 'a', label: 'nums', hl: { 2: 'ok', 5: 'ok' } })], done: true, ans: res });
});

T('面试变体 3', '左端点升序、右端点降序排序；右端点没突破历史最大值就是被包含', 'intervals = [[1,4],[2,3],[3,6],[1,2],[5,6]]', [[1, 4], [3, 6]], (F) => {
  const iv = [[1, 4], [2, 3], [3, 6], [1, 2], [5, 6]].sort((x, y) => x[0] - y[0] || y[1] - x[1]);
  let mx = -Infinity;
  const res = [];
  F({ cap: `排序后 ${fmt(iv)}：同左端点时长的在前，保证能包含后面的`, blocks: [IV(iv, { out: [] })] });
  iv.forEach(([l, r], i) => {
    const keep = r > mx;
    if (keep) { res.push([l, r]); mx = r; }
    F({ cap: `[${l},${r}]：右端 ${r} ${keep ? `> 历史最大 ${res.length > 1 ? res[res.length - 2][1] : '−∞'} → 不被包含，保留` : `≤ 历史最大 ${mx} → 一定被前面某个区间包含`}`, blocks: [IV(iv, { hl: { [i]: keep ? 'ok' : 'dim' }, out: res.map((x) => x.slice()) }), V(['maxRight', mx])] });
  });
  F({ cap: `未被包含的区间 ${fmt(res)}；排序后只用一个 for 循环`, blocks: [IV(iv, { out: res.map((x) => x.slice()) })], done: true, ans: res });
});

T('面试高频', '不建树：按「左子树 → 右子树 → 根」的顺序输出就是后序', 'preorder = [3,9,20,15,7], inorder = [9,3,15,20,7]', [9, 15, 7, 20, 3], (F) => {
  const pre = [3, 9, 20, 15, 7], ino = [9, 3, 15, 20, 7], idx = new Map(ino.map((v, i) => [v, i])), post = [];
  const go = (pl, pr, il, ir) => {
    if (pl > pr) return;
    const root = pre[pl], m = idx.get(root), leftN = m - il;
    F({ cap: `前序区间 [${pl}, ${pr}] 的根是 ${root}；中序里左边 ${leftN} 个是左子树`, blocks: [A(pre, { id: 'p', label: 'preorder', win: [pl, pr], hl: { [pl]: 'cur' } }), A(ino, { id: 'i', label: 'inorder', win: [il, ir], hl: { [m]: 'cur' } }), A(post, { id: 'o', label: 'postorder（输出）', cw: 34 })] });
    go(pl + 1, pl + leftN, il, m - 1);
    go(pl + leftN + 1, pr, m + 1, ir);
    post.push(root);
    F({ cap: `${root} 的左右子树都已输出 → 输出根 ${root}`, blocks: [A(pre, { id: 'p', label: 'preorder', hl: { [pl]: 'ok' } }), A(ino, { id: 'i', label: 'inorder', hl: { [m]: 'ok' } }), A(post, { id: 'o', label: 'postorder（输出）', cw: 34, hl: { [post.length - 1]: 'ok' } })] });
  };
  go(0, 4, 0, 4);
  F({ cap: `后序 ${fmt(post)}；HashMap 定位根，O(n)`, blocks: [A(post, { id: 'o', label: 'postorder', cw: 34, hl: rng(0, 4, 'ok') })], done: true, ans: post });
});

T('面试树', '显式栈：前序出栈即访问（先压右再压左）；后序 = 「根右左」再反转', 'root = [1,2,3,4,5]', { pre: [1, 2, 4, 5, 3], post: [4, 5, 2, 3, 1] }, (F) => {
  const root = BTO([1, 2, 3, 4, 5]);
  const st = [root], pre = [], seen = [];
  while (st.length) {
    const n = st.pop(); pre.push(n.v); seen.push(n.id);
    if (n.right) st.push(n.right);
    if (n.left) st.push(n.left);
    F({ cap: `前序：弹出 ${n.v} 访问，先压右孩子再压左孩子（左孩子先出栈）`, blocks: [TRO(root, { hl: hlOf(seen, 'ok', { [n.id]: 'cur' }) }), S(st.map((x) => x.v), { label: '栈' }), A(pre, { id: 'r', label: '前序', cw: 34 })] });
  }
  const st2 = [root], tmp = [];
  while (st2.length) { const n = st2.pop(); tmp.push(n.v); if (n.left) st2.push(n.left); if (n.right) st2.push(n.right); }
  F({ cap: `后序：同样的写法但先压左再压右，得到「根右左」${fmt(tmp)}`, blocks: [TRO(root), A(tmp, { id: 'r', label: '根右左', cw: 34 })] });
  const post = tmp.slice().reverse();
  F({ cap: `反转即为「左右根」后序 ${fmt(post)}；中序写法见 94 题`, blocks: [TRO(root, { hl: hlOf(allIds(root), 'ok') }), A(post, { id: 'r', label: '后序', cw: 34, hl: rng(0, 4, 'ok') })], done: true, ans: { pre, post } });
});

T('面试变体 A', '栈匹配类型 + 入栈时校验：内层括号等级不能高于外层', 's = "{[()]}"，再检查 "[{}]"', [true, false], (F) => {
  const lv = { '(': 1, '[': 2, '{': 3 }, pair = { ')': '(', ']': '[', '}': '{' }, out = [];
  for (const str of ['{[()]}', '[{}]']) {
    const s = str.split(''), st = [];
    let ok = true;
    for (let i = 0; i < s.length && ok; i++) {
      const c = s[i];
      if (lv[c]) {
        const top = st[st.length - 1];
        if (top && lv[c] > lv[top]) { ok = false; F({ cap: `'${c}'（等级 ${lv[c]}）要放进 '${top}'（等级 ${lv[top]}）里面 → 违反优先级`, blocks: [A(s, { hl: { [i]: 'bad' }, p: { i } }), S(st.map((x) => `${x}:${lv[x]}`), { label: '栈（括号:等级）', hl: { [st.length - 1]: 'bad' } })] }); break; }
        st.push(c);
        F({ cap: `'${c}' 等级 ${lv[c]} ≤ 外层 ${top ? lv[top] : '∞'} → 入栈`, blocks: [A(s, { hl: { [i]: 'cur' }, p: { i } }), S(st.map((x) => `${x}:${lv[x]}`), { label: '栈（括号:等级）' })] });
      } else {
        if (st[st.length - 1] !== pair[c]) { ok = false; break; }
        st.pop();
        F({ cap: `'${c}' 与栈顶配对 → 弹出`, blocks: [A(s, { hl: { [i]: 'ok' }, p: { i } }), S(st.map((x) => `${x}:${lv[x]}`), { label: '栈（括号:等级）' })] });
      }
    }
    ok = ok && st.length === 0;
    out.push(ok);
    F({ cap: `"${str}" → **${ok}**`, blocks: [A(s, { hl: rng(0, s.length - 1, ok ? 'ok' : 'dim') }), V(['结果', fmt(out)])] });
  }
  F({ cap: '只比普通括号匹配多一次等级比较；若规则相反，翻转比较符号即可', blocks: [V(['结果', fmt(out), 'ok'])], done: true, ans: out });
});

T('牛客', '按连续段分组，字符变化时输出「字符 + 次数」', 's = "abcccaaaa"', 'a1b1c3a4', (F) => {
  const s = 'abcccaaaa'.split(''), st = [];
  let out = '';
  s.forEach((c, i) => {
    if (st.length && st[st.length - 1] !== c) { out += st[0] + st.length; F({ cap: `'${c}' 与栈中 '${st[0]}' 不同 → 输出 "${st[0]}${st.length}" 并清空栈`, blocks: [A(s, { hl: { [i]: 'cur' }, p: { i } }), S(st, { label: '当前连续段' }), V(['结果', `"${out}"`, 'ok'])] }); st.length = 0; }
    st.push(c);
    F({ cap: `'${c}' 入栈（同一连续段）`, blocks: [A(s, { hl: { [i]: 'sel' }, p: { i } }), S(st, { label: '当前连续段' }), V(['结果', `"${out}"`])] });
  });
  out += st[0] + st.length;
  const ans = out.length < s.length ? out : s.join('');
  F({ cap: `收尾输出最后一段 → "${out}"，长度 ${out.length} < ${s.length} → 返回压缩串`, blocks: [TX(`"${ans}"`)], done: true, ans });
});

T('面试 DP A', 'dp[i] = nums[i] + max(dp[j])，其中 j < i 且 nums[j] < nums[i]', 'nums = [1,101,2,3,100,4,5]', 106, (F) => {
  const a = [1, 101, 2, 3, 100, 4, 5], dp = [];
  a.forEach((x, i) => {
    let best = 0, bj = -1;
    for (let j = 0; j < i; j++) if (a[j] < x && dp[j] > best) { best = dp[j]; bj = j; }
    dp[i] = x + best;
    F({ cap: `以 ${x} 结尾：前面比它小、dp 最大的是 ${bj >= 0 ? `dp[${bj}] = ${best}` : '无'} → dp[${i}] = ${x} + ${best} = **${dp[i]}**`, blocks: [A(a, { id: 'a', label: 'nums', hl: Object.assign(Object.fromEntries(a.slice(0, i).map((v, j) => [j, v < x ? 'sel' : 'dim'])), { [i]: 'cur' }) }), dpRow(dp, { hl: bj >= 0 ? { [i]: 'cur', [bj]: 'ok' } : { [i]: 'cur' } })] });
  });
  const ans = Math.max(...dp);
  F({ cap: `最大和 **${ans}**（1 + 2 + 3 + 100）；与 LIS 同结构，只是把 +1 换成 +nums[i]`, blocks: [dpRow(dp, { hl: { 4: 'ok' } })], done: true, ans });
});

T('字节 T2', '从高位贪心：尽量取「等于该位」的数字，一旦取了更小的，后面全填最大数字', 'nums = [5,4,8,2], n = 5416', 5288, (F) => {
  const d = [2, 4, 5, 8], n = '5416'.split('').map(Number), mx = 8;
  // 回溯：前缀逐位相等，找到最后一个可以「取更小数字」的位置
  const res = [];
  let pos = -1, alt = null;
  for (let i = 0; i < n.length; i++) {
    const smaller = d.filter((x) => x < n[i]);
    if (smaller.length) { pos = i; alt = smaller[smaller.length - 1]; }
    const eq = d.includes(n[i]);
    F({ cap: `第 ${i} 位目标 ${n[i]}：${eq ? '可以取相等的 ' + n[i] + ' 继续比较后面' : '没有相等的数字'}${smaller.length ? `；记下此处可取的更小数字 ${smaller[smaller.length - 1]}` : ''}`, blocks: [A(n, { id: 'n', label: 'n 的各位', hl: { [i]: eq ? 'ok' : 'bad' }, p: { i } }), A(d, { id: 'd', label: '可用数字' }), V(['最后一个可降位', pos >= 0 ? `第 ${pos} 位 → ${alt}` : '无'])] });
    if (!eq) break;
  }
  for (let i = 0; i < pos; i++) res.push(n[i]);
  res.push(alt);
  while (res.length < n.length) res.push(mx);
  const ans = +res.join('');
  F({ cap: `在第 ${pos} 位降为 ${alt}（前面保持相等），后面全部填最大数字 ${mx} → **${ans}**；若没有可降位，就用少一位的全 ${mx}`, blocks: [A(res, { id: 'n', label: '结果', hl: Object.assign(rng(0, pos - 1, 'sel'), { [pos]: 'warn' }, rng(pos + 1, 3, 'ok')) })], done: true, ans });
});

T('字节 T1', '质因数分解：最小值 = 不同质因子之积；开方次数由最大指数对齐到 2 的幂决定', 'n = 72', [6, 3], (F) => {
  F({ cap: '72 = 2³ × 3²；只能乘或开方，质因子种类不会减少，所以下界是 2 × 3 = 6', blocks: [M([['2', '指数 3'], ['3', '指数 2']], { label: '质因数分解' })] });
  F({ cap: '要开方，所有指数必须同时是偶数；要开到只剩一次方，所有指数都要是同一个 2 的幂。最大指数 3 → 向上取到 4 = 2²', blocks: [M([['2', '3 → 4'], ['3', '2 → 4']], { label: '指数对齐目标', hl: ['2', '3'] }), V(['需要开方', '2 次'])] });
  F({ cap: '乘一次 2¹ × 3² = 18：72 × 18 = 1296 = 2⁴ × 3⁴（一次乘法补齐所有指数）', blocks: [M([['2', '指数 4'], ['3', '指数 4']], { label: '1296 的分解', hlCls: 'ok', hl: ['2', '3'] }), V(['操作', 1, 'cur'])] });
  F({ cap: '√1296 = 36 = 2² × 3²', blocks: [M([['2', '指数 2'], ['3', '指数 2']], { label: '36 的分解' }), V(['操作', 2, 'cur'])] });
  F({ cap: '√36 = **6**，共 3 次操作（若指数本来就已对齐，如 256 = 2⁸，就不需要那次乘法：3 次开方）', blocks: [M([['2', '指数 1'], ['3', '指数 1']], { label: '6 的分解', hlCls: 'ok', hl: ['2', '3'] }), V(['操作', 3, 'ok'])], done: true, ans: [6, 3] });
});

T('逻辑 1', '把每轮两人取球数凑成 6：6 的倍数是必败态', '100 个球，每次取 1~5 个', 0, (F) => {
  let left = 100;
  const opp = [3, 5, 1, 2];
  F({ cap: '100 mod 6 = 4：先手先取 4 个，把 96（6 的倍数）留给对手', blocks: [V(['剩余', left])] });
  left -= 4;
  F({ cap: '先手取 4 → 剩 96', blocks: [V(['剩余', left, 'ok'], ['先手本次', 4, 'cur'])] });
  for (const x of opp) {
    left -= x;
    F({ cap: `对手取 ${x} → 剩 ${left}`, blocks: [V(['剩余', left], ['对手本次', x, 'bad'])] });
    left -= 6 - x;
    F({ cap: `先手取 6 − ${x} = ${6 - x} → 剩 ${left}（又回到 6 的倍数）`, blocks: [V(['剩余', left, 'ok'], ['先手本次', 6 - x, 'cur'])] });
  }
  F({ cap: `…如此每轮减 6，最后剩 6 个时对手取几个，先手都能取完 → 先手必胜。剩余演示到 ${left} 为止，最终会减到 **0**`, blocks: [V(['规律', '每轮合计 6'])], done: true, ans: 0 });
});

T('面试变体 5', 'Von Neumann：两位一组，01 → 0、10 → 1，00 / 11 丢弃', '偏置源输出 1,1,0,1,1,0,0,0,1,0', [0, 1, 1], (F) => {
  const src = [1, 1, 0, 1, 1, 0, 0, 0, 1, 0], out = [];
  F({ cap: 'P(01) = (1 − p)·p = P(10)，所以这两种结果等概率，与 p 无关', blocks: [A(src, { label: '偏置随机源' })] });
  for (let i = 0; i < src.length; i += 2) {
    const a = src[i], b = src[i + 1];
    const keep = a !== b;
    if (keep) out.push(a === 0 ? 0 : 1);
    F({ cap: `(${a}, ${b}) → ${keep ? `输出公平 bit ${out[out.length - 1]}` : '相同 → 丢弃'}`, blocks: [A(src, { label: '偏置随机源', win: [i, i + 1], winCls: keep ? 'ok' : 'bad' }), A(out, { id: 'o', label: '公平 bit', cw: 34 })] });
  }
  F({ cap: `凑够 53 个公平 bit 拼成整数 k，返回 k / 2⁵³ ∈ [0, 1)：double 精度下的均匀分布`, blocks: [A(out, { id: 'o', label: '公平 bit', cw: 34, hl: rng(0, out.length - 1, 'ok') })], done: true, ans: out });
});

T('面试概率题', '概率累加成 CDF，随机数 r 二分找第一个 prefix > r', 'nums = [A,B,C], p = [0.1,0.3,0.6]，本次 r = 0.35', 'B', (F) => {
  const nums = ['A', 'B', 'C'], p = [0.1, 0.3, 0.6], pre = [0.1, 0.4, 1.0], r = 0.35;
  F({ cap: '前缀和：[0, 0.1) → A，[0.1, 0.4) → B，[0.4, 1.0) → C，区间长度就是概率', blocks: [A(nums, { id: 'n', label: 'nums' }), A(p, { id: 'p', label: '概率' }), A(pre, { id: 'c', label: 'CDF 前缀和' })] });
  let l = 0, h = 2;
  while (l < h) {
    const m = (l + h) >> 1;
    F({ cap: `r = ${r}：prefix[${m}] = ${pre[m]} ${pre[m] > r ? '> r → 答案在左侧（含 m），h = m' : '≤ r → l = m + 1'}`, blocks: [A(pre, { id: 'c', label: 'CDF 前缀和', hl: { [m]: 'cur' }, p: { l, m, h } })] });
    if (pre[m] > r) h = m; else l = m + 1;
  }
  F({ cap: `返回 **${nums[l]}**；每次 O(log n)，权重变化频繁时可改用树状数组`, blocks: [A(nums, { id: 'n', label: 'nums', hl: { [l]: 'ok' } }), A(pre, { id: 'c', label: 'CDF 前缀和', hl: { [l]: 'ok' } })], done: true, ans: nums[l] });
});

/* ---------------- 剩余 LC ---------------- */
T('440', '十叉树先序遍历：统计 prefix 子树里 ≤ n 的数，够 k 就向下，不够就跳到兄弟', 'n = 13, k = 2', 10, (F) => {
  const n = 13;
  const count = (p) => { let c = 0, a = p, b = p + 1; while (a <= n) { c += Math.min(n + 1, b) - a; a *= 10; b *= 10; } return c; };
  let cur = 1, k = 2 - 1;
  F({ cap: '字典序 = 十叉树的先序：1, 10, 11, 12, 13, 2, 3, …；从 1 出发，还要再走 k − 1 = 1 步', blocks: [V(['cur', cur, 'cur'], ['剩余步数', k])] });
  while (k > 0) {
    const c = count(cur);
    if (c <= k) { F({ cap: `以 ${cur} 为前缀的数有 ${c} 个 ≤ 剩余 ${k} → 整棵子树跳过，去兄弟 ${cur + 1}`, blocks: [V(['cur', cur + 1, 'cur'], ['剩余步数', k - c])] }); k -= c; cur++; }
    else { F({ cap: `以 ${cur} 为前缀的数有 ${c} 个 > 剩余 ${k} → 答案在子树里，下降到 ${cur * 10}`, blocks: [V(['cur', cur * 10, 'cur'], ['剩余步数', k - 1])] }); cur *= 10; k--; }
  }
  F({ cap: `第 2 小是 **${cur}**；每层 O(log n)，总 O(log² n)`, blocks: [V(['答案', cur, 'ok'])], done: true, ans: cur });
});

T('687', '后序：返回「从当前节点向下、值相同的最长单边」，经过节点的路径 = 左 + 右', 'root = [5,4,5,1,1,null,5]', 2, (F) => {
  const root = BTO([5, 4, 5, 1, 1, null, 5]);
  const tag = {}, fin = [];
  let best = 0;
  const dfs = (n) => {
    if (!n) return 0;
    const l = dfs(n.left), r = dfs(n.right);
    const L = n.left && n.left.v === n.v ? l + 1 : 0, Rr = n.right && n.right.v === n.v ? r + 1 : 0;
    best = Math.max(best, L + Rr);
    tag[n.id] = '↑' + Math.max(L, Rr); fin.push(n.id);
    F({ cap: `${n.v}：左边同值延伸 ${L}、右边 ${Rr} → 经过它的路径 ${L + Rr} 条边，best = **${best}**`, blocks: [TRO(root, { hl: hlOf(fin, 'sel', { [n.id]: 'cur' }), tag }), V(['best', best, 'ok'])] });
    return Math.max(L, Rr);
  };
  dfs(root);
  F({ cap: `最长同值路径 **${best}**（5 → 5 → 5）`, blocks: [TRO(root, { hl: { i0: 'ok', i2: 'ok', i6: 'ok' }, tag })], done: true, ans: best });
});

T('934', 'DFS 把第一座岛全部标记并入队，再多源 BFS 向外扩，碰到第二座岛即答案', 'grid = [[0,1,0],[0,0,0],[0,0,1]]', 2, (F) => {
  const g = [[0, 1, 0], [0, 0, 0], [0, 0, 1]];
  const vis = {}, q = [];
  const base = () => { const o = {}; g.forEach((row, r) => row.forEach((v, c) => { o[r + ',' + c] = v === 1 ? 'land' : 'water'; })); Object.keys(vis).forEach((k) => { o[k] = vis[k]; }); return o; };
  const dfs = (r, c) => { if (r < 0 || c < 0 || r > 2 || c > 2 || g[r][c] !== 1 || vis[r + ',' + c]) return; vis[r + ',' + c] = 'cur'; q.push([r, c]); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => dfs(r + a, c + b)); };
  dfs(0, 1);
  F({ cap: '找到第一座岛 (0,1)，DFS 标记整座岛并全部入队', blocks: [G(g, { hl: base() }), V(['步数', 0])] });
  let step = 0;
  while (q.length) {
    const size = q.length, layer = [];
    for (let s = 0; s < size; s++) {
      const [r, c] = q.shift();
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = r + a, y = c + b;
        if (x < 0 || y < 0 || x > 2 || y > 2 || vis[x + ',' + y]) continue;
        if (g[x][y] === 1) { F({ cap: `扩到 (${x},${y}) 是第二座岛 → 需要填 **${step}** 个格子`, blocks: [G(g, { hl: Object.assign(base(), { [x + ',' + y]: 'ok' }) }), V(['步数', step, 'ok'])], done: true, ans: step }); return; }
        vis[x + ',' + y] = 'warn'; q.push([x, y]); layer.push([x, y]);
      }
    }
    step++;
    F({ cap: `BFS 第 ${step} 层：向外扩展 ${layer.length} 个水格（这些格子要被填成陆地）`, blocks: [G(g, { hl: base() }), V(['步数', step, 'cur'])] });
  }
});

T('面试图论', '八方向 BFS：每步代价相同，第一次到达终点即最短', 'grid 4×4（1 为障碍），从 (0,0) 到 (3,3)', 4, (F) => {
  const g = [[0, 0, 1, 0], [1, 0, 1, 0], [0, 0, 1, 1], [0, 1, 0, 0]];
  const dist = g.map((r) => r.map((v) => (v ? '■' : null)));
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const hlw = () => { const o = {}; g.forEach((row, r) => row.forEach((v, c) => { if (v) o[r + ',' + c] = 'wall'; })); return o; };
  dist[0][0] = 0;
  let q = [[0, 0]], d = 0;
  F({ cap: '起点距离 0 入队；8 个方向都可以走（注意对角线也要判越界和障碍）', blocks: [G(dist, { hl: Object.assign(hlw(), { '0,0': 'cur' }) })] });
  while (q.length) {
    const nq = [];
    for (const [r, c] of q) for (const [a, b] of dirs) {
      const x = r + a, y = c + b;
      if (x < 0 || y < 0 || x > 3 || y > 3 || g[x][y] || dist[x][y] !== null) continue;
      dist[x][y] = d + 1; nq.push([x, y]);
    }
    d++;
    const hit = nq.some(([x, y]) => x === 3 && y === 3);
    F({ cap: `第 ${d} 层：新到达 ${nq.length} 个格子${hit ? ' → 到达终点 (3,3)' : ''}`, blocks: [G(dist, { hl: gridHl(nq, hit ? 'ok' : 'cur', hlw()) })] });
    if (hit) { F({ cap: `最少 **${d}** 步：(0,0) → (1,1) → (2,1) → (3,2) → (3,3)`, blocks: [G(dist, { hl: gridHl([[0, 0], [1, 1], [2, 1], [3, 2], [3, 3]], 'ok', hlw()) })], done: true, ans: d }); return; }
    q = nq;
  }
  F({ cap: '不可达 → -1', blocks: [], done: true, ans: -1 });
});

T('2359', '每个节点最多一条出边：分别从两个起点顺着走，记录距离', 'edges = [2,2,3,-1], node1 = 0, node2 = 1', 2, (F) => {
  const edges = [2, 2, 3, -1];
  const nodes = [{ k: 0, x: 0, y: 0 }, { k: 1, x: 0, y: 1 }, { k: 2, x: 0.45, y: 0.5 }, { k: 3, x: 0.9, y: 0.5 }];
  const E = edges.map((t, i) => (t >= 0 ? [i, t] : null)).filter(Boolean);
  const walk = (s) => { const d = [Infinity, Infinity, Infinity, Infinity]; let c = s, k = 0; while (c !== -1 && d[c] === Infinity) { d[c] = k++; c = edges[c]; } return d; };
  const d1 = walk(0), d2 = walk(1);
  const fx = (x) => (x === Infinity ? '∞' : x);
  F({ cap: '从 node1 = 0 出发：0 → 2 → 3', blocks: [{ t: 'graph', nodes, edges: E, directed: true, h: 150, hl: { 0: 'cur', 2: 'sel', 3: 'sel' }, tag: Object.fromEntries(d1.map((x, i) => [i, 'd1=' + fx(x)])) }] });
  F({ cap: '从 node2 = 1 出发：1 → 2 → 3（遇到访问过的节点要停，防止环）', blocks: [{ t: 'graph', nodes, edges: E, directed: true, h: 150, hl: { 1: 'warn', 2: 'sel', 3: 'sel' }, tag: Object.fromEntries(d2.map((x, i) => [i, 'd2=' + fx(x)])) }] });
  let best = Infinity, ans = -1;
  for (let i = 0; i < 4; i++) { const m = Math.max(d1[i], d2[i]); if (m < best) { best = m; ans = i; } }
  F({ cap: `max(d1, d2)：节点 2 为 1，节点 3 为 2 → 选 **${ans}**（并列取编号小的）`, blocks: [{ t: 'graph', nodes, edges: E, directed: true, h: 150, hl: { [ans]: 'ok' }, tag: Object.fromEntries(d1.map((x, i) => [i, 'max=' + fx(Math.max(x, d2[i]))])) }], done: true, ans });
});

T('138', '三遍：节点后插入拷贝 → 设置拷贝的 random → 拆分两条链', 'head = [[7,null],[13,0],[11,4],[10,2],[1,0]]', [[7, null], [13, 0], [11, 4], [10, 2], [1, 0]], (F) => {
  const val = [7, 13, 11, 10, 1], rnd = [null, 0, 4, 2, 0], n = 5;
  const orig = val.map((v, i) => ({ k: 'o' + i, x: i / 4, y: 0, label: v }));
  const copy = val.map((v, i) => ({ k: 'c' + i, x: i / 4 + 0.06, y: 1, label: v + "'" }));
  const nextO = [...Array(n - 1).keys()].map((i) => ['o' + i, 'o' + (i + 1)]);
  const randO = rnd.map((r, i) => (r == null ? null : ['o' + i, 'o' + r])).filter(Boolean);
  F({ cap: '原链表：实线是 next，另有 random 指针（高亮）', blocks: [{ t: 'graph', nodes: orig, edges: [...nextO, ...randO], directed: true, h: 150, ehl: Object.fromEntries(randO.map(([a, b]) => [a + '-' + b, 'ok'])) }] });
  const inter = [];
  for (let i = 0; i < n; i++) { inter.push(['o' + i, 'c' + i]); if (i < n - 1) inter.push(['c' + i, 'o' + (i + 1)]); }
  F({ cap: '① 每个节点后面插入它的拷贝：A → A\' → B → B\' …（不用哈希表）', blocks: [{ t: 'graph', nodes: [...orig, ...copy], edges: inter, directed: true, h: 170, hl: Object.fromEntries(copy.map((c) => [c.k, 'cur'])) }] });
  const randC = rnd.map((r, i) => (r == null ? null : ['c' + i, 'c' + r])).filter(Boolean);
  F({ cap: '② copy.random = orig.random.next：原节点 random 指向谁，拷贝就指向谁的拷贝', blocks: [{ t: 'graph', nodes: [...orig, ...copy], edges: [...inter, ...randC], directed: true, h: 170, ehl: Object.fromEntries(randC.map(([a, b]) => [a + '-' + b, 'ok'])) }] });
  const nextC = [...Array(n - 1).keys()].map((i) => ['c' + i, 'c' + (i + 1)]);
  F({ cap: '③ 拆分：恢复原链表，拷贝节点串成新链表', blocks: [{ t: 'graph', nodes: [...orig, ...copy], edges: [...nextO, ...nextC, ...randC], directed: true, h: 170, hl: Object.fromEntries(copy.map((c) => [c.k, 'ok'])), ehl: Object.fromEntries(randC.map(([a, b]) => [a + '-' + b, 'ok'])) }], done: true, ans: val.map((v, i) => [v, rnd[i]]) });
});

T('460', 'key → (值, 频次) + 频次 → 按时间排序的 key 链表 + minFreq', 'capacity = 2；put 1、put 2、get 1、put 3、get 2、get 3、put 4、get 1、get 3、get 4', [1, -1, 3, -1, 3, 4], (F) => {
  const cap = 2, kv = new Map(), freq = new Map(), buckets = new Map(), out = [];
  let minF = 0;
  const touch = (k) => { const f = freq.get(k); buckets.get(f).splice(buckets.get(f).indexOf(k), 1); if (!buckets.get(f).length) { buckets.delete(f); if (minF === f) minF++; } freq.set(k, f + 1); if (!buckets.has(f + 1)) buckets.set(f + 1, []); buckets.get(f + 1).push(k); };
  const draw = (cap2, hk, cls, done) => F({ cap: cap2, blocks: [M([...kv].map(([k, v]) => [k, `${v} (f=${freq.get(k)})`]), { label: 'key → 值 (频次)', hl: hk, hlCls: cls }), M([...buckets].sort((a, b) => a[0] - b[0]).map(([f, ks]) => ['freq ' + f, ks.slice()]), { id: 'b', label: '频次 → key（左旧右新）', hl: 'freq ' + minF }), V(['minFreq', minF, 'cur'], ['输出', fmt(out)])], done, ans: done ? out.slice() : undefined });
  const put = (k, v) => {
    if (kv.has(k)) { kv.set(k, v); touch(k); draw(`put(${k})：已存在 → 更新值，频次 +1`, k, 'cur'); return; }
    if (kv.size === cap) { const ev = buckets.get(minF)[0]; draw(`put(${k})：已满 → 淘汰 minFreq=${minF} 桶里最旧的 ${ev}`, ev, 'bad'); buckets.get(minF).shift(); if (!buckets.get(minF).length) buckets.delete(minF); kv.delete(ev); freq.delete(ev); }
    kv.set(k, v); freq.set(k, 1); if (!buckets.has(1)) buckets.set(1, []); buckets.get(1).push(k); minF = 1;
    draw(`put(${k}, ${v})：新 key 频次 1，minFreq = 1`, k, 'ok');
  };
  const get = (k) => { if (!kv.has(k)) { out.push(-1); draw(`get(${k}) = -1`, null); return; } touch(k); out.push(kv.get(k)); draw(`get(${k}) = ${kv.get(k)}：频次 +1，移到更高频次的桶`, k, 'cur'); };
  put(1, 1); put(2, 2); get(1); put(3, 3); get(2); get(3); put(4, 4); get(1); get(3); get(4);
  draw(`全部操作 O(1)；输出 ${fmt(out)}`, null, '', true);
});

/* ---------------- 几何 ---------------- */
T('面试变体 4', '射线法：向右发射水平射线，交点奇数次在内部', '凹五边形 (0,0) (4,0) (4,4) (2,2) (0,4)；查询 P(0.5,3)、Q(2,3.5)', ['inside', 'outside'], (F) => {
  const poly = [[0, 0], [4, 0], [4, 4], [2, 2], [0, 4]];
  const toN = ([x, y], k, label) => ({ k, x: x / 4.6, y: 1 - y / 4, label });
  const pn = poly.map((p, i) => toN(p, 'v' + i, `(${p[0]},${p[1]})`));
  const pe = poly.map((_, i) => ['v' + i, 'v' + ((i + 1) % 5)]);
  const res = [];
  for (const [name, P] of [['P', [0.5, 3]], ['Q', [2, 3.5]]]) {
    let cnt = 0;
    const hitE = {};
    F({ cap: `查询 ${name}(${P[0]}, ${P[1]})：从它向右画一条水平射线`, blocks: [{ t: 'graph', nodes: [...pn, toN(P, name, name), toN([4.6, P[1]], 'far', '→')], edges: [...pe, [name, 'far']], h: 200, hl: { [name]: 'cur' }, ehl: { [name + '-far']: 'warn' } }] });
    for (let i = 0; i < 5; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % 5];
      if ((y1 > P[1]) !== (y2 > P[1])) {
        const xi = x1 + (P[1] - y1) * (x2 - x1) / (y2 - y1);
        if (xi > P[0]) { cnt++; hitE['v' + i + '-v' + ((i + 1) % 5)] = 'on'; F({ cap: `边 (${x1},${y1})–(${x2},${y2}) 跨过 y = ${P[1]}，交点 x = ${r3(xi)} 在 ${name} 右侧 → 计数 ${cnt}`, blocks: [{ t: 'graph', nodes: [...pn, toN(P, name, name), toN([4.6, P[1]], 'far', '→')], edges: [...pe, [name, 'far']], h: 200, hl: { [name]: 'cur' }, ehl: Object.assign({ [name + '-far']: 'warn' }, hitE) }] }); }
      }
    }
    res.push(cnt % 2 ? 'inside' : 'outside');
    F({ cap: `${name} 共 ${cnt} 个交点 → ${cnt % 2 ? '奇数 → **内部**' : '偶数 → **外部**（落在凹口里）'}`, blocks: [{ t: 'graph', nodes: [...pn, toN(P, name, name)], edges: pe, h: 200, hl: { [name]: cnt % 2 ? 'ok' : 'bad' }, ehl: hitE }] });
  }
  F({ cap: '实现细节：用 (y1 > y) != (y2 > y) 判断跨越，天然避免重复计算顶点；另外先判断点是否在边上', blocks: [V(['结果', fmt(res), 'ok'])], done: true, ans: res });
});

T('面试变体 2', '枚举两点作对角线，算出另外两个顶点并查哈希集合；每个正方形被两条对角线各数一次', 'points = (0,0) (1,0) (0,1) (1,1) (2,1) (1,2)', 2, (F) => {
  const pts = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], set = new Set(pts.map((p) => p.join(',')));
  const nodes = pts.map((p, i) => ({ k: 'p' + i, x: p[0] / 2, y: 1 - p[1] / 2, label: `${p[0]},${p[1]}` }));
  let found = 0;
  F({ cap: '对角线 (x1,y1)-(x2,y2)：中点 c，另两点 = c ± 旋转 90° 的半对角向量（坐标 ×2 避免小数）', blocks: [{ t: 'graph', nodes, edges: [], h: 190 }] });
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[j];
    const sx = x1 + x2, sy = y1 + y2, dx = x2 - x1, dy = y2 - y1;
    const p3 = [(sx - dy) / 2, (sy + dx) / 2], p4 = [(sx + dy) / 2, (sy - dx) / 2];
    const ok = Number.isInteger(p3[0]) && Number.isInteger(p3[1]) && set.has(p3.join(',')) && set.has(p4.join(','));
    if (!ok) continue;
    found++;
    const k3 = 'p' + pts.findIndex((p) => p.join(',') === p3.join(',')), k4 = 'p' + pts.findIndex((p) => p.join(',') === p4.join(','));
    F({ cap: `对角线 (${x1},${y1})–(${x2},${y2}) → 另两点 (${p3}) (${p4}) 都存在，计数 ${found}`, blocks: [{ t: 'graph', nodes, edges: [['p' + i, k3], [k3, 'p' + j], ['p' + j, k4], [k4, 'p' + i], ['p' + i, 'p' + j]], h: 190, hl: { ['p' + i]: 'cur', ['p' + j]: 'cur', [k3]: 'ok', [k4]: 'ok' }, ehl: { ['p' + i + '-p' + j]: 'on' } }] });
  }
  F({ cap: `命中 ${found} 次，每个正方形有两条对角线 → **${found / 2}** 个（一个正放、一个旋转 45°），O(n²)`, blocks: [{ t: 'graph', nodes, edges: [['p0', 'p1'], ['p1', 'p3'], ['p3', 'p2'], ['p2', 'p0'], ['p1', 'p4'], ['p4', 'p5'], ['p5', 'p2']], h: 190, hl: Object.fromEntries(nodes.map((n) => [n.k, 'ok'])) }], done: true, ans: found / 2 });
});

/* ---------------- 并发时序 ---------------- */
const TL = (rows, cols, cells, hlx, label) => G(rows.map((_, r) => cols.map((__, c) => (cells[r] && cells[r][c]) || '')), { label: label || '时间线（行 = 线程）', rh: rows, ch: cols, cw: 58, hl: hlx || {} });

T('Java', '双重检查锁：两次判空 + synchronized + volatile 禁止指令重排', '线程 T1、T2 同时第一次调用 getInstance()', 'same', (F) => {
  const rows = ['T1', 'T2'], cols = ['t1', 't2', 't3', 't4', 't5', 't6'], cells = [[], []];
  const step = (r, c, txt, cap, vars, cls) => { cells[r][c] = txt; F({ cap, blocks: [TL(rows, cols, cells, { [r + ',' + c]: cls || 'cur' }), V(...vars)] }); };
  step(0, 0, '判空✓', 'T1 第一次检查 instance == null → 进入', [['instance', 'null'], ['锁', '空闲']]);
  step(1, 1, '判空✓', 'T2 同时检查，也看到 null（这就是为什么需要第二次检查）', [['instance', 'null'], ['锁', '空闲']]);
  step(0, 2, '拿锁', 'T1 先抢到 synchronized 锁', [['instance', 'null'], ['锁', 'T1', 'cur']]);
  step(1, 2, '阻塞', 'T2 等锁', [['instance', 'null'], ['锁', 'T1', 'cur']], 'warn');
  step(0, 3, 'new', 'T1 第二次检查仍为 null → new Singleton()；volatile 保证「分配 → 初始化 → 赋值」不会被重排成先赋值', [['instance', '已初始化', 'ok'], ['锁', 'T1']], 'ok');
  step(0, 4, '释放', 'T1 释放锁（unlock 前的写对之后拿锁的线程可见）', [['instance', '已初始化', 'ok'], ['锁', '空闲']]);
  step(1, 4, '拿锁', 'T2 拿到锁', [['instance', '已初始化', 'ok'], ['锁', 'T2', 'cur']]);
  cells[1][5] = '判空✗';
  F({ cap: 'T2 第二次检查发现已非空 → 直接返回同一个实例。之后的调用第一次检查就返回，不再加锁', blocks: [TL(rows, cols, cells, { '1,5': 'ok' }), V(['instance', '同一个对象', 'ok'])], done: true, ans: 'same' });
});

T('并发 1', 'turn 标志 + wait / notifyAll：奇数行 A 线程、偶数行 B 线程交替', 'matrix 4 行，线程 A 打第 0、2 行，B 打第 1、3 行', [0, 1, 2, 3], (F) => {
  const rows = ['A', 'B'], cols = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'], cells = [[], []], out = [];
  let t = 0;
  for (let row = 0; row < 4; row++) {
    const who = row % 2, other = 1 - who;
    if (t < 8) cells[other][t] = 'wait';
    cells[who][t] = '打印行' + row;
    out.push(row);
    F({ cap: `turn = ${who ? 'B' : 'A'}：${who ? 'B' : 'A'} 打印第 ${row} 行；另一个线程在 while (turn != 我) wait()`, blocks: [TL(rows, cols, cells, { [who + ',' + t]: 'ok', [other + ',' + t]: 'dim' }), V(['turn', who ? 'B' : 'A', 'cur'], ['已打印', fmt(out)])] });
    t++;
    cells[who][t] = 'notify';
    F({ cap: `${who ? 'B' : 'A'} 把 turn 切给对方并 notifyAll()（用 while 而不是 if，防止虚假唤醒）`, blocks: [TL(rows, cols, cells, { [who + ',' + t]: 'warn' }), V(['turn', who ? 'A' : 'B', 'cur'])] });
    t++;
  }
  F({ cap: '也可用 ReentrantLock + 两个 Condition 精确唤醒，或 Semaphore(1)/Semaphore(0) 交替 release', blocks: [TL(rows, cols, cells), V(['输出行序', fmt(out), 'ok'])], done: true, ans: out });
});

T('并发 2', '共享计数 + 每个线程等待「轮到自己」：第 i 个线程只在 count == i 时打印', '10 个线程，按 1~10 顺序打印', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], (F) => {
  const th = Array.from({ length: 10 }, (_, i) => 'T' + (i + 1)), out = [];
  F({ cap: '10 个线程同时启动、抢锁的顺序随机；靠条件判断保证输出有序', blocks: [A(th, { cw: 44, label: '线程' }), V(['count', 1, 'cur'])] });
  const order = [3, 1, 7, 2, 4, 5, 6, 8, 10, 9];
  let count = 1, gi = 0;
  while (count <= 10 && gi < 40) {
    const k = order[gi % order.length]; gi++;
    if (k < count) continue;
    if (k !== count) { F({ cap: `${th[k - 1]} 拿到锁，但 count = ${count} ≠ ${k} → await() 释放锁继续等`, blocks: [A(th, { cw: 44, label: '线程', hl: Object.assign(rng(0, count - 2, 'ok'), { [k - 1]: 'bad' }) }), V(['count', count, 'cur'], ['输出', out.join(' ')])] }); continue; }
    out.push(count);
    F({ cap: `${th[k - 1]} 发现 count == ${k} → 打印 ${k}，count++，signalAll()`, blocks: [A(th, { cw: 44, label: '线程', hl: Object.assign(rng(0, count - 1, 'ok'), { [k - 1]: 'cur' }) }), V(['count', count + 1, 'cur'], ['输出', out.join(' '), 'ok'])] });
    count++;
    gi = 0;
    order.splice(order.indexOf(k), 1);
  }
  F({ cap: '更高效的写法：每个线程一个 Condition / Semaphore，打印完只唤醒下一个，避免惊群', blocks: [A(th, { cw: 44, label: '线程', hl: rng(0, 9, 'ok') }), V(['输出', out.join(' '), 'ok'])], done: true, ans: out });
});

T('1226', '资源有序分配：每个哲学家先拿编号小的叉子，破坏循环等待', '5 位哲学家、5 把叉子', 'no-deadlock', (F) => {
  const nodes = [];
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; nodes.push({ k: 'P' + i, x: 0.5 + 0.42 * Math.cos(a), y: 0.5 + 0.45 * Math.sin(a), label: 'P' + i }); const b = a + Math.PI / 5; nodes.push({ k: 'f' + ((i + 1) % 5), x: 0.5 + 0.24 * Math.cos(b), y: 0.5 + 0.26 * Math.sin(b), label: 'f' + ((i + 1) % 5) }); }
  const edges = [];
  for (let i = 0; i < 5; i++) { edges.push(['P' + i, 'f' + i], ['P' + i, 'f' + ((i + 1) % 5)]); }
  const draw = (cap, hlm, ehl, done) => F({ cap, blocks: [{ t: 'graph', nodes, edges, h: 230, hl: hlm, ehl }], done, ans: done ? 'no-deadlock' : undefined });
  draw('哲学家 Pi 左手是 fi、右手是 f(i+1)；如果人人先拿左手 → 5 人各拿一把，循环等待 → 死锁', Object.fromEntries([0, 1, 2, 3, 4].map((i) => ['P' + i, 'bad'])), Object.fromEntries([0, 1, 2, 3, 4].map((i) => ['P' + i + '-f' + i, 'on'])));
  draw('改为「先拿编号小的叉子」：P0~P3 依次拿左手 f0~f3；P4 的两把是 f4、f0，它要先拿 f0 → 被 P0 占着，P4 等待且不占任何叉子', { P0: 'cur', P1: 'cur', P2: 'cur', P3: 'cur', P4: 'warn' }, { 'P0-f0': 'on', 'P1-f1': 'on', 'P2-f2': 'on', 'P3-f3': 'on' });
  draw('f4 空闲 → P3 拿到 f3、f4 两把，开始吃饭', { P3: 'ok', P4: 'warn' }, { 'P0-f0': 'on', 'P1-f1': 'on', 'P2-f2': 'on', 'P3-f3': 'ok', 'P3-f4': 'ok' });
  draw('P3 吃完放下 → P2 拿到 f3 开始吃 → 依次释放，总有人能前进，不会死锁', { P2: 'ok', P3: 'dim', P4: 'warn' }, { 'P0-f0': 'on', 'P1-f1': 'on', 'P2-f2': 'ok', 'P2-f3': 'ok' });
  draw('其它解法：最多允许 4 人同时拿叉子（Semaphore(4)）、或拿不到第二把就放下第一把（tryLock）', {}, {}, true);
});

/* ---------------- 机器学习基础 ---------------- */
T('ML 1', 'Attention = softmax(QKᵀ / √d) · V；多头 = 拆成 h 份各算一遍再拼接', '2 个 token，d = 2（单头数值示例）', [[0.33, 0.67], [0.67, 0.33]], (F) => {
  const Qm = [[1, 0], [0, 1]], Km = [[1, 2], [2, 1]], Vm = [[1, 0], [0, 1]], d = 2;
  F({ cap: '每个 token 的向量分别乘 W_Q、W_K、W_V 得到 Q、K、V', blocks: [G(Qm, { id: 'q', label: 'Q', rh: ['t1', 't2'], ch: ['d1', 'd2'] }), G(Km, { id: 'k', label: 'K', rh: ['t1', 't2'], ch: ['d1', 'd2'] }), G(Vm, { id: 'v', label: 'V', rh: ['t1', 't2'], ch: ['d1', 'd2'] })] });
  const S0 = Qm.map((q) => Km.map((k) => q[0] * k[0] + q[1] * k[1]));
  const Sc = S0.map((r) => r.map((x) => r3(x / Math.sqrt(d))));
  F({ cap: 'scores = Q·Kᵀ / √d：第 i 行表示 token i 对各 token 的相关度；除以 √d 防止点积过大让 softmax 饱和', blocks: [G(S0, { id: 's0', label: 'Q·Kᵀ', rh: ['t1', 't2'], ch: ['k1', 'k2'] }), G(Sc, { id: 'sc', label: '÷ √2', rh: ['t1', 't2'], ch: ['k1', 'k2'], hl: { '0,1': 'cur', '1,0': 'cur' } })] });
  const W = Sc.map((r) => { const e = r.map((x) => Math.exp(x)), s = e[0] + e[1]; return e.map((x) => r3(x / s)); });
  F({ cap: '按行 softmax（数值稳定：先减去行最大值），每行和为 1 = 注意力权重', blocks: [G(W, { id: 'w', label: 'softmax 权重', rh: ['t1', 't2'], ch: ['k1', 'k2'], hl: { '0,1': 'ok', '1,0': 'ok' } })] });
  const O = W.map((w) => [0, 1].map((j) => r3(w[0] * Vm[0][j] + w[1] * Vm[1][j])));
  F({ cap: '输出 = 权重 · V：token 1 更多地吸收了 token 2 的信息。多头：每头 d/h 维独立算，拼接后乘 W_O；decoder 还要加因果 mask', blocks: [G(O, { id: 'o', label: '输出', rh: ['t1', 't2'], ch: ['d1', 'd2'], hl: { '0,0': 'ok', '0,1': 'ok', '1,0': 'ok', '1,1': 'ok' } })], done: true, ans: O.map((r) => r.map((x) => Math.round(x * 100) / 100)) });
});

T('ML 2', 'AUC = 随机取一正一负，正样本得分更高的概率', 'scores = [0.9,0.8,0.7,0.6,0.55,0.3]，labels = [1,0,1,1,0,0]', 0.778, (F) => {
  const s = [0.9, 0.8, 0.7, 0.6, 0.55, 0.3], y = [1, 0, 1, 1, 0, 0];
  F({ cap: '已按得分降序排好；3 个正样本、3 个负样本，共 3 × 3 = 9 个正负对', blocks: [A(s, { id: 's', label: '得分', hl: Object.fromEntries(y.map((v, i) => [i, v ? 'ok' : 'bad'])) }), A(y, { id: 'y', label: '标签（绿 = 正）' })] });
  let good = 0;
  s.forEach((v, i) => {
    if (!y[i]) return;
    const beat = s.filter((w, j) => !y[j] && w < v).length;
    good += beat;
    F({ cap: `正样本 ${v}：比它低分的负样本有 ${beat} 个 → 正确排序对 +${beat}，累计 ${good}`, blocks: [A(s, { id: 's', label: '得分', hl: Object.assign(Object.fromEntries(s.map((w, j) => [j, !y[j] && w < v ? 'sel' : ''])), { [i]: 'cur' }) }), V(['正确对', good, 'ok'], ['总对数', 9])] });
  });
  const auc = r3(good / 9);
  F({ cap: `AUC = ${good} / 9 = **${auc}**；等价公式 (正样本秩和 − P(P+1)/2) / (P·N)，排序 O(n log n)，得分相同时算 0.5 对`, blocks: [TX('AUC = ' + auc)], done: true, ans: auc });
});

T('ML 3', '交叉熵 = −log(正确类的 softmax 概率)；用 log-sum-exp 保证数值稳定', 'logits = [2, 1, 0.1]，真实类别 0', 0.417, (F) => {
  const z = [2, 1, 0.1], m = Math.max(...z);
  F({ cap: '先减去最大值 2（不改变 softmax 结果，避免 exp 溢出）', blocks: [A(z, { id: 'z', label: 'logits' }), A(z.map((x) => r3(x - m)), { id: 'zm', label: 'z − max' })] });
  const e = z.map((x) => Math.exp(x - m)), sum = e.reduce((a, b) => a + b, 0);
  const p = e.map((x) => r3(x / sum));
  F({ cap: `softmax：p = e^(z−max) / Σ = ${fmt(p)}`, blocks: [A(e.map(r3), { id: 'e', label: 'exp' }), A(p, { id: 'p', label: '概率', hl: { 0: 'ok' } })] });
  const loss = r3(-Math.log(e[0] / sum));
  F({ cap: `loss = −log p₀ = −log ${p[0]} = **${loss}**；稳定写法 loss = −z₀ + max + log Σ e^(z−max)。二分类即 −[y log p + (1 − y) log(1 − p)]`, blocks: [V(['loss', loss, 'ok'])], done: true, ans: loss });
});

T('ML 4', 'KL(P‖Q) = Σ p·log(p / q)：用 Q 近似 P 时多付出的信息量，非对称', 'P = [0.5,0.3,0.2]，Q = [0.4,0.4,0.2]', 0.025, (F) => {
  const P = [0.5, 0.3, 0.2], Q = [0.4, 0.4, 0.2];
  let kl = 0;
  F({ cap: '逐项计算 p·ln(p/q)；p = 0 的项按 0 处理，q = 0 而 p > 0 时 KL 为无穷', blocks: [A(P, { id: 'p', label: 'P' }), A(Q, { id: 'q', label: 'Q' })] });
  P.forEach((p, i) => {
    const t = p * Math.log(p / Q[i]);
    kl += t;
    F({ cap: `第 ${i} 项：${p} × ln(${p} / ${Q[i]}) = ${r3(t)}${t < 0 ? '（单项可以为负，总和 ≥ 0）' : ''}`, blocks: [A(P, { id: 'p', label: 'P', hl: { [i]: 'cur' } }), A(Q, { id: 'q', label: 'Q', hl: { [i]: 'cur' } }), V(['累计 KL', r3(kl), 'ok'])] });
  });
  F({ cap: `KL = **${r3(kl)}**；交叉熵 H(P, Q) = H(P) + KL(P‖Q)，所以最小化交叉熵等价于最小化 KL`, blocks: [TX('KL = ' + r3(kl))], done: true, ans: r3(kl) });
});

/* ---------------- 补齐 ---------------- */
T('30', '按单词长度分组滑窗：窗口以「单词」为单位移动，计数超了就从左边弹单词', 's = "barfoothefoobarman", words = ["foo","bar"]', [0, 9], (F) => {
  const s = 'barfoothefoobarman', w = 3, need = { foo: 1, bar: 1 }, res = [];
  for (let off = 0; off < w; off++) {
    const chunks = [];
    for (let i = off; i + w <= s.length; i += w) chunks.push(s.slice(i, i + w));
    const win = {};
    let l = 0, used = 0;
    F({ cap: `起点偏移 ${off}：把 s 按长度 ${w} 切成单词序列`, blocks: [A(chunks, { cw: 52, label: `偏移 ${off} 的单词序列` }), M(Object.entries(need), { id: 'need', label: '需要' })] });
    for (let r = 0; r < chunks.length; r++) {
      const c = chunks[r];
      if (!need[c]) { F({ cap: `"${c}" 不在 words 中 → 窗口清空，左边界跳到下一个单词`, blocks: [A(chunks, { cw: 52, label: `偏移 ${off}`, hl: { [r]: 'bad' } }), V(['结果', fmt(res)])] }); Object.keys(win).forEach((k) => delete win[k]); used = 0; l = r + 1; continue; }
      win[c] = (win[c] || 0) + 1; used++;
      while (win[c] > need[c]) { win[chunks[l]]--; used--; l++; }
      if (used === 2) { res.push(off + l * w); F({ cap: `窗口 [${l}, ${r}] 恰好包含所有单词 → 记录起点 ${off + l * w}`, blocks: [A(chunks, { cw: 52, label: `偏移 ${off}`, win: [l, r], winCls: 'ok' }), V(['结果', fmt(res), 'ok'])] }); win[chunks[l]]--; used--; l++; }
      else F({ cap: `加入 "${c}"，窗口内 ${used} 个单词`, blocks: [A(chunks, { cw: 52, label: `偏移 ${off}`, win: [l, r], hl: { [r]: 'cur' } }), V(['结果', fmt(res)])] });
    }
  }
  res.sort((a, b) => a - b);
  F({ cap: `所有起点 ${fmt(res)}；每个偏移 O(n / w)，总 O(n)`, blocks: [TX(fmt(res))], done: true, ans: res });
});

T('395', '分治：出现次数 < k 的字符不可能在答案里，以它为分割点递归', 's = "aaabb", k = 3', 3, (F) => {
  const k = 3;
  let best = 0;
  const go = (str, depth) => {
    const cnt = {};
    for (const c of str) cnt[c] = (cnt[c] || 0) + 1;
    const bad = Object.keys(cnt).find((c) => cnt[c] < k);
    F({ cap: `处理 "${str}"：${bad ? `'${bad}' 只出现 ${cnt[bad]} 次 < ${k} → 以它分割` : `所有字符都 ≥ ${k} 次 → 整段合法，长度 ${str.length}`}`, blocks: [A(str.split(''), { hl: Object.fromEntries(str.split('').map((c, i) => [i, c === bad ? 'bad' : bad ? '' : 'ok'])) }), M(Object.entries(cnt), { label: '计数', hl: bad, hlCls: 'bad' }), V(['best', best])] });
    if (!bad) { best = Math.max(best, str.length); return; }
    str.split(bad).filter(Boolean).forEach((p) => go(p, depth + 1));
  };
  go('aaabb', 0);
  F({ cap: `最长 **${best}**；也可枚举「窗口内字符种类数 1~26」做 26 次滑窗`, blocks: [TX('return ' + best)], done: true, ans: best });
});

T('拼多多笔试', 'dp[i][t] = 用 t 分钟读完前 i 页的最大知识量；最后一步读 1 页或读相邻 2 页', 'a = [4,2,6,3]，总时间 T = 3', 12, (F) => {
  const a = [4, 2, 6, 3], n = 4, T0 = 3, NEG = -Infinity;
  const dp = Array.from({ length: n + 1 }, () => Array(T0 + 1).fill(NEG));
  dp[0][0] = 0;
  const show = (hlx) => G(dp.map((r) => r.map((x) => (x === NEG ? '—' : x))), { label: 'dp[i][t]（i = 已读页数，t = 用时）', rh: ['0页', '1页', '2页', '3页', '4页'], ch: ['t0', 't1', 't2', 't3'], hl: hlx });
  F({ cap: 'dp[0][0] = 0，其余为 −∞（不可达）', blocks: [A(a, { id: 'a', label: '每页知识量' }), show({ '0,0': 'ok' })] });
  for (let i = 1; i <= n; i++) for (let t = 1; t <= T0; t++) {
    const one = dp[i - 1][t - 1] === NEG ? NEG : dp[i - 1][t - 1] + a[i - 1];
    const two = i >= 2 && dp[i - 2][t - 1] !== NEG ? dp[i - 2][t - 1] + (a[i - 2] + a[i - 1]) / 2 : NEG;
    dp[i][t] = Math.max(one, two);
    if (dp[i][t] === NEG) continue;
    F({ cap: `dp[${i}][${t}]：读 1 页 = ${one === NEG ? '不可达' : one}，读 2 页 = ${two === NEG ? '不可达' : two} → ${dp[i][t]}`, blocks: [A(a, { id: 'a', label: '每页知识量', hl: two > one ? { [i - 2]: 'warn', [i - 1]: 'warn' } : { [i - 1]: 'cur' } }), show({ [i + ',' + t]: 'cur', [(i - 1) + ',' + (t - 1)]: one >= two ? 'sel' : '', [(i - 2) + ',' + (t - 1)]: two > one ? 'sel' : '' })] });
  }
  const ans = Math.max(...dp[n]);
  F({ cap: `答案 = max(dp[4][t ≤ 3]) = **${ans}**：先双读 (4,2) 得 3，再读 6、3；若全是 −∞ 则返回 -1`, blocks: [show({ '4,3': 'ok' })], done: true, ans: ans === NEG ? -1 : ans });
});

;
/* ==========================================================================
   逐步演示（第 6 部分：代码手撕 / 数据库手撕）
   key 使用条目 id（handwrite-xx / database-xx）
   ========================================================================== */
const TBL = (head, rows, o = {}) => G(rows.map((r) => r.map((x) => (x == null ? '' : x))), Object.assign({ ch: head, cw: 76, cellH: 30 }, o));

/* ---------------- 并发手撕 ---------------- */
T('handwrite-56', 'ReentrantLock + 两个 Condition：满了在 notFull 上等，空了在 notEmpty 上等', 'capacity = 2；P1 put a、P1 put b、P2 put c、C1 take、C2 take、C2 take、C3 take', ['a', 'b', 'c'], (F) => {
  const cap = 2, q = [], waitFull = [], waitEmpty = [], out = [];
  const draw = (cap2, hlq, done) => F({ cap: cap2, blocks: [Q(q, { label: `队列（容量 ${cap}）`, hl: hlq || {} }), V(['notFull 等待', waitFull.join(',') || '—', waitFull.length ? 'bad' : ''], ['notEmpty 等待', waitEmpty.join(',') || '—', waitEmpty.length ? 'bad' : ''], ['已取出', out.join(',') || '—', 'ok'])], done, ans: done ? out.slice() : undefined });
  const put = (who, x) => {
    if (q.length === cap) { waitFull.push(`${who}(${x})`); draw(`${who} put(${x})：队列已满 → while (size == cap) notFull.await()，释放锁并挂起`); return false; }
    q.push(x); draw(`${who} put(${x})：入队后 notEmpty.signal()`, { [q.length - 1]: 'cur' }); return true;
  };
  const take = (who) => {
    if (!q.length) { waitEmpty.push(who); draw(`${who} take()：队列为空 → notEmpty.await()`); return; }
    const x = q.shift(); out.push(x);
    draw(`${who} take() = ${x}，然后 notFull.signal() 唤醒一个生产者`, {});
    if (waitFull.length) { const w = waitFull.shift(); const [, who2, x2] = /^(\w+)\((\w+)\)$/.exec(w); q.push(x2); draw(`${who2} 被唤醒，重新检查条件（必须用 while）→ 有空位，put(${x2}) 成功`, { [q.length - 1]: 'ok' }); }
  };
  put('P1', 'a'); put('P1', 'b'); put('P2', 'c');
  take('C1'); take('C2'); take('C2'); take('C3');
  draw('C3 仍在等待下一个元素。要点：await 放在 while 里防虚假唤醒；两个 Condition 精确唤醒，避免 notifyAll 惊群', {}, true);
});

T('handwrite-57', '固定 3 线程的线程池 + CountDownLatch：任意时刻最多 3 个任务在跑', '8 个任务（耗时 3,1,2,2,1,3,1,2），并发上限 3', 6, (F) => {
  const dur = [3, 1, 2, 2, 1, 3, 1, 2], free = [0, 0, 0], cells = [[], [], []];
  const T0 = Array.from({ length: 8 }, (_, i) => 't' + i);
  let latch = dur.length;
  dur.forEach((d, i) => {
    let w = 0;
    for (let k = 1; k < 3; k++) if (free[k] < free[w]) w = k;
    const st = free[w];
    for (let t = st; t < st + d; t++) cells[w][t] = '任务' + (i + 1);
    free[w] = st + d;
    latch--;
    F({ cap: `任务 ${i + 1}（耗时 ${d}）：等最早空闲的线程 W${w + 1}，在 t${st} 开始；结束后 latch.countDown() → ${latch}`, blocks: [TL(['W1', 'W2', 'W3'], T0, cells, Object.fromEntries([...Array(d).keys()].map((k) => [w + ',' + (st + k), 'cur']))), V(['latch', latch, 'cur'])] });
  });
  const total = Math.max(...free);
  F({ cap: `主线程 latch.await() 在 t${total} 返回：总耗时 ${total}（串行需要 ${dur.reduce((a, b) => a + b, 0)}）。也可用 Semaphore(3) 控制并发、CompletableFuture.allOf 等待`, blocks: [TL(['W1', 'W2', 'W3'], T0, cells), V(['latch', 0, 'ok'])], done: true, ans: total });
});

T('handwrite-58', 'execute 的顺序：核心线程 → 队列 → 非核心线程 → 拒绝策略', 'core = 2, max = 4, queue = ArrayBlockingQueue(2)；连续提交 7 个长任务', ['core', 'core', 'queue', 'queue', 'extra', 'extra', 'reject'], (F) => {
  const core = 2, max = 4, qcap = 2, workers = [], q = [], res = [];
  const draw = (cap, hw, hq, done) => F({ cap, blocks: [A([...workers, ...Array(max - workers.length).fill(null)], { id: 'w', label: '工作线程（前 2 个为核心线程）', cw: 60, hl: Object.assign(rng(0, core - 1, 'sel'), hw || {}) }), Q(q, { label: `阻塞队列（容量 ${qcap}）`, hl: hq || {} }), V(['poolSize', workers.length], ['queue', `${q.length}/${qcap}`], ['决策', fmt(res)])], done, ans: done ? res.slice() : undefined });
  draw('初始没有线程（除非 prestartAllCoreThreads）');
  for (let i = 1; i <= 7; i++) {
    const t = '任务' + i;
    if (workers.length < core) { workers.push(t); res.push('core'); draw(`${t}：线程数 < corePoolSize → 新建核心线程执行`, { [workers.length - 1]: 'cur' }); }
    else if (q.length < qcap) { q.push(t); res.push('queue'); draw(`${t}：核心线程已满 → 放入阻塞队列等待`, {}, { [q.length - 1]: 'cur' }); }
    else if (workers.length < max) { workers.push(t); res.push('extra'); draw(`${t}：队列也满了 → 线程数 < maximumPoolSize，新建非核心线程`, { [workers.length - 1]: 'warn' }); }
    else { res.push('reject'); draw(`${t}：线程数达到 max 且队列已满 → 执行拒绝策略（默认 AbortPolicy 抛异常；CallerRuns 让提交线程自己跑，起到反压作用）`, Object.fromEntries(workers.map((_, j) => [j, 'bad'])), Object.fromEntries(q.map((_, j) => [j, 'bad']))); }
  }
  draw('注意：只有队列满了才会扩到 max，所以无界队列（Executors.newFixedThreadPool）会让 max 失效并可能 OOM。非核心线程空闲超过 keepAliveTime 会回收', {}, {}, true);
});

T('handwrite-59', '小顶堆按到期时间排序；工作线程 wait(堆顶剩余时间)，新任务更早到期时 notify 重新计算', '在 t=0 依次提交：A 延迟 50、B 延迟 20、C 延迟 80；t=10 提交 D 延迟 5', ['D', 'B', 'A', 'C'], (F) => {
  const heap = [], out = [];
  const push = (x) => { heap.push(x); heap.sort((a, b) => a.at - b.at); };
  const show = () => heap.map((x) => `${x.id}@${x.at}`);
  const draw = (cap, now, hl2, done) => F({ cap, blocks: [TREE(show(), { label: '小顶堆（任务@到期时间）', hl: hl2 || {} }), V(['now', now, 'cur'], ['worker 等待', heap.length ? `${heap[0].at - now}ms` : '无限期'], ['已执行', out.join(' → ') || '—', 'ok'])], done, ans: done ? out.slice() : undefined });
  push({ id: 'A', at: 50 }); draw('schedule(A, 50)：入堆，notify 工作线程', 0, { 0: 'cur' });
  push({ id: 'B', at: 20 }); draw('schedule(B, 20)：B 成为堆顶；worker 被唤醒后改为只等 20ms', 0, { 0: 'cur' });
  push({ id: 'C', at: 80 }); draw('schedule(C, 80)', 0, {});
  push({ id: 'D', at: 15 }); draw('t=10 提交 D（到期 15）：比堆顶更早 → notify，worker 重新计算等待时间为 5ms', 10, { 0: 'warn' });
  for (const now of [15, 20, 50, 80]) { const x = heap.shift(); out.push(x.id); draw(`t=${now}：堆顶 ${x.id} 到期 → 出堆执行（任务丢到线程池执行，调度线程只负责计时）`, now, {}); }
  draw('核心是 wait(timeout) + 堆顶；JDK 的 DelayQueue / ScheduledThreadPoolExecutor 同理，海量任务用时间轮', 80, {}, true);
});

/* ---------------- 数据库手撕 ---------------- */
T('database-72', 'FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT', 'SELECT user_id, SUM(amount) AS total FROM orders WHERE amount > 10 GROUP BY user_id HAVING SUM(amount) > 100 ORDER BY total DESC LIMIT 1', [[2, 150]], (F) => {
  const rows = [[1, 1, 60], [2, 1, 50], [3, 2, 90], [4, 2, 5], [5, 2, 60], [6, 3, 80]];
  const head = ['id', 'user_id', 'amount'];
  F({ cap: '① FROM orders：拿到全部行', blocks: [TBL(head, rows)] });
  const w = rows.filter((r) => r[2] > 10);
  F({ cap: '② WHERE amount > 10：逐行过滤（此时还没有分组，所以不能写聚合函数；也还没有 SELECT 的别名）', blocks: [TBL(head, rows, { hl: Object.fromEntries(rows.flatMap((r, i) => (r[2] > 10 ? [] : [0, 1, 2].map((c) => [i + ',' + c, 'bad'])))) })] });
  const groups = {};
  w.forEach((r) => { (groups[r[1]] ||= []).push(r[2]); });
  const g = Object.entries(groups).map(([u, a]) => [u, a.join('+'), a.reduce((x, y) => x + y, 0)]);
  F({ cap: '③ GROUP BY user_id + 计算聚合 SUM(amount)', blocks: [TBL(['user_id', '明细', 'SUM'], g)] });
  const h = g.filter((r) => r[2] > 100);
  F({ cap: '④ HAVING SUM(amount) > 100：对分组结果过滤', blocks: [TBL(['user_id', '明细', 'SUM'], g, { hl: Object.fromEntries(g.flatMap((r, i) => [0, 1, 2].map((c) => [i + ',' + c, r[2] > 100 ? 'ok' : 'bad']))) })] });
  F({ cap: '⑤ SELECT user_id, SUM(amount) AS total：此时才产生别名 total', blocks: [TBL(['user_id', 'total'], h.map((r) => [r[0], r[2]]))] });
  const o = h.map((r) => [+r[0], r[2]]).sort((a, b) => b[1] - a[1]);
  F({ cap: '⑥ ORDER BY total DESC：在 SELECT 之后，所以可以用别名', blocks: [TBL(['user_id', 'total'], o)] });
  F({ cap: '⑦ LIMIT 1。这是「逻辑顺序」，优化器实际执行可能做谓词下推、索引排序等，以 EXPLAIN 为准', blocks: [TBL(['user_id', 'total'], o.slice(0, 1), { hl: { '0,0': 'ok', '0,1': 'ok' } })], done: true, ans: o.slice(0, 1) });
});

T('database-76', '日期 − 行号：连续的日期减去递增行号会得到同一个值，按它分组即可', '用户 1 的去重登录日期：1、2、3、5、6 号（以日表示）', [[1, 3]], (F) => {
  const days = [1, 2, 3, 5, 6];
  const rows = days.map((d, i) => [`${d} 号`, i + 1, null]);
  F({ cap: '① 先按 (user_id, DATE(login_time)) 去重，同一天多次登录只算一次', blocks: [TBL(['login_date', 'rn', 'date − rn'], rows)] });
  F({ cap: '② ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date)', blocks: [TBL(['login_date', 'rn', 'date − rn'], rows, { hl: Object.fromEntries(rows.map((_, i) => [i + ',1', 'cur'])) })] });
  rows.forEach((r, i) => { r[2] = days[i] - (i + 1); });
  F({ cap: '③ DATE_SUB(login_date, INTERVAL rn DAY)：1、2、3 号都得到 0；5、6 号得到 1 → 两个「岛」', blocks: [TBL(['login_date', 'rn', 'date − rn'], rows, { hl: Object.fromEntries(rows.flatMap((r, i) => [0, 1, 2].map((c) => [i + ',' + c, r[2] === 0 ? 'ok' : 'warn']))) })] });
  F({ cap: '④ GROUP BY user_id, grp HAVING COUNT(*) >= 3 → 区间 [1 号, 3 号] 满足「连续 3 天」', blocks: [TBL(['grp', 'start', 'end', 'days'], [[0, '1 号', '3 号', 3], [1, '5 号', '6 号', 2]], { hl: { '0,0': 'ok', '0,1': 'ok', '0,2': 'ok', '0,3': 'ok', '1,3': 'bad' } })], done: true, ans: [[1, 3]] });
});

T('database-78', 'DENSE_RANK() OVER (PARTITION BY 部门 ORDER BY 工资 DESC)，取 rk <= 3', '研发部 5 人（含并列），取前三高的工资档', ['A', 'B', 'C', 'D'], (F) => {
  const rows = [['A', 300], ['B', 300], ['C', 250], ['D', 200], ['E', 180]];
  F({ cap: '同一部门内按工资降序', blocks: [TBL(['name', 'salary', 'ROW_NUMBER', 'RANK', 'DENSE_RANK'], rows.map((r) => [...r, null, null, null]))] });
  const rn = rows.map((_, i) => i + 1);
  const rk = rows.map((r) => rows.filter((x) => x[1] > r[1]).length + 1);
  const dr = rows.map((r) => new Set(rows.filter((x) => x[1] > r[1]).map((x) => x[1])).size + 1);
  F({ cap: '三种排名函数对并列的处理不同：ROW_NUMBER 不并列；RANK 并列后跳号；DENSE_RANK 并列后不跳号', blocks: [TBL(['name', 'salary', 'ROW_NUMBER', 'RANK', 'DENSE_RANK'], rows.map((r, i) => [...r, rn[i], rk[i], dr[i]]), { hl: { '0,4': 'cur', '1,4': 'cur', '1,3': 'warn', '2,3': 'warn' } })] });
  const pick = rows.filter((_, i) => dr[i] <= 3).map((r) => r[0]);
  F({ cap: `「前三高的工资」要保留并列 → 用 DENSE_RANK <= 3：${pick.join('、')}（D 的 200 是第三档）`, blocks: [TBL(['name', 'salary', 'DENSE_RANK'], rows.map((r, i) => [...r, dr[i]]), { hl: Object.fromEntries(rows.flatMap((_, i) => [0, 1, 2].map((c) => [i + ',' + c, dr[i] <= 3 ? 'ok' : 'dim']))) })], done: true, ans: pick });
});

T('database-80', '二级索引叶子存「索引列 + 主键」；查不在索引里的列就要回主键索引取整行', 'SELECT amount FROM orders WHERE user_id = 100；索引 idx_user_id(user_id)', ['回表 2 次', '覆盖索引 0 次'], (F) => {
  const sec = [[98, 3], [100, 5], [100, 9], [101, 2], [103, 7]];
  const clu = [[2, 101, 30], [3, 98, 12], [5, 100, 45], [7, 103, 8], [9, 100, 60]];
  const dS = (hl2) => TBL(['user_id', '主键 id'], sec, { id: 's', label: '二级索引 idx_user_id 叶子（按 user_id 有序）', hl: hl2 || {} });
  const dC = (hl2) => TBL(['id', 'user_id', 'amount'], clu, { id: 'c', label: '聚簇索引叶子（按 id 有序，存整行）', hl: hl2 || {} });
  F({ cap: 'InnoDB 的数据按主键组织成 B+ 树（聚簇索引）；二级索引的叶子只存索引列和主键', blocks: [dS(), dC()] });
  F({ cap: '① 在二级索引上从根走到叶子，定位 user_id = 100，顺着叶子链表拿到主键 5、9', blocks: [dS({ '1,0': 'cur', '1,1': 'cur', '2,0': 'cur', '2,1': 'cur' }), dC()] });
  F({ cap: '② 回表：拿主键 5 到聚簇索引再查一次，取出 amount = 45', blocks: [dS({ '1,1': 'ok' }), dC({ '2,0': 'warn', '2,2': 'ok' })] });
  F({ cap: '③ 回表：主键 9 → amount = 60。命中 N 行就要回表 N 次，随机 IO 是慢的主要原因', blocks: [dS({ '2,1': 'ok' }), dC({ '4,0': 'warn', '4,2': 'ok' })] });
  const cov = [[98, 12, 3], [100, 45, 5], [100, 60, 9], [101, 30, 2], [103, 8, 7]];
  F({ cap: '优化：建联合索引 (user_id, amount) → 叶子里已有 amount，EXPLAIN 的 Extra 显示 Using index，**不再回表**（覆盖索引）', blocks: [TBL(['user_id', 'amount', '主键 id'], cov, { id: 's2', label: '覆盖索引 idx_user_amount 叶子', hl: { '1,0': 'ok', '1,1': 'ok', '2,0': 'ok', '2,1': 'ok' } })], done: true, ans: ['回表 2 次', '覆盖索引 0 次'] });
});

T('database-81', '联合索引按 (a, b, c, d) 字典序排列：只有从最左列开始的等值条件，命中的行才是连续的', '索引 (tenant_id, status, category_id, created_at)', ['连续区间', '分散无法范围扫描'], (F) => {
  const rows = [[1, 1, 3, '09-01'], [1, 1, 5, '09-03'], [1, 2, 3, '09-02'], [1, 2, 3, '09-05'], [1, 2, 7, '09-04'], [2, 1, 3, '09-06'], [2, 2, 3, '09-01'], [2, 2, 3, '09-07']];
  const head = ['tenant', 'status', 'category', 'created'];
  const mark = (pred, cls) => Object.fromEntries(rows.flatMap((r, i) => (pred(r) ? [0, 1, 2, 3].map((c) => [i + ',' + c, cls]) : [])));
  F({ cap: '索引叶子里的记录先按 tenant 排，tenant 相同再按 status，依此类推', blocks: [TBL(head, rows)] });
  F({ cap: 'WHERE tenant = 1 AND status = 2 AND category = 3 ORDER BY created DESC：命中的两行**相邻**且已按 created 有序 → 一次范围扫描，无需 filesort', blocks: [TBL(head, rows, { hl: mark((r) => r[0] === 1 && r[1] === 2 && r[2] === 3, 'ok') })] });
  F({ cap: 'WHERE tenant = 1 AND status = 2：仍是最左前缀，命中行连续（索引前两列）', blocks: [TBL(head, rows, { hl: mark((r) => r[0] === 1 && r[1] === 2, 'sel') })] });
  F({ cap: 'WHERE status = 2 AND category = 3（跳过了 tenant）：命中行**分散**在不同 tenant 下，无法定位起点 → 走不了范围扫描（8.0 的 skip scan 只在最左列基数很低时有用）', blocks: [TBL(head, rows, { hl: mark((r) => r[1] === 2 && r[2] === 3, 'bad') })] });
  F({ cap: 'WHERE tenant = 1 AND status > 1 AND category = 3：status 是范围条件，之后的 category 在区间内不再有序 → 只能用到前两列，category 靠索引下推（ICP）在索引内过滤', blocks: [TBL(head, rows, { hl: Object.assign(mark((r) => r[0] === 1 && r[1] > 1, 'sel'), mark((r) => r[0] === 1 && r[1] > 1 && r[2] === 3, 'ok')) })], done: true, ans: ['连续区间', '分散无法范围扫描'] });
});

T('database-84', 'LIMIT 大偏移要先扫描并丢弃前面所有行；游标分页直接从上一页末尾定位', 'SELECT … WHERE user_id = ? ORDER BY created_at DESC LIMIT 10000, 50', [10050, 50], (F) => {
  const idx = Array.from({ length: 12 }, (_, i) => `…${String(9 - Math.floor(i / 2)).padStart(2, '0')}`);
  F({ cap: '索引 (user_id, created_at DESC, id DESC) 上的一个用户的记录（示意）', blocks: [A(idx, { cw: 46, label: '索引顺序' }), V(['扫描行数', 0])] });
  F({ cap: 'LIMIT 10000, 50：MySQL 必须按顺序读出前 10050 行，再丢掉前 10000 行；若 SELECT 了非索引列，这 10000 行还都要回表', blocks: [A(idx, { cw: 46, label: '索引顺序', hl: Object.assign(rng(0, 8, 'bad'), rng(9, 11, 'ok')), win: [0, 11] }), V(['扫描行数', 10050, 'bad'], ['回表', '最多 10050 次', 'bad'])] });
  F({ cap: '延迟关联：子查询只在索引上取 50 个 id（覆盖索引、不回表），再 JOIN 回原表 → 回表只剩 50 次，但仍要扫 10050 条索引记录', blocks: [A(idx, { cw: 46, label: '索引顺序', hl: Object.assign(rng(0, 8, 'sel'), rng(9, 11, 'ok')), win: [0, 11] }), V(['扫描索引', 10050], ['回表', 50, 'ok'])] });
  F({ cap: '游标分页（seek）：WHERE (created_at, id) < (上一页最后一条) ORDER BY … LIMIT 50 → 直接在索引上定位，只读 50 行；代价是不能随意跳页', blocks: [A(idx, { cw: 46, label: '索引顺序', hl: rng(9, 11, 'ok'), p: { '游标': 9 } }), V(['扫描行数', 50, 'ok'])], done: true, ans: [10050, 50] });
});

T('database-87', '先查后改会超卖；把判断写进 UPDATE 条件，靠行锁串行化', 'stock = 1，T1、T2 同时抢购', ['超卖', '不超卖'], (F) => {
  const rows = ['T1', 'T2'], cols = ['t1', 't2', 't3', 't4'];
  let cells = [[], []];
  F({ cap: '错误写法：SELECT stock → 应用判断 > 0 → UPDATE stock = stock − 1', blocks: [TL(rows, cols, cells), V(['stock', 1])] });
  cells[0][0] = '读到 1'; cells[1][1] = '读到 1';
  F({ cap: '两个事务都读到 stock = 1（快照读不加锁），都认为还有货', blocks: [TL(rows, cols, cells, { '0,0': 'warn', '1,1': 'warn' }), V(['stock', 1])] });
  cells[0][2] = 'stock=0'; cells[1][3] = 'stock=-1';
  F({ cap: '两个 UPDATE 依次执行 → stock = −1，**超卖**', blocks: [TL(rows, cols, cells, { '0,2': 'cur', '1,3': 'bad' }), V(['stock', -1, 'bad'])] });
  cells = [[], []];
  cells[0][0] = 'UPDATE…'; cells[0][1] = '影响 1 行'; cells[1][1] = '等行锁'; cells[1][2] = '影响 0 行';
  F({ cap: '正确写法：UPDATE sku SET stock = stock − 1 WHERE id = ? AND stock > 0。T1 持有行锁；T2 等锁后以「当前读」重新判断条件 → 影响 0 行 → 售罄', blocks: [TL(rows, cols, cells, { '0,1': 'ok', '1,1': 'warn', '1,2': 'bad' }), V(['stock', 0, 'ok'])] });
  F({ cap: '再配合订单表唯一键 (user_id, sku_id) 防止一人多单；热点行并发高时把扣减前移到 Redis Lua，DB 只做最终扣减', blocks: [TL(rows, cols, cells), V(['结果', '不超卖', 'ok'])], done: true, ans: ['超卖', '不超卖'] });
});

T('database-88', 'MVCC：沿 undo 版本链往回找，用 ReadView 判断每个版本对当前事务是否可见', '行 id=1 的版本链：trx 30（未提交）→ trx 20（已提交）→ trx 10；读事务 trx 25', 'B', (F) => {
  const nodes = [{ k: 'v30', v: 'C · trx30' }, { k: 'v20', v: 'B · trx20' }, { k: 'v10', v: 'A · trx10' }];
  const nx = { v30: 'v20', v20: 'v10', v10: null };
  const rv = [['m_ids（活跃事务）', '[25, 30]'], ['min_trx_id', 25], ['max_trx_id', 31], ['creator', 25]];
  F({ cap: '每次更新生成新版本，旧版本通过 roll_pointer 挂在 undo log 上；最新版本在最左边', blocks: [LST(nodes, nx, { label: 'undo 版本链（值 · 写入它的事务）' }), M(rv, { label: 'trx 25 第一次读时生成的 ReadView' })] });
  F({ cap: '检查最新版本 trx30：30 在 m_ids 里（还没提交）→ **不可见**，顺着 roll_pointer 找上一版', blocks: [LST(nodes, nx, { label: 'undo 版本链', p: { 读: 'v30' }, hl: { v30: 'bad' } }), M(rv, { label: 'ReadView', hl: 'm_ids（活跃事务）', hlCls: 'bad' })] });
  F({ cap: '检查 trx20：20 < min_trx_id = 25，说明生成 ReadView 前就已提交 → **可见**，读到 B', blocks: [LST(nodes, nx, { label: 'undo 版本链', p: { 读: 'v20' }, hl: { v30: 'dim', v20: 'ok' }, ehl: { v30: 'on' } }), M(rv, { label: 'ReadView', hl: 'min_trx_id', hlCls: 'ok' })] });
  F({ cap: '之后 trx30 提交。RR：同一事务复用第一次的 ReadView → 再读仍是 B（可重复读）；RC：每次读都新建 ReadView → 这次会读到 C', blocks: [LST(nodes, nx, { label: 'undo 版本链', hl: { v20: 'ok', v30: 'warn' } }), V(['RR 再读', 'B', 'ok'], ['RC 再读', 'C', 'warn'])] });
  F({ cap: '可见性规则：trx_id < min 可见；≥ max 不可见；在 m_ids 中不可见；自己改的可见。当前读（FOR UPDATE / UPDATE）不走快照，而是加 Next-Key Lock 防幻读', blocks: [TX('trx 25 快照读结果：B')], done: true, ans: 'B' });
});


/* ===== v13 face/nonlc animations ===== */
/* v13: face/nonlc hard problems that had zero TRACES — injected before return TRACES */
/* ============================== 面经补充：数组 / 滑窗 ============================== */
T('18', '排序 + 枚举前两个数 + 对撞指针，四处去重', 'nums = [1,0,-1,0,-2,2], target = 0', [[-2, -1, 1, 2], [-2, 0, 0, 2], [-1, 0, 0, 1]], (F) => {
  const a = [1, 0, -1, 0, -2, 2].sort((x, y) => x - y), target = 0, res = [];
  F({ cap: `先排序：${fmt(a)}；固定 i、j，对 (j+1 … n−1) 做对撞`, blocks: [A(a), V(['结果', '[]'])] });
  for (let i = 0; i < a.length - 3; i++) {
    if (i > 0 && a[i] === a[i - 1]) { F({ cap: `a[${i}] 与前一个相同 → 跳过 i`, blocks: [A(a, { hl: hl(i, 'dim'), p: { i } })] }); continue; }
    for (let j = i + 1; j < a.length - 2; j++) {
      if (j > i + 1 && a[j] === a[j - 1]) continue;
      let l = j + 1, r = a.length - 1;
      while (l < r) {
        const s = a[i] + a[j] + a[l] + a[r];
        if (s === target) {
          res.push([a[i], a[j], a[l], a[r]]);
          F({ cap: `${a[i]}+${a[j]}+${a[l]}+${a[r]} = 0 ✓；l、r 跳过重复后继续`, blocks: [A(a, { hl: hl([i, j, l, r], 'ok'), p: { i, j, l, r } }), V(['sum', 0, 'ok'], ['结果', fmt(res)])] });
          while (l < r && a[l] === a[l + 1]) l++;
          while (l < r && a[r] === a[r - 1]) r--;
          l++; r--;
        } else {
          F({ cap: `sum = ${s} ${s < target ? '< 0 → l++' : '> 0 → r--'}`, blocks: [A(a, { hl: hl([i, j], 'cur', [l, r], 'sel'), p: { i, j, l, r } }), V(['sum', s], ['结果', fmt(res)])] });
          if (s < target) l++; else r--;
        }
      }
    }
  }
  F({ cap: `共 ${res.length} 个不重复四元组，时间 O(n³)`, blocks: [A(a), TX(fmt(res))], done: true, ans: res });
});

T('209', '右扩累加，和 ≥ target 时尽量左缩，维护最短长度', 'nums = [2,3,1,2,4,3], target = 7', 2, (F) => {
  const a = [2, 3, 1, 2, 4, 3], target = 7;
  let l = 0, sum = 0, best = Infinity, bl = -1, br = -1;
  for (let r = 0; r < a.length; r++) {
    sum += a[r];
    F({ cap: `右扩：加入 a[${r}]=${a[r]}，sum = ${sum}`, blocks: [A(a, { p: { l, r }, win: [l, r], hl: hl(r, 'cur') }), V(['sum', sum], ['best', best === Infinity ? '∞' : best])] });
    while (sum >= target) {
      if (r - l + 1 < best) { best = r - l + 1; bl = l; br = r; }
      F({ cap: `窗口 [${l},${r}] 和 ${sum} ≥ ${target}，长度 ${r - l + 1}${best === r - l + 1 ? ' → 刷新最短' : ''}；尝试移出 a[${l}]=${a[l]}`, blocks: [A(a, { p: { l, r }, win: [l, r], winCls: 'ok', hl: hl(l, 'warn') }), V(['sum', sum, 'ok'], ['best', best, 'ok'])] });
      sum -= a[l]; l++;
    }
  }
  const ans = best === Infinity ? 0 : best;
  F({ cap: `最短长度 **${ans}**（子数组 [${bl},${br}]）；O(n)`, blocks: [A(a, { win: [bl, br], winCls: 'ok', hl: rng(bl, br, 'ok') }), TX('return ' + ans)], done: true, ans });
});

T('340', '滑窗：右扩计入种类，超过 K 种就左缩', 's = "eceba", k = 2', 3, (F) => {
  const s = 'eceba'.split(''), k = 2, cnt = new Map();
  let l = 0, best = 0, bl = 0, br = 0;
  for (let r = 0; r < s.length; r++) {
    cnt.set(s[r], (cnt.get(s[r]) || 0) + 1);
    F({ cap: `加入 '${s[r]}'，窗口内 ${cnt.size} 种字符`, blocks: [A(s, { p: { l, r }, win: [l, r], hl: hl(r, 'cur') }), M([...cnt], { label: '窗口计数' }), V(['种类', cnt.size], ['best', best])] });
    while (cnt.size > k) {
      F({ cap: `种类 ${cnt.size} > k=${k} → 移出 '${s[l]}'`, blocks: [A(s, { p: { l, r }, win: [l, r], hl: hl(l, 'bad') }), M([...cnt], { label: '窗口计数', hl: s[l], hlCls: 'bad' })] });
      const c = s[l]; cnt.set(c, cnt.get(c) - 1); if (cnt.get(c) === 0) cnt.delete(c); l++;
    }
    if (r - l + 1 > best) { best = r - l + 1; bl = l; br = r; }
    F({ cap: `合法窗口 [${l},${r}] 长度 ${r - l + 1}${best === r - l + 1 ? '，刷新最长' : ''}`, blocks: [A(s, { p: { l, r }, win: [l, r], winCls: 'ok' }), M([...cnt], { label: '窗口计数' }), V(['best', best, 'ok'])] });
  }
  F({ cap: `最长 **${best}**（"${s.slice(bl, br + 1).join('')}"）；每种字符进出各一次，O(n)`, blocks: [A(s, { win: [bl, br], winCls: 'ok', hl: rng(bl, br, 'ok') }), TX('return ' + best)], done: true, ans: best });
});

T('567', '定长滑窗：窗口长度 = s1.length，计数完全一致即 true', 's1 = "ab", s2 = "eidbaooo"', true, (F) => {
  const s1 = 'ab', s2 = 'eidbaooo'.split(''), k = s1.length;
  const need = {}, win = {};
  for (const c of s1) need[c] = (need[c] || 0) + 1;
  let ok = false;
  const eq = () => Object.keys(need).every((c) => (win[c] || 0) === need[c]);
  for (let r = 0; r < s2.length; r++) {
    const c = s2[r];
    win[c] = (win[c] || 0) + 1;
    const l = r - k + 1;
    if (l > 0) {
      const out = s2[l - 1];
      win[out]--;
      if (win[out] === 0) delete win[out];
    }
    if (l >= 0) {
      const hit = eq();
      if (hit) ok = true;
      F({ cap: `窗口 [${l},${r}] = "${s2.slice(l, r + 1).join('')}"${hit ? ' → 计数与 s1 完全一致 ✓' : '，继续滑'}`, blocks: [A(s2, { p: { l, r }, win: [l, r], winCls: hit ? 'ok' : '' }), M(Object.entries(need), { label: 's1 需求' }), M(Object.entries(win).filter((x) => x[1]), { id: 'w', label: '窗口' }), V(['命中', hit ? 'true' : 'false', hit ? 'ok' : ''])] });
      if (hit) break;
    } else {
      F({ cap: `先扩到长度 ${k}：加入 '${c}'`, blocks: [A(s2, { p: { r }, win: [0, r] }), M(Object.entries(need), { label: 's1 需求' }), M(Object.entries(win).filter((x) => x[1]), { id: 'w', label: '窗口' })] });
    }
  }
  F({ cap: `返回 **${ok}**；定长窗口 O(|s2|·Σ)`, blocks: [TX('return ' + ok)], done: true, ans: ok });
});

/* ============================== 面经补充：栈 / 括号 / 回溯 ============================== */
T('224', '栈存「上一层结果 + 符号」，遇 ( 压栈清零，遇 ) 弹栈合并', 's = "(1+(4+5+2)-3)+(6+8)"', 23, (F) => {
  const s = '(1+(4+5+2)-3)+(6+8)'.split('');
  const st = [];
  let res = 0, num = 0, sign = 1;
  const snap = (cap, i) => F({ cap, blocks: [A(s, { hl: i != null ? { [i]: 'cur' } : {}, p: i != null ? { i } : {} }), S(st.map(([r, sg]) => `${r},${sg > 0 ? '+' : '-'}`), { label: '栈(结果,符号)' }), V(['res', res, 'cur'], ['sign', sign > 0 ? '+' : '-'], ['num', num])] });
  snap('res=0，sign=+1；数字累加到 num，运算符更新 sign', 0);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/\d/.test(c)) { num = num * 10 + +c; continue; }
    if (c === '(') {
      st.push([res, sign]);
      res = 0; sign = 1; num = 0;
      snap(`'('：把当前 res=${st[st.length - 1][0]} 与 sign 压栈，内层从 0 重新算`, i);
      continue;
    }
    // + - ) or end: first apply pending num
    res += sign * num; num = 0;
    if (c === '+') { sign = 1; snap(`结算后 sign = +1，res = ${res}`, i); }
    else if (c === '-') { sign = -1; snap(`结算后 sign = −1，res = ${res}`, i); }
    else if (c === ')') {
      const prev = st.pop();
      res = prev[0] + prev[1] * res;
      sign = 1;
      snap(`')'：弹出上层，合并得 res = ${res}`, i);
    }
  }
  F({ cap: `结果 **${res}**；括号嵌套用栈，O(n)`, blocks: [TX('return ' + res)], done: true, ans: res });
});

T('232', '两栈模拟队列：out 空时把 in 一次性倒过去，摊还 O(1)', 'push 1、push 2、peek、pop、push 3、pop、pop', [1, 1, 2, 3], (F) => {
  const inn = [], out = [], log = [];
  const dump = (cap, fin) => F({ cap, blocks: [S(inn.slice(), { id: 'in', label: 'in 栈（入口）' }), S(out.slice(), { id: 'out', label: 'out 栈（出口）' }), V(['输出', fmt(log), log.length ? 'ok' : ''])], done: !!fin, ans: fin ? log.slice() : undefined });
  inn.push(1); dump('push(1) → 入 in');
  inn.push(2); dump('push(2) → 入 in');
  F({ cap: 'out 空 → 把 in 全部弹到 out（顺序反转，队头到 out 顶）', blocks: [S(inn.slice(), { id: 'in', label: 'in 栈' }), S(out.slice(), { id: 'out', label: 'out 栈' })] });
  while (inn.length) out.push(inn.pop());
  log.push(out[out.length - 1]); dump(`peek() = out 顶 **${log[log.length - 1]}**`);
  log.push(out.pop()); dump(`pop() = **${log[log.length - 1]}**`);
  inn.push(3); dump('push(3) → 入 in（out 非空，不倒栈）');
  log.push(out.pop()); dump(`pop() = **${log[log.length - 1]}**（仍从 out 取）`);
  F({ cap: 'out 又空了 → 再把 in 倒到 out', blocks: [S(inn.slice(), { id: 'in', label: 'in 栈' }), S(out.slice(), { id: 'out', label: 'out 栈' })] });
  while (inn.length) out.push(inn.pop());
  log.push(out.pop()); dump(`pop() = **${log[log.length - 1]}**；每个元素最多搬运一次`, true);
});

T('678', '贪心：维护左括号可匹配区间 [lo, hi]；* 可当 ( / ) / 空', 's = "(*)"', true, (F) => {
  const s = '(*)'.split('');
  let lo = 0, hi = 0, ok = true;
  F({ cap: 'lo = 未匹配左括号的最少可能，hi = 最多可能；* 让区间两端各扩/缩一格', blocks: [A(s), V(['lo', 0], ['hi', 0])] });
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') { lo++; hi++; F({ cap: `'(' → lo、hi 都 +1`, blocks: [A(s, { hl: { [i]: 'cur' }, p: { i } }), V(['lo', lo, 'cur'], ['hi', hi, 'cur'])] }); }
    else if (c === ')') {
      lo = Math.max(lo - 1, 0); hi--;
      F({ cap: `')' → lo 减一（不下过 0），hi −1${hi < 0 ? ' → hi<0 失败' : ''}`, blocks: [A(s, { hl: { [i]: hi < 0 ? 'bad' : 'cur' }, p: { i } }), V(['lo', lo], ['hi', hi, hi < 0 ? 'bad' : 'cur'])] });
      if (hi < 0) { ok = false; break; }
    } else {
      lo = Math.max(lo - 1, 0); hi++;
      F({ cap: `'*' → 可当 ')'（lo−1）或 '('（hi+1）或空`, blocks: [A(s, { hl: { [i]: 'warn' }, p: { i } }), V(['lo', lo, 'warn'], ['hi', hi, 'warn'])] });
    }
  }
  ok = ok && lo === 0;
  F({ cap: `结束 lo=${lo}：${ok ? 'lo=0 → **合法**' : '仍有未匹配左括号 → 非法'}`, blocks: [A(s, { hl: rng(0, s.length - 1, ok ? 'ok' : 'bad') }), TX('return ' + ok)], done: true, ans: ok });
});

T('93', '回溯：每段 1～3 位，不能有前导零，值 ≤ 255，正好 4 段', 's = "25525511135"', ['255.255.11.135', '255.255.111.35'], (F) => {
  const s = '25525511135', res = [], path = [];
  const bt = (st, seg) => {
    if (seg === 4) {
      if (st === s.length) {
        res.push(path.join('.'));
        F({ cap: `4 段用完且扫完 → 收集 **${path.join('.')}**`, blocks: [A(s.split(''), { hl: rng(0, s.length - 1, 'ok') }), S(path.slice(), { label: '已选段' }), V(['结果', res.length, 'ok'])] });
      }
      return;
    }
    if (st === s.length) return;
    let num = 0;
    for (let e = st; e < s.length && e < st + 3; e++) {
      if (e > st && s[st] === '0') break;
      num = num * 10 + (s.charCodeAt(e) - 48);
      if (num > 255) break;
      path.push(String(num));
      F({ cap: `第 ${seg + 1} 段试 "${num}"（下标 [${st},${e}]）`, blocks: [A(s.split(''), { hl: rng(st, e, 'cur'), p: { i: e } }), S(path.slice(), { label: '已选段' })] });
      bt(e + 1, seg + 1);
      path.pop();
    }
  };
  bt(0, 0);
  F({ cap: `共 ${res.length} 种复原：${res.join('、')}`, blocks: [TX(res.join('  '))], done: true, ans: res });
});

T('301', 'BFS 逐层删括号：同一层删同样多个，首次合法即最短删除', 's = "()())()"', ['(())()', '()()()'], (F) => {
  const start = '()())()';
  const isValid = (t) => { let b = 0; for (const c of t) { if (c === '(') b++; else if (c === ')') { b--; if (b < 0) return false; } } return b === 0; };
  let q = [start], seen = new Set([start]), res = [], depth = 0;
  F({ cap: `从 "${start}" 开始；每层对所有串各删一个括号，保证删除次数最少`, blocks: [A(start.split('')), V(['层', 0])] });
  while (q.length) {
    const valids = q.filter(isValid);
    F({ cap: `第 ${depth} 层共 ${q.length} 个串${valids.length ? `，其中合法：${valids.map((x) => '"' + x + '"').join('、')}` : '，尚无合法'}`, blocks: [S(q.slice(0, 8).concat(q.length > 8 ? ['…'] : []), { label: '本层（节选）' }), V(['合法数', valids.length, valids.length ? 'ok' : ''])] });
    if (valids.length) { res = valids; break; }
    const next = [];
    for (const cur of q) {
      for (let i = 0; i < cur.length; i++) {
        if (cur[i] !== '(' && cur[i] !== ')') continue;
        const nxt = cur.slice(0, i) + cur.slice(i + 1);
        if (seen.has(nxt)) continue;
        seen.add(nxt);
        next.push(nxt);
      }
    }
    q = next;
    depth++;
    if (depth > 5) break;
  }
  F({ cap: `最少删除后的结果：**${res.join('、')}**`, blocks: [TX(res.join('  '))], done: true, ans: res });
});

/* ============================== 面经补充：树 / 图 / 二分 ============================== */
T('662', 'BFS 编号：同一层 maxId − minId + 1 即宽度（用相对下标防溢出）', 'root = [1,3,2,5,3,null,9]', 4, (F) => {
  const root = BTO([1, 3, 2, 5, 3, null, 9]);
  const q = [[root, 0]]; let bestW = 0;
  F({ cap: '根编号 0；左孩子 2·i，右孩子 2·i+1；每层宽度 = 最右 − 最左 + 1', blocks: [TRO(root), V(['maxWidth', 0])] });
  while (q.length) {
    const size = q.length, left = q[0][1];
    let right = left;
    const ids = [];
    for (let i = 0; i < size; i++) {
      const [n, id] = q.shift();
      const rel = id - left;
      right = id;
      ids.push(n.v + '@' + rel);
      if (n.left) q.push([n.left, rel * 2]);
      if (n.right) q.push([n.right, rel * 2 + 1]);
    }
    const w = right - left + 1;
    if (w > bestW) bestW = w;
    F({ cap: `本层相对编号 ${ids.join(', ')} → 宽度 ${w}${w === bestW ? '，刷新最大' : ''}`, blocks: [TRO(root), Q(ids), V(['本层宽', w, 'cur'], ['maxWidth', bestW, 'ok'])] });
  }
  F({ cap: `最大宽度 **${bestW}**；相对下标避免编号爆炸`, blocks: [TRO(root), TX('return ' + bestW)], done: true, ans: bestW });
});

T('329', '记忆化 DFS：对每个格子走「严格递增」最长路，四方向扩散', 'matrix = [[9,9,4],[6,6,8],[2,1,1]]', 4, (F) => {
  const g = [[9, 9, 4], [6, 6, 8], [2, 1, 1]], m = 3, n = 3;
  const memo = Array.from({ length: m }, () => Array(n).fill(0));
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let best = 0;
  const cellHl = (path, cls) => {
    const o = {};
    g.forEach((row, r) => row.forEach((_, c) => { o[r + ',' + c] = 'dim'; }));
    path.forEach(([r, c]) => { o[r + ',' + c] = cls || 'cur'; });
    return o;
  };
  F({ cap: '对每个格子 DFS：只能走到更大的邻居；memo 存从该格出发的最长长度', blocks: [G(g.map((r) => r.map(String))), V(['ans', 0])] });
  const dfs = (r, c, path) => {
    if (memo[r][c]) return memo[r][c];
    let len = 1;
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= m || nc >= n || g[nr][nc] <= g[r][c]) continue;
      F({ cap: `(${r},${c})=${g[r][c]} → (${nr},${nc})=${g[nr][nc]} 严格更大，继续走`, blocks: [G(g.map((row) => row.map(String)), { hl: cellHl([...path, [r, c], [nr, nc]], 'cur') }), V(['途经', path.map(([x, y]) => g[x][y]).concat(g[r][c], g[nr][nc]).join('→')])] });
      len = Math.max(len, 1 + dfs(nr, nc, path.concat([[r, c]])));
    }
    memo[r][c] = len;
    return len;
  };
  for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) {
    const len = dfs(r, c, []);
    if (len > best) best = len;
    F({ cap: `从 (${r},${c})=${g[r][c]} 出发最长 ${len}${len === best ? '，刷新全局' : ''}`, blocks: [G(g.map((row) => row.map(String)), { hl: cellHl([[r, c]], 'ok') }), V(['本格', len, 'cur'], ['ans', best, 'ok'])] });
  }
  F({ cap: `全局最长递增路径 **${best}**（例如 1→2→6→9）；O(m·n)`, blocks: [G(g.map((row) => row.map(String))), TX('return ' + best)], done: true, ans: best });
});

T('1482', '对「天数」二分：mid 天内能否摘满 m 束（每束连续 k 朵）', 'bloomDay = [1,10,3,10,2], m = 3, k = 1', 3, (F) => {
  const day = [1, 10, 3, 10, 2], m = 3, k = 1;
  let lo = 1, hi = Math.max(...day), ans = -1;
  F({ cap: `二分答案：最少天数在 [1, ${hi}]；check(d) = 第 d 天能否做满 ${m} 束`, blocks: [A(day, { label: 'bloomDay' }), V(['lo', lo], ['hi', hi])] });
  const check = (d) => {
    let bouquets = 0, streak = 0;
    const open = day.map((x) => x <= d ? 1 : 0);
    for (let i = 0; i < day.length; i++) {
      if (day[i] <= d) { streak++; if (streak === k) { bouquets++; streak = 0; } }
      else streak = 0;
    }
    return { ok: bouquets >= m, bouquets, open };
  };
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const { ok, bouquets, open } = check(mid);
    F({ cap: `mid=${mid}：开花标记 ${fmt(open)} → 可做 ${bouquets} 束 ${ok ? '≥ m → 试更小（hi=mid−1）' : '< m → 试更大（lo=mid+1）'}`, blocks: [A(day, { label: 'bloomDay', hl: hl(...day.flatMap((x, i) => x <= mid ? [i, 'ok'] : [i, 'dim'])) }), V(['mid', mid, 'cur'], ['束数', bouquets, ok ? 'ok' : 'bad'], ['lo', lo], ['hi', hi])] });
    if (ok) { ans = mid; hi = mid - 1; } else lo = mid + 1;
  }
  F({ cap: `最少天数 **${ans}**；二分 O(n log D)`, blocks: [A(day, { label: 'bloomDay' }), TX('return ' + ans)], done: true, ans });
});

T('145', '迭代后序：用栈做「根→右→左」，再整体反转', 'root = [1,2,3,4,5]', [4, 5, 2, 3, 1], (F) => {
  const root = BTO([1, 2, 3, 4, 5]);
  const st = [root], pre = [], done = [];
  F({ cap: '技巧：栈上模拟「根右左」（先压左再压右），输出反转就是后序', blocks: [TRO(root), S([], { label: '栈' }), A([], { id: 'r', label: '根右左', cw: 34 })] });
  while (st.length) {
    const n = st.pop();
    pre.push(n.v); done.push(n.id);
    if (n.left) st.push(n.left);
    if (n.right) st.push(n.right);
    F({ cap: `弹出 ${n.v} 记入序列；先压左、再压右 → 右先被弹出`, blocks: [TRO(root, { hl: hlOf(done, 'ok', { [n.id]: 'warn' }) }), S(st.map((x) => x.v), { label: '栈' }), A(pre, { id: 'r', label: '根右左', cw: 34, hl: { [pre.length - 1]: 'cur' } })] });
  }
  const ans = pre.slice().reverse();
  F({ cap: `反转得后序：**${ans.join(' ')}**`, blocks: [TRO(root, { hl: hlOf(done, 'ok') }), A(ans, { id: 'r', label: '后序', cw: 34, hl: rng(0, ans.length - 1, 'ok') })], done: true, ans });
});

return TRACES;
})();

