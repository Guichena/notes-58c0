// Pure, bounded cache identity model. No HTTP/Cache API or authorization code.
const token = /^[A-Za-z0-9_-]{1,96}$/;
export function assetKey(scope, assetId, version, variant) {
  for (const x of [scope, assetId, version, variant]) {
    if (typeof x !== 'string' || !token.test(x)) throw new TypeError('bad identity');
  }
  // Caller must supply trusted, authorized metadata; this is not a verifier.
  return JSON.stringify([scope, assetId, version, variant]);
}
export class BoundedImageCache {
  #items = new Map(); #bytes = 0;
  constructor() {}
  put(key, bytes) {
    if (typeof key !== 'string' || key.length > 400 ||
        !(bytes instanceof Uint8Array) || bytes.byteLength > 65536) {
      throw new TypeError('entry limit');
    }
    // Retain owned bytes rather than a mutable or huge backing-buffer view.
    const copy = new Uint8Array(bytes);
    this.remove(key);
    while (this.#items.size >= 8 || this.#bytes + copy.byteLength > 131072) {
      this.remove(this.#items.keys().next().value);
    }
    this.#items.set(key, copy); this.#bytes += copy.byteLength;
  }
  get(key) {
    const v = this.#items.get(key);
    if (v === undefined) return null;
    this.#items.delete(key); this.#items.set(key, v);
    return new Uint8Array(v);
  }
  remove(key) {
    const v = this.#items.get(key);
    if (v !== undefined) { this.#bytes -= v.byteLength; this.#items.delete(key); }
  }
  clear() { this.#items.clear(); this.#bytes = 0; }
  stats() { return {entries: this.#items.size, bytes: this.#bytes}; }
}
