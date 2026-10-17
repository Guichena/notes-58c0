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
