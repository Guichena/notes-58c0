// Encodes a bounded JSON document for a script type=application/json data block.
// Not for HTML attributes, executable JS, CSS, URLs, or authorization decisions.
export function encodeState(jsonText) {
  if (typeof jsonText !== 'string' || jsonText.length > 16384) {
    throw new TypeError('JSON text limit');
  }
  const parsed = JSON.parse(jsonText);
  let nodes = 0;
  const stack = [[parsed, 0]];
  while (stack.length) {
    const [v, depth] = stack.pop();
    if (++nodes > 2048 || depth > 32) throw new RangeError('structure limit');
    if (typeof v === 'number' && (!Number.isFinite(v) || Object.is(v, -0) ||
        (Number.isInteger(v) && !Number.isSafeInteger(v)))) {
      throw new TypeError('finite numbers, safe integers, no negative zero');
    }
    if (v !== null && typeof v === 'object') {
      for (const k of Object.keys(v)) stack.push([v[k], depth + 1]);
    }
  }
  return JSON.stringify(parsed).replace(/[<>&\u2028\u2029]/g,
    c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}
// Use a fixed, developer-controlled element ID and markup wrapper. Read textContent,
// then JSON.parse in the client. Do not merge untrusted objects into prototypes.
