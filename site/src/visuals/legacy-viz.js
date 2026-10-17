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

