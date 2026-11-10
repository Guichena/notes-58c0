// Standard problem pages for the interview problems that used to live in the
// retired "算法练习" catch-all. They were QA documents; the module wants one
// page shape, so each one is re-projected onto the algorithm problem template:
// idea -> statement -> code -> breakdown -> follow-ups, and whatever did not
// map (worked examples, related links) is kept verbatim in a trailing section.
//
// This runs after every reviewed registry guard, so those keep validating the
// QA source shape they were written against.

const NUMBER_AND_SLUG = {
  'own-algo-gap-132-pattern': ['456', '132-pattern'],
  'own-algo-gap-bst-greater-tree': ['538', 'convert-bst-to-greater-tree'],
  'own-algo-gap-collinear-points': ['149', 'max-points-on-a-line'],
  'own-algo-gap-digit-decoding': ['91', 'decode-ways'],
  'own-algo-gap-distinct-subsequences': ['115', 'distinct-subsequences'],
  'own-algo-gap-equal-runs': ['485', 'max-consecutive-ones'],
  'own-algo-gap-euler-itinerary': ['332', 'reconstruct-itinerary'],
  'own-algo-gap-exclusive-time': ['636', 'exclusive-time-of-functions'],
  'own-algo-gap-kth-list-node': ['剑指 22', ''],
  'own-algo-gap-list-partition': ['86', 'partition-list'],
  'own-algo-gap-path-normalization': ['71', 'simplify-path'],
  'own-algo-gap-random-set': ['380', 'insert-delete-getrandom-o1'],
  'own-algo-gap-remove-duplicate-letters': ['316', 'remove-duplicate-letters'],
  'own-algo-gap-reservoir': ['382', 'linked-list-random-node'],
  'own-algo-gap-sudoku-validation': ['36', 'valid-sudoku'],
  'own-algo-gap-tree-subtree': ['572', 'subtree-of-another-tree'],
  'own-algo-gap-unsorted-segment': ['581', 'shortest-unsorted-continuous-subarray'],
  'own-algo-gap-validate-stack': ['946', 'validate-stack-sequences'],
  'own-algo-gap-zero-flip-window': ['1004', 'max-consecutive-ones-iii'],
  'lc-754': ['754', 'reach-a-number'],
  'lc-695': ['695', 'max-area-of-island'],
  'lc-122': ['122', 'best-time-to-buy-and-sell-stock-ii'],
  'lc-179': ['179', 'largest-number'],
  'lc-14': ['14', 'longest-common-prefix']
};

function decode(s) {
  return String(s)
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
const flat = (s) => decode(s).replace(/\s+/g, ' ').trim();

// One statement per line, indented by brace depth. Only structural characters
// outside strings and comments introduce a break, so semantics cannot change.
export function formatJava(src) {
  const lines = [];
  let cur = '';
  let depth = 0;
  let paren = 0;
  let i = 0;
  let inStr = null;
  let inLineComment = false;
  let inBlock = false;
  const braces = []; // 'block' | 'init'
  const indent = () => '    '.repeat(Math.max(0, depth));
  const flush = (text) => { const t = text.trim(); if (t) lines.push(indent() + t); };
  const lastSignificant = () => {
    for (let k = cur.length - 1; k >= 0; k--) {
      const ch = cur[k];
      if (!/\s/.test(ch)) return ch;
    }
    return '';
  };
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (inLineComment) { cur += c; if (c === '\n') { inLineComment = false; flush(cur); cur = ''; } i++; continue; }
    if (inBlock) { cur += c; if (c === '*' && n === '/') { cur += '/'; i += 2; inBlock = false; } else i++; continue; }
    if (inStr) { cur += c; if (c === '\\') { cur += n ?? ''; i += 2; continue; } if (c === inStr) inStr = null; i++; continue; }
    if (c === '/' && n === '/') { inLineComment = true; cur += c; i++; continue; }
    if (c === '/' && n === '*') { inBlock = true; cur += c; i++; continue; }
    if (c === '"' || c === "'") { inStr = c; cur += c; i++; continue; }
    if (c === '(') { paren++; cur += c; i++; continue; }
    if (c === ')') { paren = Math.max(0, paren - 1); cur += c; i++; continue; }
    if (c === '{') {
      // `= {`, `( {`, `, {` start an array/argument initializer: keep it inline.
      const prev = lastSignificant();
      if (prev === '=' || prev === ',' || prev === '(' || prev === '[') {
        braces.push('init');
        cur += c; i++; continue;
      }
      flush(cur + '{'); cur = ''; depth++; braces.push('block'); i++; continue;
    }
    if (c === '}') {
      const kind = braces.pop() ?? 'block';
      if (kind === 'init') { cur += c; i++; continue; }
      flush(cur); cur = ''; depth = Math.max(0, depth - 1); flush('}'); i++; continue;
    }
    if (c === ';') { if (paren === 0) { flush(cur + ';'); cur = ''; } else cur += c; i++; continue; }
    if (c === '\n') { flush(cur); cur = ''; i++; continue; }
    cur += c; i++;
  }
  flush(cur);
  const merged = [];
  for (const line of lines) {
    const prev = merged[merged.length - 1];
    if (prev !== undefined && /^\s*else\b/.test(line) && /^\s*\}\s*$/.test(prev)) {
      merged[merged.length - 1] = prev.replace(/\}\s*$/, '} ' + line.trim());
      continue;
    }
    merged.push(line);
  }
  return merged.join('\n');
}

function splitSections(html) {
  const re = /<h([2-4])[^>]*>([\s\S]*?)<\/h\1>/g;
  const marks = [];
  let m;
  while ((m = re.exec(html))) marks.push({ level: Number(m[1]), title: flat(m[2]), index: m.index });
  if (!marks.length) return { lead: html, sections: [] };
  const sections = marks.map((mark, i) => ({
    title: mark.title,
    html: html.slice(mark.index, i + 1 < marks.length ? marks[i + 1].index : html.length)
  }));
  return { lead: html.slice(0, marks[0].index), sections };
}

const listItems = (html) => [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => flat(m[1])).filter(Boolean);

// The source blocks are runnable programs (solution + brute-force oracle + a
// self-test main). A problem page only wants the LeetCode-style solution.
const looksLikeJavaSource = (text) => /\b(class|interface)\s+\w+/.test(text) && /[;{}]/.test(text);
function pickJavaPre(html) {
  const re = /<pre[^>]*>([\s\S]*?)<\/pre>/g;
  let m;
  while ((m = re.exec(html))) {
    const text = decode(m[1]);
    if (looksLikeJavaSource(text)) return text;
  }
  return '';
}

const TEST_MEMBER = /^(main|oracle|brute|bruteForce|check|verify|enumerate|permutations|generate|validate|require|selfTest|selftest|test|benchmark)$/;

// Drop `main` and brute-force/self-test helpers, keeping the class and the
// methods that make up the answer.
export function solutionOnly(code) {
  const lines = code.split('\n');
  const keep = [];
  let depth = 0;
  let skipUntil = null;
  for (const line of lines) {
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    if (skipUntil === null && depth === 1) {
      const ident = /([A-Za-z_$][\w$]*)\s*\(/.exec(line);
      if (ident && TEST_MEMBER.test(ident[1]) && !line.trim().endsWith(';')) skipUntil = depth;
    }
    if (skipUntil === null) keep.push(line);
    depth += opens - closes;
    if (skipUntil !== null && depth <= skipUntil) skipUntil = null;
  }
  return keep.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
}

const bodyText = (html) => flat(html.replace(/<h[2-4][^>]*>[\s\S]*?<\/h[2-4]>/, ''));

// "边界、反例与追问" is sometimes a list, sometimes one dense paragraph.
function boundaryOf(section) {
  if (!section) return [];
  const items = listItems(section.html);
  if (items.length) return items;
  return bodyText(section.html)
    .split(/(?<=。)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Four source entries had no Java block at all; these are the standard
// LeetCode-style solutions for them.
const CODE_FALLBACK = {
  'own-algo-gap-bst-greater-tree': [
    'class Solution {',
    '    private int sum = 0;',
    '    public TreeNode convertBST(TreeNode root) {',
    '        if (root == null) return null;',
    '        convertBST(root.right);',
    '        sum += root.val;',
    '        root.val = sum;',
    '        convertBST(root.left);',
    '        return root;',
    '    }',
    '}'
  ].join('\n'),
  'own-algo-gap-collinear-points': [
    'class Solution {',
    '    public int maxPoints(int[][] points) {',
    '        int n = points.length;',
    '        if (n <= 2) return n;',
    '        int best = 2;',
    '        for (int i = 0; i < n; i++) {',
    '            Map<String, Integer> slope = new HashMap<>();',
    '            for (int j = i + 1; j < n; j++) {',
    '                int dx = points[j][0] - points[i][0];',
    '                int dy = points[j][1] - points[i][1];',
    '                int g = gcd(dx, dy);',
    '                String key = (dx / g) + "/" + (dy / g);',
    '                int count = slope.merge(key, 1, Integer::sum) + 1;',
    '                best = Math.max(best, count);',
    '            }',
    '        }',
    '        return best;',
    '    }',
    '    private int gcd(int a, int b) {',
    '        return b == 0 ? Math.abs(a) : gcd(b, a % b);',
    '    }',
    '}'
  ].join('\n'),
  'own-algo-gap-exclusive-time': [
    'class Solution {',
    '    public int[] exclusiveTime(int n, List<String> logs) {',
    '        int[] res = new int[n];',
    '        Deque<Integer> stack = new ArrayDeque<>();',
    '        int prev = 0;',
    '        for (String log : logs) {',
    '            String[] parts = log.split(":");',
    '            int id = Integer.parseInt(parts[0]);',
    '            int time = Integer.parseInt(parts[2]);',
    '            if (parts[1].equals("start")) {',
    '                if (!stack.isEmpty()) res[stack.peek()] += time - prev;',
    '                stack.push(id);',
    '                prev = time;',
    '            } else {',
    '                res[id] += time - prev + 1;',
    '                stack.pop();',
    '                prev = time + 1;',
    '            }',
    '        }',
    '        return res;',
    '    }',
    '}'
  ].join('\n'),
  'own-algo-gap-tree-subtree': [
    'class Solution {',
    '    public boolean isSubtree(TreeNode root, TreeNode subRoot) {',
    '        if (root == null) return false;',
    '        return same(root, subRoot) || isSubtree(root.left, subRoot) || isSubtree(root.right, subRoot);',
    '    }',
    '    private boolean same(TreeNode a, TreeNode b) {',
    '        if (a == null || b == null) return a == b;',
    '        return a.val == b.val && same(a.left, b.left) && same(a.right, b.right);',
    '    }',
    '}'
  ].join('\n')
};

export function projectAlgoProblemPages(entries, { baselineTest = false } = {}) {
  if (baselineTest) return entries;
  return entries.map((entry) => {
    const meta = NUMBER_AND_SLUG[entry.id];
    if (!meta || entry.kind !== 'qa' || !Array.isArray(entry.items) || entry.items.length !== 1) return entry;
    const [number, slug] = meta;
    const item = entry.items[0];
    const answer = String(item.a || '');
    const { lead, sections } = splitSections(answer);
    const pick = (needle) => sections.find((s) => s.title.includes(needle));

    const contract = pick('输入、输出与前提');
    const why = pick('为什么这样做');
    const complexity = pick('复杂度与正确性');
    const boundary = pick('边界、反例与追问') || pick('边界');
    const followups = pick('可能的问法');

    const rawCode = pickJavaPre(answer);
    const code = rawCode.trim() ? solutionOnly(formatJava(rawCode)) : (CODE_FALLBACK[entry.id] || '');

    // Worked examples read as part of the breakdown; the related links are
    // already served by the "同类题" section, so nothing is left dangling.
    const examples = pick('例子与推演');
    const walkthrough = [why ? bodyText(why.html) : '', examples ? bodyText(examples.html) : '']
      .filter(Boolean)
      .join('\n\n');

    const next = {
      id: entry.id,
      kind: 'algo',
      mod: entry.mod,
      part: entry.part,
      cat: entry.cat,
      title: entry.title,
      number,
      progressKey: entry.progressKey || entry.id,
      idea: flat(lead).replace(/^本质\s*/, '') || entry.title,
      description: contract ? bodyText(contract.html) : flat(item.q || entry.title),
      code,
      walkthrough,
      complexityNote: complexity ? bodyText(complexity.html) : '',
      boundaryCases: boundaryOf(boundary),
      followupQuestions: followups ? listItems(followups.html) : [],
      // Kept so the reviewed correction registry can still reverse and re-apply
      // its edits against this entry; the catalog and renderers ignore it once
      // the entry is an algorithm page.
      items: entry.items
    };
    if (slug) next.slug = slug;
    return next;
  });
}
