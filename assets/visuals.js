/* Generated deterministically. Edit src/, never dist/. */
void 0;

/* Source: src/visuals/legacy-viz.js */
/* 迁移自 v7：代码高亮、SVG 图解库、深入补强与反事实数据。build.mjs 会原样内联到 v8。 */
    function commentIndex(line) {
      let quote = '';
      let escaped = false;
      for (let index = 0; index < line.length - 1; index += 1) {
        const char = line[index];
        if (escaped) { escaped = false; continue; }
        if (quote && char === '\\') { escaped = true; continue; }
        if (quote && char === quote) { quote = ''; continue; }
        if (!quote && (char === '"' || char === "'")) { quote = char; continue; }
        if (!quote && char === '/' && line[index + 1] === '/') return index;
      }
      return -1;
    }

    // highlightCode 已移至 app.js（v8 重写，支持语言参数）

    /* ===== 图解库：按题型生成 SVG 示意 ===== */
    const vEsc = (v) => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const VDEFS = '<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#0969da"/></marker><marker id="ahg" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#1a7f37"/></marker></defs>';
    const SV = (w, h, inner) => `<svg class="viz-svg" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${VDEFS}${inner}</svg>`;
    const R = (x, y, w, h, c) => `<rect class="${c || 'vbox'}" x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/>`;
    const TX = (x, y, t, c) => `<text class="${c || 'vt'}" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central">${vEsc(t)}</text>`;
    const CL = (x, y, w, h, t, c, tc) => R(x, y, w, h, 'vcell' + (c ? ' ' + c : '')) + TX(x + w / 2, y + h / 2, t, tc || 'vt');
    const LN = (x1, y1, x2, y2, c) => `<line class="${c || 'vline'}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    const AR = (x1, y1, x2, y2, c) => `<line class="${c || 'varrow'}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#${c === 'vcur' ? 'ahg' : 'ah'})"/>`;
    const PA = (d, c) => `<path class="${c || 'varrow'}" d="${d}" marker-end="url(#${c === 'vcur' ? 'ahg' : 'ah'})"/>`;
    const LB = (x, y, t, c) => TX(x, y, t, c || 'vlbl');
    // 以中心点定位的矩形 / 单元格
    const RC = (cx, cy, w, h, c) => R(cx - w / 2, cy - h / 2, w, h, c);
    const NC = (cx, cy, w, h, t, c, tc) => CL(cx - w / 2, cy - h / 2, w, h, t, c, tc);
    // 一行等距单元格：cx 为整行中心，返回 {svg, x(i)} 方便画指针
    const ROWC = (cx, cy, items, o) => {
      o = o || {};
      const w = o.w || 62, h = o.h || 46, p = o.pitch || (w + 10);
      const x0 = cx - ((items.length - 1) * p) / 2;
      let s = '';
      items.forEach((v, i) => {
        const bx = x0 + i * p;
        let cls = (o.cls && o.cls[i]) || (Array.isArray(o.hl) && o.hl.includes(i) ? 'hl' : '') || '';
        s += NC(bx, cy, w, h, v, cls, o.small ? 'vts' : 'vt');
        if (o.idx) s += LB(bx, cy + h / 2 + 15, (o.idxPrefix || 'i=') + i);
        if (o.ptr && o.ptr[i]) {
          s += PA(`M${bx} ${cy + h / 2 + (o.idx ? 26 : 4)} l0 13`, 'vcur');
          s += LB(bx, cy + h / 2 + (o.idx ? 50 : 28), o.ptr[i]);
        }
      });
      if (o.label) s += LB(cx, cy - h / 2 - 22, o.label);
      return { svg: s, x: (i) => x0 + i * p, cx, cy, w, h, p };
    };
    const FLOWC = (cx, cy, steps, o) => {
      o = o || {};
      const w = o.w || 138, h = o.h || 50, p = o.pitch || (w + 30);
      const x0 = cx - ((steps.length - 1) * p) / 2;
      return steps.map((t, i) => NC(x0 + i * p, cy, w, h, t, o.cls || '', 'vts')
        + (i < steps.length - 1 ? AR(x0 + i * p + w / 2 + 3, cy, x0 + (i + 1) * p - w / 2 - 4, cy) : '')).join('');
    };

    const VIZ_TPL = {
      hashLookup: () => {
        const row = ROWC(240, 90, [2, 7, 11, 15], { idx: true, idxPrefix: 'i=' });
        return {
          w: 480, h: 300, name: '哈希一次扫描',
          cap: '从左到右扫描数组：每读一个数，先到哈希表里查“我需要的那一半”是否出现过，再把当前数登记进去，每个元素只处理一次。',
          inner: LB(240, 30, '① 一次扫描数组') + row.svg
            + PA(`M${row.x(1)} 130 C${row.x(1)} 168 240 176 240 196`, 'varrow') + LB(330, 172, '查 need = target − 7')
            + LB(240, 208, '② 哈希表：已见过的“值 → 下标”')
            + R(40, 222, 400, 62) + NC(140, 253, 168, 40, '2 → 0', 'ok', 'vts') + NC(340, 253, 168, 40, '7 → 1', 'hl', 'vts'),
        };
      },
      hashGroup: () => {
        const row = ROWC(240, 74, ['eat', 'tea', 'tan', 'ate'], { w: 88, pitch: 98, small: true });
        return {
          w: 480, h: 290, name: '哈希分组 / 计数',
          cap: '把“属于同一组”的元素映射到同一个哈希键：分组题用特征码当 key，计数题用元素本身当 key。',
          inner: LB(240, 30, '① 为每个元素算 key（频次 / 排序后字符串等）') + row.svg
            + PA(`M${row.x(0)} 100 l0 20`) + PA(`M${row.x(1)} 100 l0 20`) + PA(`M${row.x(3)} 100 l0 20`)
            + LB(240, 142, '② 相同 key 落入同一个桶')
            + R(40, 156, 400, 110) + LB(240, 184, 'key = "aet"  → 3 个单词', 'vlbl')
            + NC(148, 222, 180, 44, 'eat, tea, ate', 'ok', 'vts') + NC(352, 222, 150, 44, 'tan', 'hl', 'vts'),
        };
      },
      twoPointerOpposite: () => {
        const row = ROWC(240, 130, [1, 3, 5, 7, 9, 11], { idx: true, idxPrefix: 'i=', ptr: { 0: 'left', 5: 'right' } });
        return {
          w: 480, h: 260, name: '对撞双指针',
          cap: '左右指针从两端向中间收缩：每次比较都能单调地排除一侧，保证不漏解，整体只走 O(n) 步。',
          inner: LB(240, 30, '有序数组：和太小 → left++；和太大 → right--') + row.svg
            + PA(`M${row.x(0)} 118 C${row.x(0)} 74 240 66 118 74`, 'varrow')
            + PA(`M${row.x(5)} 118 C${row.x(5)} 74 360 66 362 74`, 'varrow')
            + R(30, 206, 420, 44, 'vfill') + TX(240, 228, '指针外侧区间已被证明不含答案，可以安全丢弃', 'vts'),
        };
      },
      twoPointerSame: () => {
        const row = ROWC(240, 120, [0, 1, 0, 3, 12], { idx: true, hl: [1, 3, 4], ptr: { 1: 'read', 2: 'write' } });
        return {
          w: 480, h: 270, name: '同向（读写）双指针',
          cap: '快指针负责读、慢指针负责写：把满足条件的元素搬到写位置，写指针只在“写成功”后前进。',
          inner: LB(240, 30, '保持 [0, write) 内全是有序且合格的结果') + row.svg
            + R(30, 196, 420, 46, 'vfillok') + TX(240, 219, '原地交换 → 额外空间 O(1)；read 与 write 之间是待处理区', 'vts'),
        };
      },
      slideWindow: () => {
        const row = ROWC(260, 120, ['a', 'b', 'c', 'a', 'b', 'c', 'b'], { w: 46, pitch: 62, small: true, ptr: { 3: 'left', 6: 'right' } });
        return {
          w: 520, h: 270, name: '滑动窗口',
          cap: '右指针无条件扩张，窗口不合法时左指针单调收缩；每个下标最多进出窗口一次，所以整体 O(n)。',
          inner: LB(260, 28, '窗口 [left, right]：任意时刻只维护一段连续区间') + row.svg
            + R(row.x(3) - 30, 96, 3 * 62 + 30 + 24, 50, 'vwin')
            + PA('M500 176 C400 226 140 226 60 200', 'vcur') + LB(300, 232, '出现重复 → left 跳到重复字符的下一位'),
        };
      },
      prefixSum: () => {
        const row = ROWC(240, 130, ['0', '3', '5', '2', '4'], { idx: true, idxPrefix: 'p', hl: [2] });
        return {
          w: 480, h: 270, name: '前缀和 + 哈希',
          cap: '把“连续子数组和”变成两个前缀相减：只要历史前缀里出现过 prefix − target，就找到一段合法区间。',
          inner: LB(240, 30, 'prefix[i] = 前 i 个元素之和') + row.svg
            + AR(60, 62, 420, 62, 'vdash') + LB(240, 48, 'prefix[r] − prefix[l] = 区间和')
            + R(30, 200, 420, 48, 'vfill') + TX(240, 224, '先查历史前缀、再登记当前前缀，避免把长度为 0 的区间算进去', 'vts'),
        };
      },
      monotonicQueue: () => {
        const row = ROWC(270, 110, [1, 3, -1, -3, 5, 3, 6], { w: 52, pitch: 66, l: 1, idx: true, ptr: { 4: '队首 max' } });
        return {
          w: 540, h: 270, name: '单调队列',
          cap: '队列存下标、值单调递减：新元素弹掉队尾所有更小的元素（它们再不可能成为最大值），队首就是当前窗口最大值。',
          inner: LB(270, 28, '滑动窗口最大值：窗口每右移一格，进出各一次') + row.svg
            + R(30, 210, 480, 44, 'vfillwarn') + TX(270, 232, '队列：下标 4(值5) → 下标 5(值3)，队首即最大值', 'vts'),
        };
      },
      prefixMono: () => {
        const row = ROWC(270, 100, ['0', '1', '4', '3', '9'], { w: 58, pitch: 72, idx: true, idxPrefix: 'p', ptr: { 1: '左端', 4: 'right' } });
        return {
          w: 540, h: 260, name: '前缀和 + 单调队列',
          cap: '有负数时不能普通滑窗。维护 prefix 递增的下标队列：队首能凑出 ≥K 就弹出求最短，队尾丢掉更差前缀。',
          inner: LB(270, 28, 'prefix[j] − prefix[i] ≥ K  → 区间 [i, j) 合法') + row.svg
            + R(30, 186, 480, 52, 'vfillok') + TX(270, 204, '更晚且 prefix 更小的右端，作为左端一定更优', 'vts') + TX(270, 222, '前缀必须用 long，避免累加溢出', 'vlbl'),
        };
      },
      interval: () => ({
        w: 500, h: 270, name: '区间排序 + 合并',
        cap: '按左端点排序后，只需比较“当前区间左端”与“已合并区间的右端”是否重叠：重叠就合并，否则另起一段。',
        inner: LB(250, 30, '按左端点排序后的区间')
          + R(60, 56, 90, 32, 'vcell ok') + LB(230, 72, '[1,3]')
          + R(130, 102, 190, 32, 'vcell dim') + LB(390, 118, '[2,6] 与 [1,3] 重叠 → 合并为 [1,6]')
          + R(320, 148, 90, 32, 'vcell ok') + LB(230, 164, '[8,10]')
          + LN(40, 206, 460, 206, 'vdash') + LB(250, 228, '时间轴：最终得到 [1,6] 与 [8,10]'),
      }),
      matrixSpiral: () => {
        let g = '';
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g += NC(150 + c * 62, 80 + r * 56, 56, 48, String(r * 3 + c + 1), r < 2 || c === 0 ? 'ok' : '');
        return {
          w: 420, h: 270, name: '矩阵按层遍历',
          cap: '用上/下/左/右四个边界表示当前未访问的外圈，顺时针走完一圈后把边界向内收一层，直到边界相交。',
          inner: LB(150, 34, '四个边界向内收缩') + g
            + PA('M300 96 C340 110 340 168 300 184', 'varrow') + LB(210, 232, '顺时针走完外圈 → 边界内缩 → 重复'),
        };
      },
      gridFlood: () => {
        const land = [0, 1, 2, 4];
        let g = '';
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
          const k = r * 4 + c;
          g += NC(110 + c * 62, 80 + r * 54, 54, 46, land.includes(k) ? '1' : '0', land.includes(k) ? 'ok' : 'dim', 'vts');
        }
        return {
          w: 440, h: 260, name: '网格 DFS / BFS 淹没',
          cap: '遇到一个未访问的“陆地”就以它为起点做一次 DFS/BFS，把整座岛淹没，最后统计起点个数即为岛屿数。',
          inner: LB(110, 34, '网格（1 = 陆地）') + g + LB(220, 232, '每发现一个未访问的 1 → 岛屿数 +1，并淹没整座岛'),
        };
      },
      linkedReverse: () => ({
        w: 520, h: 210, name: '链表反转（三指针）',
        cap: 'prev / cur / next 三指针沿链表推进：先把 cur.next 存入 next，再让 cur.next 指向 prev，最后整体右移一格。',
        inner: NC(100, 100, 100, 46, 'prev') + NC(250, 100, 100, 46, 'cur', 'hl') + NC(400, 100, 100, 46, 'next')
          + AR(154, 100, 196, 100) + AR(304, 100, 346, 100)
          + PA('M250 126 C250 170 100 170 100 128', 'varrow') + LB(175, 186, 'cur.next = prev'),
      }),
      linkedFastSlow: () => ({
        w: 520, h: 220, name: '快慢指针',
        cap: '快指针每次两步、慢指针一步：快指针到尾时慢指针恰好在中点；若存在环，两者必然在环内相遇。',
        inner: [0, 1, 2, 3, 4].map((i) => NC(80 + i * 90, 104, 66, 46, String(i), i === 2 ? 'hl' : (i === 4 ? 'warn' : ''), 'vts')).join('')
          + LB(170, 152, 'slow 每次 1 步') + LB(440, 152, 'fast 每次 2 步')
          + PA('M80 78 C160 34 420 34 440 78') + LB(260, 44, '快指针到尾部 → 慢指针正好在中点'),
      }),
      linkedCycle: () => ({
        w: 500, h: 270, name: '环检测与入环点',
        cap: '快慢指针在环内相遇即有环；相遇后把一个指针放回头部、两者同速前进，再次相遇处就是入环点。',
        inner: [0, 1, 2, 3].map((i) => NC(90 + i * 100, 80, 72, 46, String(i), i === 2 ? 'hl' : '', 'vts')).join('')
          + AR(128, 80, 152, 80) + AR(228, 80, 252, 80) + AR(328, 80, 352, 80)
          + PA('M400 104 C440 170 250 232 130 112', 'vcur') + LB(260, 222, '环：fast 追上 slow 的位置', 'vts'),
      }),
      linkedMerge: () => ({
        w: 520, h: 230, name: '合并有序链表',
        cap: '两个指针各指向一条链表，每次把较小的节点接到结果链表尾部；一条走完后把另一条整段接上即可。',
        inner: LB(60, 46, 'A: 1 → 3 → 5') + LB(60, 76, 'B: 2 → 4 → 6')
          + NC(190, 116, 56, 42, '1', '', 'vts') + NC(256, 116, 56, 42, '3', 'dim', 'vts') + NC(322, 116, 56, 42, '5', 'dim', 'vts')
          + NC(190, 176, 56, 42, '2', '', 'vts') + NC(256, 176, 56, 42, '4', 'dim', 'vts') + NC(322, 176, 56, 42, '6', 'dim', 'vts')
          + AR(362, 116, 400, 130) + AR(362, 176, 400, 162)
          + R(400, 106, 100, 80, 'vfillok') + TX(450, 134, '结果', 'vts') + TX(450, 158, '1→2→3…', 'vts'),
      }),
      treeDfs: () => ({
        w: 460, h: 250, name: '二叉树递归骨架',
        cap: '递归只要回答三件事：函数返回什么、单层做什么、什么时候终止；前/中/后序只是“访问根节点”的位置不同。',
        inner: NC(230, 60, 66, 40, 'root') + LN(230, 80, 150, 116, 'vdash') + LN(230, 80, 310, 116, 'vdash')
          + NC(150, 134, 66, 40, '左') + NC(310, 134, 66, 40, '右')
          + R(30, 182, 400, 52, 'vfill') + TX(230, 202, '前序：根 → 左 → 右    中序：左 → 根 → 右', 'vts') + TX(230, 222, '后序：左 → 右 → 根；写代码前先定“函数返回什么”', 'vlbl'),
      }),
      treeLevel: () => ({
        w: 480, h: 250, name: '层序遍历（BFS）',
        cap: '队列里保存同一层的节点：先把当前层全部出队并记录，再统一把下一层入队，从而天然分层。',
        inner: NC(240, 60, 70, 38, '8') + LN(240, 80, 160, 112, 'vdash') + LN(240, 80, 320, 112, 'vdash')
          + NC(160, 130, 70, 38, '4') + NC(320, 130, 70, 38, '12')
          + R(70, 176, 180, 36, 'vfill') + TX(160, 194, '第 1 层：8', 'vts')
          + R(260, 176, 180, 36, 'vfillok') + TX(350, 194, '第 2 层：4, 12', 'vts')
          + LB(240, 232, '入队时标记 visited，避免同一节点被重复入队'),
      }),
      treeBst: () => ({
        w: 470, h: 240, name: 'BST 性质',
        cap: 'BST 的中序遍历一定有序；查找/插入/删除借助“左小右大”或上下界，可以一次剪掉一半子树。',
        inner: NC(235, 62, 96, 40, 'root = 5') + LN(235, 82, 155, 116, 'vdash') + LN(235, 82, 315, 116, 'vdash')
          + NC(155, 136, 96, 40, '全部 < 5') + NC(315, 136, 96, 40, '全部 > 5')
          + R(35, 178, 400, 48, 'vfill') + TX(235, 202, '中序遍历 → 有序序列；比较 root 决定去左子树还是右子树', 'vts'),
      }),
      treePath: () => ({
        w: 480, h: 250, name: '树上的路径回溯',
        cap: '进入节点时把值加入路径（做选择），离开节点时撤销（回溯），路径数组始终等于“根到当前节点”的链。',
        inner: NC(240, 60, 66, 38, '5') + LN(240, 79, 160, 112, 'vdash') + LN(240, 79, 320, 112, 'vdash')
          + NC(160, 130, 66, 38, '4') + NC(320, 130, 66, 38, '8')
          + R(60, 170, 170, 62, 'vfillok') + TX(145, 192, 'path = [5, 4]', 'vts') + TX(145, 214, '进入 push，离开 pop', 'vlbl')
          + R(250, 170, 170, 62, 'vfill') + TX(335, 192, '回溯保证状态干净', 'vts') + TX(335, 214, '适合枚举所有路径', 'vlbl'),
      }),
      graphBfs: () => ({
        w: 500, h: 260, name: '图 BFS 分层扩散',
        cap: '起点入队后逐层向外扩散，第一次到达某点就是最少步数；visited 必须在入队时标记。',
        inner: NC(90, 120, 56, 42, 'A', 'ok') + NC(220, 76, 56, 42, 'B') + NC(220, 170, 56, 42, 'C') + NC(360, 120, 56, 42, 'D')
          + LN(118, 118, 192, 88, 'vdash') + LN(118, 126, 192, 166, 'vdash') + LN(248, 90, 332, 116, 'vdash') + LN(248, 178, 332, 132, 'vdash')
          + R(30, 212, 440, 34, 'vfill') + TX(250, 229, '距离：A = 0，B = C = 1，D = 2（BFS 首次到达即最短）', 'vts'),
      }),
      topoSort: () => ({
        w: 520, h: 250, name: '拓扑排序（Kahn）',
        cap: '统计入度，先把入度为 0 的点入队；取出一个点后把它指向的邻居入度减一，减到 0 就入队。',
        inner: NC(110, 100, 110, 46, '课程 1') + NC(270, 100, 110, 46, '课程 2') + NC(430, 100, 110, 46, '课程 3')
          + AR(168, 100, 212, 100) + AR(328, 100, 372, 100)
          + LB(110, 62, '入度 0') + LB(270, 62, '入度 1') + LB(430, 62, '入度 1')
          + R(30, 164, 460, 54, 'vfillwarn') + TX(260, 184, '若最终输出点数 < 总点数 → 存在环，无法完成课程安排', 'vts') + TX(260, 204, '用邻接表存图，入度数组配合队列即可', 'vlbl'),
      }),
      trie: () => ({
        w: 460, h: 250, name: '前缀树（Trie）',
        cap: '每个节点代表一个字符，根到某节点的路径就是一个前缀；isEnd 标记单词结束，公共前缀自动共享同一个节点。',
        inner: NC(230, 60, 60, 36, '•') + NC(140, 126, 52, 36, 'a') + NC(320, 126, 52, 36, 'b')
          + LN(230, 78, 160, 122, 'vdash') + LN(230, 78, 300, 122, 'vdash')
          + NC(70, 192, 52, 36, 'p', 'ok') + NC(195, 192, 52, 36, 't', 'hl') + LN(140, 144, 96, 188, 'vdash') + LN(140, 144, 170, 188, 'vdash')
          + LB(360, 150, 'isEnd = true') + LB(360, 172, '标记单词结束'),
      }),
      backtrackSubset: () => ({
        w: 540, h: 260, name: '回溯决策树',
        cap: '每层决定一个元素“选 / 不选”，走到叶子就是一个完整方案；返回上一层必须撤销选择，保证状态干净。',
        inner: NC(270, 50, 70, 34, '[]', '', 'vts')
          + NC(170, 112, 70, 34, '[1]', '', 'vts') + NC(370, 112, 70, 34, '[]', 'dim', 'vts')
          + NC(100, 174, 80, 34, '[1,2]', 'ok', 'vts') + NC(210, 174, 70, 34, '[1]', '', 'vts')
          + NC(320, 174, 70, 34, '[2]', 'ok', 'vts') + NC(430, 174, 70, 34, '[]', 'dim', 'vts')
          + LN(270, 67, 190, 96, 'vdash') + LN(270, 67, 350, 96, 'vdash')
          + LN(170, 129, 110, 158, 'vdash') + LN(170, 129, 200, 158, 'vdash') + LN(370, 129, 330, 158, 'vdash') + LN(370, 129, 420, 158, 'vdash')
          + LB(270, 226, '叶子数 = 2ⁿ；每个节点做一次“选择 + 递归 + 撤销”'),
      }),
      backtrackPermute: () => ({
        w: 500, h: 250, name: '排列 / 组合剪枝',
        cap: '排列用 used 数组避免重复使用同一位置；组合用 start 下标保证只往后选，从而天然去重。',
        inner: ['1', '2', '3'].map((t, i) => NC(100 + i * 120, 76, 56, 42, t, i === 0 ? 'hl' : '', 'vts')).join('')
          + R(40, 128, 420, 96, 'vfill')
          + TX(250, 156, '第 1 位固定为 1 → 剩余 [2,3] 再做全排列 → [1,2,3]、[1,3,2]', 'vts')
          + TX(250, 184, 'used[i] = true 进入、false 撤销；组合则用 start 只往后选', 'vlbl')
          + TX(250, 208, '含重复元素时先排序，再在每层跳过相同值去重', 'vlbl'),
      }),
      backtrackBoard: () => {
        let g = '';
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) g += NC(205 + c * 58, 66 + r * 50, 52, 44, (r === 1 && c === 2) ? 'Q' : '', (r === 1 && c === 2) ? 'ok' : 'dim', 'vts');
        return {
          w: 460, h: 280, name: '棋盘类回溯',
          cap: '逐行放置，放完用列与两个对角线约束剪枝；冲突就回退换下一个位置，放满所有行即得到一个解。',
          inner: g + LB(220, 262, '冲突判断：同列 / 主对角线 / 副对角线，用 set 做 O(1) 检查'),
        };
      },
      binSearchExact: () => {
        const row = ROWC(260, 130, [1, 3, 5, 6, 9, 12], { idx: true, idxPrefix: 'i=', ptr: { 0: 'left', 5: 'right' } });
        return {
          w: 520, h: 260, name: '闭区间二分',
          cap: 'left ≤ right 循环：mid 命中就返回；否则按单调性把不可能的一半排除，区间每轮至少缩小一半。',
          inner: LB(260, 30, 'mid = left + (right − left) / 2   ← 防溢出写法') + row.svg
            + LB(row.x(0), 236, 'left') + LB(row.x(5), 236, 'right')
            + R(30, 200, 460, 30, 'vfill') + TX(260, 215, 'nums[mid] < target → left = mid + 1；否则 right = mid − 1', 'vts'),
        };
      },
      binSearchBoundary: () => {
        const row = ROWC(260, 130, [1, 2, 2, 2, 3, 4], { idx: true, idxPrefix: 'i=', cls: { 1: 'ok', 2: 'ok', 3: 'ok' } });
        return {
          w: 520, h: 250, name: '二分边界（左闭右开）',
          cap: '找“第一个满足条件的位置”时 right 收缩到 mid（而不是 mid−1），循环用 left < right，结束时 left 即答案下标。',
          inner: LB(260, 30, '找第一个 ≥ 2 → 返回下标 1（lower_bound）') + row.svg
            + R(30, 194, 460, 44, 'vfillwarn') + TX(260, 216, 'right = mid 而非 mid − 1，否则可能跳过边界本身', 'vts'),
        };
      },
      binSearchAnswer: () => ({
        w: 520, h: 260, name: '答案二分',
        cap: '搜索空间是“答案的取值范围”而不是下标：写一个单调的 check(x)，用它来收缩答案区间。',
        inner: FLOWC(260, 54, ['确定答案范围', 'check(mid) 是否可行', '收缩边界'], { w: 138, h: 46, pitch: 172 })
          + R(30, 108, 460, 46, 'vfill') + TX(260, 131, '典型问法：最小化最大值 / 最大化最小值 / 能否在 X 时间内完成', 'vts')
          + R(30, 168, 460, 52, 'vfillok') + TX(260, 188, '可行 → 尝试更小的答案；不可行 → 答案必须更大', 'vts')
          + TX(260, 204, 'x 可行 ⇒ 所有更宽松的值也可行（单调性）', 'vts')
          + LB(260, 244, '注意 check 的上界要足够大、计算过程用 long 防溢出'),
      }),
      sortPartition: () => {
        const row = ROWC(250, 130, [3, 1, 4, 1, 5], { cls: { 0: 'dim', 1: 'ok', 2: 'hl', 3: 'ok', 4: 'dim' } });
        return {
          w: 500, h: 250, name: '分区 / 快排 / 快选',
          cap: 'pivot 分区后左边都 ≤ pivot、右边都 ≥ pivot。快排递归两侧；第 K 大只递归包含目标排名的一侧，平均 O(n)。',
          inner: LB(250, 30, 'pivot = 4 → 左边全 ≤ 4，右边全 ≥ 4') + row.svg
            + R(30, 194, 440, 42, 'vfill') + TX(250, 215, '快排：两侧都递归；快选：只走目标一侧', 'vts'),
        };
      },
      sortMerge: () => ({
        w: 500, h: 240, name: '归并排序 / 归并统计',
        cap: '先递归拆到长度 1，再两两合并有序段；合并过程中可以顺便统计逆序对这类“跨区间”信息。',
        inner: FLOWC(250, 54, ['拆分到单个元素', '两两合并有序段'], { w: 168, h: 46, pitch: 200 })
          + NC(100, 130, 48, 40, '4', 'dim', 'vts') + NC(160, 130, 48, 40, '1', 'dim', 'vts')
          + NC(220, 130, 48, 40, '3', 'dim', 'vts') + NC(280, 130, 48, 40, '2', 'dim', 'vts')
          + AR(320, 130, 356, 130) + NC(420, 130, 48, 40, '1', 'ok', 'vts') + NC(400, 190, 48, 40, '2', 'ok', 'vts')
          + LB(250, 226, '稳定排序；时间 O(n log n) 与数据分布无关，代价是 O(n) 额外空间'),
      }),
      heapTopK: () => ({
        w: 500, h: 260, name: '小顶堆维护 TopK',
        cap: '堆里只保留 K 个元素、堆顶是其中最小的：新元素大于堆顶就替换堆顶，扫完后堆内即最大的 K 个。',
        inner: NC(250, 60, 96, 42, '堆顶 min', 'warn') + NC(160, 124, 76, 38, '…') + NC(340, 124, 76, 38, '…')
          + LN(250, 81, 198, 106, 'vdash') + LN(250, 81, 302, 106, 'vdash')
          + R(30, 178, 440, 58, 'vfillok') + TX(250, 198, '当前元素 > 堆顶 → 弹出堆顶并插入当前元素', 'vts') + TX(250, 220, '堆大小恒为 K：时间 O(n log K)，空间 O(K)', 'vlbl'),
      }),
      stackLifo: () => ({
        w: 460, h: 260, name: '栈 / 单调栈',
        cap: '栈只在顶端进出；单调栈额外保证栈内单调，遇到破坏单调性的元素就不断弹栈并结算答案。',
        inner: [0, 1, 2, 3].map((i) => R(155, 198 - i * 34, 150, 32, i < 3 ? 'vcell' : 'vcell hl')).join('')
          + TX(230, 214 - 0 * 34, 'top', 'vts')
          + PA('M120 210 l0 -56', 'vcur') + LB(96, 186, 'push', 'vlbl')
          + PA('M340 210 l0 -56', 'varrow') + LB(366, 186, 'pop', 'vlbl')
          + R(40, 226, 380, 26, 'vfill') + TX(230, 239, '典型用途：下一个更大元素、最大矩形、接雨水', 'vts'),
      }),
      greedyInterval: () => ({
        w: 500, h: 250, name: '贪心：按结束时间排序',
        cap: '区间调度类贪心先按右端点排序，每次选“最早结束且与已选不冲突”的区间，可证明这样能给后面留出最多空间。',
        inner: R(60, 80, 90, 34, 'vcell ok') + TX(105, 97, '[1,3]', 'vts')
          + R(130, 122, 120, 34, 'vcell dim') + TX(190, 139, '[2,5] 被跳过', 'vts')
          + R(200, 80, 90, 34, 'vcell ok') + TX(245, 97, '[3,6]', 'vts')
          + R(330, 80, 90, 34, 'vcell ok') + TX(375, 97, '[7,9]', 'vts')
          + R(40, 178, 420, 52, 'vfill') + TX(250, 200, '选 [1,3]、[3,6]、[7,9]；[2,5] 结束更晚，一定不是更优选择', 'vts'),
      }),
      cacheLRU: () => ({
        w: 540, h: 270, name: 'LRU：哈希表 + 双向链表',
        cap: '哈希表实现 O(1) 定位节点，双向链表维护访问顺序：命中或插入后把节点摘下来挂到表头，超出容量就淘汰表尾。',
        inner: LB(150, 32, 'HashMap：key → 链表节点') + R(40, 46, 220, 96)
          + NC(150, 76, 180, 34, 'key → node', '', 'vts') + NC(150, 116, 180, 30, '容量 O(capacity)', 'dim', 'vts')
          + LB(390, 32, '双向链表：最近使用在最左')
          + NC(300, 90, 64, 42, 'head', 'ok', 'vts') + NC(390, 90, 64, 42, 'B', '', 'vts') + NC(480, 90, 60, 42, 'tail', 'warn', 'vts')
          + LN(332, 90, 358, 90, 'vdash') + LN(422, 90, 450, 90, 'vdash') + LB(345, 116, 'next') + LB(436, 116, 'next')
          + PA('M150 146 C150 196 296 196 300 116', 'varrow') + LB(230, 210, 'get / put 命中 → 摘链并挂到 head', 'vlbl')
          + R(40, 224, 480, 40, 'vfillwarn') + TX(280, 244, '容量超限：删除 tail 节点，同时从 HashMap 中移除该 key', 'vts'),
      }),
      dpLinear: () => ({
        w: 520, h: 250, name: '一维 DP',
        cap: 'dp[i] 表示“前 i 个元素 / 以 i 结尾”的最优值，转移来自有限个更早的状态；常可用滚动变量把空间压到 O(1)。',
        inner: ROWC(260, 130, ['dp0', 'dp1', 'dp2', 'dp3', 'dp4'], { w: 66, pitch: 76, small: true, cls: { 2: 'hl' } }).svg
          + PA('M184 108 C184 70 260 70 260 106', 'varrow') + PA('M260 108 C260 70 336 70 336 106', 'varrow')
          + LB(260, 46, 'dp[i] = max(dp[i−1], dp[i−2] + 收益)')
          + R(30, 194, 460, 44, 'vfillok') + TX(260, 216, '遍历顺序必须保证“依赖的状态已经算好”', 'vts'),
      }),
      dpGrid: () => {
        let g = '';
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g += NC(160 + c * 72, 76 + r * 56, 62, 46, 'dp', (r === 1 && c === 2) ? 'hl' : '', 'vts');
        return {
          w: 500, h: 270, name: '二维 DP / 网格路径',
          cap: 'dp[i][j] 由上方与左方转移而来，所以按行、按列双重循环即可；第一行与第一列需要单独初始化。',
          inner: LB(160, 34, '按行遍历：上、左两个状态已经算好') + g
            + AR(268, 104, 268, 118, 'varrow') + AR(246, 132, 226, 132, 'vcur')
            + LB(250, 238, 'dp[i][j] = dp[i−1][j] + dp[i][j−1]（来自上方与左方）'),
        };
      },
      dpKnapsack: () => ({
        w: 520, h: 240, name: '背包 DP 遍历方向',
        cap: '外层遍历物品、内层遍历容量：0/1 背包容量必须倒序、完全背包容量正序，方向决定了物品能否被重复使用。',
        inner: ROWC(260, 60, ['c0', 'c1', 'c2', 'c3', 'c4'], { w: 60, pitch: 70, small: true, cls: { 2: 'hl' } }).svg
          + R(30, 116, 460, 44, 'vfillwarn') + TX(260, 138, '0/1 背包：for (int j = C; j >= w; j--)   ← 倒序', 'vts')
          + R(30, 172, 460, 44, 'vfillok') + TX(260, 194, '完全背包：for (int j = w; j <= C; j++)   ← 正序', 'vts')
          + LB(260, 232, '倒序保证 dp[j] 引用的是“上一轮”的状态，避免同一物品被重复选择'),
      }),
      dpString: () => {
        const cols = ['ε', 'a', 'b', 'c'], rows = ['ε', 'x', 'y'];
        let g = '';
        cols.forEach((t, c) => { g += NC(160 + c * 72, 54, 62, 40, t, '', 'vts'); });
        rows.forEach((t, r) => { g += NC(88, 100 + r * 48, 58, 42, t, '', 'vts'); });
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) g += NC(160 + c * 72, 100 + r * 48, 62, 42, String(r + c), (r === 1 && c === 2) ? 'hl' : '', 'vts');
        return {
          w: 500, h: 270, name: '双序列 DP（编辑距离 / LCS）',
          cap: '行列分别是两个字符串的前缀：字符相同就继承左上格，不同则从插入、删除、替换三种操作中取最小值。',
          inner: LB(88, 30, 's2') + LB(160 + 3 * 72, 30, 's1 →') + g
            + LB(250, 254, 'dp[i][j] 依赖左上、上、左三格 → 按行遍历即可'),
        };
      },
      dpStock: () => ({
        w: 520, h: 240, name: '状态机 DP（股票系列）',
        cap: '把“持有 / 不持有”作为状态，买入与卖出是两条转移边；限制交易次数时再加一维“已交易次数”。',
        inner: NC(140, 110, 130, 48, '不持有', 'ok') + NC(390, 110, 130, 48, '持有', 'hl')
          + AR(208, 96, 322, 96) + LB(265, 74, '买入 −price')
          + AR(322, 126, 208, 126, 'vcur') + LB(265, 148, '卖出 +price')
          + LB(265, 200, 'dp[i][0]：第 i 天不持有的最大收益；dp[i][1]：第 i 天持有的最大收益'),
      }),
      bitOps: () => ({
        w: 520, h: 230, name: '位运算技巧',
        cap: '异或满足交换律与结合律，且自己异或自己为 0；n & (n−1) 消掉最低位的 1，(n & −n) 取出最低位的 1。',
        inner: ROWC(260, 80, ['a', 'b', 'a', 'c', 'b'], { w: 56, pitch: 66, small: true }).svg
          + R(30, 132, 460, 48, 'vfillok') + TX(260, 156, 'a ^ b ^ a ^ c ^ b = c（成对出现的元素全部抵消为 0）', 'vts')
          + LB(260, 208, '计数 1 的个数：while (n != 0) { n &= n − 1; cnt++; }'),
      }),
      mathNumber: () => ({
        w: 480, h: 230, name: '数论 / 数学',
        cap: '先用数学把问题化简（约数、质因数、取模、快速幂），再套固定模板；重点检查溢出与取模后不可逆的运算。',
        inner: FLOWC(240, 62, ['数学化简', '套模板实现'], { w: 168, h: 46, pitch: 200 })
          + R(30, 128, 420, 44, 'vfillwarn') + TX(240, 150, 'gcd(a, b) = gcd(b, a % b)；快速幂用二进制拆分指数', 'vts')
          + LB(240, 200, 'int 溢出是这类题的头号错误，必要时全程使用 long'),
      }),
      geometry: () => ({
        w: 500, h: 240, name: '计算几何',
        cap: '叉积的符号用来判断“左转 / 右转 / 共线”，是凸包、线段相交与多边形面积判定的共同基础。',
        inner: NC(150, 160, 60, 42, 'A') + NC(320, 70, 60, 42, 'B') + NC(410, 170, 60, 42, 'C')
          + AR(155, 158, 314, 78) + AR(326, 74, 404, 166)
          + LB(250, 206, 'cross(AB, AC) > 0 → 逆时针（左转）；= 0 → 三点共线'),
      }),
      randomProb: () => {
        const row = ROWC(260, 80, ['0', '1', '2', '3', '4'], { w: 54, pitch: 64, small: true });
        return {
          w: 520, h: 250, name: '随机与等概率',
          cap: '要证明等概率，就要保证样本空间大小一致且每个结果被选中的概率相同；多余的部分用拒绝采样丢弃。',
          inner: row.svg + PA(`M470 106 C300 46 ${row.x(0)} 46 ${row.x(0)} 104`, 'varrow')
            + LB(260, 52, 'Fisher–Yates：从后往前，与 [0, i] 中随机位置交换')
            + R(30, 150, 460, 60, 'vfillok') + TX(260, 172, '每个位置被选中概率都是 1/n → 所有排列等概率', 'vts') + TX(260, 194, 'rand.nextInt(i + 1) 的范围必须是 [0, i]', 'vlbl'),
        };
      },
      mlAttention: () => ({
        w: 540, h: 240, name: '注意力机制',
        cap: 'Q·Kᵀ 得到相似度，除以 √dₖ 后做 softmax 归一化，再乘 V 加权求和；多头则是并行做多组投影并拼接。',
        inner: NC(80, 80, 90, 42, 'Q', 'hl') + NC(210, 80, 100, 42, 'K', 'ok') + NC(370, 80, 100, 42, 'V', 'ok')
          + AR(128, 80, 156, 80) + LB(142, 58, '·ᵀ')
          + R(40, 136, 460, 46, 'vfill') + TX(270, 159, 'softmax(QKᵀ / √dₖ) · V', 'vts')
          + LB(270, 212, '缩放控制点积方差；mask 必须在 softmax 之前把不可见位置置为 −∞'),
      }),
      designPattern: () => ({
        w: 500, h: 240, name: '设计模式 / 单例',
        cap: '手写类题先说清“要解决什么变化点”，再给最小可运行骨架：接口 + 多个实现 + 工厂/注册表，并明确指出线程安全边界。',
        inner: NC(250, 56, 150, 42, '接口 / 抽象类', 'hl') + LN(250, 78, 140, 118, 'vdash') + LN(250, 78, 360, 118, 'vdash')
          + NC(140, 140, 120, 42, '实现 A') + NC(360, 140, 120, 42, '实现 B')
          + R(30, 180, 440, 48, 'vfillok') + TX(250, 204, '单例：volatile + DCL 保证安全发布；枚举单例天然抗反射与序列化', 'vts'),
      }),
      concurrency: () => ({
        w: 560, h: 250, name: '并发协作',
        cap: '并发题的得分点是“共享状态 + 同步原语 + 唤醒条件”：谁加锁、谁等待、谁唤醒、中断或异常时如何释放资源。',
        inner: ROWC(280, 60, ['线程 A 打印 1', '线程 B 打印 2', '线程 A 打印 3', '线程 B 打印 4'], { w: 128, pitch: 138, small: true }).svg
          + R(30, 122, 500, 50, 'vfill') + TX(280, 147, '共享状态 next = 1；锁内 while (!我的号码) await(); 打印后 next++ 并 signalAll', 'vts')
          + R(30, 184, 500, 46, 'vfillwarn') + TX(280, 207, 'await 必须写在 while 中（防虚假唤醒）；finally 中释放锁', 'vts'),
      }),
      arraySim: () => {
        const row = ROWC(250, 100, ['0', '1', '2', '3', '4'], { idx: true, idxPrefix: 'i=', cls: { 2: 'hl' } });
        return {
          w: 500, h: 240, name: '数组模拟 / 原地处理',
          cap: '不换数据结构，直接用下标模拟：先明确“下标含义”和“区间语义”，再逐条处理边界与越界判断。',
          inner: row.svg + R(30, 168, 440, 52, 'vfill') + TX(250, 190, '下标含义 + 区间语义 + 边界条件，是这类题的三件套', 'vts') + TX(250, 212, '常见坑：下标越界、int 溢出、原地修改后影响后续判断', 'vlbl'),
        };
      },
      stringMatch: () => {
        const row = ROWC(260, 100, ['a', 'a', 'b', 'b', 'c'], { w: 52, pitch: 62, small: true, cls: { 0: 'hl', 1: 'hl' } });
        return {
          w: 520, h: 240, name: '字符串双指针 / 原地处理',
          cap: '用读 / 写双指针或滑动窗口处理字符流；注意 StringBuilder 的使用、char 与 Unicode code point 的区别。',
          inner: row.svg + R(30, 158, 460, 58, 'vfillok') + TX(260, 180, '连续相同字符合并 → a2b2c：写指针只在字符变化时前进', 'vts') + TX(260, 202, '频繁拼接用 StringBuilder，比较内容用 equals', 'vlbl'),
        };
      },
  
    rainTwoPointer: () => {
      const row = ROWC(260, 120, [0, 1, 0, 2, 1, 0, 1, 3], { w: 44, pitch: 54, small: true, ptr: { 0: 'L', 7: 'R' } });
      return {
        w: 520, h: 250, name: '接雨水 · 对撞双指针',
        cap: '哪一侧当前柱更矮，就从哪一侧结算：另一侧一定存在更高边界，水位 = 该侧历史最高 − 当前高度。',
        inner: LB(260, 28, '较低一侧的水位已被对侧更高柱保证') + row.svg
          + R(30, 186, 460, 44, 'vfillok') + TX(260, 208, 'height[L] < height[R] → 用 leftMax 结算 L，然后 L++', 'vts'),
      };
    },
    matrixSearch: () => {
      let g = '';
      const vals = [[1, 4, 7], [2, 5, 8], [3, 6, 9]];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        g += NC(160 + c * 62, 86 + r * 56, 56, 48, String(vals[r][c]), (r === 0 && c === 2) ? 'hl' : ((r === 1 && c === 1) ? 'ok' : ''), 'vts');
      }
      return {
        w: 440, h: 280, name: '有序矩阵楼梯搜索',
        cap: '从右上角出发：当前值太大就向左（该列都更小），太小就向下（该行都更大），每次排除一行或一列，O(m+n)。',
        inner: LB(160, 34, '行增、列增：从右上角走楼梯') + g + LB(220, 250, '不要按螺旋遍历；II 题从角出发即可'),
      };
    },
    linkedIntersect: () => ({
      w: 520, h: 250, name: '相交链表',
      cap: 'A 走完切到 B 头，B 走完切到 A 头。两指针总路程同为 m+n，长度差被抵消，相遇点即交点（或同时到 null）。',
      inner: LB(70, 48, 'A') + NC(150, 70, 52, 36, 'a1') + NC(220, 70, 52, 36, 'a2') + NC(330, 110, 52, 36, 'c1', 'ok') + NC(400, 110, 52, 36, 'c2', 'ok')
        + LB(70, 168, 'B') + NC(150, 170, 52, 36, 'b1') + NC(220, 170, 52, 36, 'b2') + NC(290, 170, 52, 36, 'b3')
        + AR(176, 70, 194, 70) + AR(246, 76, 304, 100) + AR(176, 170, 194, 170) + AR(246, 164, 304, 130)
        + LB(260, 220, '比较节点引用，不要比较 val'),
    }),
    linkedCopy: () => ({
      w: 540, h: 230, name: '随机链表复制',
      cap: '把复制节点插在原节点后面，借 A.next 就是 A′ 设置 random，最后拆成两条链表并恢复原链表。',
      inner: NC(90, 80, 70, 40, 'A') + NC(180, 80, 70, 40, "A'", 'ok') + NC(290, 80, 70, 40, 'B') + NC(380, 80, 70, 40, "B'", 'ok')
        + AR(125, 80, 145, 80) + AR(215, 80, 255, 80) + AR(325, 80, 345, 80)
        + PA('M180 100 C180 160 380 160 380 100', 'vcur') + LB(270, 186, "A′.random = A.random.next"),
    }),
    dutchFlag: () => {
      const row = ROWC(250, 120, [2, 0, 2, 1, 1, 0], { idx: true, ptr: { 0: 'p0', 2: 'i', 5: 'p2' } });
      return {
        w: 520, h: 250, name: '荷兰国旗 · 三指针',
        cap: '[0, p0) 全是 0，(p2, n) 全是 2，中间未处理。遇到 0 与 p0 交换并双进；遇到 2 与 p2 交换但 i 不前进。',
        inner: row.svg + R(30, 186, 460, 44, 'vfill') + TX(250, 208, '0 区 | 1 区 | 未检查区 | 2 区 —— 同向三指针，不是对撞', 'vts'),
      };
    },
    nextPerm: () => {
      const row = ROWC(250, 96, [1, 3, 5, 4, 2], { idx: true, hl: [1], ptr: { 1: 'i', 3: 'j' } });
      return {
        w: 520, h: 270, name: '下一个排列',
        cap: '从右找第一个升序对 nums[i]<nums[i+1]，再从右找刚好比它大的 j，交换后把 i 右侧反转成升序。',
        inner: row.svg + R(30, 188, 460, 60, 'vfillok') + TX(250, 208, '找 i → 找 j 并交换 → 反转 i 右侧', 'vts') + TX(250, 230, '整个数组降序时，直接反转得到最小排列', 'vlbl'),
      };
    },
    treeLca: () => ({
      w: 480, h: 250, name: '二叉树 LCA',
      cap: '后序递归：当前节点是 p 或 q 则返回自己；左右都命中则当前就是 LCA；只一侧命中则答案在那一侧。',
      inner: NC(240, 56, 70, 38, '3', 'ok') + LN(240, 75, 160, 108, 'vdash') + LN(240, 75, 320, 108, 'vdash')
        + NC(160, 126, 70, 38, 'p=5', 'hl') + NC(320, 126, 70, 38, 'q=1', 'hl')
        + R(40, 176, 400, 52, 'vfillok') + TX(240, 194, 'left 命中 p、right 命中 q → root 就是 LCA', 'vts') + TX(240, 214, '普通二叉树不能靠大小决定往哪边走', 'vlbl'),
    }),
    sqlOrder: () => ({
      w: 560, h: 230, name: 'SQL 逻辑执行顺序',
      cap: 'WHERE 在分组前过滤行，所以不能写聚合；SELECT 别名在 WHERE 阶段还不存在。ORDER BY 在 SELECT 之后，可以用别名。',
      inner: FLOWC(280, 70, ['FROM', 'WHERE', 'GROUP', 'HAVING', 'SELECT', 'ORDER'], { w: 78, h: 44, pitch: 88 })
        + R(30, 140, 500, 64, 'vfillwarn') + TX(280, 162, 'WHERE SUM(x) 非法 → 改 HAVING；WHERE 别名非法 → 用表达式或子查询', 'vts') + TX(280, 184, '逻辑顺序理解语义；物理顺序看 EXPLAIN（谓词下推 / Join 重排）', 'vlbl'),
    }),
    btreeIndex: () => ({
      w: 540, h: 260, name: 'B+Tree 与回表',
      cap: '聚簇索引叶子就是整行；二级索引叶子只有主键。用二级索引查出主键后再回聚簇索引取行，就是回表。',
      inner: NC(140, 70, 150, 42, '二级索引叶子', 'hl') + AR(219, 70, 300, 70) + NC(380, 70, 140, 42, '主键 id=8', 'ok')
        + AR(380, 94, 380, 130) + NC(380, 152, 180, 42, '聚簇索引整行', 'ok')
        + R(30, 198, 480, 44, 'vfill') + TX(270, 220, '覆盖索引：查询列都在二级索引里 → 不用回表', 'vts'),
    }),
    indexLeftmost: () => ({
      w: 540, h: 250, name: '联合索引最左前缀',
      cap: '索引 (a,b,c) 按 a → b → c 排序。a 等值后 b 才能用范围/排序；跳过 a 直接用 b 通常无法走该索引。',
      inner: ROWC(270, 80, ['a', 'b', 'c'], { w: 80, pitch: 100 }).svg
        + R(40, 140, 200, 40, 'vfillok') + TX(140, 160, 'WHERE a=? AND b>?', 'vts')
        + R(300, 140, 200, 40, 'vfillwarn') + TX(400, 160, 'WHERE b=?  （跳过 a）', 'vts')
        + LB(270, 210, '范围条件后的列无法再用于查找，但可能用于排序'),
    }),
    mvccLock: () => ({
      w: 540, h: 250, name: '快照读 / 当前读 / 间隙锁',
      cap: '普通 SELECT 是 MVCC 快照读不加锁；FOR UPDATE / UPDATE 是当前读。RR 下用 Next-Key Lock 锁记录+间隙防幻读。',
      inner: NC(140, 80, 170, 48, '快照读 SELECT', 'ok') + NC(400, 80, 190, 48, '当前读 FOR UPDATE', 'hl')
        + R(30, 150, 480, 70, 'vfill') + TX(270, 172, 'RR：事务第一次快照读创建 Read View，之后复用', 'vts')
        + TX(270, 196, 'RC：每条语句新 Read View，能看到已提交变更', 'vlbl'),
    }),
    redoBinlog: () => ({
      w: 560, h: 250, name: 'Redo / Undo / Binlog 两阶段提交',
      cap: 'redo 保证崩溃后已提交不丢；undo 回滚 + MVCC；binlog 复制与 PITR。2PC 让 redo 与 binlog 提交原子一致。',
      inner: FLOWC(280, 70, ['redo prepare', '写 binlog', 'redo commit'], { w: 150, h: 46, pitch: 170 })
        + R(30, 140, 500, 80, 'vfillwarn') + TX(280, 162, '崩溃在 prepare 之后、binlog 之前 → 回滚', 'vts')
        + TX(280, 186, '崩溃在 binlog 之后、commit 之前 → 恢复时提交（否则主从不一致）', 'vts'),
    }),
    replication: () => ({
      w: 560, h: 240, name: '主从复制与读己之写',
      cap: '主库写 binlog → 从库 IO 线程拉到 relay log → SQL 线程重放。刚写入立刻读从库可能读不到。',
      inner: NC(110, 80, 120, 48, '主库写', 'ok') + AR(174, 80, 230, 80) + NC(300, 80, 140, 48, 'relay log', 'hl') + AR(374, 80, 430, 80) + NC(490, 80, 100, 48, '从库')
        + R(30, 150, 500, 60, 'vfillwarn') + TX(280, 172, '强一致接口读主；或等 GTID / 位点追上后再读从', 'vts') + TX(280, 194, '大事务、DDL、热点行、从库资源不足都会加大延迟', 'vlbl'),
    }),
    sharding: () => ({
      w: 540, h: 250, name: '分库分表',
      cap: '分片键要覆盖最高频等值查询且分布均匀。选错就变成散弹查询；跨片分页、跨片事务、扩容是后续主要成本。',
      inner: NC(120, 80, 110, 44, '用户A → 库0') + NC(270, 80, 110, 44, '用户B → 库1', 'ok') + NC(420, 80, 110, 44, '用户C → 库2')
        + R(30, 150, 480, 70, 'vfill') + TX(270, 172, '订单按 user_id 分：用户订单列表走单片', 'vts') + TX(270, 196, '按 order_id 查要映射表 / 基因法，否则广播', 'vlbl'),
    }),
    outboxViz: () => ({
      w: 560, h: 250, name: 'Outbox 与幂等消费',
      cap: '业务表和 outbox 同一本地事务提交；独立扫描器投递消息；消费侧用唯一键去重，失败可重放。',
      inner: FLOWC(280, 70, ['写业务行', '写 outbox', '扫描投递', '消费幂等'], { w: 120, h: 46, pitch: 132 })
        + R(30, 148, 500, 70, 'vfillok') + TX(280, 170, '禁止“先提交 DB 再发 MQ”：进程崩溃会丢消息', 'vts')
        + TX(280, 194, '消费表 UNIQUE(message_id)；处理成功才确认，允许重复投递', 'vlbl'),
    }),
    sqlWindow: () => ({
      w: 540, h: 250, name: '窗口函数 / 连续区间',
      cap: '连续登录：login_date − ROW_NUMBER 得到岛标识；同一用户同一岛内日期连续。留存、TopN 也是窗口题。',
      inner: ROWC(270, 80, ['1/1', '1/2', '1/4', '1/5', '1/6'], { w: 70, pitch: 84, small: true, cls: { 0: 'ok', 1: 'ok', 2: 'hl', 3: 'hl', 4: 'hl' } }).svg
        + R(30, 150, 480, 70, 'vfill') + TX(270, 172, 'date − rn 相同 → 同一连续段；COUNT 得到连续天数', 'vts')
        + TX(270, 196, 'TopN 用 ROW_NUMBER / RANK，不要全局 LIMIT', 'vlbl'),
    }),
    scenarioFlow: () => ({
      w: 560, h: 250, name: '场景题答题骨架',
      cap: '先量化规模与一致性，再画主链路；然后按高扩展 / 高性能 / 高可用补齐，最后讲故障、对账和取舍。',
      inner: FLOWC(280, 66, ['规模/SLA', '主链路', '三高补齐', '故障与取舍'], { w: 120, h: 48, pitch: 132 })
        + R(30, 140, 500, 80, 'vfillok') + TX(280, 162, '扩展：拆分/分片/无状态     性能：缓存/异步/批量', 'vts')
        + TX(280, 186, '可用：超时重试、限流熔断、降级、对账补偿、RPO/RTO', 'vts'),
    }),
    scenarioCache: () => ({
      w: 560, h: 260, name: '缓存与 DB 一致性',
      cap: 'Cache Aside：先更 DB 再删缓存；失败靠 TTL 与对账。禁止无锁双写。热点用逻辑过期 + 单飞重建。',
      inner: NC(120, 80, 120, 46, '更新请求', 'hl') + AR(184, 80, 240, 80) + NC(310, 80, 110, 46, '写 MySQL', 'ok') + AR(369, 80, 420, 80) + NC(490, 80, 110, 46, '删 Redis')
        + R(30, 150, 500, 80, 'vfillwarn') + TX(280, 172, '删失败 ≠ 双写成功：让缓存过期，异步补偿删除', 'vts')
        + TX(280, 196, '近实时可用 binlog/CDC 更新缓存，但要处理乱序与回环', 'vlbl'),
    }),
    scenarioSeckill: () => ({
      w: 560, h: 260, name: '秒杀库存链路',
      cap: '前置拦截（限流/缓存库存）→ Redis 预扣（原子）→ MQ 异步下单 → DB 条件更新做最终一致；热点 key 要打散。',
      inner: FLOWC(280, 70, ['限流', 'Redis 预扣', 'MQ 下单', 'DB 条件更新'], { w: 128, h: 50, pitch: 138 })
        + R(30, 140, 500, 84, 'vfillwarn') + TX(280, 162, 'UPDATE stock SET s=s-1 WHERE id=? AND s>=1', 'vts')
        + TX(280, 186, '分段库存 / 随机扣减打散行锁；超卖用唯一订单号 + 回补库存', 'vlbl'),
    }),
    scenarioRate: () => ({
      w: 540, h: 240, name: '分布式限流',
      cap: '网关层粗限流 + 接口层细限流。滑动窗口用 ZSET；高 QPS 用令牌桶 / 计数器 Redis Lua，避免竞态。',
      inner: NC(140, 80, 140, 46, '网关配额', 'ok') + AR(214, 80, 270, 80) + NC(400, 80, 160, 46, '接口 Lua 原子', 'hl')
        + R(30, 150, 480, 60, 'vfill') + TX(270, 172, 'Key = rate:{api}:{user}；过期与窗口对齐；超限返回 429', 'vts')
        + TX(270, 194, '集群要避免“每实例各限一份”导致总配额翻倍', 'vlbl'),
    }),

    gapLock: () => ({
      w: 560, h: 250, name: 'Next-Key / 间隙锁',
      cap: 'RR 当前读会锁住扫描到的记录以及记录之间的间隙，阻止别人在范围内插入，从而避免幻读。',
      inner: ROWC(280, 80, ['(−∞, 10]', '10', '(10, 20]', '20', '(20, +∞)'], { w: 92, pitch: 102, small: true, cls: { 0: 'dim', 1: 'ok', 2: 'hl', 3: 'ok', 4: 'dim' } }).svg
        + R(30, 150, 500, 70, 'vfillwarn') + TX(280, 172, 'WHERE id > 10 AND id <= 20 FOR UPDATE', 'vts')
        + TX(280, 196, '锁住 10 与 20 的记录，以及 (10,20] 间隙；无索引时间隙会扩大', 'vlbl'),
    }),
    deadlockTx: () => ({
      w: 560, h: 250, name: '两事务交叉加锁',
      cap: 'T1 锁行 A 再等行 B，T2 锁行 B 再等行 A，形成环。InnoDB 检测后回滚代价较小的一方。',
      inner: NC(140, 70, 160, 46, 'T1 持有 A', 'ok') + NC(420, 70, 160, 46, 'T2 持有 B', 'hl')
        + PA('M220 92 C280 150 340 150 400 92', 'varrow') + PA('M400 48 C340 10 220 10 160 48', 'vcur')
        + R(30, 150, 500, 70, 'vfillwarn') + TX(280, 172, '约定全局加锁顺序：先小主键再大主键', 'vts')
        + TX(280, 196, 'SHOW ENGINE INNODB STATUS 看 LATEST DETECTED DEADLOCK', 'vlbl'),
    }),
    stateMachine: () => ({
      w: 560, h: 250, name: '订单 / 秒杀状态机',
      cap: '状态迁移必须 CAS：UPDATE ... WHERE id=? AND status=期望旧值。关单、支付、回补库存都走同一条件更新。',
      inner: NC(90, 80, 110, 46, 'CREATED', 'hl') + AR(148, 80, 200, 80) + NC(270, 80, 110, 46, 'PAID', 'ok')
        + AR(148, 100, 200, 150) + NC(270, 168, 110, 46, 'CLOSED', 'warn')
        + R(390, 56, 150, 140, 'vfill') + TX(465, 90, 'CAS 更新', 'vts') + TX(465, 118, '旧状态不匹配', 'vlbl') + TX(465, 142, '→ 0 行，幂等', 'vlbl')
        + LB(270, 226, '副作用（扣库存 / 关支付单）放 Outbox，不要写在 if 成功后的内存里'),
    }),
    explainCompare: () => ({
      w: 560, h: 250, name: 'EXPLAIN 对照',
      cap: '先看 type 和 key，再看 rows × filtered，最后看 Extra。ALL + Using filesort 通常就是慢 SQL 的现场。',
      inner: NC(150, 70, 210, 52, '坏：ALL + filesort', 'warn', 'vts')
        + NC(410, 70, 210, 52, '好：range + 覆盖索引', 'ok', 'vts')
        + R(30, 160, 500, 60, 'vfill') + TX(280, 182, '覆盖索引把回表打掉；深度分页用 seek 代替 OFFSET', 'vts')
        + TX(280, 204, 'MySQL 8 再用 EXPLAIN ANALYZE 看真实耗时', 'vlbl'),
    }),
    shardMigrate: () => ({
      w: 560, h: 250, name: '分片扩容时间表',
      cap: '预分片虚拟桶 → 双写窗口 → 校验 → 切读 → 下线旧片。不要“停服搬数据”。',
      inner: FLOWC(280, 70, ['预分片', '双写', '校验', '切读', '下线'], { w: 92, h: 46, pitch: 104 })
        + R(30, 148, 500, 70, 'vfillok') + TX(280, 170, '双写期以旧片为事实源，新片只补齐', 'vts')
        + TX(280, 194, '校验按主键抽样 + 全量 checksum，切读要可回滚', 'vlbl'),
    }),
    capacityCalc: () => ({
      w: 560, h: 250, name: '容量估算骨架',
      cap: '先写公式再代入数字。没有数字就用符号，但必须说出峰值系数、副本和缓存命中率。',
      inner: R(30, 40, 500, 180, 'vfill')
        + TX(280, 70, '峰值 QPS = DAU × 人均请求 / 86400 × 峰均比', 'vts')
        + TX(280, 102, '存储 = QPS × 对象字节 × TTL × 副本 / 命中率修正', 'vts')
        + TX(280, 134, 'DB TPS ≈ 写 QPS / 批量大小；连接数 ≈ 实例 × 池大小', 'vts')
        + TX(280, 166, '留 30%~50% 水位；用压测验证，不要用峰值理论值当上限', 'vlbl')
        + TX(280, 194, '强一致接口单独算读主比例，不要按全站缓存命中率打折', 'vlbl'),
    }),
    taskState: () => ({
      w: 560, h: 250, name: '任务状态机 + 抢占',
      cap: '扫描只找候选。真正执行前必须 CAS：UPDATE ... WHERE id=? AND status=可抢占状态。0 行说明被别人拿走。',
      inner: NC(90, 80, 110, 46, 'PENDING', 'hl') + AR(148, 80, 200, 80) + NC(270, 80, 120, 46, 'RUNNING', 'ok')
        + AR(334, 80, 390, 80) + NC(470, 80, 110, 46, 'SUCCESS', 'ok')
        + AR(270, 104, 270, 148) + NC(270, 176, 120, 46, 'RETRY/DEAD', 'warn')
        + LB(270, 226, 'locked_until 过期可被回收，所以业务必须幂等'),
    }),
        fallback: (p) => ({
        w: 520, h: 220, name: '通用解题流程',
        cap: '先复述输入输出与约束，再说明选择的模型与不变量，最后给出实现、复杂度与边界验证。',
        inner: FLOWC(260, 66, ['读题定约束', '选模型 / 不变量', '写实现', '验复杂度与边界'], { w: 112, h: 50, pitch: 128 })
          + R(30, 132, 460, 60, 'vfillok') + TX(260, 156, '本题核心：' + String(p.idea || '先明确状态与不变量'), 'vts')
          + TX(260, 178, '再把思路落到代码，并说明时间 / 空间复杂度', 'vlbl'),
      }),
    };

    // 说明：匹配前统一去掉空白与大小写，因此正则里不写空格（"第 K 个" → 第k个）
    /* ===== 图解动效：每个题型的关键「运动轨迹」，用移动标记把核心思路演出来 ===== */
    const VIZ_MOTION = {
      hashLookup: { path: [[132, 90], [348, 90], [240, 196]], dur: 4.6 },
      hashGroup: { path: [[93, 74], [387, 74], [240, 145], [148, 222]], dur: 5 },
      twoPointerOpposite: { paths: [[[65, 130], [240, 130]], [[415, 130], [240, 130]]], dur: 3.4, alt: true },
      twoPointerSame: { paths: [[[100, 120], [380, 120]], [[100, 120], [262, 120]]], dur: 3.6, alt: true },
      slideWindow: { path: [[74, 120], [446, 120]], dur: 3.6, alt: true },
      prefixSum: { path: [[96, 130], [384, 130], [240, 224]], dur: 4.4 },
      monotonicQueue: { path: [[468, 110], [72, 110]], dur: 4.4, alt: true },
      prefixMono: { path: [[126, 100], [414, 100], [270, 204]], dur: 4.4, alt: true },
      interval: { path: [[60, 118], [410, 118]], dur: 3.6, alt: true },
      matrixSpiral: { path: [[150, 80], [274, 80], [274, 192], [150, 192], [150, 136]], dur: 5.4, alt: true },
      gridFlood: { path: [[110, 80], [296, 80], [296, 134], [110, 134]], dur: 4.4, alt: true },
      linkedReverse: { path: [[400, 100], [250, 100], [100, 100]], dur: 3.6, alt: true },
      linkedFastSlow: { path: [[80, 104], [440, 104]], dur: 3.4, alt: true },
      linkedCycle: { path: [[90, 80], [390, 80], [390, 152], [90, 152]], dur: 4.6 },
      linkedMerge: { path: [[190, 116], [322, 116], [190, 176], [322, 176]], dur: 4.6, alt: true },
      cacheLRU: { path: [[150, 76], [300, 90], [480, 90], [300, 90]], dur: 4.6, alt: true },
      treeDfs: { path: [[230, 60], [150, 134], [230, 60], [310, 134], [230, 60]], dur: 5 },
      treeLevel: { path: [[240, 60], [160, 130], [320, 130]], dur: 3.8, alt: true },
      treeBst: { path: [[235, 62], [155, 136], [315, 136]], dur: 3.8, alt: true },
      treePath: { path: [[240, 60], [160, 130], [240, 60], [320, 130]], dur: 4.4 },
      graphBfs: { path: [[90, 120], [220, 76], [220, 170], [360, 120]], dur: 4.8, alt: true },
      topoSort: { path: [[110, 100], [430, 100]], dur: 3.4, alt: true },

      trie: { path: [[230, 60], [140, 126], [70, 192], [230, 60], [320, 126], [195, 192]], dur: 5.6 },
      backtrackSubset: { path: [[270, 50], [170, 112], [100, 174], [170, 112], [270, 50], [370, 112], [430, 174]], dur: 6, alt: true },
      backtrackPermute: { path: [[100, 76], [340, 76]], dur: 3.4, alt: true },
      backtrackBoard: { path: [[205, 66], [263, 116], [321, 166], [379, 216]], dur: 4.4, alt: true },
      binSearchExact: { paths: [[[80, 130], [260, 130]], [[440, 130], [260, 130]]], dur: 3.4, alt: true },
      binSearchBoundary: { path: [[80, 130], [440, 130]], dur: 3.8, alt: true },
      binSearchAnswer: { path: [[95, 54], [260, 54], [425, 54], [260, 108], [260, 190]], dur: 5.2, alt: true },
      sortPartition: { path: [[106, 130], [250, 130], [394, 130]], dur: 3.8, alt: true },
      sortMerge: { path: [[100, 130], [280, 130], [420, 130], [400, 190]], dur: 4.6, alt: true },
      heapTopK: { path: [[160, 124], [250, 60], [340, 124]], dur: 3.8, alt: true },
      stackLifo: { path: [[230, 232], [230, 100]], dur: 3.2, alt: true },
      greedyInterval: { path: [[105, 97], [375, 97]], dur: 3.6, alt: true },
      dpLinear: { path: [[108, 130], [412, 130]], dur: 3.8, alt: true },
      dpGrid: { path: [[160, 76], [376, 76], [376, 132], [160, 132], [160, 188], [376, 188]], dur: 6, alt: true },
      dpKnapsack: { path: [[400, 60], [120, 60]], dur: 3.4, alt: true },
      dpString: { path: [[160, 100], [376, 100], [160, 148], [376, 148], [160, 196]], dur: 5.4, alt: true },
      dpStock: { path: [[140, 110], [390, 110]], dur: 3.4, alt: true },

      bitOps: { path: [[128, 80], [392, 80]], dur: 3.6, alt: true },
      mathNumber: { path: [[156, 62], [324, 62]], dur: 3.2, alt: true },
      geometry: { path: [[150, 160], [320, 70], [410, 170]], dur: 4.6, alt: true },
      randomProb: { path: [[132, 80], [388, 80]], dur: 3.6, alt: true },
      mlAttention: { path: [[80, 80], [210, 80], [370, 80], [270, 159]], dur: 4.8, alt: true },
      designPattern: { path: [[250, 56], [140, 140], [250, 56], [360, 140]], dur: 4.4 },
      concurrency: { path: [[73, 60], [487, 60]], dur: 3.8, alt: true },
      arraySim: { path: [[106, 100], [394, 100]], dur: 3.6, alt: true },
      stringMatch: { path: [[136, 100], [384, 100]], dur: 3.6, alt: true },

      rainTwoPointer: { paths: [[[68, 120], [250, 120]], [[452, 120], [270, 120]]], dur: 3.6, alt: true },
      matrixSearch: { path: [[284, 86], [222, 86], [222, 142], [160, 198]], dur: 4.8, alt: true },
      linkedIntersect: { paths: [[[150, 70], [330, 110]], [[150, 170], [330, 110]]], dur: 3.8, alt: true },
      linkedCopy: { path: [[90, 80], [180, 80], [380, 80]], dur: 3.6, alt: true },
      dutchFlag: { paths: [[[70, 120], [180, 120]], [[430, 120], [320, 120]]], dur: 3.6, alt: true },
      nextPerm: { path: [[394, 96], [178, 96], [322, 96]], dur: 4.2, alt: true },
      treeLca: { path: [[160, 126], [240, 56], [320, 126]], dur: 4.2 },
      sqlOrder: { path: [[68, 40], [492, 40], [280, 162]], dur: 5, alt: true },
      btreeIndex: { path: [[140, 70], [380, 70], [380, 152]], dur: 4.2, alt: true },
      indexLeftmost: { path: [[170, 80], [370, 80]], dur: 3.4, alt: true },
      mvccLock: { path: [[140, 80], [400, 80], [270, 172]], dur: 4.4, alt: true },
      redoBinlog: { path: [[130, 42], [280, 42], [430, 42]], dur: 4.2, alt: true },
      replication: { path: [[110, 80], [300, 80], [490, 80]], dur: 4.2, alt: true },
      sharding: { path: [[120, 80], [270, 80], [420, 80]], dur: 3.8, alt: true },
      outboxViz: { path: [[82, 42], [214, 42], [346, 42], [478, 42]], dur: 4.8, alt: true },
      sqlWindow: { path: [[102, 80], [438, 80]], dur: 3.6, alt: true },
      scenarioFlow: { path: [[82, 36], [478, 36], [280, 162]], dur: 4.8, alt: true },
      scenarioCache: { path: [[120, 80], [310, 80], [490, 80]], dur: 4.2, alt: true },
      scenarioSeckill: { path: [[82, 36], [478, 36], [280, 162]], dur: 4.8, alt: true },
      scenarioRate: { path: [[140, 80], [400, 80], [270, 172]], dur: 4.2, alt: true },
      gapLock: { path: [[86, 80], [474, 80], [280, 172]], dur: 4.6, alt: true },
      deadlockTx: { path: [[140, 70], [420, 70], [280, 172]], dur: 4.2, alt: true },
      stateMachine: { path: [[90, 80], [270, 80], [270, 168]], dur: 4.4, alt: true },
      explainCompare: { path: [[150, 70], [410, 70], [280, 182]], dur: 4.2, alt: true },
      shardMigrate: { path: [[72, 70], [488, 70], [280, 170]], dur: 4.8, alt: true },
      capacityCalc: { path: [[280, 70], [280, 166]], dur: 3.6, alt: true },
      taskState: { path: [[90, 80], [270, 80], [470, 80], [270, 176]], dur: 4.6, alt: true },
      fallback: { path: [[68, 66], [452, 66], [260, 156]], dur: 4.6, alt: true },
    };

    function buildVizMotionCss() {
      let css = '';
      Object.keys(VIZ_MOTION).forEach((key) => {
        const m = VIZ_MOTION[key];
        (m.paths || [m.path]).forEach((p, idx) => {
          const x0 = p[0][0], y0 = p[0][1];
          const frames = p.map((pt, i) => Math.round((i / (p.length - 1)) * 100) + '%{transform:translate(' + Math.round(pt[0] - x0) + 'px,' + Math.round(pt[1] - y0) + 'px)}').join('');
          css += '@keyframes vm-' + key + '-' + idx + '{' + frames + '}';
        });
      });
      return css;
    }

    function injectVizMotion() {
      if (document.getElementById('viz-motion-style')) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const style = document.createElement('style');
      style.id = 'viz-motion-style';
      style.textContent = buildVizMotionCss();
      document.head.appendChild(style);
    }

    function moverSvg(key, motion) {
      const paths = motion.paths || [motion.path];
      return paths.map((p, idx) => {
        const x = p[0][0], y = p[0][1];
        const dir = motion.alt ? ' alternate' : '';
        return '<g class="vmover" style="animation:vm-' + key + '-' + idx + ' ' + (motion.dur || 3.6) + 's ease-in-out infinite' + dir + '">'
          + '<circle class="vmover-halo" cx="' + x + '" cy="' + y + '" r="15"/>'
          + '<circle class="vmover-dot" cx="' + x + '" cy="' + y + '" r="7.5"/></g>';
      }).join('');
    }

    function staggerViz(svg) {
      const nodes = svg.querySelectorAll('.vcell, .vbox, text, .vline, .vdash, .varrow, .vcur, .vwin');
      nodes.forEach((node, i) => { node.style.animationDelay = Math.min(i * 26, 1300) + 'ms'; });
    }

    function wireViz() {
      detailEl.querySelectorAll('.viz').forEach((fig) => {
        const svg = fig.querySelector('svg');
        if (svg) staggerViz(svg);
        const btn = fig.querySelector('.viz-replay');
        if (!btn) return;
        btn.addEventListener('click', () => {
          const cur = fig.querySelector('svg');
          if (!cur) return;
          const fresh = cur.cloneNode(true);
          cur.replaceWith(fresh);
          staggerViz(fresh);
        });
      });
    }

    const VIZ_HINT = [
      [/最小的n：|任意乘法/, 'mathNumber'],
      [/快速排序/, 'sortPartition'],
      [/多数元素/, 'arraySim'],
      [/矩阵置零/, 'arraySim'],
      [/扑克牌中的顺子/, 'arraySim'],
      [/按概率随机|cdf/, 'binSearchExact'],
      [/有序矩阵中第k小|kth-smallest-element-in-a-sorted-matrix/, 'binSearchAnswer'],
      [/第三范式|3nf/, 'sqlOrder'],
      [/唯一索引|幂等设计/, 'outboxViz'],
      [/补偿扫描|中间态任务/, 'taskState'],
      [/接雨水/, 'rainTwoPointer'],
      [/搜索二维矩阵/, 'matrixSearch'],
      [/相交链表/, 'linkedIntersect'],
      [/随机链表|复制带随机/, 'linkedCopy'],
      [/回文链表|重排链表/, 'linkedReverse'],
      [/倒数第/, 'linkedFastSlow'],
      [/二叉树的最近公共祖先/, 'treeLca'],
      [/下一个排列/, 'nextPerm'],
      [/颜色分类/, 'dutchFlag'],
      [/路径总和(?!ii|iii)/, 'treePath'],
      [/sql逻辑|执行顺序/, 'sqlOrder'],
      [/b\+tree|聚簇索引|回表/, 'btreeIndex'],
      [/联合索引|最左前缀|索引失效/, 'indexLeftmost'],
      [/explain/, 'explainCompare'],
      [/隔离级别|mvcc|幻读/, 'mvccLock'],
      [/redo|undo|binlog/, 'redoBinlog'],
      [/主从复制|读写分离/, 'replication'],
      [/分库分表/, 'shardMigrate'],
      [/outbox|幂等消费/, 'outboxViz'],
      [/连续登录|留存率|topn|第n高薪/, 'sqlWindow'],
      [/库存扣减|超卖/, 'scenarioSeckill'],
      [/缓存与mysql|缓存一致性|redis挂了|本地缓存/, 'scenarioCache'],
      [/秒杀/, 'scenarioSeckill'],
      [/qps评估|流量预估|容量压测|500gb/, 'capacityCalc'],
      [/订单未支付|超时自动关闭/, 'stateMachine'],
      [/限流/, 'scenarioRate'],
      [/答题框架|高扩展|高可用/, 'scenarioFlow'],
      [/二叉树展开为链表/, 'treeDfs'],
      [/分割等和子集/, 'dpKnapsack'],
      [/前缀树|trie|添加与搜索单词|单词搜索ii/, 'trie'],
      [/课程表|拓扑排序|课程安排/, 'topoSort'],

      [/最长有效括号/, 'stackLifo'],
      [/lru|lfu|缓存/, 'cacheLRU'],
      [/寻找重复数|环形链表|linked-list-cycle/, 'linkedCycle'],
      [/岛屿|腐烂的橘子|被围绕的区域|矩阵中的路径|单词搜索|生命游戏|扫雷/, 'gridFlood'],
      [/旋转图像|螺旋矩阵|z字形变换|对角线遍历/, 'matrixSpiral'],
      [/合并区间|插入区间|无重叠区间|用最少数量的箭引爆气球|会议室|汇总区间|包含的区间/, 'interval'],
      [/滑动窗口最大值|单调队列/, 'monotonicQueue'],
      [/滑动窗口|无重复字符的最长子串|最小覆盖子串|长度最小的子数组|找到字符串中所有字母异位词|水果成篮|至少有k个重复|串联所有单词/, 'slideWindow'],
      [/和至少为k的最短/, 'prefixMono'],
      [/和为k的子数组|前缀和|和至少为k/, 'prefixSum'],
      [/two-sum-ii|两数之和ii/, 'twoPointerOpposite'],
      [/two-sum|两数之和/, 'hashLookup'],
      [/三数之和|四数之和|最接近的三数|3sum|有效三角形/, 'twoPointerOpposite'],
      [/移动零|移除元素|删除有序数组中的重复项|压缩字符串/, 'twoPointerSame'],
      [/有序数组的平方|盛最多水的容器|验证回文串|最长回文串|合并两个有序数组/, 'twoPointerOpposite'],
      [/最长连续序列|丢失的数字|找不同|两个数组的交集|存在重复元素|anagram|异位词|hashmap|hashset/, 'hashGroup'],
      [/反转链表|k个一组翻转|两两交换|reverse-nodes|reverse-linked/, 'linkedReverse'],
      [/环形链表|linked-list-cycle/, 'linkedCycle'],
      [/合并两个有序链表|两数相加|排序链表|合并k个升序|删除排序链表中的重复/, 'linkedMerge'],
      [/链表/, 'linkedFastSlow'],
      [/层序遍历|level-order|右视图|锯齿形|zigzag/, 'treeLevel'],
      [/二叉搜索树的最近公共祖先|二叉搜索树|binary-search-tree|bst-|验证二叉|搜索树中第k小|修剪二叉|有序数组转换|搜索树/, 'treeBst'],
      [/路径总和ii|路径总和iii|所有路径|求根节点到叶节点/, 'treePath'],
      [/二叉树|flip-binary-tree|symmetric-tree|前序遍历|中序遍历|后序遍历|最大深度|最小深度|对称|直径|最大路径和|相同的树|子树|剪枝|最长同值路径/, 'treeDfs'],
      [/克隆图|单词接龙/, 'graphBfs'],
      [/n皇后|解数独|数独/, 'backtrackBoard'],
      [/全排列|排列/, 'backtrackPermute'],
      [/子集|组合总和|括号生成|字母组合|分割回文串|组合/, 'backtrackSubset'],
      [/回溯/, 'backtrackSubset'],
      [/旋转排序数组|寻找峰值|峰值元素|旋转数组|寻找两个正序数组的中位数/, 'binSearchBoundary'],
      [/二分查找|binary-search|搜索插入位置|x的平方根|有效的完全平方数|第一个和最后一个位置|有序数组中的单一元素/, 'binSearchExact'],
      [/爱吃香蕉|分割数组的最大值|最小除数|运送包裹|第k小的数对距离|乘法表中第k小|准时到达|可移除字符|最小速度|最小时间|有序矩阵中第k小/, 'binSearchAnswer'],
      [/数组中的第k|第k个最大|kth-largest|quickselect/, 'sortPartition'],
      [/前k个高频|top-k-frequent|最大的k个|数据流的中位数|median-finder|合并n个有序数组|堆排序/, 'heapTopK'],
      [/排序数组|排序链表|逆序对|归并|merge-sort/, 'sortMerge'],
      [/有效的括号|最小栈|逆波兰|字符串解码|简化路径|每日温度|柱状图中最大的矩形|基本计算器|括号匹配/, 'stackLifo'],
      [/跳跃游戏|分发饼干|加油站|划分字母区间|买卖股票的最佳时机ii|分割平衡字符串/, 'greedyInterval'],
      [/最长公共子串|编辑距离|最长公共子序列|通配符匹配|正则表达式匹配|最长回文子串|回文子串|不同的子序列|最长重复子数组/, 'dpString'],
      [/背包|零钱兑换|分割等和子集|单词拆分|目标和|完全平方数|硬币/, 'dpKnapsack'],
      [/不同路径|最小路径和|最大正方形|三角形最小路径和|下降路径|地下城游戏/, 'dpGrid'],
      [/股票|stock/, 'dpStock'],

      [/异或|只出现一次|位1的个数|汉明距离|颠倒二进制位|二进制求和|格雷编码/, 'bitOps'],
      [/最长递增子序列|最大子数组和|乘积最大子数组|打家劫舍|爬楼梯|最大子序|杨辉三角/, 'dpLinear'],
      [/注意力|attention|softmax|多头|transformer|神经网络|embedding|auc|交叉熵|kl散度/, 'mlAttention'],
      [/单例|设计模式|工厂模式|策略模式|观察者|装饰器|代理模式/, 'designPattern'],
      [/多线程|并发|线程|按序打印|阻塞队列|交替打印|哲学家/, 'concurrency'],
      [/pow|最小的n|计数质数|最大公约数|阶乘|快速幂|数论|罗马数字|整数反转|回文数|excel表列|快乐数|两数相除|plus-one|字典序的第k小|约瑟夫|破冰游戏|乒乓球/, 'mathNumber'],
      [/叉积|共线|凸包|直线|矩形面积|几何|正方形|点在多边形/, 'geometry'],
      [/随机|洗牌|shuffle|rand|概率|采样|蓄水池/, 'randomProb'],
      [/字符串|压缩|最长公共前缀|外观数列|字符串相加|翻转字符串|atoi|比较版本号|整数转/, 'stringMatch'],
      [/数组|矩阵|轮转/, 'arraySim'],
      [/树|二叉/, 'treeDfs'],
    ];
    // 题型关键词没命中时，按算法分类兜底
    const CAT_VIZ = {
      '哈希': 'hashGroup', '双指针': 'twoPointerOpposite', '滑动窗口': 'slideWindow', '前缀和': 'prefixSum',
      '子串': 'slideWindow', '字符串': 'stringMatch', '普通数组': 'arraySim', '区间': 'interval',
      '矩阵': 'matrixSpiral', '链表': 'linkedFastSlow', '二叉树': 'treeDfs', '图论': 'graphBfs',
      '计算几何': 'geometry', '数学与数论': 'mathNumber', '回溯': 'backtrackSubset', '二分查找': 'binSearchExact',
      '分治': 'sortPartition', '排序': 'sortMerge', '栈': 'stackLifo', '堆': 'heapTopK', '贪心': 'greedyInterval',
      '动态规划': 'dpLinear', '多维动态规划': 'dpGrid', '概率与随机': 'randomProb', '技巧': 'bitOps',
      '机器学习基础': 'mlAttention', 'Java 设计模式': 'designPattern', '并发': 'concurrency',
    };

    const CAT_VIZ_DB = {
      '第一章：SQL 基础与统计手撕': 'sqlWindow',
      '第二章：索引与查询优化': 'btreeIndex',
      '第三章：事务、锁与日志': 'mvccLock',
      '第四章：高可用、一致性与分库分表': 'replication',
      '第五章：项目定制表设计': 'outboxViz',
      '手撕题总览': 'sqlOrder',
    };
    const CAT_VIZ_SCENE = {
      '架构场景题': 'scenarioFlow',
      '第一章：基础手写与数据结构': 'heapTopK',
      '第二章：设计模式专题': 'designPattern',
      '第三章：Java 并发与任务调度': 'concurrency',
      '第四章：Redis 与分布式基础': 'scenarioCache',
      '第五章：MQ 可靠性与削峰治理': 'outboxViz',
      '第六章：项目定制系统设计': 'scenarioFlow',
      '手撕题总览': 'scenarioFlow',
    };

    function pickVizKey(p) {
      if (p.vizKey) return p.vizKey;
      const title = (p.title + ' ' + (p.slug || '')).toLowerCase().replace(/\s+/g, '');
      for (const [re, key] of VIZ_HINT) { if (re.test(title)) return key; }
      if (p.kind === 'database') return CAT_VIZ_DB[p.category] || 'sqlOrder';
      if (p.kind === 'scenario' || p.kind === 'handwrite') return CAT_VIZ_SCENE[p.category] || 'scenarioFlow';
      return CAT_VIZ[p.category] || 'fallback';
    }

    const DEEPEN = {
      'database-72': { title: 'WHERE / HAVING / 别名', points: [
        '行条件放 WHERE，聚合条件放 HAVING。能在分组前滤掉就不要拖到分组后。',
        '外连接时，右表条件放 WHERE 会把 NULL 行滤掉，LEFT JOIN 退化成 INNER JOIN；应放在 ON。',
        '逻辑顺序用于理解语义；物理顺序看 EXPLAIN，优化器会谓词下推和 Join 重排。'
      ]},
      'database-74': { title: '销冠 SQL 口径', points: [
        'GROUP BY 用稳定 ID（merchant_id, product_id），不要只按名称。',
        '并列第一用 RANK()；只要一条用 ROW_NUMBER() 并加 product_id 作为稳定排序。',
        '金额用 DECIMAL，不要 FLOAT。时间条件走订单创建时间还是支付时间要先问清。'
      ]},
      'database-76': { title: '连续登录的边界', points: [
        '同一天多次登录要 DATE() 去重，否则岛会被拆碎或被放大。',
        '跨时区：用业务约定时区转日期，不要直接 DATE(login_time) 用会话时区。',
        'date − ROW_NUMBER 只在“一天一行”时成立；缺签、补签要先问产品口径。',
        '求最大连续天数：按岛 GROUP BY 后 COUNT(*)，再取 MAX；求当前连续则只看包含今天的岛。'
      ], sql: [
        { label: '去重后求最大连续天数', code: "WITH d AS (\n  SELECT user_id, DATE(login_time) AS dt\n  FROM login_log GROUP BY user_id, DATE(login_time)\n), island AS (\n  SELECT user_id, dt,\n         DATE_SUB(dt, INTERVAL ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY dt) DAY) AS grp\n  FROM d\n)\nSELECT user_id, MAX(cnt) AS max_streak\nFROM (\n  SELECT user_id, grp, COUNT(*) AS cnt FROM island GROUP BY user_id, grp\n) t\nGROUP BY user_id;" }
      ]},
      'database-77': { title: '留存率分母', points: [
        '次日留存分母是“当天注册用户”，分子是“这些用户在 D+1 有登录”。不要把当天没登录的注册用户踢出分母。',
        'LEFT JOIN 登录表，用 COUNT(DISTINCT 注册用户) 做分母，COUNT(DISTINCT 次日有登录) 做分子。',
        '自然日还是 24 小时窗口必须先定口径；活动投放还要按渠道拆。'
      ]},
      'database-78': { title: 'TopN 窗口选择', points: [
        'ROW_NUMBER 不保留并列；RANK 并列且跳号；DENSE_RANK 并列不跳号。面试先问要不要并列。',
        '部门 TopN：PARTITION BY dept_id ORDER BY salary DESC。不能全局 LIMIT。',
        '第 N 高薪：DENSE_RANK = N；若“严格第 N 个不同值”才用 DENSE_RANK。'
      ]},
      'database-80': { title: '回表代价 / 覆盖索引 / ICP', points: [
        '回表次数 ≈ 扫描行数。二级索引过滤性差时，回表可能比扫聚簇索引更慢，优化器会放弃该索引。',
        '覆盖索引：SELECT 列都在二级索引里（Using index）。流水查询 (user_id, created_at, amount) 是典型覆盖索引。',
        'ICP：引擎在回表前用索引字段过滤，Extra 出现 Using index condition。',
        '加了索引还慢：看 type/rows/filtered，再看是否回表、filesort、临时表。'
      ]},
      'database-81': { title: '联合索引怎么排', points: [
        '等值列在前、范围列在后：WHERE a=? AND b=? AND c>10 建 (a,b,c)。',
        '最左列必须是查询总会带上的列，区分度高但查询不带，索引等于没建。',
        'ORDER BY 要与索引列顺序、方向一致，中间不能被范围条件断开。'
      ]},
      'database-83': { title: 'EXPLAIN 怎么下结论', extraViz: 'explainCompare', table: {
        title: '常见 Extra 对照',
        headers: ['Extra', '含义', '怎么办'],
        rows: [
          ['Using index', '覆盖索引，不回表', '保持 SELECT 列在索引内'],
          ['Using index condition', 'ICP，回表前过滤', '把过滤列加进联合索引'],
          ['Using filesort', '额外排序', '让 ORDER BY 走索引'],
          ['Using temporary', '临时表', '避免 DISTINCT/GROUP BY 打宽'],
          ['Using where', '引擎层再过滤', '检查索引能否覆盖该条件']
        ]
      }, points: [
        'type：const/ref/range 可接受；index 扫索引全量；ALL 必须解释原因。',
        'key 为 NULL 就是没走预期索引；rows × filtered 约等于返回/回表量。',
        'MySQL 8 用 EXPLAIN ANALYZE 看真实耗时，避免估算 rows 很小、实际扫很多。'
      ]},
      'database-84': { title: '深度分页', points: [
        'OFFSET 100000 会扔掉前 10 万行。改成 WHERE id > last_id ORDER BY id LIMIT n。',
        '非主键排序：用 (sort_col, id) 作为 seek 键，下一页带上上一页最后一行的这两个值。',
        '业务允许的话做延迟关联：子查询只取主键，再回表取列。'
      ], sql: [
        { label: 'seek 分页', code: "SELECT * FROM orders\nWHERE (created_at, id) < (?, ?)\nORDER BY created_at DESC, id DESC\nLIMIT 20;" }
      ]},
      'database-86': { title: '慢 SQL 现场', extraViz: 'explainCompare', sql: [
        { label: '典型坏 SQL', code: "SELECT * FROM orders\nWHERE DATE(created_at) = '2026-09-20'\nORDER BY amount DESC LIMIT 20;" },
        { label: '改写', code: "SELECT * FROM orders\nWHERE created_at >= '2026-09-20'\n  AND created_at <  '2026-09-21'\nORDER BY amount DESC LIMIT 20;" }
      ], points: [
        'DATE(created_at) 让索引失效。改成范围条件。',
        'SELECT * 让覆盖索引用不上。只取需要的列。',
        '先 EXPLAIN，再看慢日志 rows_examined，最后用 ANALYZE 验证。'
      ]},
      'database-87': { title: '库存扣减的锁与死锁', extraViz: 'deadlockTx', sql: [
        { label: '条件更新防超卖', code: "UPDATE sku_stock\nSET stock = stock - 1, version = version + 1\nWHERE sku_id = ? AND stock >= 1;" },
        { label: '交叉加锁会死锁', code: "-- T1\nUPDATE sku_stock SET stock=stock-1 WHERE sku_id=1 AND stock>=1;\nUPDATE sku_stock SET stock=stock-1 WHERE sku_id=2 AND stock>=1;\n-- T2 若先 2 后 1，形成环。约定按 sku_id 升序加锁。" }
      ], points: [
        '检查和写入做成一次当前读，避免先 SELECT 再 UPDATE 的窗口。',
        '多行扣减按主键升序加锁。死锁日志看 SHOW ENGINE INNODB STATUS。',
        '热点 SKU 拆成 stock_seg，随机选段扣减，再汇总展示库存。'
      ]},
      'database-88': { title: 'RR 幻读到底有没有被解决', extraViz: 'gapLock', points: [
        '快照读：同一事务 Read View 不变，普通 SELECT 看不到后续插入，幻读被 MVCC 挡住。',
        '当前读：靠 Next-Key Lock 锁记录+间隙。没有索引时锁范围会扩大到很多间隙。',
        'RC 每条语句新 Read View；当前读仍加锁，但默认不加间隙锁（以官方文档为准）。',
        '长事务让 Read View 不释放，undo 不能 purge，查询和 DDL 都会变慢。'
      ]},
      'database-89': { title: '崩溃恢复怎么判断提交还是回滚', points: [
        'redo prepare 有、binlog 没有：回滚。',
        'redo prepare 有、binlog 也有：提交，否则从库会多数据。',
        'redo commit 有：事务已成功，崩溃后 redo 补脏页。',
        '生产 binlog 优先 ROW；STATEMENT 遇到 UUID()/NOW() 可能主从不一致。'
      ]},
      'database-91': { title: '主从延迟与半同步', points: [
        '异步复制 RPO 可能丢最后一小段；半同步至少一个从库收到 binlog 才返回。',
        '不要只看 Seconds_Behind_Master：写心跳表，比较从库读到的 ts。',
        '读己之写：WAIT_FOR_EXECUTED_GTID_SET，或该用户短窗口强制读主。',
        '并行复制提高吞吐，但大事务、DDL、热点行仍会卡住。'
      ]},
      'database-92': { title: '分片键、跨片查询与扩容', extraViz: 'shardMigrate', steps: [
        '按最高频等值查询选分片键，预分片虚拟桶（例如 1024 桶）。',
        '扩容双写：旧片仍是事实源，新片异步补齐。',
        '校验：主键抽样 + checksum；失败则延长双写，不要切读。',
        '切读可回滚；观察错误率和延迟后再下线旧片。'
      ], points: [
        'order_id 查询用基因法或映射表，禁止散弹。',
        '跨片分页用 (created_at, id) 各片取一页再归并。'
      ], links: [
        { id: 'database-93', label: 'Outbox 表设计' },
        { id: 'scenario-distributed-scheduler', label: '调度分片抢占' }
      ]},
      'database-93': { title: 'Outbox 和消费幂等', points: [
        '业务行和 outbox 同一本地事务。禁止先提交再发 MQ。',
        '扫描器按 next_retry_at 拉取 NEW/FAILED，投递成功标记 SENT。',
        '消费表 UNIQUE(message_id)。允许重复投递，处理成功才确认。'
      ], links: [
        { id: 'handwrite-64', label: '可靠异步消息手撕' },
        { id: 'scenario-order-timeout-close', label: '关单副作用' }
      ]},
      'scenario-design-framework': { extraViz: 'capacityCalc', formulaTitle: '三高答题时先写公式', formulas: [
        '峰值 QPS = DAU × 人均请求 / 86400 × 峰均比（常见 3~5）',
        '带宽 = 峰值 QPS × 均包大小 × 副本 / 压缩比',
        '存储 = 日增量 × 保留天数 × 副本 × (1 + 索引开销 0.3~1.0)',
        'DB 连接 ≈ 实例数 × 池大小；池大小先按 (QPS × 平均 RT) 估并发'
      ], points: [
        '先问清规模和一致性，再画主链路，最后用三高检查遗漏。',
        '没有数字就写符号，但必须说出峰均比、副本、命中率和水位。'
      ]},
      'scenario-realtime-music-ranking': { extraViz: 'capacityCalc', formulas: [
        '写入 QPS ≈ 在线播放人数 × 心跳或进度上报频率',
        'ZSET 内存 ≈ 歌曲数 × (score 8B + member + skiplist 开销) × 分片',
        'HASH 聚合窗口 1s 可把写放大打到 1/频率'
      ], dbDesign: [
        'play_event 按天分区只追加；rank_snapshot(day, song_id, plays, captured_at) 对账。',
        'song 维表过滤下架；排行不能只信 ZSET。'
      ], links: [
        { id: 'handwrite-46', label: '海量 Top K 手撕' },
        { id: '347', label: '前 K 高频（算法）' }
      ], title: '排行榜落到存储', points: [
        '实时榜 Redis ZSET；DB 只吃快照和对账。',
        '跨天双 key；防刷短窗口去重放 Redis，审计异步落库。'
      ]},
      'scenario-live-comment-system': { extraViz: 'capacityCalc', formulas: [
        '广播带宽 = 在线人数 × 单条评论大小 × 评论 QPS / 房间数均值',
        '房间热点：头部房间占 80% 流量，单独分区 / 单独网关'
      ], dbDesign: [
        'comment(room_id, seq, user_id, content, created_at)，主键 (room_id, seq)。',
        'seq 用房间级 Redis INCR；历史按 room_id 分区，冷数据归档对象存储。',
        '敏感词审核状态走异步，先展示后打标，避免同步审核拖垮推送。'
      ], title: '直播评论的房间分片', points: [
        '推送走网关分区，不要一个 MQ topic 广播全站。',
        '历史拉取按 seq 向下 seek，禁止 OFFSET。',
        '房间关闭后停止写入并切只读缓存。'
      ], links: [
        { id: 'database-84', label: 'seek 分页' },
        { id: 'handwrite-64', label: '可靠消息' }
      ]},
      'scenario-lan-distribute-500gb': { formulas: [
        '单机满速 ≈ min(磁盘顺序读, 网卡, 对端写盘)',
        'P2P：有数据的节点数越多，聚合下载带宽越接近 N × 单机网卡'
      ], title: '先测瓶颈再谈协议', points: [
        '500GB 在千兆网上单点约 1.1 小时，先确认是网卡还是磁盘。',
        '分块 + 校验 + 断点；有数据的节点加入种子，避免中心带宽打满。'
      ]},
      'scenario-single-machine-counter': [
        ['用 synchronized 关键字', '实现最简单；但高并发下性能差'],
        ['用 AtomicLong', '无锁、性能好；但高并发下仍有 CAS 竞争'],
        ['用 LongAdder', '高并发性能最好；但sum() 不是实时的（最终一致）'],
      ],
      'scenario-distributed-scheduler': { dbDesign: [
        'job(id, shard_key, status, next_run_at, lease_owner, lease_expire_at, retry_count, timeout_ms)。',
        '索引 (status, shard_key, next_run_at)；job_log 按时间分区。'
      ], title: '抢占、租约、分片', points: [
        'UPDATE ... WHERE status=WAITING AND next_run_at<=now() 限行抢占。',
        '执行中靠 lease_expire_at 续约；超时可被别人回收。',
        '按 slot 认领，避免全表抢锁。'
      ], links: [
        { id: 'database-92', label: '分库分表' },
        { id: 'handwrite-59', label: '定时调度器手撕' }
      ]},
      'scenario-service-prewarm': { formulas: [
        '预热 QPS 上限 = DB 只读容量 × 70%，拉长窗口而不是启动瞬间打满',
        '缓存命中率目标先定，再反推必须预热的 key 集合大小'
      ], title: '预热不要打崩 DB', points: [
        '按热点榜 / 前一天 top key 预热，不要全量。',
        '发布时分批、带限流；失败可重试，成功打标记避免重复预热。'
      ]},
      'scenario-external-dependency-isolation': { title: '隔离仓与超时', points: [
        '独立线程池 / 连接池 / 舱壁，避免合作方 RT 升高占满自己的 Tomcat 线程。',
        '超时 < 对方 P99，重试只给幂等读；熔断后返回降级数据。',
        '关键路径不要同步调非关键合作方。'
      ], links: [
        { id: 'handwrite-58', label: '线程池参数' },
        { id: 'scenario-distributed-rate-limit', label: '限流' }
      ]},
      'scenario-cross-site-sso': { dbDesign: [
        'auth_code(code PK, user_id, client_id, expire_at, used)。一次性、短 TTL。',
        'refresh_token(hash PK, user_id, client_id, expire_at, revoked)。只存哈希。',
        'logout 写 token_blacklist 或把 session_version +1，校验时比对版本。'
      ], title: '授权码、时钟、退出', points: [
        'A 站登录后跳 B 站拿 code，B 用 code 换 token。code 一次性。',
        '服务器时钟差用短 TTL + nbf/exp 容差；不要把 token 当会话库。',
        '退出要能吊销：黑名单或 session_version。'
      ]},
      'scenario-qps-capacity-planning': { extraViz: 'capacityCalc', formulas: [
        '日请求 = DAU × 人均打开次数 × 每次打开请求数',
        '峰值 QPS = 日请求 / 86400 × 峰均比',
        '实例数 = 峰值 QPS / 单实例安全 QPS × (1 + 冗余 0.4)',
        '单实例安全 QPS 必须来自压测，不是压测峰值的 100%'
      ], title: '上线容量怎么报', points: [
        '先拆读/写，再拆强一致接口。写和强一致不要按缓存命中率打折。',
        '压测要包含依赖（DB/Redis/下游），单机假高峰没有意义。'
      ]},
      'scenario-order-timeout-close': { extraViz: 'stateMachine', dbDesign: [
        'orders(id, user_id, status, expire_at, pay_amount, version)，索引 (status, expire_at)。',
        'outbox 与下单同一本地事务，关单后回补库存、关支付单。'
      ], title: '关单必须 CAS', points: [
        'UPDATE ... WHERE id=? AND status=CREATED。0 行表示已支付或已关闭。',
        '延迟消息可丢，必须有扫表兜底。',
        '副作用走 Outbox，消费幂等。'
      ], links: [
        { id: 'database-93', label: 'Outbox' },
        { id: 'database-87', label: '库存扣减' }
      ]},
      'scenario-massive-topk': { extraViz: 'capacityCalc', formulas: [
        '单机堆内存 ≈ K × 元素大小；K=100 可忽略，K=1e7 就要外排',
        '文件切分块数 = 数据量 / 可用内存'
      ], title: 'Top K 的分治', points: [
        '每块局部小顶堆，再归并。不要全局排序。',
        '和算法题 347 / 215 说辞一致：堆维护竞争力，不是全排序。'
      ], links: [
        { id: 'handwrite-46', label: '海量文件 Top K 手撕' },
        { id: '215', label: '数组中的第 K 个最大' },
        { id: '347', label: '前 K 高频' }
      ]},
      'scenario-external-sort': { formulas: [
        '归并路数 M 受文件句柄和内存缓冲限制，常见 16~64 路',
        '趟数 ≈ log_M (块数)'
      ], title: '外排', points: [
        '切块进内存排序写回，多路归并。',
        '最后一趟可以直接输出，不必再写完整中间文件。'
      ], links: [{ id: 'handwrite-46', label: '海量 Top K' }]},
      'scenario-redis-mysql-consistency': { dbDesign: [
        '数据表带 version / updated_at；缓存 value 带同一版本。',
        'cache_invalidate 与业务同一事务，后台扫描删 Redis。'
      ], title: '先更 DB 再删缓存', points: [
        '并发读可能把旧值写回，所以必须有 TTL 和补偿删除。',
        'CDC 要按版本丢弃乱序事件。',
        '热点用逻辑过期 + 单飞重建。'
      ], links: [
        { id: 'handwrite-61', label: '缓存一致性手撕' },
        { id: 'database-89', label: 'binlog / 2PC' }
      ]},
      'scenario-rpc-framework': { dbDesign: [
        'idempotent_request(request_id PK, biz_key, status, result_ref, created_at)，和业务同一事务。'
      ], title: '超时分层与幂等', points: [
        '连接超时、读超时、总超时分开。写操作重试必须带 request_id。',
        '注册中心挂了要有本地服务列表缓存。',
        '可观测：成功率、P99、inflight、线程池拒绝。'
      ], links: [
        { id: 'database-93', label: '消费幂等表' },
        { id: 'handwrite-58', label: '线程池参数' }
      ]},
      'scenario-local-cache': { title: '本地缓存和分布式缓存', points: [
        '本地缓存要有容量上限、TTL、淘汰（LRU）。',
        '多实例本地缓存会不一致，适合可容忍短暂脏读的配置/字典。',
        '更新通知用版本号或短 TTL，不要幻想立刻全员失效。'
      ], links: [
        { id: 'handwrite-47', label: '手写 LRU' },
        { id: '146', label: 'LRU 缓存（算法）' }
      ]},
      'scenario-seckill-system': { dbDesign: [
        'sku_stock 或 sku_stock_seg 分段打散行锁。',
        'seckill_order(request_id UNIQUE, user_id, sku_id, status)。',
        'stock_change_log 记录预扣、实扣、回补。'
      ], title: '秒杀库存落到表', points: [
        'Redis 预扣挡流量，DB 条件更新做最终一致。',
        '运行中加库存带场次/版本，避免加回已关闭场次。',
        'DB 扣减失败则 Redis 回补，对账扫差异。'
      ], links: [
        { id: 'database-87', label: '库存扣减 SQL' },
        { id: 'scenario-distributed-rate-limit', label: '限流' },
        { id: 'handwrite-60', label: '限流手撕' }
      ]},
      'scenario-redis-outage': { title: '缓存挂了怎么降级', points: [
        '失败开还是失败关要事先约定：读多可短暂穿透 + 限流；核心写路径不要把 Redis 当唯一真相。',
        '本地缓存顶一波热点；DB 加限流和熔断。',
        '恢复时禁止全量回源，按热点榜预热。'
      ], links: [
        { id: 'scenario-service-prewarm', label: '预热' },
        { id: 'handwrite-61', label: '缓存一致性' }
      ]},
      'scenario-distributed-rate-limit': { dbDesign: [
        'rate_rule 热加载；计数放 Redis；审计异步写日志。'
      ], title: '集群总配额', points: [
        '不能每实例各限一份。Lua 保证原子。',
        '滑动窗口准、令牌桶平滑、固定窗口便宜但有突刺。',
        'Redis 故障时本地保守限流，语义提前和业务约定。'
      ], links: [
        { id: 'handwrite-60', label: '限流手撕' },
        { id: 'scenario-seckill-system', label: '秒杀前置拦截' }
      ]},

      'handwrite-46': { title: '和架构题对齐', points: [
        '手写局部堆 + 归并；架构题补切分、内存预算和外排。'
      ], links: [
        { id: 'scenario-massive-topk', label: '海量 Top K 架构' },
        { id: '215', label: '第 K 大（算法）' }
      ]},
      'handwrite-47': { title: '和架构题对齐', points: [
        '手写 HashMap + 双向链表；架构题补 TTL、容量、多实例失效。'
      ], links: [
        { id: '146', label: 'LRU 算法题' },
        { id: 'scenario-local-cache', label: '本地缓存架构' }
      ]},
      'handwrite-60': { title: '和架构题对齐', points: [
        '手写 Lua/ZSET；架构题补网关层、集群总配额、降级和 429。'
      ], links: [{ id: 'scenario-distributed-rate-limit', label: '分布式限流架构' }]},
      'handwrite-61': { title: '和架构题对齐', points: [
        '手写 Cache Aside；架构题补 TTL、CDC、单飞和对账。'
      ], links: [{ id: 'scenario-redis-mysql-consistency', label: '缓存一致性架构' }]},
      'handwrite-62': { title: '锁和库存', points: [
        'SET NX PX + token 校验释放。业务锁不要替代库存条件更新。'
      ], links: [{ id: 'database-87', label: '库存扣减' }]},
      'handwrite-64': { title: '和 Outbox 对齐', points: [
        '生产侧本地事务 + 扫描投递；消费侧唯一键幂等。'
      ], links: [{ id: 'database-93', label: 'Outbox 表' }]},
      'handwrite-66': { title: '分片上传表', points: [
        '文件哈希去重、分片 bitmap、合并任务状态机，和数据库题 24 用同一套表。'
      ], links: [{ id: 'database-95', label: '分片上传表设计' }]},
      'handwrite-67': { title: 'RAG 表', links: [{ id: 'database-97', label: 'Chunk / 权限过滤表' }]},
      'handwrite-68': { title: '会话表', links: [{ id: 'database-96', label: '会话与消息表' }]},
      'handwrite-70': { title: '生产级优化', links: [
        { id: 'database-98', label: '知识工作台库优化' },
        { id: 'scenario-design-framework', label: '三高答题框架' }
      ]},
      'database-73': { title: '3NF 和反范式怎么一起说', points: [
        '3NF 消的是传递依赖：user_name 依赖 user_id，不应作为订单的稳定事实。',
        '订单明细仍要冗余成交时的商品名、价格、商家名快照，否则改名会改写历史。',
        'OLTP 先规范化；报表、搜索、详情页可以宽表 / 物化视图，但要写清同步机制。'
      ], links: [{ id: 'database-74', label: '销冠统计口径' }]},
      'database-75': { title: '并列第一不要 LIMIT 1', sql: [
        { label: '先聚合再 RANK', code: "WITH total AS (\n  SELECT student_id, SUM(score) AS s\n  FROM scores GROUP BY student_id\n)\nSELECT student_id, s FROM (\n  SELECT student_id, s, RANK() OVER (ORDER BY s DESC) rk FROM total\n) t WHERE rk = 1;" }
      ], points: [
        '按 student_id 分组，不要按姓名。',
        'LIMIT 1 会丢掉并列。RANK() 或先求 MAX(total) 再关联。',
        '没成绩的学生要不要进结果，决定用 JOIN 还是 LEFT JOIN。'
      ]},
      'database-79': { title: '去重删除先定保留规则', sql: [
        { label: '自连接删较大 id', code: "DELETE u1 FROM user_account u1\nJOIN user_account u2\n  ON u1.email = u2.email AND u1.id > u2.id;" },
        { label: '窗口函数 + 派生表', code: "DELETE FROM user_account\nWHERE id IN (\n  SELECT id FROM (\n    SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY id) rn\n    FROM user_account\n  ) t WHERE rn > 1\n);" }
      ], points: [
        '不能按 email IN (...) 全删。先定保留最小 id 还是最新 created_at。',
        '千万级必须把待删 id 写入临时表，按主键分批删，盯主从延迟。',
        '删完立刻加 UNIQUE(email)。NULL 邮箱：NOT NULL 或业务层只允许一个空值。'
      ], links: [{ id: 'database-90', label: '唯一索引幂等' }]},
      'database-82': { title: '索引失效怎么改写', sql: [
        { label: '函数包列', code: "-- 坏：DATE(created_at)=?\n-- 好：\nWHERE created_at >= '2026-09-20'\n  AND created_at <  '2026-09-21'" },
        { label: '隐式转换', code: "-- phone 是 VARCHAR\n-- 坏：phone = 13800138000\n-- 好：phone = '13800138000'" }
      ], points: [
        'LIKE %xx 走不了 B+Tree 前缀；改前缀匹配或倒排/ES。',
        '联合索引跳过最左列等于没建。OR 两侧都要有索引，否则考虑 UNION ALL。',
        '!= / 低选择性不一定失效，最终看优化器成本，不要绝对化。'
      ], links: [{ id: 'database-81', label: '最左前缀' }, { id: 'database-83', label: 'EXPLAIN' }]},
      'database-85': { title: '等值在前、范围在后、覆盖排序', sql: [
        { label: '流水表', code: "CREATE TABLE user_transactions (\n  id BIGINT PRIMARY KEY AUTO_INCREMENT,\n  user_id BIGINT NOT NULL,\n  amount DECIMAL(18,2) NOT NULL,\n  txn_time DATETIME NOT NULL,\n  biz_no VARCHAR(64) NOT NULL,\n  UNIQUE KEY uk_biz_no (biz_no),\n  KEY idx_user_time_id (user_id, txn_time DESC, id DESC)\n);" },
        { label: '近 30 天', code: "SELECT id, amount, txn_time, biz_no\nFROM user_transactions\nWHERE user_id = ? AND txn_time >= ?\nORDER BY txn_time DESC, id DESC\nLIMIT 100;" }
      ], points: [
        '起始时间在应用层算好再传入，避免对列套 NOW()/DATE()。',
        '全站按时间汇总不能指望 (user_id, txn_time)，要另建 (txn_time, user_id)。',
        '流水只追加，错账用冲正。过亿按 user_id 分片或按时间归档。'
      ], links: [{ id: 'database-84', label: 'seek 分页' }, { id: 'database-81', label: '联合索引' }]},
      'database-90': { title: '唯一索引才是幂等的硬底', sql: [
        { label: '下单', code: "UNIQUE KEY uk_request (user_id, request_id)\n-- 直接 INSERT，冲突后 SELECT 已有订单返回。" },
        { label: '消费', code: "UNIQUE KEY uk_event_group (event_id, consumer_group)\n-- 先插 consume_log，成功才做业务。" }
      ], points: [
        '先查再插并发下会双写。必须唯一约束或锁。',
        '幂等键不能每次重试新 UUID。支付用平台流水号，下单用用户 request_id。',
        'Redis SETNX 只能前置削峰，最终仍要 DB 唯一键，因为不在同一事务。'
      ], links: [{ id: 'database-93', label: 'Outbox / 消费表' }, { id: 'database-79', label: '去重删除' }]},
      'database-94': { extraViz: 'taskState', title: '中间态必须可抢占', sql: [
        { label: '扫描候选', code: "SELECT id FROM notify_task\nWHERE status IN ('INIT','PUBLISHED','CONSUMING','RETRY')\n  AND next_retry_at <= NOW()\nORDER BY id LIMIT 100;" },
        { label: '条件更新抢占', code: "UPDATE notify_task\nSET status='RETRYING', locked_until=DATE_ADD(NOW(), INTERVAL 5 MINUTE)\nWHERE id=? AND status IN ('INIT','PUBLISHED','CONSUMING','RETRY')\n  AND next_retry_at <= NOW();\n-- 影响行数=1 才执行。" }
      ], points: [
        '扫描不等于占有。多实例靠 CAS 抢占，0 行说明被别人拿走。',
        '锁租约要心跳续期；过期可被回收，所以业务必须幂等。',
        '超过重试阈值进 DEAD，不要无限重试打爆下游。'
      ], links: [
        { id: 'scenario-distributed-scheduler', label: '调度抢占' },
        { id: 'database-93', label: 'Outbox' }
      ]},
      'database-95': { extraViz: 'taskState', title: '文件资产和用户引用要拆开', points: [
        'file_asset 用 (sha256, size) 唯一，秒传只插 user_file 引用。',
        '分片进度用 Redis Bitmap；MySQL 记 upload_task 状态和失败原因。',
        '索引任务独立状态机：PENDING/RUNNING/SUCCESS/FAILED，可按 next_retry_at 扫描。',
        'chunk 表存切片位置和向量 id，重建索引不要覆盖原文件资产。'
      ], links: [
        { id: 'handwrite-66', label: '分片上传手撕' },
        { id: 'database-94', label: '补偿扫描' }
      ]},
      'database-96': { title: '会话 / 消息 / 产物怎么拆', points: [
        'session、message、run、artifact 分开。消息只追加，产物用 run_id 幂等。',
        '引用消息用 message_id，不要把长上下文重复落多份。',
        '中断恢复靠 run.checkpoint 和 status=RUNNING/STOPPING/STOPPED。',
        '按 session_id + created_at 分页，禁止深 OFFSET。'
      ], links: [
        { id: 'handwrite-68', label: '流式生成手撕' },
        { id: 'handwrite-69', label: 'checkpoint/resume' }
      ]},
      'database-97': { title: 'RAG 必须先过滤权限再近邻', points: [
        'chunk 带 file_id、user_id/acl、token 范围。向量库过滤条件和 MySQL 权限视图要一致。',
        '重建索引用 index_version，检索只读当前版本，避免读写同一批被覆盖。',
        '召回后回表取原文，不要把全文塞进向量库。'
      ], links: [
        { id: 'handwrite-67', label: '混合检索手撕' },
        { id: 'database-95', label: '文件与 chunk 表' }
      ]},
      'database-98': { title: '知识工作台库的生产级抓手', points: [
        '热点：会话消息按 session 分区；文件资产去重；索引任务限流。',
        '长事务：Embedding 写入分批提交，不要一个事务包整个文件。',
        '权限：每次检索带租户/用户条件，禁止先 topK 再内存过滤造成越权。',
        '备份与删除：用户删文件要同时下线引用、索引和对象存储，走状态机而不是物理秒删。'
      ], links: [
        { id: 'handwrite-70', label: '项目生产级优化' },
        { id: 'database-97', label: 'RAG 表' }
      ]},
      'handwrite-48': { title: '内存池面试怎么收口', points: [
        '先说分配策略：空闲块用 TreeMap 按 size 找 ceiling，释放后要合并相邻块防碎片。',
        '并发要么整池加锁，要么 ThreadLocal 缓存 + 全局备用；TreeMap 本身不是线程安全。'
      ]},
      'handwrite-49': { title: '设计模式不要背名单', points: [
        '按变化点选：创建用工厂，算法切换用策略，流程骨架用模板，管道用责任链，解耦通知用观察者，增强用代理。',
        '每个模式只讲你项目里的一处落地，比列 23 种更加分。'
      ], links: [
        { id: 'handwrite-50', label: '单例' },
        { id: 'handwrite-51', label: '工厂+策略' }
      ]},
      'handwrite-50': { title: 'DCL 必须说到 volatile', points: [
        '懒加载才需要 DCL；不要求懒加载用枚举，天然抗反射和序列化。',
        'volatile 禁止半初始化发布。面试主动对比饿汉、静态内部类、枚举。'
      ], links: [{ id: 'singleton-dcl', label: '算法题单里的 DCL 代码' }]},
      'handwrite-51': { title: '工厂 + 策略', points: [
        '接口 + 多实现 + Map 注册。新增类型加类不改 if-else。',
        'Spring 用 List<Handler> 注入；手写用静态 Map 或枚举工厂。'
      ]},
      'handwrite-52': { title: '模板方法', points: [
        '抽象类固定步骤，子类只填变化点。和策略的差别：模板管流程，策略管可替换算法。'
      ]},
      'handwrite-53': { title: '责任链', points: [
        'handle(ctx, chain)，失败不调用 next。顺序、短路、通用上下文是得分点。'
      ]},
      'handwrite-54': { title: '观察者', points: [
        '发布方不依赖具体监听者。同步监听要防慢监听拖垮主链路，重要事件可改异步 + 幂等。'
      ]},
      'handwrite-55': { title: '动态代理', points: [
        'JDK 代理只能打接口；类代理用 CGLIB。面试说到 InvocationHandler 和场景：事务、日志、RPC。'
      ]},
      'handwrite-56': { title: '阻塞队列', points: [
        '一把锁两个 Condition：notFull / notEmpty。await 必须 while，finally 解锁。',
        '生产用 ArrayBlockingQueue / LinkedBlockingQueue，手写是为了讲清楚等待/唤醒。'
      ], links: [{ id: 'handwrite-58', label: '线程池队列' }]},
      'handwrite-57': { title: '最大并发 3', points: [
        'Semaphore(3) 或线程池 core=max=3、有界队列。要收集 Future 异常，不能只 fire-and-forget。'
      ], links: [{ id: 'handwrite-58', label: '线程池参数' }]},
      'handwrite-58': { title: '线程池怎么报参数', points: [
        'CPU 密集：核数到核数+1。IO 密集：核数 × (1+等待/计算)，再压测。',
        '队列必须有界。拒绝策略要能把请求带回压到上游，而不是静默丢。',
        '一个业务一个池，避免合作方 RT 升高占满公共池。'
      ], links: [
        { id: 'scenario-external-dependency-isolation', label: '隔离仓' },
        { id: 'handwrite-57', label: '并发度 3' }
      ]},
      'handwrite-59': { title: '调度器', points: [
        'DelayQueue / 有序等待 + wait(timeout)。时间源优先 nanoTime。',
        '生产用 ScheduledThreadPoolExecutor；手写要讲错过触发、取消和单线程执行器。'
      ], links: [{ id: 'scenario-distributed-scheduler', label: '分布式调度' }]},
      'handwrite-63': { title: '分布式 ID', points: [
        '先问是否要趋势递增、是否可暴露、峰值 QPS。',
        '号段简单；Snowflake 要处理时钟回拨；UUID 无序会打散 B+Tree。',
        '数据库自增在分库后不够，需要号段表或雪花。'
      ], links: [{ id: 'database-92', label: '分库分表' }]},
      'handwrite-65': { title: '削峰去重', points: [
        '先按业务键去重再进优先级队列。高优不能饿死低优，用老化或配额。',
        '和限流搭配：限流挡入口，队列挡下游。'
      ], links: [
        { id: 'handwrite-60', label: '限流' },
        { id: 'handwrite-64', label: '可靠消息' }
      ]},
      'handwrite-69': { title: 'checkpoint 怎么落库', points: [
        '每步写入 run_id + seq + payload，恢复时从最新成功 seq 继续。',
        '状态 STOPPING 要能被补偿扫描捡起，避免进程被杀后任务消失。'
      ], links: [
        { id: 'database-96', label: '会话与 run 表' },
        { id: 'database-94', label: '中间态补偿' }
      ]},
    };
    // S5: 反事实分析（scenario 专属：如果不用 X 会怎样）
    const SCENARIO_COUNTERFACTUALS = {
      'scenario-design-framework': [
        ['不做需求澄清直接开干', '省 5 分钟开场；但方向跑偏的概率大增，面试官认为你缺乏工程素养'],
        ['不做容量估算直接画架构', '架构图看起来更简洁；但所有"选型"都失去依据，无法回答"为什么是 Kafka 不是 RabbitMQ"'],
        ['忽略故障与降级设计', '讲起来更顺；但面试官追问"Redis 挂了怎么办"时会直接卡住'],
      ],
      'scenario-realtime-music-ranking': [
        ['用 MySQL ORDER BY 实时算', '零额外组件；但 QPS 上限 ~1k，数据量大时全表扫描会拖垮主库'],
        ['只用 Redis ZSet 不做持久化', '性能最高；但 Redis 重启丢榜单，需要 RDB/AOF + 定期落库双保险'],
        ['用离线计算代替实时（每小时跑一次）', '成本最低、最稳定；但榜单延迟 1 小时，用户体验差'],
      ],
      'scenario-live-comment-system': [
        ['用 HTTP 轮询代替长连接', '实现最简单；但延迟秒级、服务器成本高 100 倍'],
        ['用 WebSocket 单机服务', '延迟最低；但单机只能支撑 ~50w 长连接，需要分布式网关'],
        ['不做消息持久化', '实现简单；但用户重连后丢历史弹幕'],
      ],
      'scenario-seckill-system': [
        ['不用 Redis 预减库存，直接打 MySQL', 'QPS 上限从 10w 跌到 5k，DB 连接池打爆；省去了 Redis 运维成本和缓存一致性问题'],
        ['不用 MQ 异步下单，同步写库', 'RT 从 50ms 涨到 500ms+，突发流量直接打挂 DB；省去了消息丢失/重复的兜底成本'],
        ['不要求强一致（允许少卖）', '可以用最终一致性 + 对账任务，架构大幅简化；但会出现超卖事故，业务不能接受'],
      ],
      'scenario-cross-site-sso': [
        ['用 Session + Cookie 共享', '实现最简单；但不支持跨域、不支持移动端、需要共享 Session 存储'],
        ['用 JWT 无状态令牌', '无状态、易扩展；但无法主动失效（除非加黑名单，变得有状态）'],
        ['不做单点登出', '实现简单；但用户体验差，安全风险高'],
      ],
      'scenario-distributed-rate-limit': [
        ['用单机 Guava RateLimiter', '实现零成本；但只限单机，集群总量会翻倍'],
        ['用 Redis + Lua 分布式限流', '精确控制集群总量；但 Redis 是单点，且每次请求多一次网络 RT'],
        ['完全不限流，靠扩容硬扛', '无技术复杂度；但突发流量会打挂整个系统，成本更高'],
      ],
      'scenario-distributed-scheduler': [
        ['用单机 Quartz', '实现最简单；但单点故障、无法水平扩展'],
        ['用 XXL-Job / Elastic-Job', '社区成熟、功能全；但引入外部依赖，运维成本高'],
        ['用 DB 轮询任务表', '无外部依赖；但 QPS 高时打爆 DB、延迟精度差'],
      ],
      'scenario-external-dependency-isolation': [
        ['不做隔离，直接调用', '实现最简单；但第三方故障会传染，整个系统雪崩'],
        ['用线程池隔离（Hystrix 模式）', '资源隔离彻底；但线程切换开销大'],
        ['用信号量隔离', '开销小；但不能隔离慢调用'],
      ],
      'scenario-external-sort': [
        ['一次性读入内存排序', '实现最简单；但数据量大于内存时直接 OOM'],
        ['用数据库 ORDER BY', '无需自己写；但 DB 排序性能差，大数据量会超时'],
        ['用 MapReduce 分布式排序', '可扩展性最强；但实现复杂度最高'],
      ],
      'scenario-lan-distribute-500gb': [
        ['用单点 HTTP 下载', '实现最简单；但服务器带宽是瓶颈，500GB / 1Gbps = 66 分钟'],
        ['用 BitTorrent P2P 分发', '带宽利用率最高；但实现复杂、需要追踪服务器'],
        ['用 CDN 预热', '最简单；但 500GB 预热成本高，且需要提前规划'],
      ],
      'scenario-local-cache': [
        ['不用本地缓存，全部走 Redis', '架构最简单；但每次多 1ms 网络 RT，热点 key 时 Redis 压力大'],
        ['本地缓存永不过期', '性能最好；但数据不一致，需要主动失效机制'],
        ['用 Caffeine 代替 Guava Cache', '性能更高（W-TinyLFU）；但引入额外依赖'],
      ],
      'scenario-massive-topk': [
        ['用堆排序单机处理', '实现简单；但数据量大于内存时不可行'],
        ['用分治 + 多路归并', '可处理任意大数据；但实现复杂，需要外部存储'],
        ['用 Redis ZSet', '实现最简单；但 ZSet 大数据量时内存占用高'],
      ],
      'scenario-order-timeout-close': [
        ['用 Java Timer/DelayQueue', '实现最简单；但单点、重启丢数据、不支持分布式'],
        ['用 RabbitMQ TTL + DLX', '社区成熟；但延迟精度差（秒级漂移）'],
        ['不主动关单，等用户对账', '零技术成本；但库存会长期占用，业务损失'],
      ],
      'scenario-qps-capacity-planning': [
        ['不做容量规划，直接上线', '省时间；但突发流量会打挂系统'],
        ['过度设计（按 100 倍峰值）', '绝对安全；但成本浪费 100 倍'],
        ['用云厂商自动扩缩容', '零规划成本；但扩容有延迟（分钟级），突发流量仍会受影响'],
      ],
      'scenario-redis-mysql-consistency': [
        ['先更新 DB 再更新缓存', '实现最简单；但并发下会脏读'],
        ['用 Canal 监听 binlog 异步更新', '最终一致性好；但引入 Canal 集群，运维成本高'],
        ['用分布式事务（2PC）', '强一致；但性能差，缓存和 DB 都支持 XA 才行'],
      ],
      'scenario-redis-outage': [
        ['不做降级，直接报错', '实现最简单；但用户体验差'],
        ['用本地缓存兜底', '可用性高；但数据可能不一致'],
        ['用 DB 直读', '实现简单；但 DB 压力大'],
      ],
      'scenario-rpc-framework': [
        ['用 HTTP/REST 代替 RPC', '通用性最强；但性能比 RPC 差 30%、序列化开销大'],
        ['用现成的 gRPC', '社区成熟；但 protobuf 定义有学习成本'],
        ['用消息队列代替 RPC', '天然异步；但延迟高，不适合实时调用'],
      ],
      'scenario-service-prewarm': [
        ['不做预热，直接上线', '实现最简单；但冷启动时 RT 高、JIT 未编译'],
        ['用懒加载代替预热', '启动快；但第一次请求慢'],
        ['用 AOT 编译（GraalVM）', '启动最快；但构建时间长、反射支持差'],
      ],
      'scenario-single-machine-counter': [
        ['用 synchronized 关键字', '实现最简单；但高并发下性能差'],
        ['用 AtomicLong', '无锁、性能好；但高并发下仍有 CAS 竞争'],
        ['用 LongAdder', '高并发性能最好；但sum() 不是实时的（最终一致）'],
      ],

      'scenario-distributed-lock': [
        ['用 MySQL 唯一索引代替', '实现简单、无单点；但 QPS 低（~1k）、不支持超时、不支持可重入'],
        ['用 Zookeeper 临时节点', '强一致、支持 watcher；但 ZK 集群运维成本高、写性能差（~1w QPS）'],
        ['不需要互斥，只要最终一致', '可以用乐观锁（版本号 / CAS），性能高 10 倍；但冲突重试会增多'],
      ],
      'scenario-short-url': [
        ['直接用自增 ID 不作混淆', '实现最简单；但会暴露业务规模（竞争对手可以爬数据）'],
        ['用哈希（MD5 前 8 位）', '无状态、无中心；但会冲突，需要冲突解决逻辑'],
        ['不做缓存', '省 Redis 成本；但热点短链会打爆 DB（如 1:1000 读写比）'],
      ],
      'scenario-unique-id': [
        ['直接用 DB AUTO_INCREMENT', 'QPS 上限 1k，且 DB 是单点；但实现 5 分钟搞定，适合初创'],
        ['直接用 UUID', '无单点、无网络调用；但 128 bit 占空间、无序导致 B+ 树页分裂、不可读'],
        ['不要求全局唯一（只业务内唯一）', '可以用 (biz_tag, local_id) 复合主键，每个业务独立发号；但跨业务关联会麻烦'],
      ],
      'scenario-message-queue': [
        ['用 HTTP 同步调用代替 MQ', '实现最简单；但耦合高、无法削峰、故障会传染'],
        ['用 Redis Pub/Sub 代替', '延迟最低；但无持久化、无确认机制、消息会丢失'],
        ['用数据库轮询代替', '无外部依赖；但 QPS 高时打爆 DB、延迟精度差'],
      ],
      'scenario-delay-queue': [
        ['用 Java Timer/DelayQueue', '实现最简单；但单点、重启丢数据、不支持分布式'],
        ['用 Quartz 定时任务', '成熟稳定；但精度差（秒级）、QPS 低'],
        ['不主动关单，等用户对账', '零技术成本；但库存会长期占用，业务损失'],
      ],
      'scenario-oauth-login': [
        ['用 Session + Cookie 共享', '实现最简单；但不支持跨域、不支持移动端'],
        ['用 JWT 无状态令牌', '无状态、易扩展；但无法主动失效（除非加黑名单）'],
        ['不做单点登出', '实现简单；但用户体验差，安全风险高'],
      ],
      'scenario-log-system': [
        ['用 ELK 自建', '成本低；但 ES 运维复杂、性能有限'],
        ['用云厂商日志服务（阿里云 SLS）', '零运维；但成本高、数据出不了云'],
        ['不做分布式追踪', '实现简单；但微服务故障时无法定位'],
      ],
      'scenario-notification': [
        ['用 DB 轮询代替推送', '实现最简单；但延迟高、DB 压力大'],
        ['用第三方推送服务', '省自建成本；但依赖外部服务、有数据安全风险'],
        ['不做已读状态', '实现简单；但用户体验差'],
      ],
      'scenario-hot-search': [
        ['用 MySQL ORDER BY 实时算', '零额外组件；但 QPS 上限 ~1k，数据量大时全表扫描会拖垮主库'],
        ['只用 Redis ZSet 不做持久化', '性能最高；但 Redis 重启丢榜单'],
        ['用离线计算代替实时（每小时跑一次）', '成本最低、最稳定；但榜单延迟 1 小时，用户体验差'],
      ],
      'scenario-feed-system': [
        ['用推模式（写扩散）代替拉模式', '读快（O(1)）；但大 V 发帖会写爆（千万粉丝 = 千万次写）'],
        ['用拉模式（读扩散）代替推模式', '写简单；但读慢（要聚合所有关注的人的最新帖子）'],
        ['不分层（纯 DB）', '架构最简单；但热点大 V 会打爆 DB'],
      ],
      'scenario-red-packet': [
        ['用 DB 直接扣减', '强一致；但 QPS 上限 ~1k，高并发会超时'],
        ['用 Redis 预分配 + DB 对账', '性能高 100 倍；但需要 Redis 和 DB 一致性'],
        ['不做公平性，先抢先得', '实现最简单；但用户体验差'],
      ],
      'scenario-nearby': [
        ['用 MySQL + 经纬度范围查询', '实现简单；但 QPS 上限 ~1k，数据量大时慢'],
        ['用 Redis GEO', '性能高 100 倍；但 Redis 内存成本高'],
        ['用 PostGIS / MongoDB', '功能强（支持多边形、路径）；但运维成本高'],
      ],
      'scenario-scan-login': [
        ['用 Session + Cookie', '实现简单；但不支持跨域、不支持移动端'],
        ['用 JWT 无状态令牌', '无状态、易扩展；但无法主动失效'],
        ['用 OAuth 2.0 + OIDC', '标准化、生态成熟；但学习曲线陡峭'],
      ],
      'scenario-gray-release': [
        ['不做灰度，直接全量发布', '零技术成本；但故障影响全部用户'],
        ['用蓝绿发布代替灰度', '风险最低；但资源成本高'],
        ['用 Feature Flag 代替灰度', '灵活；但代码侵入高'],
      ],
      'scenario-cdn': [
        ['不用 CDN，直接从源站访问', '零成本；但延迟高、源站压力大'],
        ['用 P2P 分发', '带宽利用率最高；但实现复杂'],
        ['用多云 CDN', '可用性最高；但成本高'],
      ],
      'scenario-search-recommendation': [
        ['用 MySQL LIKE 代替 ES', '实现最简单；但性能差、功能弱'],
        ['用纯向量检索代替多路召回', '准确率高；但召回率低'],
        ['不做精排，直接返回召回结果', '实现最简单；但准确率低'],
      ],
    
    };


;

/* Source: src/visuals/diagram-engine.js */
;
/* ==========================================================================
   v8 图解引擎
   · Player：逐帧播放器（播放 / 单步 / 拖动 / 速度），首次滚动到可见时自动播放一遍
   · 架构图：分层泳道 + 节点类型 + 请求包沿链路流动 + 步骤说明（ARCH 规格见 arch-specs.js）
   · 算法演示：用真实输入跑算法生成帧（TRACES 见 algo-traces.js），指针 / 窗口 / 节点用 FLIP 平滑移动
   ========================================================================== */
const DG = (() => {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const tw = (s, fs) => { let w = 0; for (const ch of String(s)) w += /[⺀-￿]/.test(ch) ? fs : fs * 0.6; return w; };
  const svgOpen = (w, h, cls) => `<svg class="dg-svg ${cls || ''}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMin meet" role="img">`;
  const DEFS = '<defs><marker id="dg-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="dg-ah"/></marker>'
    + '<marker id="dg-ah-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="dg-ah-on"/></marker>'
    + '<marker id="dg-ah-done" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="dg-ah-done"/></marker></defs>';

  /* ---------------- 通用播放器 ---------------- */
  const players = [];
  function mountPlayer(root, n, draw, opts = {}) {
    const st = { i: opts.start || 0, n, timer: null, speed: +(localStorage.getItem('iv8-speed') || 1), played: false };
    const bar = root.querySelector('.dg-ctrl');
    const counter = root.querySelector('.dg-count');
    const range = root.querySelector('.dg-range');
    const playBtn = root.querySelector('[data-dg="play"]');
    const go = (i, fromUser) => {
      st.i = Math.max(0, Math.min(st.n - 1, i));
      draw(st.i);
      if (counter) counter.textContent = `${st.i + 1} / ${st.n}`;
      if (range) range.value = String(st.i);
      if (fromUser) stop();
    };
    const tick = () => {
      if (st.i >= st.n - 1) { stop(); return; }
      go(st.i + 1);
      st.timer = setTimeout(tick, (opts.interval || 1100) / st.speed);
    };
    const play = () => {
      if (st.i >= st.n - 1) go(0);
      stop(true);
      root.classList.add('playing');
      if (playBtn) playBtn.innerHTML = PAUSE;
      st.timer = setTimeout(tick, 350 / st.speed);
    };
    const stop = (keep) => {
      clearTimeout(st.timer); st.timer = null;
      if (!keep) { root.classList.remove('playing'); if (playBtn) playBtn.innerHTML = PLAY; }
    };
    if (bar) bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-dg]');
      if (!b) return;
      const a = b.dataset.dg;
      if (a === 'play') { st.timer ? stop() : play(); }
      else if (a === 'prev') go(st.i - 1, true);
      else if (a === 'next') go(st.i + 1, true);
      else if (a === 'first') go(0, true);
      else if (a === 'last') go(st.n - 1, true);
      else if (a === 'speed') {
        st.speed = st.speed >= 2 ? 0.5 : st.speed * 2;
        try { localStorage.setItem('iv8-speed', String(st.speed)); } catch (err) { /* 忽略 */ }
        b.textContent = st.speed + '×';
      }
    });
    if (range) range.addEventListener('input', () => go(+range.value, true));
    const sp = root.querySelector('[data-dg="speed"]');
    if (sp) sp.textContent = st.speed + '×';
    go(st.i);
    const api = { go, play, stop, st, root };
    players.push(api);
    if (opts.autoplay !== false && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((ents) => {
        if (ents.some((x) => x.isIntersecting) && !st.played) { st.played = true; io.disconnect(); if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) play(); }
      }, { threshold: 0.45 });
      io.observe(root);
    }
    return api;
  }
  const PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  const PAUSE = '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
  const ctrlHtml = (n) => `<div class="dg-ctrl">
    <button type="button" data-dg="first" title="回到开头"><svg viewBox="0 0 24 24"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg></button>
    <button type="button" data-dg="prev" title="上一步"><svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7"/></svg></button>
    <button type="button" data-dg="play" class="dg-play" title="播放 / 暂停">${PLAY}</button>
    <button type="button" data-dg="next" title="下一步"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button>
    <button type="button" data-dg="last" title="跳到结尾"><svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg></button>
    <input class="dg-range" type="range" min="0" max="${n - 1}" value="0" aria-label="进度">
    <span class="dg-count">1 / ${n}</span>
    <button type="button" data-dg="speed" class="dg-speed" title="播放速度">1×</button></div>`;

  /* ---------------- FLIP：带 data-k 的元素平滑移动 ---------------- */
  const posOf = (el) => { const m = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px/.exec(el.getAttribute('style') || ''); return m ? [+m[1], +m[2]] : null; };
  function flipSwap(host, html) {
    const old = new Map();
    host.querySelectorAll('[data-k]').forEach((el) => old.set(el.dataset.k, { p: posOf(el), t: el.dataset.t, w: el.dataset.w }));
    host.innerHTML = html;
    const moved = [];
    host.querySelectorAll('[data-k]').forEach((el) => {
      const o = old.get(el.dataset.k);
      if (!o) { if (old.size) el.classList.add('dg-enter'); return; }
      const p = posOf(el);
      if (o.p && p && (o.p[0] !== p[0] || o.p[1] !== p[1])) {
        el.style.transition = 'none';
        el.style.transform = `translate(${o.p[0]}px, ${o.p[1]}px)`;
        moved.push([el, p]);
      }
      if (o.w != null && el.dataset.w != null && o.w !== el.dataset.w) {
        const r = el.querySelector('.dg-wrect');
        if (r) { r.style.transition = 'none'; r.setAttribute('width', o.w); moved.push([r, null, el.dataset.w]); }
      }
      if (o.t != null && el.dataset.t != null && o.t !== el.dataset.t) el.classList.add('dg-chg');
    });
    if (moved.length) {
      host.getBoundingClientRect();
      requestAnimationFrame(() => moved.forEach(([el, p, w]) => {
        el.style.transition = '';
        if (p) el.style.transform = `translate(${p[0]}px, ${p[1]}px)`;
        if (w != null) el.setAttribute('width', w);
      }));
    }
  }
  const tr = (x, y) => `transform:translate(${Math.round(x * 10) / 10}px, ${Math.round(y * 10) / 10}px)`;

  /* ==========================================================================
     架构图
     ========================================================================== */
  const NODE_W = 128, NODE_H = 48;
  function archLayout(spec, W) {
    const lanes = spec.lanes || [];
    const nodes = {};
    let maxCol = 0, maxRow = 0;
    Object.entries(spec.nodes).forEach(([k, v]) => { maxCol = Math.max(maxCol, v[1]); maxRow = Math.max(maxRow, v[2]); });
    const cols = Math.max(maxCol + 1, lanes.length);
    const padX = 20;
    const colW = (W - padX * 2) / cols;
    const top = lanes.length ? 44 : 18;
    const rowH = spec.rowH || 80;
    Object.entries(spec.nodes).forEach(([k, v]) => {
      const [type, c, r, label, o = {}] = v;
      const [la, lb] = String(label).split('\n');
      const need = Math.max(tw(la, 11.5), lb ? tw(lb, 9.6) : 0) + 30;
      const w = o.w || Math.min(colW - 14, Math.max(Math.min(NODE_W, colW - 30), need));
      nodes[k] = { k, type, label, x: padX + colW * c + colW / 2, y: top + rowH * r + NODE_H / 2 + 6, w, h: o.h || NODE_H, o };
    });
    const H = top + rowH * maxRow + NODE_H + 30;
    return { nodes, H, colW, cols, padX, top, rowH };
  }
  // 连接点：在节点边框上取与目标方向相交的点
  function anchor(n, tx, ty) {
    const dx = tx - n.x, dy = ty - n.y;
    const hw = n.w / 2 + 2, hh = n.h / 2 + 2;
    if (Math.abs(dx) * hh > Math.abs(dy) * hw) return [n.x + Math.sign(dx) * hw, n.y + dy * (hw / Math.abs(dx || 1))];
    return [n.x + dx * (hh / Math.abs(dy || 1)), n.y + Math.sign(dy) * hh];
  }
  // 路线统一用三次贝塞尔表示：{ p0, c1, c2, p3 }
  const bez = (r, t) => { const u = 1 - t; return [u * u * u * r[0] + 3 * u * u * t * r[2] + 3 * u * t * t * r[4] + t * t * t * r[6], u * u * u * r[1] + 3 * u * u * t * r[3] + 3 * u * t * t * r[5] + t * t * t * r[7]]; };
  const routeObj = (r) => { const [mx, my] = bez(r, 0.5); const f = (v) => v.toFixed(1); return { r, d: `M${f(r[0])} ${f(r[1])} C${f(r[2])} ${f(r[3])} ${f(r[4])} ${f(r[5])} ${f(r[6])} ${f(r[7])}`, mx, my }; };
  function edgePath(a, b, bend) {
    const [x1, y1] = anchor(a, b.x, b.y);
    const [x2, y2] = anchor(b, a.x, a.y);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    const qx = mx + nx * bend, qy = my + ny * bend;
    // 二次曲线升阶为三次
    return routeObj([x1, y1, x1 + (2 / 3) * (qx - x1), y1 + (2 / 3) * (qy - y1), x2 + (2 / 3) * (qx - x2), y2 + (2 / 3) * (qy - y2), x2, y2]);
  }
  // 走行间通道：从节点上 / 下边出发，弧线跳到两行之间再落到目标上 / 下边
  function gapRouteH(a, b, gy, side, off) {
    const dir = Math.sign(b.x - a.x) || 1;
    const x1 = a.x + dir * a.w * 0.22 + off, y1 = a.y + side * a.h / 2;
    const x2 = b.x - dir * b.w * 0.22 + off, y2 = b.y + side * b.h / 2;
    const Y = (gy - 0.125 * (y1 + y2)) / 0.75;
    return routeObj([x1, y1, x1 + dir * 10, Y, x2 - dir * 10, Y, x2, y2]);
  }
  // 走列间通道：从节点左 / 右边出发，绕到列间空隙再回来
  function gapRouteV(a, b, gx, side, off) {
    const dir = Math.sign(b.y - a.y) || 1;
    const x1 = a.x + side * a.w / 2, y1 = a.y + dir * a.h * 0.18 + off;
    const x2 = b.x + side * b.w / 2, y2 = b.y - dir * b.h * 0.18 + off;
    const X = (gx - 0.125 * (x1 + x2)) / 0.75;
    return routeObj([x1, y1, X, y1 + dir * 8, X, y2 - dir * 8, x2, y2]);
  }
  const TYPE_ICON = { c: '◉', edge: '⇆', svc: '⚙', cache: '⚡', mq: '≋', db: '⛁', store: '▤', job: '⟳', ext: '⬡', cfg: '☰', algo: 'ƒ' };
  function nodeSvg(n, state) {
    const [l1, l2] = String(n.label).split('\n');
    const x = -n.w / 2, y = -n.h / 2;
    let shape;
    if (n.type === 'db' || n.type === 'store') {
      const e = 6;
      shape = `<path class="dg-shape" d="M${x} ${y + e} a${n.w / 2} ${e} 0 0 1 ${n.w} 0 v${n.h - e * 2} a${n.w / 2} ${e} 0 0 1 ${-n.w} 0 z"/><path class="dg-shape-l" d="M${x} ${y + e} a${n.w / 2} ${e} 0 0 0 ${n.w} 0"/>`;
    } else if (n.type === 'mq') {
      shape = `<rect class="dg-shape" x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="${n.h / 2}"/>` + [0.28, 0.42, 0.56, 0.7].map((f) => `<line class="dg-shape-l" x1="${x + n.w * f + 18}" y1="${y + n.h - 9}" x2="${x + n.w * f + 18}" y2="${y + n.h - 4}"/>`).join('');
    } else {
      shape = `<rect class="dg-shape" x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="${n.type === 'c' ? 14 : 8}"/>`;
    }
    // 文字自适应：先缩字号，仍放不下再截断（完整内容在 <title> 里）
    const avail = n.w - 30;
    const fit = (s, base, min) => {
      const w1 = tw(s, 1);
      let f = Math.min(base, avail / Math.max(w1, 0.01));
      if (f >= min) return [s, f];
      let t = String(s);
      while (t.length > 1 && tw(t + '…', min) > avail) t = t.slice(0, -1);
      return [t + '…', min];
    };
    const [t1, fs1] = fit(l1, 12.5, 9.5);
    const [t2, fs2] = l2 ? fit(l2, 10.5, 8.4) : ['', 10.5];
    const text = l2
      ? `<text class="dg-l1" x="${10}" y="${-5}" style="font-size:${fs1.toFixed(1)}px">${esc(t1)}</text><text class="dg-l2" x="${10}" y="${11}" style="font-size:${fs2.toFixed(1)}px">${esc(t2)}</text>`
      : `<text class="dg-l1" x="${10}" y="${4}" style="font-size:${fs1.toFixed(1)}px">${esc(t1)}</text>`;
    return `<g class="dg-node t-${n.type} ${state || ''}" style="${tr(n.x, n.y)}"><title>${esc(String(n.label).replace('\n', ' · '))}</title>${shape}<text class="dg-ic" x="${x + 13}" y="${4}">${TYPE_ICON[n.type] || '•'}</text>${text}</g>`;
  }
  function archFlowsOf(spec) {
    return (spec.flows || []).map(([name, steps, note]) => ({ name, note, steps: steps.map(([a, b, text, detail]) => ({ a, b, text, detail })) }));
  }
  function renderArch(id, spec) {
    const flows = archFlowsOf(spec);
    const tabs = flows.length > 1 ? `<div class="dg-tabs">${flows.map((f, i) => `<button type="button" data-flow="${i}" class="${i === 0 ? 'on' : ''}">${esc(f.name)}</button>`).join('')}</div>` : '';
    return `<figure class="dg dg-arch" data-arch="${esc(id)}">
      <div class="dg-head"><span class="dg-kind">架构图解</span><strong>${esc(spec.title || '')}</strong>${tabs}</div>
      <div class="dg-stage"></div>
      <div class="dg-cap"></div>
      ${ctrlHtml(2)}
      <ol class="dg-steps"></ol>
      ${spec.legend !== false ? `<div class="dg-legend">${[['c', '客户端'], ['edge', '接入 / 网关'], ['svc', '服务'], ['cache', '缓存'], ['mq', '消息队列'], ['db', '存储'], ['job', '后台任务'], ['ext', '外部依赖']].filter(([t]) => Object.values(spec.nodes).some((v) => v[0] === t)).map(([t, n]) => `<span class="t-${t}"><i></i>${n}</span>`).join('')}</div>` : ''}
    </figure>`;
  }
  function mountArch(fig, spec) {
    const W = 760;
    const L = archLayout(spec, W);
    const flows = archFlowsOf(spec);
    let flowIdx = 0, player = null;
    const stage = fig.querySelector('.dg-stage');
    const cap = fig.querySelector('.dg-cap');
    const stepsEl = fig.querySelector('.dg-steps');
    // 所有边（去重，双向时分开弯曲）
    const pairs = new Map();
    flows.forEach((f) => f.steps.forEach((s) => { if (s.a !== s.b) pairs.set(s.a + '>' + s.b, true); }));
    (spec.links || []).forEach(([a, b]) => pairs.set(a + '>' + b, true));
    // 边路由：曲线若穿过其它节点就加大弯曲，直到绕开
    const routeCache = new Map();
    const hitCount = (r, a, b) => {
      let c = 0;
      for (let t = 0.05; t < 0.96; t += 0.03) {
        const [x, y] = bez(r, t);
        if (y < 30 || y > L.H - 6 || x < 8 || x > W - 8) { c += 3; continue; }
        for (const n of Object.values(L.nodes)) {
          if (n.k === a || n.k === b) continue;
          if (Math.abs(x - n.x) < n.w / 2 + 4 && Math.abs(y - n.y) < n.h / 2 + 4) c++;
        }
      }
      return c;
    };
    const pathOf = (a, b) => {
      const key = a + '>' + b;
      if (routeCache.has(key)) return routeCache.get(key);
      const A = L.nodes[a], B = L.nodes[b];
      const both = pairs.has(b + '>' + a);
      const base = both ? 12 : 0;
      const cands = [];
      for (const off of [0, 26, -26, 48, -48]) cands.push(edgePath(A, B, base + off));
      const off = both ? (a < b ? -7 : 7) : 0;
      const rh = L.rowH;
      const sameRowish = Math.abs(A.y - B.y) < rh * 0.6;
      const sameColish = Math.abs(A.x - B.x) < L.colW * 0.6;
      if (!sameColish) {
        const top = Math.min(A.y, B.y), bot = Math.max(A.y, B.y);
        cands.push(gapRouteH(A, B, top - rh / 2, -1, off), gapRouteH(A, B, bot + rh / 2, 1, off));
        if (!sameRowish) cands.push(gapRouteH(A, B, (A.y + B.y) / 2, Math.sign(B.y - A.y), off));
        cands.push(gapRouteH(A, B, top - rh * 1.5, -1, off), gapRouteH(A, B, bot + rh * 1.5, 1, off));
      }
      if (!sameRowish || sameColish) {
        const l = Math.min(A.x, B.x), rr = Math.max(A.x, B.x);
        cands.push(gapRouteV(A, B, rr + L.colW / 2, 1, off), gapRouteV(A, B, l - L.colW / 2, -1, off));
      }
      let best = cands[0], bestHit = Infinity;
      for (const c of cands) { const hc = hitCount(c.r, a, b); if (hc < bestHit) { best = c; bestHit = hc; if (!hc) break; } }
      routeCache.set(key, best);
      return best;
    };
    const laneSvg = () => (spec.lanes || []).map((ln, i) => `<g class="dg-lane"><rect x="${L.padX + L.colW * i + 3}" y="6" width="${L.colW - 6}" height="${L.H - 12}" rx="10"/><text x="${L.padX + L.colW * i + L.colW / 2}" y="26">${esc(ln)}</text></g>`).join('');
    const draw = (i) => {
      const f = flows[flowIdx];
      const cur = i - 1; // 帧 0 = 总览
      const edgeState = new Map(), nodeState = new Map();
      f.steps.forEach((s, j) => {
        const st = j < cur ? 'done' : j === cur ? 'on' : 'todo';
        if (s.a !== s.b) { const k = s.a + '>' + s.b; const prev = edgeState.get(k); if (!prev || st === 'on' || (st === 'done' && prev === 'todo')) edgeState.set(k, st); }
        [s.a, s.b].forEach((n) => { const p = nodeState.get(n); if (st === 'on') nodeState.set(n, 'on'); else if (st === 'done' && p !== 'on') nodeState.set(n, 'done'); else if (!p) nodeState.set(n, 'todo'); });
      });
      let edges = '';
      pairs.forEach((_, k) => {
        const [a, b] = k.split('>');
        if (!L.nodes[a] || !L.nodes[b]) return;
        const p = pathOf(a, b);
        const st = edgeState.get(k) || 'idle';
        edges += `<path class="dg-edge ${st}" d="${p.d}" marker-end="url(#dg-ah${st === 'on' ? '-on' : st === 'done' ? '-done' : ''})"/>`;
      });
      // 步骤编号徽标
      let badges = '';
      const seenMid = {};
      f.steps.forEach((s, j) => {
        let x, y;
        if (s.a === s.b) { const n = L.nodes[s.a]; x = n.x + n.w / 2 - 2; y = n.y - n.h / 2 - 2; }
        else { const p = pathOf(s.a, s.b); x = p.mx; y = p.my; }
        const key = Math.round(x / 8) + ',' + Math.round(y / 8);
        seenMid[key] = (seenMid[key] || 0) + 1;
        if (seenMid[key] > 1) { x += (seenMid[key] - 1) * 17; }
        const st = j < cur ? 'done' : j === cur ? 'on' : 'todo';
        badges += `<g class="dg-badge ${st}" style="${tr(x, y)}"><circle r="8.5"/><text y="3.6">${j + 1}</text></g>`;
      });
      const nodes = Object.values(L.nodes).map((n) => nodeSvg(n, nodeState.get(n.k) || 'idle')).join('');
      let pkt = '';
      const s = f.steps[cur];
      if (s && s.a !== s.b) pkt = `<circle class="dg-pkt" r="6"><animateMotion dur="0.85s" begin="indefinite" fill="freeze" path="${pathOf(s.a, s.b).d}"/></circle>`;
      else if (s) { const n = L.nodes[s.a]; pkt = `<circle class="dg-ring" cx="${n.x}" cy="${n.y}" r="${n.w / 2}"/>`; }
      stage.innerHTML = svgOpen(W, L.H, 'arch') + DEFS + laneSvg() + edges + nodes + badges + pkt + '</svg>';
      const am = stage.querySelector('animateMotion');
      if (am && am.beginElement) { try { am.beginElement(); } catch (err) { /* 忽略 */ } }
      if (cur < 0) cap.innerHTML = `<b>总览</b>${esc(f.note || spec.summary || '按 ▶ 播放，看请求如何一步步流经各组件。')}`;
      else cap.innerHTML = `<span class="dg-no">${cur + 1}</span><b>${esc(s.text)}</b>${s.detail ? `<span>${esc(s.detail)}</span>` : ''}`;
      stepsEl.querySelectorAll('li').forEach((li, j) => { li.className = j < cur ? 'done' : j === cur ? 'on' : ''; });
    };
    const setFlow = (k) => {
      flowIdx = k;
      const f = flows[k];
      stepsEl.innerHTML = f.steps.map((s, j) => `<li data-step="${j}"><b>${esc(s.text)}</b>${s.detail ? `<span>${esc(s.detail)}</span>` : ''}</li>`).join('');
      const n = f.steps.length + 1;
      fig.querySelector('.dg-range').max = String(n - 1);
      if (player) { player.stop(); player.st.n = n; }
      player = player || mountPlayer(fig, n, draw, { interval: 1500 });
      player.st.n = n;
      player.go(0);
    };
    fig.addEventListener('click', (e) => {
      const t = e.target.closest('[data-flow]');
      if (t) { fig.querySelectorAll('[data-flow]').forEach((b) => b.classList.toggle('on', b === t)); setFlow(+t.dataset.flow); player.play(); return; }
      const li = e.target.closest('[data-step]');
      if (li) player.go(+li.dataset.step + 1, true);
    });
    setFlow(0);
  }

  /* ==========================================================================
     算法演示：场景块渲染
     ========================================================================== */
  const AW = 680;
  const CELL = 44;
  function fitCells(n, want) { return Math.max(24, Math.min(want || CELL, Math.floor((AW - 60) / Math.max(1, n)) - 4)); }
  function blockLabel(label, y) { return label ? `<text class="dg-blabel" x="8" y="${y + 13}">${esc(label)}</text>` : ''; }

  const R = {};
  // 一维数组：v 值、hl 高亮、p 指针（name→idx，可多个）、win 窗口 [l,r]
  R.arr = (b, y0) => {
    const n = b.v.length;
    const cw = fitCells(n, b.cw);
    const gap = 4;
    const total = n * cw + (n - 1) * gap;
    const x0 = Math.max(60, (AW - total) / 2);
    const hasLabel = !!b.label;
    const y = y0 + (hasLabel ? 20 : 4);
    const X = (i) => x0 + i * (cw + gap);
    let s = blockLabel(b.label, y0);
    if (b.win && b.win[1] >= b.win[0]) {
      const [l, r] = b.win;
      const w = X(r) - X(l) + cw + 8;
      s += `<g data-k="${b.id}:win" data-w="${w}" class="dg-win ${b.winCls || ''}" style="${tr(X(l) - 4, y - 4)}"><rect class="dg-wrect" x="0" y="0" width="${w}" height="${cw + 8}" rx="9"/></g>`;
    } else if (b.win) s += `<g data-k="${b.id}:win" data-w="0" class="dg-win" style="${tr(X(Math.max(0, b.win[0])) - 4, y - 4)}"><rect class="dg-wrect" x="0" y="0" width="0" height="${cw + 8}" rx="9"/></g>`;
    b.v.forEach((v, i) => {
      const cls = (b.hl && b.hl[i]) || '';
      const txt = v === null || v === undefined ? '' : String(v);
      s += `<g data-k="${b.id}:c${i}" data-t="${esc(txt)}" class="dg-cell ${cls}" style="${tr(X(i), y)}"><rect width="${cw}" height="${cw}" rx="7"/><text x="${cw / 2}" y="${cw / 2 + 5}" style="font-size:${txt.length > 3 ? Math.max(10, cw / txt.length * 1.3) : Math.min(15, cw * .38)}px">${esc(txt)}</text></g>`;
      if (b.idx !== false) s += `<text class="dg-idx" x="${X(i) + cw / 2}" y="${y + cw + 13}">${i}</text>`;
    });
    // 指针（同一位置多个指针纵向堆叠）
    const byPos = {};
    Object.entries(b.p || {}).forEach(([name, i]) => { if (i == null || i < -1 || i > n) return; (byPos[i] ||= []).push(name); });
    let maxStack = 0;
    Object.entries(byPos).forEach(([i, names]) => {
      names.forEach((name, j) => {
        maxStack = Math.max(maxStack, j + 1);
        const px = X(+i) + cw / 2, py = y + cw + 18 + j * 17;
        s += `<g data-k="${b.id}:p:${name}" class="dg-ptr p${j}" style="${tr(px, py)}"><path d="M0 0 l-5 7 h10 z"/><text y="${19}">${esc(name)}</text></g>`;
      });
    });
    if (b.note) s += `<text class="dg-note" x="${AW / 2}" y="${y + cw + 30 + maxStack * 17}">${esc(b.note)}</text>`;
    return { s, h: (hasLabel ? 20 : 4) + cw + 22 + Math.max(1, maxStack) * 17 + (b.note ? 18 : 0) };
  };
  // 栈 / 队列：水平排列，右侧为栈顶（队列 dir:'q' 左出右进）
  R.stack = (b, y0) => {
    const n = b.v.length;
    const cw = fitCells(Math.max(n, 6), b.cw || 40);
    const gap = 4;
    const x0 = 90;
    const y = y0 + 20;
    let s = blockLabel(b.label || (b.q ? '队列' : '栈'), y0);
    s += `<path class="dg-bracket" d="M${x0 - 8} ${y - 4} v${cw + 8} h${Math.max(cw * 6, n * (cw + gap)) + 18}${b.q ? ` M${x0 - 8} ${y - 4} h${Math.max(cw * 6, n * (cw + gap)) + 18}` : ''}"/>`;
    s += `<text class="dg-idx" x="${x0 - 14}" y="${y + cw / 2 + 4}" text-anchor="end">${b.q ? '队头' : '栈底'}</text>`;
    b.v.forEach((v, i) => {
      const cls = (b.hl && b.hl[i]) || '';
      const txt = String(v);
      const fs = txt.length > 3 ? Math.max(9.5, cw / txt.length * 1.35) : 14;
      s += `<g data-k="${b.id}:s${b.keys ? b.keys[i] : i}" data-t="${esc(txt)}" class="dg-cell ${cls}" style="${tr(x0 + i * (cw + gap), y)}"><rect width="${cw}" height="${cw}" rx="7"/><text x="${cw / 2}" y="${cw / 2 + 5}" style="font-size:${fs}px">${esc(txt)}</text></g>`;
    });
    if (n) s += `<g data-k="${b.id}:top" class="dg-ptr" style="${tr(x0 + (n - 1) * (cw + gap) + cw / 2, y + cw + 6)}"><path d="M0 0 l-5 7 h10 z"/><text y="19">${b.q ? '队尾' : '栈顶'}</text></g>`;
    else s += `<text class="dg-note" x="${x0 + 60}" y="${y + cw / 2 + 4}">（空）</text>`;
    return { s, h: 20 + cw + 34 };
  };
  // 哈希表：一行 key→value 卡片，hl 为高亮 key
  R.map = (b, y0) => {
    const e = b.e || [];
    let s = blockLabel(b.label || 'HashMap', y0);
    let x = 16, y = y0 + 22;
    const hl = new Set([].concat(b.hl ?? []).map(String));
    const lineH = 34;
    let lines = 1;
    if (!e.length) s += `<text class="dg-note" x="80" y="${y + 20}">（空）</text>`;
    e.forEach(([k, v]) => {
      const txt = v === undefined ? String(k) : `${k} → ${Array.isArray(v) ? '[' + v.join(',') + ']' : v}`;
      const w = Math.max(44, tw(txt, 12.5) + 22);
      if (x + w > AW - 10) { x = 16; y += lineH; lines++; }
      const cls = hl.has(String(k)) ? (b.hlCls || 'cur') : '';
      s += `<g data-k="${b.id}:m:${esc(k)}" data-t="${esc(txt)}" class="dg-chipv ${cls}" style="${tr(x, y)}"><rect width="${w}" height="26" rx="13"/><text x="${w / 2}" y="17.5">${esc(txt)}</text></g>`;
      x += w + 8;
    });
    return { s, h: 22 + lines * lineH + 4 };
  };
  // 变量 / 结果：一行小标签
  R.vars = (b, y0) => {
    let x = 16, s = '';
    b.v.forEach(([k, v, cls]) => {
      const txt = `${k} = ${v}`;
      const w = tw(txt, 12.5) + 20;
      s += `<g data-k="${b.id || 'vars'}:${esc(k)}" data-t="${esc(String(v))}" class="dg-var ${cls || ''}" style="${tr(x, y0 + 4)}"><rect width="${w}" height="26" rx="6"/><text x="10" y="17.5">${esc(txt)}</text></g>`;
      x += w + 8;
    });
    return { s, h: 36 };
  };
  R.text = (b, y0) => ({ s: `<text class="dg-result ${b.cls || ''}" x="${AW / 2}" y="${y0 + 20}">${esc(b.v)}</text>`, h: 32 });
  // 链表：n 为节点 [{k,v}] 按显示顺序；nx 为 {k: 下一个 k|null}；p 为指针 name→k
  R.list = (b, y0) => {
    const nodes = b.n;
    const n = nodes.length;
    const textW = Math.max(...nodes.map((nd) => tw(String(nd.v), 14))) + 16;
    const cw = Math.max(Math.min(56, Math.floor((AW - 80) / Math.max(1, n)) - 22), Math.min(118, textW));
    const gap = Math.max(22, Math.min(40, (AW - 80 - n * cw) / Math.max(1, n - 1)));
    const total = n * cw + (n - 1) * gap;
    const x0 = Math.max(40, (AW - total) / 2);
    const y = y0 + (b.label ? 26 : 10) + 18;
    const pos = {};
    nodes.forEach((nd, i) => { pos[nd.k] = x0 + i * (cw + gap); });
    let s = blockLabel(b.label, y0);
    const nh = 36;
    // 箭头
    Object.entries(b.nx || {}).forEach(([k, t]) => {
      if (pos[k] == null) return;
      const xa = pos[k];
      if (t === null) { if (b.showNull !== false) s += `<text class="dg-null" x="${xa + cw + 10}" y="${y + nh / 2 + 4}">∅</text>`; return; }
      if (pos[t] == null) return;
      const xb = pos[t];
      const cls = (b.ehl && b.ehl[k]) || '';
      if (xb > xa) s += `<path class="dg-larrow ${cls}" d="M${xa + cw + 2} ${y + nh / 2} L${xb - 3} ${y + nh / 2}" marker-end="url(#dg-ah${cls ? '-on' : ''})"/>`;
      else { const lift = 22 + Math.min(30, Math.abs(xa - xb) / 12); s += `<path class="dg-larrow back ${cls}" d="M${xa + cw / 2} ${y - 1} C${xa + cw / 2} ${y - lift - 8} ${xb + cw / 2} ${y - lift - 8} ${xb + cw / 2 + 4} ${y - 3}" marker-end="url(#dg-ah${cls ? '-on' : ''})"/>`; }
    });
    nodes.forEach((nd) => {
      const cls = (b.hl && b.hl[nd.k]) || '';
      s += `<g data-k="${b.id}:n:${nd.k}" data-t="${esc(nd.v)}" class="dg-lnode ${cls}" style="${tr(pos[nd.k], y)}"><rect width="${cw}" height="${nh}" rx="8"/><text x="${cw / 2}" y="${nh / 2 + 5}">${esc(nd.v)}</text></g>`;
    });
    const byK = {};
    Object.entries(b.p || {}).forEach(([name, k]) => { if (k == null) return; (byK[k] ||= []).push(name); });
    let mx = 0;
    Object.entries(byK).forEach(([k, names]) => names.forEach((name, j) => {
      if (pos[k] == null) return;
      mx = Math.max(mx, j + 1);
      s += `<g data-k="${b.id}:p:${name}" class="dg-ptr p${j}" style="${tr(pos[k] + cw / 2, y + nh + 6 + j * 17)}"><path d="M0 0 l-5 7 h10 z"/><text y="19">${esc(name)}</text></g>`;
    }));
    return { s, h: (b.label ? 26 : 10) + 18 + nh + 16 + Math.max(1, mx) * 17 };
  };
  // 二叉树：v 为 LeetCode 层序数组（null 表示空）；hl/tag/p 以层序下标为键
  function treeNodes(arr) {
    if (!arr.length || arr[0] == null) return [];
    const nodes = [{ i: 0, v: arr[0], d: 0, l: null, r: null }];
    const q = [nodes[0]];
    let k = 1;
    while (q.length && k < arr.length) {
      const cur = q.shift();
      for (const side of ['l', 'r']) {
        if (k >= arr.length) break;
        const v = arr[k];
        if (v != null) { const nd = { i: k, v, d: cur.d + 1, l: null, r: null, parent: cur.i }; cur[side] = nd; nodes.push(nd); q.push(nd); }
        k++;
      }
    }
    let x = 0;
    const walk = (nd) => { if (!nd) return; walk(nd.l); nd.x = x++; walk(nd.r); };
    walk(nodes[0]);
    return nodes;
  }
  // 节点对象树 {v, id, left, right} → 布局节点（中序决定横坐标，键为 id，结构变化时节点平滑移动）
  function objNodes(root) {
    const nodes = [];
    const walk = (n, d, par) => {
      if (!n) return null;
      const nd = { i: n.id, v: n.v, d, parent: par };
      nodes.push(nd);
      nd.l = walk(n.left, d + 1, n.id);
      nd.r = walk(n.right, d + 1, n.id);
      return nd;
    };
    walk(root, 0, null);
    let x = 0;
    const io = (nd) => { if (!nd) return; io(nd.l); nd.x = x++; io(nd.r); };
    io(nodes[0]);
    return nodes;
  }
  R.tree = (b, y0) => {
    const nodes = b.root !== undefined ? objNodes(b.root) : treeNodes(b.v);
    if (!nodes.length) return { s: blockLabel(b.label, y0) + `<text class="dg-note" x="${AW / 2}" y="${y0 + 34}">（空树）</text>`, h: 50 };
    const maxD = nodes.reduce((m, n) => Math.max(m, n.d), 0);
    const cnt = nodes.length;
    const sx = Math.min(56, (AW - 80) / Math.max(1, cnt - 1 || 1));
    const x0 = (AW - (cnt - 1) * sx) / 2;
    const sy = 62, r = 17;
    const y = y0 + (b.label ? 30 : 16) + r;
    const P = {};
    nodes.forEach((n) => { P[n.i] = [x0 + n.x * sx, y + n.d * sy]; });
    let s = blockLabel(b.label, y0);
    nodes.forEach((n) => { if (n.parent != null) { const [x1, y1] = P[n.parent], [x2, y2] = P[n.i]; const cls = (b.ehl && b.ehl[n.i]) || ''; s += `<line class="dg-tedge ${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; } });
    nodes.forEach((n) => {
      const cls = (b.hl && b.hl[n.i]) || '';
      const [x, yy] = P[n.i];
      s += `<g data-k="${b.id}:t${n.i}" data-t="${esc(n.v)}" class="dg-tnode ${cls}" style="${tr(x, yy)}"><circle r="${r}"/><text y="5">${esc(n.v)}</text>${b.tag && b.tag[n.i] != null ? `<text class="dg-tag" y="${r + 14}">${esc(b.tag[n.i])}</text>` : ''}</g>`;
    });
    Object.entries(b.p || {}).forEach(([name, i], j) => {
      if (i == null || !P[i]) return;
      const [x, yy] = P[i];
      s += `<g data-k="${b.id}:p:${name}" class="dg-tptr" style="${tr(x - r - 4, yy - r - 2)}"><text text-anchor="end">${esc(name)}</text></g>`;
    });
    return { s, h: (b.label ? 30 : 16) + r * 2 + maxD * sy + (b.tag ? 22 : 10) };
  };
  // 网格 / DP 表：g 二维数组；hl {'r,c':cls}；rh/ch 行列表头
  R.grid = (b, y0) => {
    const rows = b.g.length, cols = b.g[0].length;
    const hasRh = !!b.rh, hasCh = !!b.ch;
    const cw = Math.max(24, Math.min(b.cw || 40, Math.floor((AW - 80 - (hasRh ? 40 : 0)) / cols) - 3));
    const chh = b.cellH || cw;
    const gap = 3;
    const rhW = hasRh ? Math.max(28, Math.min(cw, 60)) + 6 : 0;
    const total = cols * cw + (cols - 1) * gap + rhW;
    const x0 = Math.max(20, (AW - total) / 2) + rhW;
    const y = y0 + (b.label ? 22 : 6) + (hasCh ? 20 : 0);
    let s = blockLabel(b.label, y0);
    if (hasCh) b.ch.forEach((c, j) => { s += `<text class="dg-hdr" x="${x0 + j * (cw + gap) + cw / 2}" y="${y - 7}">${esc(c)}</text>`; });
    for (let r = 0; r < rows; r++) {
      if (hasRh) s += `<text class="dg-hdr" x="${x0 - 10}" y="${y + r * (chh + gap) + chh / 2 + 4}" text-anchor="end">${esc(b.rh[r])}</text>`;
      for (let c = 0; c < cols; c++) {
        const v = b.g[r][c];
        const cls = (b.hl && b.hl[r + ',' + c]) || '';
        const txt = v === null || v === undefined ? '' : String(v);
        const fs = txt.length > 3 ? Math.max(9.5, Math.min(12.5, (cw - 6) / (tw(txt, 1) || 1))) : Math.min(13, chh * 0.42);
        s += `<g data-k="${b.id}:g${r},${c}" data-t="${esc(txt)}" class="dg-cell ${cls}" style="${tr(x0 + c * (cw + gap), y + r * (chh + gap))}"><rect width="${cw}" height="${chh}" rx="5"/><text x="${cw / 2}" y="${chh / 2 + 4.5}" style="font-size:${fs.toFixed(1)}px">${esc(txt)}</text></g>`;
      }
    }
    Object.entries(b.p || {}).forEach(([name, rc]) => {
      if (!rc) return;
      const [r, c] = rc.split(',').map(Number);
      s += `<g data-k="${b.id}:p:${name}" class="dg-gptr" style="${tr(x0 + c * (cw + gap) + cw - 2, y + r * (chh + gap) + 2)}"><circle r="8"/><text y="3.5">${esc(name)}</text></g>`;
    });
    return { s, h: (b.label ? 22 : 6) + (hasCh ? 20 : 0) + rows * (chh + gap) + 10 };
  };
  // 柱状图：v 高度；water 每列积水；hl；p 指针；area [l,r,h] 画出容器
  R.bars = (b, y0) => {
    const n = b.v.length, mx = Math.max(1, ...b.v, ...(b.water || []).map((w, i) => w + b.v[i]));
    const cw = Math.min(40, Math.floor((AW - 80) / n) - 4), gap = 4;
    const x0 = (AW - (n * cw + (n - 1) * gap)) / 2;
    const H = 130, unit = H / mx;
    const base = y0 + (b.label ? 22 : 8) + H;
    let s = blockLabel(b.label, y0);
    if (b.area) {
      const [l, r, hh] = b.area;
      s += `<g data-k="${b.id}:area" data-w="${(r - l) * (cw + gap) + cw}" class="dg-area" style="${tr(x0 + l * (cw + gap), base - hh * unit)}"><rect class="dg-wrect" width="${(r - l) * (cw + gap) + cw}" height="${hh * unit}"/></g>`;
    }
    b.v.forEach((v, i) => {
      const x = x0 + i * (cw + gap);
      const cls = (b.hl && b.hl[i]) || '';
      if (b.water && b.water[i] > 0) s += `<rect class="dg-water" x="${x}" y="${base - (v + b.water[i]) * unit}" width="${cw}" height="${b.water[i] * unit}"/>`;
      s += `<g class="dg-bar ${cls}"><rect x="${x}" y="${base - v * unit}" width="${cw}" height="${Math.max(1, v * unit)}" rx="3"/><text x="${x + cw / 2}" y="${base - v * unit - 5}">${v}</text></g>`;
      s += `<text class="dg-idx" x="${x + cw / 2}" y="${base + 14}">${i}</text>`;
    });
    Object.entries(b.p || {}).forEach(([name, i], j) => {
      if (i == null) return;
      s += `<g data-k="${b.id}:p:${name}" class="dg-ptr p${j}" style="${tr(x0 + i * (cw + gap) + cw / 2, base + 20)}"><path d="M0 0 l-5 7 h10 z"/><text y="19">${esc(name)}</text></g>`;
    });
    return { s, h: (b.label ? 22 : 8) + H + 58 };
  };
  // 区间：v [[s,e]]；out 合并结果
  R.iv = (b, y0) => {
    const all = [...b.v, ...(b.out || [])];
    const lo = Math.min(...all.map((x) => x[0])), hi = Math.max(...all.map((x) => x[1]));
    const x0 = 70, W = AW - 110, sc = W / Math.max(1, hi - lo);
    const X = (v) => x0 + (v - lo) * sc;
    let s = blockLabel(b.label, y0);
    let y = y0 + (b.label ? 24 : 8);
    b.v.forEach(([a, c], i) => {
      const cls = (b.hl && b.hl[i]) || '';
      s += `<g class="dg-ivl ${cls}"><rect x="${X(a)}" y="${y}" width="${Math.max(4, (c - a) * sc)}" height="16" rx="8"/><text x="${X(a) - 6}" y="${y + 12}" text-anchor="end">[${a},${c}]</text></g>`;
      y += 22;
    });
    if (b.out) {
      y += 6;
      s += `<text class="dg-blabel" x="8" y="${y + 12}">结果</text>`;
      b.out.forEach(([a, c]) => { s += `<g class="dg-ivl ok"><rect x="${X(a)}" y="${y}" width="${Math.max(4, (c - a) * sc)}" height="16" rx="8"/><text x="${X(a) + ((c - a) * sc) / 2}" y="${y + 12}" text-anchor="middle" class="in">[${a},${c}]</text></g>`; });
      y += 22;
    }
    for (let t = lo; t <= hi; t += Math.max(1, Math.ceil((hi - lo) / 12))) s += `<text class="dg-idx" x="${X(t)}" y="${y + 12}">${t}</text>`;
    return { s, h: y - y0 + 22 };
  };
  // 图：nodes [{k,x,y,label}]（x,y 为 0~1），edges [[a,b]]
  R.graph = (b, y0) => {
    const H = b.h || 190, W = AW - 120, x0 = 60;
    const y = y0 + (b.label ? 24 : 8);
    const P = {};
    b.nodes.forEach((n) => { P[n.k] = [x0 + n.x * W, y + 18 + n.y * (H - 36)]; });
    let s = blockLabel(b.label, y0);
    (b.edges || []).forEach(([a, c, w]) => {
      const [x1, y1] = P[a], [x2, y2] = P[c];
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      const cls = (b.ehl && (b.ehl[a + '-' + c] || (!b.directed && b.ehl[c + '-' + a]))) || '';
      s += `<line class="dg-gedge ${cls}" x1="${x1 + ux * 18}" y1="${y1 + uy * 18}" x2="${x2 - ux * 20}" y2="${y2 - uy * 20}" ${b.directed ? `marker-end="url(#dg-ah${cls ? '-on' : ''})"` : ''}/>`;
      if (w != null) s += `<text class="dg-idx" x="${(x1 + x2) / 2 + 6}" y="${(y1 + y2) / 2 - 4}">${esc(w)}</text>`;
    });
    b.nodes.forEach((n) => {
      const cls = (b.hl && b.hl[n.k]) || '';
      const [x, yy] = P[n.k];
      s += `<g data-k="${b.id}:gn${n.k}" class="dg-tnode ${cls}" style="${tr(x, yy)}"><circle r="17"/><text y="5">${esc(n.label ?? n.k)}</text>${b.tag && b.tag[n.k] != null ? `<text class="dg-tag" y="31">${esc(b.tag[n.k])}</text>` : ''}</g>`;
    });
    return { s, h: (b.label ? 24 : 8) + H + (b.tag ? 12 : 0) };
  };

  function renderScene(frame) {
    let y = 8, body = '';
    for (const b of frame.blocks || []) {
      const f = R[b.t];
      if (!f) continue;
      const out = f(Object.assign({ id: b.t }, b), y);
      body += out.s;
      y += out.h + 8;
    }
    return { svg: body, h: y + 4 };
  }
  function renderAlgo(id, trace) {
    return `<figure class="dg dg-algo" data-trace="${esc(id)}">
      <div class="dg-head"><span class="dg-kind">逐步演示</span><strong>${esc(trace.title || '')}</strong><span class="dg-input">${esc(trace.input || '')}</span></div>
      <div class="dg-stage"></div>
      <div class="dg-cap"></div>
      ${ctrlHtml(2)}
    </figure>`;
  }
  const mk = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const traceCache = new Map();
  function framesOf(id, trace) {
    if (traceCache.has(id)) return traceCache.get(id);
    const frames = [];
    const F = (fr) => frames.push(fr);
    try { trace.run(F); } catch (err) { frames.push({ cap: '演示生成失败：' + err.message, blocks: [] }); }
    // 只有结论文字 / 变量的「总结帧」沿用上一帧的数据结构，避免画面突然变空
    for (let i = 1; i < frames.length; i++) {
      const bl = frames[i].blocks || [];
      if (bl.every((b) => b.t === 'text' || b.t === 'vars')) {
        const keep = (frames[i - 1].blocks || []).filter((b) => b.t !== 'text' && b.t !== 'vars' && !bl.some((x) => x.id && x.id === b.id));
        frames[i].blocks = [...keep, ...bl];
      }
    }
    traceCache.set(id, frames);
    return frames;
  }
  function mountAlgo(fig, id, trace) {
    const frames = framesOf(id, trace);
    // 统一高度，避免播放时页面跳动
    const H = Math.max(...frames.map((f) => renderScene(f).h));
    const stage = fig.querySelector('.dg-stage');
    const cap = fig.querySelector('.dg-cap');
    stage.innerHTML = svgOpen(AW, H, 'algo') + DEFS + '<g class="dg-layer"></g></svg>';
    const layer = stage.querySelector('.dg-layer');
    fig.querySelector('.dg-range').max = String(frames.length - 1);
    mountPlayer(fig, frames.length, (i) => {
      const fr = frames[i];
      flipSwap(layer, renderScene(fr).svg);
      cap.innerHTML = `<span class="dg-no">${i + 1}</span><span class="dg-ctext">${mk(fr.cap || '')}</span>`;
      fig.classList.toggle('is-done', !!fr.done);
    }, { interval: trace.interval || 1150 });
  }

  function mountAll(root) {
    root.querySelectorAll('figure.dg-arch').forEach((fig) => { const sp = typeof ARCH !== 'undefined' && ARCH[fig.dataset.arch]; if (sp) mountArch(fig, sp); });
    root.querySelectorAll('figure.dg-algo').forEach((fig) => { const t = typeof TRACES !== 'undefined' && TRACES[fig.dataset.trace]; if (t) mountAlgo(fig, fig.dataset.trace, t); });
  }
  function stopAll() { players.splice(0).forEach((p) => p.stop()); }

  return { renderArch, renderAlgo, mountAll, stopAll, framesOf, treeNodes };
})();

;

;

/* Source: src/visuals/architecture-specs.js */
/* ==========================================================================
   场景题架构图规格
   nodes: 键 → [类型, 列, 行, '主标题\n副标题', {w}]
     类型：c 客户端 · edge 接入/网关 · svc 服务 · cache 缓存 · mq 队列 · db 数据库 · store 文件/对象存储
           job 后台任务 · ext 外部依赖 · cfg 配置/注册中心 · algo 数据结构
   flows: [流程名, [[起点, 终点, 这一步做什么, 补充说明], ...], 总览说明]；起点 = 终点表示节点内部动作
   ========================================================================== */
const ARCH = {
  'scenario-design-framework': {
    title: '通用高并发系统骨架：先主链路，再高可用兜底',
    lanes: ['客户端', '接入层', '服务层', '中间件', '存储'],
    nodes: {
      u: ['c', 0, 1, '用户\nApp / Web'],
      cdn: ['edge', 1, 0, 'DNS / CDN\n静态资源就近'],
      gw: ['edge', 1, 1, 'LB + 网关\n鉴权 · 限流 · 路由'],
      svc: ['svc', 2, 1, '领域服务\n无状态 · 水平扩容'],
      wk: ['job', 2, 2, '异步消费者\n幂等消费'],
      rc: ['job', 2, 0, '对账 / 补偿任务'],
      cache: ['cache', 3, 0, 'Redis 缓存\n热点 · 多副本'],
      mq: ['mq', 3, 1, 'MQ\n削峰 · 解耦'],
      ext: ['ext', 3, 2, '第三方依赖\n超时 · 熔断'],
      db: ['db', 4, 1, 'MySQL 集群\n分库分表 · 最终事实'],
    },
    flows: [
      ['主链路（高性能）', [
        ['u', 'cdn', '静态资源走 DNS/CDN 就近返回', '动静分离，源站只承接动态请求'],
        ['u', 'gw', '动态请求进 LB/网关', '统一鉴权、限流、路由、灰度'],
        ['gw', 'svc', '路由到无状态领域服务', '按业务领域拆分；无状态才能水平扩容'],
        ['svc', 'cache', '优先读缓存，热点直接命中', '缓存扛读；注意穿透 / 击穿 / 雪崩'],
        ['svc', 'db', '未命中回源数据库并回填缓存', '数据库是最终事实；按业务键分库分表'],
        ['svc', 'mq', '非关键操作异步化写 MQ', '削峰填谷、解耦下游，主链路 RT 变短'],
        ['mq', 'wk', '消费者异步处理', '至少一次投递 → 业务必须幂等'],
        ['wk', 'db', '落库完成异步步骤', '状态机推进'],
      ], '先把一次请求的主链路讲顺：入口 → 服务 → 缓存 / DB → 异步化，再逐个组件讲故障与兜底。'],
      ['高可用兜底', [
        ['gw', 'gw', '入口限流 / 降级开关', '超出容量快速失败，保护后端'],
        ['svc', 'ext', '调用第三方：deadline 超时 + 有限重试', '错误率超阈值熔断，走降级（缓存 / 默认值 / 异步补偿）'],
        ['svc', 'cache', '缓存故障：本地缓存 + 受控回源', 'singleflight + 限流保护 DB'],
        ['svc', 'db', 'DB 主从切换期间写失败可重试', '重试必须幂等、带退避与预算，避免重试风暴'],
        ['rc', 'db', '对账任务扫描中间态订单', '异步链路用状态机 + 对账补偿保证最终一致'],
        ['rc', 'mq', '补发丢失的消息 / 事件', '恢复后限速，防止二次雪崩'],
      ], '任何跨服务调用都要回答：超时多少、重试几次、失败怎么降级、恢复后怎么限速。'],
    ],
  },

  'scenario-realtime-music-ranking': {
    title: '播放事件流 → 分片 ZSet → 归并 TopK → 物化榜单',
    lanes: ['客户端', '接入层', '消息与计算', '存储', '查询侧'],
    nodes: {
      app: ['c', 0, 1, '播放客户端\n上报 event_id'],
      rd: ['c', 0, 2.3, '看榜用户'],
      api: ['edge', 1, 1, '接入服务\n鉴权 · 校验 · 限流'],
      dup: ['cache', 1, 0, '幂等去重\nevent_id SETNX'],
      kafka: ['mq', 2, 0, 'Kafka\n按 song_id 分区'],
      agg: ['svc', 2, 1, '流式聚合\n100ms~1s 小窗口'],
      zset: ['cache', 3, 0, 'Redis ZSet 分片\n批量 ZINCRBY'],
      db: ['db', 3, 1.9, '聚合持久化\n小时 / 天粒度'],
      topk: ['job', 4, 0, 'TopK 归并\n各分片 Top1000'],
      mat: ['cache', 4, 1, '物化榜单\n秒级 TTL'],
      qs: ['svc', 4, 2.3, '查询服务\n批量补齐元数据'],
    },
    flows: [
      ['写入链路', [
        ['app', 'api', '上报播放事实', 'event_id / user_id / song_id / 有效时长，客户端不自己计数'],
        ['api', 'dup', '按 event_id 快速幂等 + 基础风控', '防重复上报、防刷'],
        ['api', 'kafka', '写入 Kafka 削峰', '按 song_id 或 song_id+bucket 分区，消费者可水平扩容'],
        ['kafka', 'agg', '消费者按 song_id 小窗口合并增量', '同一首歌 1s 内 1000 次播放合并成一次 +1000'],
        ['agg', 'zset', '批量 ZINCRBY 更新分片榜单', '单 ZSet 扛不住时拆成多个分片，各自维护局部 TopK'],
        ['agg', 'db', '可重放的聚合结果批量落库', 'Redis 只负责实时服务，不是唯一事实源'],
      ], '写多读多：写侧用 MQ + 小窗口聚合把 QPS 降两个数量级，读侧只读物化结果。'],
      ['读取链路', [
        ['topk', 'zset', '周期读取每个分片的 Top1000'],
        ['topk', 'topk', 'K 路归并得到全局 Top1000', '分片越多归并越重，但只在后台做'],
        ['topk', 'mat', '写入秒级 TTL 的物化榜单'],
        ['rd', 'qs', '用户请求排行榜'],
        ['qs', 'mat', '直接读物化结果', '绝大多数请求不访问分片 ZSet；详情按 song_id 批量补齐'],
      ]],
      ['故障降级', [
        ['kafka', 'kafka', 'MQ 积压：允许榜单延迟上升，但不丢事件', '扩容消费者时保持分区内顺序'],
        ['qs', 'mat', 'Redis 故障：继续读最近一次物化榜单'],
        ['agg', 'db', '持续落 durable aggregate'],
        ['db', 'zset', 'Redis 恢复后从聚合结果重建实时榜'],
      ]],
    ],
  },

  'scenario-live-comment-system': {
    title: '评论接入审核 → 窗口聚合采样 → 按网关节点扇出',
    lanes: ['用户', '长连接网关', '处理', '分发', '存储'],
    nodes: {
      ua: ['c', 0, 0, '用户 A\n发评论'],
      ub: ['c', 0, 2, '房间观众\n百万长连接'],
      gw: ['edge', 1, 0, 'WS 网关\n鉴权 · 心跳'],
      gw2: ['edge', 1, 2, 'WS 网关集群\n本机批量写 socket'],
      mod: ['svc', 2, 0, '审核 / 频控\n敏感词 · 风控'],
      mq: ['mq', 3, 0, 'MQ\nroom_id+bucket 分区'],
      agg: ['svc', 3, 1, '窗口聚合\n高优保留 · 采样'],
      fan: ['svc', 2, 2, 'Fanout 服务\n房间 → 网关订阅'],
      recent: ['cache', 4, 1, '最近消息\n环形缓冲 + seq'],
      hist: ['db', 4, 2, '历史评论\n异步批量持久化'],
    },
    flows: [
      ['发送与广播', [
        ['ua', 'gw', '通过长连接发送评论'],
        ['gw', 'mod', '敏感词 / 风控 / 频率控制', '不合规的直接拦截，不进 MQ'],
        ['mod', 'mq', '通过审核写入 MQ', '按 room_id + logical_bucket 分区，避免超级房间打爆单分区'],
        ['mq', 'agg', '100ms~1s 窗口聚合', '主播 / 管理员消息全部保留；普通评论按质量分、频率采样'],
        ['agg', 'recent', '入选消息分配 sequence，写最近消息缓冲'],
        ['agg', 'fan', '入选消息进入房间 fanout channel'],
        ['fan', 'gw2', '只发给有该房间连接的网关节点', '不是每个用户一条 MQ 消息'],
        ['gw2', 'ub', '网关本机内存扇出，批量写 socket', '慢客户端用有界队列，满了丢低优先级消息'],
        ['recent', 'hist', '历史消息异步批量持久化'],
      ], '核心是「消息量 × 观众数」的放大：先在聚合层削减条数，再按网关节点而不是按用户扇出。'],
      ['断线重连', [
        ['ub', 'gw2', '网关宕机：客户端重连到其他节点', '房间订阅从路由状态恢复'],
        ['gw2', 'recent', '携带 last_sequence 拉取缺失片段'],
        ['recent', 'gw2', '返回缺口消息'],
        ['gw2', 'ub', '补齐后继续实时推送'],
      ]],
    ],
  },

  'scenario-lan-distribute-500gb': {
    title: '分块 + 首份分散下载 + 局域网 P2P 扩散',
    lanes: ['公网', '协调', '局域网设备', '局域网设备'],
    nodes: {
      origin: ['ext', 0, 1, '公网源站\nmanifest + chunk'],
      coord: ['svc', 1, 1, 'Coordinator\n分配 · 发现 peers'],
      a: ['c', 2, 0, '设备 A\n首拉块 1~k'],
      b: ['c', 3, 0, '设备 B\n首拉块 k+1~2k'],
      c: ['c', 2, 2, '设备 C'],
      d: ['c', 3, 2, '设备 D … 30'],
    },
    flows: [
      ['分块扩散', [
        ['a', 'coord', '拉 manifest，发现同网段 peers', '文件切成 4~64MB 的块，每块带 hash'],
        ['coord', 'a', '分配 A 首份下载块 1~k'],
        ['coord', 'b', '分配 B 首份下载块 k+1~2k', '不同设备首拉不同块，而不是 30 台都下同一段'],
        ['origin', 'a', 'A 从公网拉分到的块并校验 hash', '公网总流量 ≈ 1 份文件，而不是 30 份'],
        ['origin', 'b', 'B 同理拉取自己的块'],
        ['a', 'c', 'A 校验通过立即成为该块的 LAN seed'],
        ['b', 'c', 'C 从多个 peer 并行拉缺失块', 'rarest-first，避免稀有块只剩一个副本'],
        ['c', 'd', '块在局域网内指数扩散'],
        ['d', 'd', '块集合完整后按 manifest 校验整文件', '失败块只重传对应 chunk'],
      ], '瓶颈是公网带宽：让 WAN 只承担约 1 份流量，其余都在局域网内交换。'],
      ['容错', [
        ['c', 'coord', 'peer 离线：上报并重新选择 source'],
        ['coord', 'd', '稀有块指派多个副本'],
        ['origin', 'd', 'P2P 失效时退化为中心分发', '支持断点续传，origin 兜底'],
      ]],
    ],
  },

  'scenario-single-machine-counter': {
    title: '把热点计数拆成多个槽位：写分散、读汇总',
    lanes: ['请求线程', '分片计数 (LongAdder Cell)', '汇总', '持久化'],
    nodes: {
      t1: ['c', 0, 0, '线程 T1'],
      t2: ['c', 0, 1, '线程 T2'],
      t3: ['c', 0, 2, '线程 Tn'],
      c1: ['algo', 1, 0, 'Cell[0]\n独立 CAS'],
      c2: ['algo', 1, 1, 'Cell[1]\n独立 CAS'],
      c3: ['algo', 1, 2, 'Cell[k]\n独立 CAS'],
      sum: ['svc', 2, 1, 'sum() 汇总\n读时求和'],
      wal: ['store', 3, 0, 'WAL 顺序日志\n（需可靠时）'],
      ck: ['db', 3, 2, 'checkpoint\n带 offset 快照'],
    },
    flows: [
      ['更新与读取', [
        ['t1', 'c1', 'T1 按线程 hash 选中 Cell[0] 做 CAS +1'],
        ['t2', 'c2', 'T2 更新 Cell[1]，与 T1 互不竞争', 'AtomicLong 单点 CAS 在高并发下大量自旋失败'],
        ['t3', 'c3', 'Tn 更新 Cell[k]', '冲突时 Cell 数组扩容，进一步分散'],
        ['c1', 'sum', '查询时把 base + 所有 Cell 求和'],
        ['c2', 'sum', '累加 Cell[1]'],
        ['c3', 'sum', '累加 Cell[k]', 'sum() 不是原子快照，适合统计类场景'],
      ], '单 JVM 首选 LongAdder；多进程则每进程本地计数，周期把 delta 汇总。'],
      ['可靠持久化', [
        ['t2', 'wal', '需要不丢时：增量先顺序追加 WAL', '批量刷盘，不能每次 +1 都 fsync'],
        ['sum', 'ck', '后台线程周期写 checkpoint（带 WAL offset）'],
        ['ck', 'sum', '重启：加载 checkpoint', '再从 offset 回放 WAL，避免重复累计'],
      ]],
    ],
  },

  'scenario-distributed-scheduler': {
    title: '控制面落库 → 分片调度 → MQ 投递 → Worker 租约执行',
    lanes: ['控制面', '调度面', '消息', '执行面', '兜底'],
    nodes: {
      user: ['c', 0, 0, '用户 / 控制台\n创建任务'],
      jdb: ['db', 0, 1.6, 'Job DB\nnext_fire_time · 版本'],
      sch: ['svc', 1, 0.8, 'Scheduler 分片\n持租约 owner'],
      tw: ['algo', 1, 2, '时间轮 / 延时队列\n近未来任务'],
      mq: ['mq', 2, 0.8, 'MQ\nexecution_id'],
      dlq: ['mq', 2, 2, 'DLQ\n超过重试上限'],
      wk: ['svc', 3, 0.8, 'Worker\n领取 · lease · 执行'],
      rec: ['db', 3, 2, 'execution 记录\nRUNNING / 成功 / 失败'],
      rc: ['job', 4, 1.4, 'Reconciler\n扫到期未触发 / 租约过期'],
    },
    flows: [
      ['触发与执行', [
        ['user', 'jdb', '创建任务：保存定义并计算 next_fire_time', 'DB 是控制面事实来源'],
        ['jdb', 'sch', '对应分片 owner 扫描近未来任务', '按 job_id hash / 时间桶分片，每片一个持租约的 owner'],
        ['sch', 'tw', '加载进内存时间轮 / 延时队列'],
        ['tw', 'sch', '到期触发'],
        ['sch', 'jdb', '原子更新触发状态（CAS 版本号）', '防止同一次触发被重复调度'],
        ['sch', 'mq', '生成 execution_id 并投递 MQ', '调度与执行解耦：调度面只负责“到期”'],
        ['mq', 'wk', 'Worker 领取并获取 lease'],
        ['wk', 'rec', '执行业务，写执行结果 / ACK', '至少一次语义 → 业务按 execution_id 幂等'],
        ['sch', 'jdb', '周期任务计算下一次 next_fire_time'],
      ], '三层分离：控制面（定义）/ 调度面（到期）/ 执行面（干活），各自独立扩容。'],
      ['失败与补偿', [
        ['wk', 'mq', '执行失败：按退避策略重试'],
        ['mq', 'dlq', '超过重试上限进入 DLQ', '人工或规则处理'],
        ['rc', 'rec', '扫描 RUNNING 且租约过期的执行', 'Worker 宕机时由租约到期发现'],
        ['rc', 'mq', '重新投递'],
        ['rc', 'jdb', '扫描已到期未触发的任务并补触发', 'Scheduler owner 失联时租约到期自动接管'],
      ]],
    ],
  },

  'scenario-service-prewarm': {
    title: '启动与预热解耦：关键数据同步、大数据后台分片 + 原子切换',
    lanes: ['数据源', '预热', '服务实例', '流量'],
    nodes: {
      cfg: ['cfg', 0, 0, '配置 / 快照元数据\nsnapshotVersion'],
      snap: ['store', 0, 1, '共享快照\nRedis / 对象存储'],
      db: ['db', 0, 2, '主库\n（避免被全量扫）'],
      cdc: ['mq', 1, 2, 'CDC 变更日志\n版本之后的增量'],
      ld: ['job', 1, 1, 'Warmup Loader\n分片 · 限速 · 重试'],
      boot: ['svc', 1, 0, '启动主流程\n同步加载关键小数据'],
      nc: ['cache', 2, 1, 'newCache\n构建中（双缓冲）'],
      ac: ['cache', 2, 0, 'activeCache\n正在服务'],
      rp: ['edge', 3, 0, 'Readiness Probe\n流量权重 0→100%'],
      lb: ['c', 3, 1, 'LB / 调用方'],
    },
    flows: [
      ['预热流程', [
        ['cfg', 'boot', '读取配置与上一次可用快照元数据'],
        ['boot', 'ac', '同步加载最小必需数据（严格超时）', '失败则保持 NotReady，或按策略用旧快照'],
        ['boot', 'rp', '进入 WARMING：低权重 / 回源模式接少量流量'],
        ['snap', 'ld', '后台按分片并行加载 snapshotVersion 数据', '随机抖动启动 + 协调器分片，避免重启惊群扫主库'],
        ['ld', 'nc', '写入 newCache，不覆盖正在服务的旧缓存'],
        ['cdc', 'nc', '追赶 snapshotVersion 之后的增量变更'],
        ['nc', 'nc', '校验数量 / 校验和'],
        ['nc', 'ac', '原子切换引用 activeCache = newCache'],
        ['rp', 'lb', 'readiness 提升，流量权重逐步到 100%'],
      ], '关键是“可启动 ≠ 已预热”：关键数据同步、优化型数据后台加载，最后原子切换。'],
      ['失败处理', [
        ['ld', 'db', '分片加载失败：只重试该分片（限速）'],
        ['nc', 'nc', '新缓存校验失败 → 丢弃，不覆盖 last-known-good'],
        ['ac', 'lb', '继续以旧快照 / 受控回源服务'],
      ]],
    ],
  },

  'scenario-external-dependency-isolation': {
    title: '把外部依赖的故障域关进一个小资源池',
    lanes: ['入口', '隔离层', '依赖', '兜底'],
    nodes: {
      req: ['c', 0, 1, '入口请求\n计算剩余 deadline'],
      bh: ['svc', 1, 0, 'Bulkhead\n独立线程池 / 信号量'],
      cb: ['svc', 1, 1, 'Circuit Breaker\n关闭 · 打开 · 半开'],
      rt: ['svc', 1, 2, '重试预算\n指数退避 + 抖动'],
      ext: ['ext', 2, 1, '合作方服务\n不可靠'],
      fb: ['cache', 3, 0, 'Fallback\n缓存 / 默认值'],
      ob: ['mq', 3, 1, '本地 Outbox / MQ\n写请求异步重试'],
      mt: ['job', 3, 2, '指标 / 告警\n错误率 · P99'],
    },
    flows: [
      ['正常调用', [
        ['req', 'bh', '判断能否降级，获取依赖并发许可', '许可耗尽立即拒绝，不排队拖住线程'],
        ['bh', 'cb', '熔断器关闭 → 放行'],
        ['cb', 'ext', '带 deadline 调用（连接 / 读超时都要设）'],
        ['ext', 'rt', '可重试错误：在预算内退避重试', '不可重试错误立即失败'],
        ['cb', 'mt', '持续统计错误率与慢调用'],
      ], '外部依赖一律按“不可靠”设计：超时 + 有界重试 + 熔断 + 隔离舱 + 降级。'],
      ['熔断与恢复', [
        ['cb', 'cb', '连续失败达到阈值 → 熔断打开', '后续请求快速失败，不再打到外部'],
        ['req', 'fb', '读请求走 fallback：缓存或默认值'],
        ['req', 'ob', '需可靠送达的写请求写 Outbox 异步重试'],
        ['cb', 'ext', '半开：少量探针请求测试恢复'],
        ['cb', 'cb', '探针成功 → 逐步关闭熔断并限制恢复流量', '避免所有实例同时放量'],
      ]],
    ],
  },

  'scenario-cross-site-sso': {
    title: 'OIDC 授权码 + PKCE：A、B 共同信任 IdP',
    lanes: ['浏览器', '业务站点', '身份中心 IdP'],
    nodes: {
      br: ['c', 0, 1, '浏览器\n带 IdP 域 Cookie'],
      a: ['svc', 1, 0, '网站 A\n本地 session'],
      b: ['svc', 1, 2, '网站 B\n本地 session'],
      auth: ['edge', 2, 0.5, 'IdP 授权端点\n/authorize · 复用会话'],
      tok: ['svc', 2, 1.6, 'IdP Token 端点\n签发 ID / Access Token'],
      ss: ['cache', 2, 2.6, 'IdP 会话存储\n+ JWKS'],
    },
    flows: [
      ['A 登录后访问 B', [
        ['br', 'a', '访问 A，未登录'],
        ['a', 'auth', 'A 重定向到 IdP 登录', '实际建立的是 IdP 会话'],
        ['auth', 'ss', '用户输入密码，IdP 建立会话并写 Cookie（IdP 域）'],
        ['auth', 'a', '回跳 A 带一次性 code，A 换 token 建本地 session'],
        ['br', 'b', '访问 B：B 没有本地 session'],
        ['b', 'auth', 'B 302 到 authorize（带 state / nonce / code_challenge）'],
        ['auth', 'ss', '浏览器带着 IdP Cookie → IdP 发现已有会话', '无需再次输入密码'],
        ['auth', 'b', '签发一次性 code，重定向回 B'],
        ['b', 'tok', 'B 后端用 code + code_verifier 换 token'],
        ['tok', 'b', '返回 ID Token；B 验签、校验 state / nonce，建立本地 session'],
      ], 'A、B 不共享业务 Cookie；真正共享的是 IdP 的会话。'],
      ['故障与安全', [
        ['b', 'b', 'IdP 暂不可用：已有本地 session 按有效期继续服务', '新登录快速失败，不无限重试'],
        ['b', 'ss', 'JWKS 缓存；kid miss 时刷新', '避免密钥轮换导致全站认证失败'],
      ]],
    ],
  },

  'scenario-qps-capacity-planning': {
    title: '需求侧算峰值 QPS，供给侧压测单实例安全 QPS',
    lanes: ['需求侧', '压测', '被测系统', '结论'],
    nodes: {
      biz: ['c', 0, 0, '业务指标\nDAU · 人均调用'],
      tm: ['algo', 0, 1.2, '流量模型\n峰值系数 · 增长'],
      lg: ['job', 1, 0, '压测机\n逐阶加并发'],
      svc: ['svc', 2, 0, '被测服务\n固定规格单实例'],
      dep: ['db', 2, 1.2, '下游依赖\nDB / Redis / Stub'],
      mt: ['cfg', 1, 1.2, '指标平台\nP99 · 错误率 · CPU · GC'],
      cap: ['svc', 3, 0.6, '容量模型\n峰值 ÷ 单机容量 ÷ 水位'],
      hpa: ['edge', 3, 1.8, 'HPA / 限流阈值\n+ N+1 冗余'],
    },
    flows: [
      ['评估流程', [
        ['biz', 'tm', '峰值 QPS = 活跃用户 × 人均调用 × 峰值系数 / 时间窗', '再叠加增长与活动系数'],
        ['lg', 'svc', '固定实例规格，逐阶增加并发'],
        ['svc', 'dep', '下游真实依赖或按比例挡板'],
        ['svc', 'mt', '记录 throughput、P99、错误率、CPU、GC、连接池'],
        ['mt', 'mt', 'SLO 开始失守 → 取前一档作为单实例安全 QPS', '先找第一个瓶颈，优化后重测'],
        ['tm', 'cap', '预估峰值 QPS'],
        ['mt', 'cap', '单实例安全 QPS'],
        ['cap', 'hpa', '实例数 ÷ 目标利用率 60~70%，满足 N+1 / 单 AZ 故障', '同时推导连接池、DB/Redis 容量与限流阈值'],
      ], '自动扩容有启动延迟，不能替代容量规划：突发仍需预留 headroom 和限流。'],
    ],
  },

  'scenario-order-timeout-close': {
    title: '延时触发只负责“尝试关闭”，状态由 DB 条件更新裁决',
    lanes: ['下单', '订单服务', '延时 / 消息', '存储', '兜底'],
    nodes: {
      u: ['c', 0, 0.5, '用户下单'],
      pay: ['ext', 0, 2, '支付回调'],
      os: ['svc', 1, 0.5, '订单服务\n创建 UNPAID'],
      cs: ['svc', 1, 2, '超时关单消费者'],
      dq: ['mq', 2, 0.5, '延时消息\nexpire_at 到期投递'],
      ev: ['mq', 2, 2, 'ReleaseInventory\n事件'],
      db: ['db', 3, 0.5, 'Order DB\n状态机 + Outbox'],
      inv: ['svc', 3, 2, '库存服务\n释放锁定库存'],
      rc: ['job', 4, 1.2, 'Reconciler\n扫过期仍 UNPAID'],
    },
    flows: [
      ['超时关单', [
        ['u', 'os', '提交订单'],
        ['os', 'db', '事务内写 UNPAID + expire_at + Outbox'],
        ['db', 'dq', 'Outbox 异步发布延时消息'],
        ['dq', 'cs', '到期投递给关单消费者'],
        ['cs', 'db', 'UPDATE … SET CLOSED WHERE id=? AND status=UNPAID', '只有 affectedRows = 1 才继续'],
        ['cs', 'ev', '关闭成功 → 发送释放库存事件'],
        ['ev', 'inv', '释放库存（幂等）', '释放失败进入重试 / 对账，不回滚订单状态'],
      ], '支付回调与超时关单是并发竞争同一行状态：谁的条件更新先成功，谁拿到状态所有权。'],
      ['与支付并发', [
        ['pay', 'os', '支付回调到达'],
        ['os', 'db', 'UPDATE … SET PAID WHERE status=UNPAID', '若已被关闭 → affectedRows = 0 → 走退款流程'],
        ['dq', 'cs', '延时消息此时到期'],
        ['cs', 'db', '条件更新 CLOSED 失败（已是 PAID）→ 直接丢弃', '重复消息也被 CAS 消化'],
      ]],
      ['漏消息兜底', [
        ['rc', 'db', '定期扫描 expire_at 已过且仍 UNPAID 的订单'],
        ['rc', 'cs', '补偿执行关单（同样走条件更新）'],
      ]],
    ],
  },

  'scenario-massive-topk': {
    title: 'Map：每分片局部小顶堆  →  Reduce：全局归并',
    lanes: ['数据文件', 'Worker 线程池', '局部结果', '归并'],
    nodes: {
      f1: ['store', 0, 0, 'file-1\n顺序读'],
      f2: ['store', 0, 1, 'file-2'],
      f3: ['store', 0, 2, 'file-n'],
      w1: ['svc', 1, 0, 'Worker 1\n大 buffer 流式读'],
      w2: ['svc', 1, 1, 'Worker 2'],
      w3: ['svc', 1, 2, 'Worker k'],
      h1: ['algo', 2, 0, '局部小顶堆\n容量 K'],
      h2: ['algo', 2, 1, '局部小顶堆\n容量 K'],
      h3: ['algo', 2, 2, '局部小顶堆\n容量 K'],
      g: ['algo', 3, 1, '全局小顶堆 K\n→ 降序输出'],
    },
    flows: [
      ['分治 TopK', [
        ['f1', 'w1', '固定大小线程池，每个 Worker 负责一个文件 / 分块'],
        ['w1', 'h1', '维护容量 K 的小顶堆：新值 > 堆顶才替换', '每个线程拥有自己的局部堆，不争全局锁'],
        ['f2', 'w2', '其他 Worker 并行扫描'],
        ['w2', 'h2', '局部 TopK'],
        ['f3', 'w3', '…'],
        ['w3', 'h3', '局部 TopK'],
        ['h1', 'g', '收集所有局部 K 个候选'],
        ['h2', 'g', '合并到全局小顶堆'],
        ['h3', 'g', '合并完成'],
        ['g', 'g', '按需降序输出 Top K', '内存只保留 K 个候选，复杂度 O(N log K)'],
      ], '内存装不下全部数据也没关系：算法只保留 K 个候选，真正的风险在 IO 和坏记录。'],
    ],
  },

  'scenario-external-sort': {
    title: 'Phase 1 分块排序生成 run，Phase 2 多路归并',
    lanes: ['输入', 'Phase 1 · 分块排序', 'Phase 2 · K 路归并', '输出'],
    nodes: {
      big: ['store', 0, 1, '大文件\n远大于内存'],
      mem: ['svc', 1, 0, '内存 chunk\nread → sort'],
      r1: ['store', 1, 1, 'run-1.tmp'],
      r2: ['store', 1, 2, 'run-n.tmp'],
      heap: ['algo', 2, 1, '小顶堆\n每个 run 一个队首'],
      tmp: ['store', 3, 0.6, 'final.tmp\nfsync · 校验'],
      out: ['db', 3, 1.8, '最终文件\n原子 rename'],
    },
    flows: [
      ['外部排序', [
        ['big', 'mem', '按内存大小读入一个 chunk'],
        ['mem', 'mem', '内存中排序'],
        ['mem', 'r1', '顺序写出有序 run-1'],
        ['mem', 'r2', '重复直到读完，得到 n 个有序 run'],
        ['r1', 'heap', '每个 run 打开 buffered reader，首元素入堆'],
        ['r2', 'heap', 'run 过多时分多轮归并，控制打开的 fd 数'],
        ['heap', 'tmp', '弹出最小值写出，并从对应 run 补一个'],
        ['tmp', 'out', '完成后校验并原子 rename，清理临时 run'],
      ], '优化点：run 大小、归并路数、读写缓冲区、临时空间；进程重启读 manifest 复用已完成的 run。'],
    ],
  },

  'scenario-redis-mysql-consistency': {
    title: 'Cache-Aside：读回填，写先提交 DB 再删缓存，失败可靠重试',
    lanes: ['调用方', '服务', '缓存', '存储', '兜底'],
    nodes: {
      r: ['c', 0, 0, '读请求'],
      w: ['c', 0, 2, '写请求'],
      svc: ['svc', 1, 1, '业务服务\nsingleflight 回源'],
      redis: ['cache', 2, 0, 'Redis\nkey + TTL'],
      mq: ['mq', 2, 2, 'Outbox / MQ\n可靠失效事件'],
      db: ['db', 3, 1, 'MySQL\n事实来源'],
      cdc: ['job', 4, 1, 'binlog CDC\nCanal 兜底删缓存'],
    },
    flows: [
      ['读路径', [
        ['r', 'svc', '读请求'],
        ['svc', 'redis', 'GET：命中直接返回'],
        ['svc', 'db', '未命中：singleflight 合并回源', '热点 key 同一时刻只放一个请求打 DB'],
        ['svc', 'redis', '回填缓存（带 TTL，加随机抖动）'],
      ]],
      ['写路径', [
        ['w', 'svc', '写请求'],
        ['svc', 'db', '事务更新 MySQL 并提交', '先写 DB 再删缓存，而不是更新缓存'],
        ['svc', 'redis', '删除缓存 key', '下次读自然回源拿到新值'],
        ['svc', 'mq', '删除失败：写入可靠失效事件', '不能回滚已提交的 DB'],
        ['mq', 'redis', '消费者重试删除直到成功'],
        ['db', 'cdc', '订阅 binlog'],
        ['cdc', 'redis', 'CDC 再次删除 / 校正，最终兜底'],
      ], '先删缓存再写库会在并发读下回填旧值；先写库后删缓存窗口更小，再用可靠重试 + CDC 兜底。'],
    ],
  },

  'scenario-rpc-framework': {
    title: '代理 → 编解码 → 负载均衡 → 长连接 → 服务端分发',
    lanes: ['调用方', '客户端框架', '网络 / 治理', '服务端框架', '业务'],
    nodes: {
      biz: ['c', 0, 1, '业务代码\nuserService.get(id)'],
      proxy: ['svc', 1, 0, '动态代理\n方法 → Request'],
      codec: ['svc', 1, 1, 'Codec\nProtobuf / JSON'],
      lb: ['svc', 1, 2, '负载均衡\n权重 · EWMA · 一致性哈希'],
      reg: ['cfg', 2, 0, '注册中心\n服务目录本地缓存'],
      conn: ['edge', 2, 1.4, '长连接池\nrequestId 关联响应'],
      el: ['svc', 3, 0.6, 'EventLoop\n解码'],
      pool: ['svc', 3, 1.8, '业务线程池\n隔离 · 满则拒绝'],
      impl: ['db', 4, 1.2, '服务实现\nMethodInvoker'],
    },
    flows: [
      ['一次调用', [
        ['biz', 'proxy', '调用本地接口，代理拦截'],
        ['proxy', 'codec', '封装 Request（接口 / 方法 / 参数 / requestId / deadline）并序列化'],
        ['reg', 'lb', '从本地缓存的服务目录拿到实例列表'],
        ['codec', 'lb', '选择实例（健康度 / 延迟 / 权重）'],
        ['lb', 'conn', '复用长连接发送'],
        ['conn', 'el', '服务端 EventLoop 解码'],
        ['el', 'pool', '投递到隔离的业务线程池', 'IO 线程不执行业务，避免阻塞'],
        ['pool', 'impl', '反射 / 生成代码调用服务方法'],
        ['impl', 'conn', '响应编码返回'],
        ['conn', 'proxy', '按 requestId 完成 Future，返回业务结果'],
      ], '先讲清调用语义与失败语义：超时、重试是否幂等、熔断、限流都在治理层统一处理。'],
      ['失败语义', [
        ['conn', 'conn', '连接健康检查 + outlier ejection'],
        ['pool', 'pool', '队列满 → 拒绝 / 背压，不无限排队'],
        ['lb', 'reg', '注册中心不可用：继续用本地缓存目录'],
        ['proxy', 'lb', '超时后按幂等语义决定是否重试其他实例'],
      ]],
    ],
  },

  'scenario-local-cache': {
    title: 'Caffeine 风格：容量淘汰 + TTL + singleflight + 失效广播',
    lanes: ['调用方', '本地缓存', '回源', '集群同步'],
    nodes: {
      req: ['c', 0, 1, '请求\nget(key, loader)'],
      map: ['algo', 1, 0, '并发 Map\n分段 / CAS'],
      ev: ['algo', 1, 1, '淘汰策略\nW-TinyLFU / LRU'],
      tw: ['job', 1, 2, '时间轮\n惰性 + 后台过期'],
      sf: ['svc', 2, 0, 'singleflight\n同 key 只回源一次'],
      src: ['db', 2, 1.3, 'Redis / DB\n远端数据'],
      bus: ['mq', 3, 0.6, '失效广播\nMQ / PubSub'],
      peer: ['svc', 3, 1.8, '其他实例\n本地缓存'],
    },
    flows: [
      ['读取与淘汰', [
        ['req', 'map', '命中直接返回'],
        ['map', 'sf', '未命中：进入 singleflight', '热点 key 同时 miss 只放一个 loader'],
        ['sf', 'src', 'loader 回源远端'],
        ['sf', 'map', 'put 回本地缓存', 'loader 失败不永久缓存异常，可短暂 stale-if-error'],
        ['map', 'ev', '异步记录访问频率 / 顺序'],
        ['ev', 'map', '超过 size / weight 上限时驱逐冷数据'],
        ['tw', 'map', '时间轮批量清理过期 entry', '不给每个 key 一个 Timer'],
      ]],
      ['数据变更', [
        ['req', 'map', '本机写事件：invalidate 本地 key'],
        ['map', 'bus', '广播失效消息（带版本号）'],
        ['bus', 'peer', '其他实例删除对应 key', '本地缓存不承担强一致，靠短 TTL + 通知收敛'],
      ]],
    ],
  },

  'scenario-seckill-system': {
    title: '前置拦截 → Redis Lua 原子预扣 → MQ 异步下单 → 对账兜底',
    lanes: ['用户', '接入层', '秒杀服务', '缓存 / 消息', '订单与存储'],
    nodes: {
      u: ['c', 0, 1, '抢购用户'],
      op: ['c', 0, 2.4, '运营\n运行中加库存'],
      cdn: ['edge', 1, 0, 'CDN\n静态页 · 倒计时'],
      gw: ['edge', 1, 1, '网关\n鉴权 · 分层限流 · 验证码'],
      sk: ['svc', 2, 1, '秒杀服务\n资格校验'],
      lua: ['cache', 3, 0, 'Redis Lua\n一人一单 + stock--'],
      st: ['mq', 3, 1.2, 'Redis Stream / MQ\n预占事件'],
      os: ['svc', 4, 0.6, '订单服务\nrequestId 幂等'],
      db: ['db', 4, 1.8, 'MySQL\n订单 · 库存流水'],
      rc: ['job', 2, 2.4, 'Reconciler\n孤儿预占 · 丢消息'],
    },
    flows: [
      ['抢购主链路', [
        ['u', 'cdn', '活动页、倒计时走 CDN', '不打源站'],
        ['u', 'gw', '点击抢购（带 token / 验证码）'],
        ['gw', 'sk', '分层限流后放行少量请求', '大部分请求在网关就被拒绝'],
        ['sk', 'lua', 'Lua 原子：校验一人一单、stock>0、stock--', '库存、资格、活动版本已提前预热到 Redis'],
        ['lua', 'st', '同一脚本内写入预占事件', '避免“扣库存成功但应用崩溃没发 MQ”的窗口'],
        ['st', 'os', '订单服务消费，按 requestId 幂等建单'],
        ['os', 'db', '落订单并扣减 DB 库存'],
        ['sk', 'u', '立即返回“排队中”，前端轮询结果'],
      ], '核心矛盾：瞬时流量远超库存。层层过滤，只让“有资格且有库存”的请求走到 DB。'],
      ['运行中加库存', [
        ['op', 'db', '持久化 AddStock(delta, version) 变更流水', '不要 SET stock=newTotal 覆盖并发扣减'],
        ['db', 'lua', 'INCRBY / Lua 原子增加 Redis 可售量', 'version 保证幂等'],
        ['rc', 'lua', '对账：预占 / 订单 / 流水 / 可售库存'],
      ]],
      ['异常兜底', [
        ['os', 'os', '消费失败：重试 → 死信'],
        ['rc', 'st', '扫描 PENDING 预占，补发事件'],
        ['rc', 'db', '超时未支付 → 关单并释放库存', '修复孤儿预占与重复释放'],
      ]],
    ],
  },

  'scenario-redis-outage': {
    title: '熔断 Redis → 本地缓存 → 受控回源 → 限速恢复',
    lanes: ['请求', '应用防护', '缓存层', '存储', '恢复'],
    nodes: {
      req: ['c', 0, 1, '读 / 写请求'],
      br: ['svc', 1, 0, 'Redis 客户端\n短超时 + 熔断'],
      lc: ['cache', 1, 1.2, '本地缓存\n旧快照'],
      lim: ['svc', 1, 2.4, '限流 + singleflight\n保护 DB'],
      redis: ['cache', 2, 0, 'Redis 集群\nSentinel / Cluster'],
      db: ['db', 3, 1.2, 'MySQL\n受控回源'],
      ob: ['mq', 3, 2.4, 'Outbox\n待失效 / 待重建'],
      rb: ['job', 4, 0.6, '重建任务\n限速预热热点'],
    },
    flows: [
      ['故障期间', [
        ['req', 'br', '访问 Redis'],
        ['br', 'redis', '连续超时 / 错误率升高'],
        ['br', 'br', '熔断打开：后续请求不再等待 Redis', '短 timeout 防止线程挂死'],
        ['req', 'lc', '读请求优先本地缓存 / 旧快照'],
        ['lc', 'lim', '本地未命中 → 限流 + singleflight'],
        ['lim', 'db', '只允许有限并发回源 DB', '超过阈值直接降级或提示稍后重试'],
        ['req', 'db', '写请求继续写 DB'],
        ['db', 'ob', '记录缓存失效 / 更新事件'],
      ], '先区分 Redis 存的是“可丢缓存”还是“锁 / 队列 / 计数”：后者必须 fail-close 或切换明确设计的备用路径。'],
      ['恢复', [
        ['redis', 'redis', '主从切换完成（基础设施 failover）'],
        ['br', 'redis', '熔断半开：少量探测'],
        ['ob', 'rb', '重放失效事件'],
        ['rb', 'redis', '限速重建热点缓存', '防止恢复瞬间全量回源造成二次雪崩'],
        ['br', 'br', '探测成功 → 关闭熔断，流量逐步恢复'],
      ]],
    ],
  },

  'scenario-distributed-rate-limit': {
    title: '本地快速限流 + Redis Lua 全局配额 + 规则动态下发',
    lanes: ['请求', '网关 / 实例', '集中配额', '配置 / 观测'],
    nodes: {
      req: ['c', 0, 1, '请求\n用户 / IP / 租户'],
      loc: ['svc', 1, 0.4, '本地令牌桶\n静态 / 租户规则'],
      gw: ['edge', 1, 1.6, '网关 / 服务入口\n429 快速返回'],
      lua: ['cache', 2, 0.4, 'Redis Lua\n滑动窗口 / 令牌桶'],
      qs: ['svc', 2, 1.6, '配额中心\n周期分配 quota'],
      cc: ['cfg', 3, 0.4, '配置中心\n规则 + version'],
      mt: ['job', 3, 1.6, '指标\nallowed · rejected'],
    },
    flows: [
      ['中低 QPS：Redis Lua', [
        ['cc', 'loc', '规则推送到实例本地缓存（带版本）'],
        ['req', 'gw', '请求进入'],
        ['gw', 'loc', '先过本地静态规则'],
        ['gw', 'lua', '需要全局精确配额：执行 Lua', '删旧数据 + 计数 + 判断 + 记录，一次原子执行'],
        ['lua', 'gw', '超限 → 429 / 业务错误码'],
        ['gw', 'mt', '上报放行 / 拒绝 / 延迟指标'],
      ]],
      ['高 QPS：配额下发', [
        ['qs', 'loc', '配额中心按实例周期分配 token 租约', '热路径不访问 Redis，牺牲少量精度'],
        ['req', 'gw', '请求进入'],
        ['gw', 'loc', '本地令牌桶直接判断'],
        ['loc', 'qs', '快用完时再申请下一批'],
      ]],
      ['降级', [
        ['lua', 'lua', 'Redis 故障'],
        ['gw', 'loc', '切换本地保守限流', '核心写倾向 fail-close，普通读可 fail-open'],
        ['cc', 'cc', '配置中心不可用：继续用 last-known-good 规则'],
      ]],
    ],
  },

  'scenario-distributed-lock': {
    title: 'SET NX PX 加锁 + 看门狗续期 + Lua 校验释放',
    lanes: ['客户端', '锁服务', '备选方案'],
    nodes: {
      c1: ['c', 0, 0, '客户端 A\n唯一 value'],
      c2: ['c', 0, 1.6, '客户端 B'],
      wd: ['job', 1, 1.6, 'Watchdog\n每 10s 续期'],
      redis: ['cache', 1, 0, 'Redis\nSET key val NX PX'],
      zk: ['cfg', 2, 0, 'ZooKeeper\n临时顺序节点 + watch'],
      db: ['db', 2, 1.6, 'DB 唯一索引\n简单低频'],
    },
    flows: [
      ['Redis 锁生命周期', [
        ['c1', 'redis', 'SET lock:order:1 <uuid> NX PX 30000', '一条命令同时完成互斥 + 过期'],
        ['redis', 'c1', '返回 OK，A 获得锁'],
        ['c2', 'redis', 'B 尝试加锁'],
        ['redis', 'c2', '返回 nil：自旋 / 订阅等待 / 快速失败'],
        ['wd', 'redis', '业务未结束：看门狗续期 PEXPIRE', 'Redisson 默认 30s 租期，每 10s 续'],
        ['c1', 'redis', 'Lua：GET == uuid 才 DEL', '防止误删别人的锁（锁可能已过期被 B 拿走）'],
      ], '三要素：互斥（NX）、防死锁（PX 过期）、只删自己的（value 校验 + Lua 原子）。'],
      ['故障与选型', [
        ['c1', 'c1', 'A 崩溃：锁到期自动释放'],
        ['redis', 'redis', '主从切换可能丢锁', '需要强一致时用 RedLock（有争议）或 ZK'],
        ['c1', 'zk', 'ZK：创建临时顺序节点，最小序号获得锁', '会话断开节点自动删除；只 watch 前一个节点避免惊群'],
        ['c2', 'db', 'DB：INSERT 唯一键抢锁', 'QPS 低、无自动过期，适合低频任务'],
      ]],
    ],
  },

  'scenario-short-url': {
    title: '发号 + Base62 编码；读侧缓存命中 302 跳转',
    lanes: ['客户端', '接入层', '短链服务', '缓存 / 发号', '存储'],
    nodes: {
      w: ['c', 0, 0, '生成方\n提交长链'],
      r: ['c', 0, 2, '访问者\n打开短链'],
      gw: ['edge', 1, 1, '网关\n限流防刷'],
      gen: ['svc', 2, 0, '生成服务\nBase62 编码'],
      rd: ['svc', 2, 2, '跳转服务\n301 / 302'],
      id: ['algo', 3, 0, '发号器\n号段 / Redis INCR'],
      cache: ['cache', 3, 2, 'Redis\n短码 → 长链'],
      db: ['db', 4, 1, 'MySQL\n短码唯一索引'],
      bf: ['algo', 4, 2.4, '布隆过滤器\n拦不存在短码'],
    },
    flows: [
      ['生成短链', [
        ['w', 'gw', '提交长链'],
        ['gw', 'gen', '限流后转发'],
        ['gen', 'id', '取全局唯一 ID', '号段模式：一次取 1000 个在内存发放'],
        ['gen', 'gen', 'ID → Base62 编码', '7 位 62 进制 ≈ 3.5 万亿个'],
        ['gen', 'db', '写入 短码 → 长链 映射'],
        ['gen', 'w', '返回短链'],
      ]],
      ['访问跳转', [
        ['r', 'gw', '打开短链'],
        ['gw', 'rd', '转发'],
        ['rd', 'cache', '查缓存：命中直接 302', '302 每次经过服务可统计点击；301 浏览器缓存更省但丢统计'],
        ['rd', 'bf', '未命中先过布隆过滤器', '拦截不存在的短码，防穿透'],
        ['rd', 'db', '回源 DB（互斥锁防击穿）'],
        ['rd', 'cache', '回填缓存'],
        ['rd', 'r', '302 Location: 长链'],
      ]],
    ],
  },

  'scenario-unique-id': {
    title: '雪花算法本地生成 vs 号段模式批量取号',
    lanes: ['应用', 'ID 生成', '协调 / 存储'],
    nodes: {
      app: ['c', 0, 1, '业务应用\n下单 / 建表主键'],
      sf: ['algo', 1, 0, 'Snowflake\n1 + 41 时间戳 + 10 机器 + 12 序列'],
      seg: ['svc', 1, 2, 'Leaf 号段\n双 buffer 预取'],
      zk: ['cfg', 2, 0, 'ZK / 配置\n分配 workerId'],
      db: ['db', 2, 2, '号段表\nmax_id + step'],
    },
    flows: [
      ['雪花算法', [
        ['zk', 'sf', '启动时分配唯一 workerId', '避免机器 ID 冲突'],
        ['app', 'sf', '请求 ID：本地生成，无网络调用'],
        ['sf', 'sf', '同一毫秒内序列号 +1，满 4096 等下一毫秒', '趋势递增，对 B+ 树友好'],
        ['sf', 'app', '返回 64 位 ID'],
        ['sf', 'sf', '时钟回拨：短时等待追平，长时拒绝并告警'],
      ]],
      ['号段模式', [
        ['seg', 'db', 'UPDATE max_id = max_id + step 取一段'],
        ['app', 'seg', '请求 ID：内存中递增发放'],
        ['seg', 'db', '用到 10% 时异步预取下一段', '双 buffer，DB 抖动时仍可继续发号'],
        ['seg', 'app', '返回 ID'],
      ]],
    ],
  },

  'scenario-message-queue': {
    title: 'RocketMQ：NameServer 路由 + CommitLog 顺序写 + ConsumeQueue 索引',
    lanes: ['生产者', '路由 / 副本', 'Broker', '消费者'],
    nodes: {
      p: ['c', 0, 0.6, 'Producer\n重试 + 本地消息表'],
      tx: ['svc', 0, 2, '本地事务\n业务 DB'],
      ns: ['cfg', 1, 0, 'NameServer\nTopic 路由'],
      cl: ['store', 2, 0.6, 'CommitLog\n所有消息顺序写'],
      cq: ['algo', 2, 1.8, 'ConsumeQueue\n按队列的索引'],
      sl: ['db', 1, 2, 'Slave / 副本\n同步复制'],
      c: ['c', 3, 1.2, 'Consumer Group\n拉取 · ACK'],
      dlq: ['mq', 3, 2.4, '重试队列 / DLQ'],
    },
    flows: [
      ['普通消息', [
        ['p', 'ns', '获取 Topic 路由（Broker + 队列）'],
        ['p', 'cl', '选择队列发送，Broker 顺序追加 CommitLog', '顺序写 + PageCache，吞吐高'],
        ['cl', 'sl', '同步 / 异步复制到副本'],
        ['cl', 'cq', '异步构建 ConsumeQueue 索引'],
        ['c', 'cq', '消费者按队列拉取 offset'],
        ['cq', 'c', '定位 CommitLog 读出消息'],
        ['c', 'c', '业务处理成功后 ACK / 提交 offset', '至少一次 → 业务幂等'],
        ['c', 'dlq', '消费失败重试，超过次数进入死信'],
      ]],
      ['事务消息', [
        ['p', 'cl', '发送半消息（消费者不可见）'],
        ['p', 'tx', '执行本地事务'],
        ['p', 'cl', '提交 Commit / Rollback'],
        ['cl', 'p', '长时间未决 → Broker 回查事务状态'],
        ['cq', 'c', 'Commit 后消费者可见'],
      ]],
    ],
  },

  'scenario-delay-queue': {
    title: 'Redis ZSet：score = 到期时间，扫描线程搬运到就绪队列',
    lanes: ['生产者', '延时存储', '触发', '消费者'],
    nodes: {
      p: ['c', 0, 1, 'Producer\n订单创建'],
      zset: ['cache', 1, 0.4, 'Redis ZSet\nscore = expireAt'],
      rmq: ['mq', 1, 1.8, 'RocketMQ 延迟级别\n/ 时间轮'],
      scan: ['job', 2, 0.4, '扫描线程\n抢锁 · 分片'],
      ready: ['mq', 2, 1.8, '就绪队列'],
      c: ['svc', 3, 1.1, 'Consumer\n幂等关单'],
    },
    flows: [
      ['ZSet 方案', [
        ['p', 'zset', 'ZADD delay_queue expireAt orderId'],
        ['scan', 'zset', 'ZRANGEBYSCORE 0 now LIMIT 100', '多实例用分布式锁或按 key 分片扫描'],
        ['scan', 'zset', 'ZREM 成功才算抢到（防多实例重复）', '或用 Lua 把“取出 + 删除”原子化'],
        ['scan', 'ready', '搬运到就绪队列'],
        ['ready', 'c', '消费者执行关单（条件更新幂等）'],
      ], 'Redis 需开 AOF + 主从防丢；DB 轮询简单但 QPS 低；RabbitMQ TTL+DLX 有队头阻塞。'],
      ['MQ 延迟消息', [
        ['p', 'rmq', '发送带延迟级别的消息', '4.x 固定 18 个级别；5.x 支持任意时间'],
        ['rmq', 'rmq', 'Broker 内部定时 / 时间轮到期'],
        ['rmq', 'c', '到期投递给消费者'],
      ]],
    ],
  },

  'scenario-oauth-login': {
    title: 'OAuth 2.0 授权码模式 + state 防 CSRF + PKCE',
    lanes: ['浏览器', '我方后端', '第三方平台'],
    nodes: {
      u: ['c', 0, 1, '用户浏览器'],
      be: ['svc', 1, 0.4, '我方后端\n回调 · 绑定账号'],
      rs: ['cache', 1, 1.8, 'Redis\nstate · code_verifier'],
      auth: ['ext', 2, 0, '授权页\n用户同意'],
      tok: ['ext', 2, 1.1, 'Token 接口\ncode → access_token'],
      api: ['ext', 2, 2.2, '用户信息接口\nopenid / unionid'],
    },
    flows: [
      ['授权登录', [
        ['u', 'be', '点击“微信登录”'],
        ['be', 'rs', '生成 state + code_verifier 存 Redis（短 TTL）'],
        ['be', 'u', '302 到授权页（带 state、code_challenge）'],
        ['u', 'auth', '用户在第三方页面确认授权'],
        ['auth', 'be', '回调我方 redirect_uri?code&state'],
        ['be', 'rs', '校验 state 一致且未使用', '不一致直接拒绝，防 CSRF'],
        ['be', 'tok', '后端用 code + client_secret / verifier 换 access_token', 'token 不经过浏览器'],
        ['be', 'api', '拉取用户信息'],
        ['be', 'be', 'openid / unionid 映射本地 user_id，签发本系统 JWT'],
        ['be', 'u', '登录成功'],
      ]],
    ],
  },

  'scenario-log-system': {
    title: '采集 → Kafka 缓冲 → 实时检索 / 分析 / 冷存储 三路',
    lanes: ['应用节点', '采集', '缓冲', '处理', '存储与展示'],
    nodes: {
      app: ['c', 0, 1, '应用日志\n结构化 JSON'],
      fb: ['edge', 1, 1, 'Filebeat\n断点续传 offset'],
      kafka: ['mq', 2, 1, 'Kafka\n削峰 · 多订阅'],
      ls: ['svc', 3, 0, 'Logstash\n解析 · 脱敏'],
      fl: ['svc', 3, 1, 'Flink\n聚合 · 告警规则'],
      arc: ['job', 3, 2, '归档任务'],
      es: ['db', 4, 0, 'Elasticsearch\n+ Kibana 检索'],
      ch: ['db', 4, 1, 'ClickHouse\n+ Grafana 分析'],
      hdfs: ['store', 4, 2, 'HDFS / 对象存储\n冷数据'],
    },
    flows: [
      ['日志链路', [
        ['app', 'fb', '写本地文件，Filebeat tail 采集', '记录 offset，重启续传'],
        ['fb', 'kafka', '批量发送到 Kafka', '日志洪峰时 Kafka 缓冲，保护下游存储'],
        ['kafka', 'ls', '检索链路消费'],
        ['ls', 'es', '解析、脱敏后写 ES，Kibana 全文检索', '按天滚动索引 + ILM 冷热分层'],
        ['kafka', 'fl', '分析链路消费'],
        ['fl', 'ch', '聚合写 ClickHouse，Grafana 看板 / 告警'],
        ['kafka', 'arc', '归档链路消费'],
        ['arc', 'hdfs', '压缩归档冷数据，离线分析'],
      ], '成本控制是难点：采样、分级保留、冷热分层；ES 只放近期热数据。'],
    ],
  },

  'scenario-notification': {
    title: '推拉结合：私信写扩散，系统公告读扩散',
    lanes: ['发送方', '消息', '服务', '存储', '触达'],
    nodes: {
      s: ['c', 0, 0.5, '发送方\n业务系统 / 用户'],
      rd: ['c', 0, 2.2, '接收用户\n打开消息中心'],
      mq: ['mq', 1, 0.5, 'MQ\n削峰'],
      ms: ['svc', 2, 0.5, '消息服务\n写扩散 / 读扩散'],
      q: ['svc', 2, 2.2, '收件箱查询\n合并私信 + 公告'],
      inbox: ['db', 3, 0.1, '用户收件箱\n私信写扩散'],
      ann: ['db', 3, 1.2, '公告表\n只存一份'],
      read: ['cache', 3, 2.3, 'Redis Hash\n已读 / 未读数'],
      ws: ['edge', 4, 0.5, '在线：WebSocket'],
      push: ['ext', 4, 1.6, '离线：厂商 Push'],
    },
    flows: [
      ['发送', [
        ['s', 'mq', '发送消息事件'],
        ['mq', 'ms', '消息服务消费'],
        ['ms', 'inbox', '私信 / 小范围通知：写入每个接收者收件箱', '写扩散，读时 O(1)'],
        ['ms', 'ann', '全员公告：只写一份', '读扩散，避免千万级写放大'],
        ['ms', 'ws', '在线用户实时推送'],
        ['ms', 'push', '离线用户走厂商 Push（失败重试）'],
      ]],
      ['读取与已读', [
        ['rd', 'q', '打开消息中心'],
        ['q', 'inbox', '拉取个人收件箱'],
        ['q', 'ann', '拉取用户上次读取点之后的公告', '按 last_read_ann_id 游标'],
        ['q', 'read', '标记已读、更新未读数'],
        ['read', 'inbox', '已读状态异步落库'],
      ]],
    ],
  },

  'scenario-hot-search': {
    title: '行为流 → 防刷 → 实时热度（含时间衰减）→ ZSet 榜单',
    lanes: ['用户行为', '消息', '实时计算', '榜单存储', '读取'],
    nodes: {
      u: ['c', 0, 1, '搜索 / 点击 / 转发'],
      kafka: ['mq', 1, 1, 'Kafka\n行为事件'],
      anti: ['svc', 2, 0, '防刷过滤\n设备指纹 · IP 画像'],
      fl: ['svc', 2, 1.2, 'Flink 窗口计算\n热度 = 分 × 权重'],
      decay: ['job', 2, 2.4, '衰减任务\nH = H0·e^(-λt)'],
      zset: ['cache', 3, 1.2, 'Redis ZSet\n分地域 / 分标签'],
      ck: ['store', 3, 2.4, 'Checkpoint\n状态恢复'],
      api: ['svc', 4, 1.2, '热搜接口\n本地缓存 Top50'],
      rd: ['c', 4, 0, '刷榜单用户'],
    },
    flows: [
      ['计算链路', [
        ['u', 'kafka', '行为事件上报'],
        ['kafka', 'anti', '先过防刷：刷量账号 / 设备 / IP 降权或剔除'],
        ['anti', 'fl', '有效行为进入窗口聚合'],
        ['fl', 'fl', '热度 = 基础分 × 时间衰减 × 用户权重'],
        ['fl', 'zset', 'ZADD / ZINCRBY 更新榜单'],
        ['decay', 'zset', '定时整体衰减，旧热点自然下沉'],
        ['fl', 'ck', '定期 checkpoint，宕机后恢复状态'],
      ]],
      ['读取', [
        ['rd', 'api', '打开热搜'],
        ['api', 'zset', 'ZREVRANGE 0 49（本地缓存秒级刷新）', '千万读 QPS 不直接打 Redis'],
        ['api', 'rd', '返回榜单'],
      ]],
    ],
  },

  'scenario-feed-system': {
    title: '推拉结合：普通作者推收件箱，大 V 读时拉取合并',
    lanes: ['发帖', '消息', 'Feed 服务', '存储', '读 Feed'],
    nodes: {
      au: ['c', 0, 0.4, '普通作者发帖'],
      bv: ['c', 0, 1.8, '大 V 发帖\n千万粉丝'],
      mq: ['mq', 1, 0.4, 'MQ\n异步扇出'],
      fs: ['svc', 2, 0.4, '扇出服务\n写粉丝收件箱'],
      out: ['db', 3, 1.8, '作者发件箱\n大 V 只写一份'],
      inbox: ['cache', 3, 0.4, '粉丝收件箱\nRedis ZSet 限长'],
      rs: ['svc', 2, 2.8, 'Feed 读服务\n推 + 拉合并'],
      rd: ['c', 4, 2.8, '刷 Feed 的用户'],
    },
    flows: [
      ['发帖', [
        ['au', 'mq', '普通作者发帖'],
        ['mq', 'fs', '异步扇出'],
        ['fs', 'inbox', '写入每个粉丝收件箱（推 / 写扩散）', '收件箱限长，只保留最近 N 条'],
        ['bv', 'out', '大 V 只写自己的发件箱（拉 / 读扩散）', '避免一次发帖千万次写'],
      ]],
      ['读 Feed', [
        ['rd', 'rs', '下拉刷新（游标 = 上一页最后的 时间戳 + ID）', '不用 OFFSET，避免重复与深分页'],
        ['rs', 'inbox', '读自己的收件箱（推来的）'],
        ['rs', 'out', '拉取关注的大 V 发件箱最新内容'],
        ['rs', 'rs', '多路归并按时间 / 热度排序'],
        ['rs', 'rd', '返回一页'],
      ]],
    ],
  },

  'scenario-red-packet': {
    title: '发时预拆（二倍均值）→ 抢时 Lua 原子领取 → 异步入账对账',
    lanes: ['用户', '红包服务', '缓存', '消息 / 存储'],
    nodes: {
      s: ['c', 0, 0.4, '发红包'],
      g: ['c', 0, 1.8, '群成员抢'],
      rp: ['svc', 1, 0.4, '发红包服务\n扣余额 + 预拆'],
      gr: ['svc', 1, 1.8, '抢红包服务\n风控 · 去重'],
      list: ['cache', 2, 0.4, 'Redis List\n预拆金额'],
      set: ['cache', 2, 1.8, 'Redis Set\n已领用户'],
      mq: ['mq', 3, 1.1, 'MQ\n领取记录'],
      db: ['db', 3, 0.1, 'MySQL\n红包 · 流水'],
      acc: ['svc', 3, 2.4, '账户服务\n入账 · 对账'],
    },
    flows: [
      ['发与抢', [
        ['s', 'rp', '发红包：先扣发送者余额（DB 事务）'],
        ['rp', 'db', '落红包记录'],
        ['rp', 'list', '二倍均值预拆 N 份写入 List', '每份 ∈ [0.01, 剩余均值 × 2]，保证总额不超'],
        ['g', 'gr', '点击抢'],
        ['gr', 'set', 'Lua：SISMEMBER 判重 + LPOP 取一份 + SADD', '原子执行，杜绝超发与重复领'],
        ['gr', 'mq', '领取成功记录写 MQ'],
        ['mq', 'acc', '异步入账'],
        ['acc', 'db', '写领取流水，定时与 Redis 对账', '24h 未领完原路退回'],
      ]],
    ],
  },

  'scenario-nearby': {
    title: 'GeoHash 编码 + 九宫格邻域查询 + 精确距离过滤',
    lanes: ['用户', '位置服务', '空间索引'],
    nodes: {
      u: ['c', 0, 0.4, '用户 A\n上报位置'],
      q: ['c', 0, 1.8, '用户 B\n查附近的人'],
      ls: ['svc', 1, 0.4, '位置服务\nGeoHash 编码'],
      ns: ['svc', 1, 1.8, '附近查询\n九宫格 + Haversine'],
      geo: ['cache', 2, 0.4, 'Redis GEO\nZSet 存 52 位 GeoHash'],
      pg: ['db', 2, 1.8, 'PostGIS / Mongo\n复杂空间查询'],
    },
    flows: [
      ['上报与查询', [
        ['u', 'ls', '上报经纬度（限频）'],
        ['ls', 'geo', 'GEOADD：经纬度 → GeoHash 作为 score'],
        ['q', 'ns', '查询 5km 内的人'],
        ['ns', 'geo', 'GEOSEARCH / 查本格 + 周围 8 格', '只查本格会漏掉边界另一侧的人'],
        ['ns', 'ns', 'Haversine 精确计算距离并过滤、排序'],
        ['ns', 'q', '返回附近列表'],
        ['ns', 'pg', '多边形 / 路径等复杂查询走空间数据库（R-Tree）'],
      ]],
    ],
  },

  'scenario-scan-login': {
    title: '二维码 = 一次性 scene_id；手机端确认，PC 端 WebSocket 收到登录态',
    lanes: ['PC 浏览器', '服务端', '手机 App'],
    nodes: {
      pc: ['c', 0, 1, 'PC 浏览器\n展示二维码'],
      qs: ['svc', 1, 0.4, '二维码服务\n生成 scene_id'],
      ws: ['edge', 1, 1.8, 'WebSocket\n/ 长轮询'],
      rs: ['cache', 1, 2.9, 'Redis\nscene_id → 状态'],
      app: ['c', 2, 1, '手机 App\n已登录'],
    },
    flows: [
      ['扫码登录', [
        ['pc', 'qs', '请求二维码'],
        ['qs', 'rs', '生成 scene_id，状态 WAIT，TTL 2 分钟'],
        ['pc', 'ws', 'PC 建立 WebSocket 订阅该 scene_id'],
        ['app', 'qs', '手机扫码：带手机登录态上报 scene_id → SCANNED'],
        ['qs', 'ws', '推送“已扫码，请在手机确认”'],
        ['app', 'qs', '手机点击确认 → CONFIRMED'],
        ['qs', 'rs', '生成一次性临时 code，绑定 user_id'],
        ['ws', 'pc', '推送 code'],
        ['pc', 'qs', 'PC 用 code 换正式 token / session', 'code 只能用一次，过期失效'],
      ]],
    ],
  },

  'scenario-gray-release': {
    title: '网关流量染色 → 灰度实例；指标异常一键回滚',
    lanes: ['用户', '入口', '服务版本', '管控'],
    nodes: {
      u1: ['c', 0, 0.3, '灰度用户\n白名单 / 5%'],
      u2: ['c', 0, 1.7, '其他用户'],
      gw: ['edge', 1, 1, '网关 / Mesh\n流量染色 + 标签路由'],
      v2: ['svc', 2, 0.3, 'v2 灰度实例'],
      v1: ['svc', 2, 1.7, 'v1 正式实例'],
      ff: ['cfg', 3, 0.3, 'Feature Flag\n功能开关'],
      mon: ['job', 3, 1.7, '监控对比\n错误率 · P99 · 业务指标'],
    },
    flows: [
      ['灰度与回滚', [
        ['u1', 'gw', '请求带用户 ID / 设备 / 地域'],
        ['gw', 'v2', '命中灰度规则 → 打标签路由到 v2', '标签需在调用链上透传，下游也走灰度版本'],
        ['u2', 'gw', '其他请求'],
        ['gw', 'v1', '路由到 v1'],
        ['ff', 'v2', '新功能用开关控制，可独立关闭'],
        ['mon', 'v2', '对比 v1 / v2 指标'],
        ['mon', 'gw', '指标正常 → 逐步放量 5% → 20% → 100%', '异常 → 规则回切，秒级回滚'],
      ], '数据兼容是难点：表结构变更要“先加后删”，新旧版本能同时读写。'],
    ],
  },

  'scenario-cdn': {
    title: '就近调度到边缘节点；未命中逐级回源',
    lanes: ['用户', '调度', '边缘', '中间层', '源站'],
    nodes: {
      u: ['c', 0, 1, '用户'],
      dns: ['edge', 1, 1, 'GSLB / DNS\n就近 · 负载'],
      edge: ['cache', 2, 1, '边缘节点\nLRU + TTL'],
      mid: ['cache', 3, 1, '中间层 / 父节点\n合并回源'],
      origin: ['db', 4, 1, '源站\n对象存储'],
    },
    flows: [
      ['命中与回源', [
        ['u', 'dns', '解析域名'],
        ['dns', 'u', '返回最近且健康的边缘节点 IP'],
        ['u', 'edge', '请求资源：命中直接返回（大多数）'],
        ['edge', 'mid', '未命中：回源到中间层', '一致性哈希选父节点，同一资源集中缓存'],
        ['mid', 'origin', '中间层也未命中才回源站', '请求合并，源站只收到一次'],
        ['origin', 'mid', '返回并缓存'],
        ['mid', 'edge', '返回并缓存（TTL / Cache-Control）'],
        ['edge', 'u', '返回用户'],
      ], '内容更新用“文件名带 hash”而不是频繁刷新缓存；节点故障由调度摘除。'],
    ],
  },

  'scenario-search-recommendation': {
    title: '多路召回 → 精排 → 重排',
    lanes: ['用户', '召回', '排序', '返回'],
    nodes: {
      u: ['c', 0, 1, '用户\n搜索 / 刷推荐'],
      es: ['db', 1, 0, 'ES 倒排召回\n关键词'],
      vec: ['db', 1, 1, '向量召回\nHNSW'],
      hot: ['cache', 1, 2, '热门 / 协同召回'],
      fs: ['cache', 2, 0, '特征库\n用户 · 物品'],
      rank: ['algo', 2, 1, '精排模型\nGBDT / DNN'],
      rr: ['svc', 3, 1, '重排\n去重 · 打散 · 业务规则'],
    },
    flows: [
      ['一次请求', [
        ['u', 'es', 'Query 走倒排召回'],
        ['u', 'vec', 'Embedding 走向量召回'],
        ['u', 'hot', '热门 / 协同过滤召回'],
        ['es', 'rank', '合并候选（数千）'],
        ['vec', 'rank', '合并候选'],
        ['hot', 'rank', '合并候选'],
        ['fs', 'rank', '拉取特征，模型打分取 Top 数百'],
        ['rank', 'rr', '重排：多样性打散、去重、运营规则'],
        ['rr', 'u', '返回一页结果'],
      ], '召回保证“找得全”，精排保证“排得准”；任何一路召回故障都可降级为其他路。'],
    ],
  },
};

;
/* 代码手撕 / 数据库手撕的架构图（规格同 arch-specs.js） */
Object.assign(ARCH, {
  'handwrite-64': {
    title: '同事务落库 → 发布器投递 → 幂等消费 → 重试 / 死信 → 补偿扫描',
    lanes: ['业务', '存储', '投递', '消息', '消费'],
    nodes: {
      biz: ['c', 0, 1, '业务服务\n生成 eventId'],
      db: ['db', 1, 0.4, '业务表 + event_task\n同一本地事务'],
      pub: ['job', 2, 0.4, '发布器\n扫描 SAVED'],
      scan: ['job', 2, 2, '补偿扫描 XXL-Job\n超时中间态'],
      mq: ['mq', 3, 0.4, 'MQ\nPublisher Confirm'],
      dlq: ['mq', 3, 2, '死信队列\n人工 / 补偿'],
      con: ['svc', 4, 0.4, '消费者\n手动 ACK'],
      log: ['db', 4, 2, 'consumer_log\n(event_id, consumer) 唯一键'],
    },
    flows: [
      ['正常链路', [
        ['biz', 'db', '同一个事务写业务数据 + event_task(SAVED)', '要么都成功要么都失败，不会出现「业务成功但事件丢了」'],
        ['pub', 'db', '发布器扫描 SAVED 事件'],
        ['pub', 'mq', '发送 MQ，开启 Publisher Confirm'],
        ['pub', 'db', 'Broker 确认后更新为 PUBLISHED', '确认失败保留 SAVED，下次重发（至少一次）'],
        ['mq', 'con', '消费者收到消息'],
        ['con', 'log', '先插入 consumer_log 做幂等预占', '唯一键冲突 = 已处理过，直接 ACK'],
        ['con', 'con', '执行业务成功 → 手动 ACK'],
        ['con', 'db', '回写任务状态 SUCCESS'],
      ], '状态机：INIT → SAVED → PUBLISHED → CONSUMING → SUCCESS / RETRYING → DEAD'],
      ['失败与补偿', [
        ['con', 'mq', '可重试错误：按退避重新投递'],
        ['mq', 'dlq', '超过最大次数进入死信，状态 DEAD'],
        ['scan', 'db', '定时扫描 SAVED / PUBLISHED 超时未完成的事件'],
        ['scan', 'mq', '补发或标记人工处理', '扫描要分页 + 限速，避免把 DB 打满'],
      ]],
    ],
  },

  'handwrite-66': {
    title: '初始化查秒传 → 分片直传 MinIO + Bitmap 记进度 → 合并校验 → 异步解析',
    lanes: ['客户端', '上传服务', '缓存 / 存储', '异步处理'],
    nodes: {
      cli: ['c', 0, 1, '客户端\n计算 SHA-256 · 切片'],
      up: ['svc', 1, 0.4, '上传服务\ninit / chunk / complete'],
      hash: ['db', 1, 2, 'file_hash 表\n秒传去重'],
      bm: ['cache', 2, 0.4, 'Redis Bitmap\n已传分片'],
      oss: ['store', 2, 1.5, 'MinIO\n临时分片 / 最终对象'],
      mq: ['mq', 3, 0.4, 'FILE_UPLOADED\n事件'],
      idx: ['job', 3, 1.5, '解析 · 切片\nEmbedding · 索引'],
    },
    flows: [
      ['上传流程', [
        ['cli', 'up', 'initUpload(fileHash, size, totalChunks)'],
        ['up', 'hash', '查 file_hash：完整文件已存在 → 秒传，直接建用户文件记录'],
        ['up', 'bm', '未完成：返回已上传分片（断点续传）'],
        ['cli', 'up', '并发上传缺失分片'],
        ['up', 'oss', '分片写入 MinIO 临时路径'],
        ['up', 'bm', 'SETBIT 标记该分片完成'],
        ['up', 'up', 'BITCOUNT == totalChunks → 抢合并锁，按序合并并校验 SHA-256'],
        ['up', 'hash', '状态 UPLOADING → UPLOADED，记录对象地址'],
        ['up', 'mq', '投递 FILE_UPLOADED 事件'],
        ['mq', 'idx', '异步解析、切片、向量化、写索引（失败可重试，不影响上传结果）'],
      ]],
    ],
  },

  'handwrite-67': {
    title: 'Query 理解 → 多路召回 + 权限过滤 → RRF 融合 → 重排 → 带引用生成',
    lanes: ['用户', '理解', '召回', '融合与排序', '生成'],
    nodes: {
      u: ['c', 0, 1, '用户问题'],
      qu: ['svc', 1, 1, 'Query 理解\n意图 · 实体 · 权限上下文'],
      bm: ['db', 2, 0, 'BM25\n关键词召回'],
      vec: ['db', 2, 1, '向量 kNN\n语义召回'],
      wiki: ['db', 2, 2, '知识页召回\n高质量 Wiki'],
      rrf: ['algo', 3, 0.5, 'Weighted RRF\nΣ w / (k + rank)'],
      rr: ['svc', 3, 1.7, '去重 · 合并 · 重排\ncross-encoder'],
      llm: ['ext', 4, 1.1, 'LLM\n按 token 预算组装证据'],
    },
    flows: [
      ['检索链路', [
        ['u', 'qu', '提问'],
        ['qu', 'bm', 'BM25 召回（带权限过滤条件）'],
        ['qu', 'vec', '向量召回（同样按 ACL 过滤）', '过滤要在召回阶段做，不能靠模型“别说”'],
        ['qu', 'wiki', '知识页召回'],
        ['bm', 'rrf', '按排名而非原始分数融合', '不同通道的分数不可比，RRF 只看名次'],
        ['vec', 'rrf', '合并'],
        ['wiki', 'rrf', '合并'],
        ['rrf', 'rr', 'chunk 去重、相邻片段合并、同文档限流、重排'],
        ['rr', 'llm', '选证据 + 保留引用映射，要求基于证据回答'],
        ['llm', 'u', '返回答案与引用'],
      ], '评估看 recall@k / MRR / 引用正确率，而不是只看最终回答“像不像”。'],
    ],
  },

  'database-89': {
    title: 'redo prepare → 写 binlog → redo commit；崩溃后按两者状态决定提交或回滚',
    lanes: ['客户端', 'Server 层', 'InnoDB 引擎', '日志文件'],
    nodes: {
      c: ['c', 0, 1, 'COMMIT'],
      ex: ['svc', 1, 1, '执行器'],
      buf: ['cache', 2, 0, 'Buffer Pool\n修改数据页'],
      undo: ['store', 2, 2, 'undo log\n回滚 · MVCC 旧版本'],
      redo: ['store', 3, 0, 'redo log\n崩溃恢复（物理）'],
      bin: ['store', 3, 2, 'binlog\n复制 · 恢复（逻辑）'],
    },
    flows: [
      ['一次提交', [
        ['ex', 'undo', '更新前先写 undo（记录旧值）'],
        ['ex', 'buf', '修改 Buffer Pool 中的数据页（脏页之后异步刷盘）'],
        ['c', 'ex', '提交事务'],
        ['ex', 'redo', '① redo log 写 prepare 并刷盘'],
        ['ex', 'bin', '② 写 binlog 并刷盘（sync_binlog = 1）'],
        ['ex', 'redo', '③ redo log 标记 commit'],
      ], 'redo 是 InnoDB 的，binlog 是 Server 层的：两份日志必须一致，否则主库恢复结果和从库重放结果会不同。'],
      ['崩溃恢复', [
        ['redo', 'redo', '扫描 redo：commit 状态 → 直接提交'],
        ['redo', 'bin', 'prepare 状态 → 去查 binlog 里是否有这个事务（XID）'],
        ['bin', 'ex', '有完整 binlog → 提交；没有 → 用 undo 回滚', '保证「主库数据」和「binlog 驱动的从库」一致'],
      ]],
    ],
  },

  'database-91': {
    title: '主库写 binlog → 从库 IO 线程拉到 relay log → SQL 线程重放',
    lanes: ['应用', '主库', '从库'],
    nodes: {
      app: ['c', 0, 0.4, '应用写请求'],
      rd: ['c', 0, 2, '应用读请求'],
      m: ['db', 1, 0.4, '主库\n事务提交写 binlog'],
      dump: ['svc', 1, 2, 'binlog dump 线程'],
      io: ['svc', 2, 0.4, '从库 IO 线程\n写 relay log'],
      sql: ['svc', 2, 1.4, '从库 SQL 线程\n并行重放'],
      s: ['db', 2, 2.4, '从库数据'],
    },
    flows: [
      ['复制与读写分离', [
        ['app', 'm', '写请求只走主库'],
        ['m', 'dump', '事务提交写入 binlog'],
        ['dump', 'io', '推送 binlog 事件'],
        ['io', 'sql', '落到 relay log'],
        ['sql', 's', '重放，从库数据追上主库'],
        ['rd', 's', '普通读走从库'],
      ], '异步复制存在延迟：刚写完立刻读从库可能读不到。'],
      ['主从延迟对策', [
        ['rd', 'm', '写后短时间内 / 强一致接口 → 强制读主库'],
        ['rd', 'rd', '按复制延迟动态摘除落后从库'],
        ['sql', 's', '等从库追上 GTID / 位点后再读；拆分大事务、开启并行复制'],
      ]],
    ],
  },

  'database-92': {
    title: '按 user_id 路由到库和表；order_no 带分片基因或走映射表',
    lanes: ['应用', '路由', '分库 · 分表'],
    nodes: {
      c: ['c', 0, 0.4, '按 user_id 查列表'],
      c2: ['c', 0, 2, '按 order_no 查详情'],
      rt: ['svc', 1, 0.4, '分片路由\ndb = uid % 4, tb = uid / 4 % 8'],
      map: ['cache', 1, 2, 'order_no → shard\n或号里嵌分片位'],
      d0: ['db', 2, 0, 'db_0\norders_00 … 07'],
      d1: ['db', 2, 1, 'db_1\norders_00 … 07'],
      d3: ['db', 2, 2, 'db_3\norders_00 … 07'],
    },
    flows: [
      ['路由', [
        ['c', 'rt', 'C 端按 user_id 查订单列表'],
        ['rt', 'd1', 'uid = 1001 → db_1.orders_02（同一用户的订单聚集在一张表）'],
        ['c2', 'map', '后台按 order_no 查：解析号里的分片基因（或查映射表）'],
        ['map', 'd3', '直接定位到 db_3，避免广播查询'],
      ], '分片键选查询最多的维度；跨分片分页 / 统计交给 ES 或数仓，不在分库上硬做。'],
      ['扩容', [
        ['rt', 'rt', '双写 / 增量同步到新分片（2 倍扩容只需迁移一半数据）'],
        ['rt', 'd0', '全量迁移 + 校验，灰度切读，最后切写'],
      ]],
    ],
  },

  'database-93': {
    title: '业务表与 outbox 同事务；Relay 投递 MQ；消费端用唯一键幂等',
    lanes: ['业务', 'MySQL', '投递', '消息', '消费'],
    nodes: {
      s: ['svc', 0, 1, '业务服务'],
      tbl: ['db', 1, 0.4, '业务表'],
      ob: ['db', 1, 1.8, 'event_outbox\nstatus · retry · next_retry_at'],
      relay: ['job', 2, 1.8, 'Relay\n扫描 / CDC'],
      mq: ['mq', 3, 1.8, 'MQ'],
      cs: ['svc', 4, 1.8, '消费者'],
      ded: ['db', 4, 0.4, 'consume_record\n(consumer, event_id) 唯一'],
    },
    flows: [
      ['最终一致', [
        ['s', 'tbl', '本地事务：更新业务表'],
        ['s', 'ob', '同一事务插入 outbox 事件（status = NEW）'],
        ['relay', 'ob', 'Relay 扫描到期事件（或订阅 binlog）'],
        ['relay', 'mq', '发送，成功后更新 SENT；失败 retry_count++，next_retry_at 退避'],
        ['mq', 'cs', '投递给消费者'],
        ['cs', 'ded', 'INSERT consume_record：成功才执行业务，唯一键冲突说明是重复消息', '业务与去重记录在同一个本地事务里'],
      ], '保证的是「至少一次投递 + 幂等消费 = 最终一致」，而不是分布式强一致。'],
    ],
  },
});


;

/* Source: src/visuals/algorithm-traces.js */
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

