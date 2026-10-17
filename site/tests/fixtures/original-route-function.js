// Verbatim route function from the pinned original, retained only as a test oracle.
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!raw) return { view: 'home' };
  const parts = raw.split('/').map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  if (parts[0] === 'm' && TREE[parts[1]]) return { view: 'mod', mod: parts[1] };
  if ((parts[0] === 'must' || parts[0] === 'hl') && HL_MODS.includes(parts[1])) { if (parts[0] === 'must') history.replaceState(null, '', '#/hl/' + parts[1]); return { view: 'hl', mod: parts[1] }; }
  if (parts[0] === 'e' && ALGO_ALIAS[decodeURIComponent(parts[1] || '')]) parts[1] = ALGO_ALIAS[decodeURIComponent(parts[1])];
  if (parts[0] === 'e' && DATA.FACE_PARENTS && DATA.FACE_PARENTS[parts[1]] != null) {
    const nmax = DATA.FACE_PARENTS[parts[1]];
    let n = parts[2] != null && parts[2] !== '' ? parseInt(parts[2], 10) : 1;
    if (!Number.isFinite(n) || n < 1) n = 1; if (n > nmax) n = nmax;
    parts[1] = parts[1] + '-' + (n - 1); parts.length = 2;
  }
  if (parts[0] === 'e' && byId.has(parts[1])) return { view: 'entry', id: parts[1], q: parts[2] != null && parts[2] !== '' ? parts[2] : null };
  // 兼容 v7 书签：#<id>
  const legacy = parts.join('/');
  if (byId.has(legacy)) return { view: 'entry', id: legacy };
  if (legacy.startsWith('h-') || legacy.startsWith('s-') || legacy.startsWith('q-')) return null; // 页内锚点
  return { view: 'nf', id: raw };
}
