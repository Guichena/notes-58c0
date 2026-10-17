/** Chapter data is separate from the navigation catalog. Hydration deliberately
 * mutates existing catalog objects so sidebar/pager/search references stay valid.
 * Failed requests are evicted from the promise cache so Retry really retries. */
export class ContentRepository {
  constructor({baseURL, fetcher = globalThis.fetch.bind(globalThis)}) {
    this.baseURL = new URL(baseURL);
    this.fetcher = fetcher;
    this.pending = new Map();
    this.loaded = new Set();
    this.catalog = null;
    this.byId = new Map();
  }
  loadJSON(relative) {
    if (!this.pending.has(relative)) {
      const task = Promise.resolve().then(async () => {
        const response = await this.fetcher(new URL(relative, this.baseURL));
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${relative}`);
        return response.json();
      }).catch(error => { this.pending.delete(relative); throw error; });
      this.pending.set(relative, task);
    }
    return this.pending.get(relative);
  }
  async loadCatalog() {
    if (this.catalog) return this.catalog;
    const data = await this.loadJSON('data/catalog.json');
    if (!Array.isArray(data.entries)) { this.pending.delete('data/catalog.json'); throw new Error('Invalid catalog'); }
    this.catalog = data;
    this.byId = new Map(data.entries.map(e=>[e.id,e]));
    return data;
  }
  async loadChapter(relative) {
    if (this.loaded.has(relative)) return;
    const data = await this.loadJSON(relative);
    try {
      const expected = this.catalog.entries.filter(e=>e._chunk===relative);
      if (!Array.isArray(data.entries) || data.entries.length!==expected.length) throw new Error('Invalid chapter: '+relative);
      const seen=new Set();
      for(const entry of data.entries) {
        const target=this.byId.get(entry.id);
        if(!target || target._chunk!==relative || seen.has(entry.id)) throw new Error('Invalid chapter identity: '+relative);
        seen.add(entry.id);
      }
      for(const entry of data.entries) Object.assign(this.byId.get(entry.id),entry);
      this.loaded.add(relative);
    } catch(error) { this.pending.delete(relative); throw error; }
  }
  async loadEntry(id) {
    await this.loadCatalog();
    const entry = this.byId.get(id);
    if (!entry) throw new Error('Unknown entry: '+id);
    await this.loadChapter(entry._chunk);
    return entry;
  }
  async loadMap(mod) {
    await this.loadCatalog();
    const chunks = new Set(this.catalog.entries.filter(e=>e.mod===mod && e.kind==='qa').map(e=>e._chunk));
    await Promise.all([...chunks].map(chunk=>this.loadChapter(chunk)));
  }
  async loadSearch() {
    await this.loadCatalog();
    const records = await this.loadJSON('data/search.json');
    try {
      if (!Array.isArray(records)) throw new Error('Invalid search index');
      return records.map(record=>{
        const e=record && this.byId.get(record.id);
        if(!e || typeof record.title !== 'string' || typeof record.text !== 'string') throw new Error('Invalid search record');
        if(record.qi != null && (!Number.isInteger(record.qi) || record.qi < 0 || !e.items || record.qi >= e.items.length)) throw new Error('Invalid search question identity');
        return {...record,e,tl:(record.qi==null?record.title+' '+(e.kind==='algo'?e.number:''):record.title).toLowerCase(),tx:record.text.toLowerCase()};
      });
    } catch(error) {
      // Parsing succeeded but the payload is unusable: retry must refetch it.
      this.pending.delete('data/search.json');
      throw error;
    }
  }
}
