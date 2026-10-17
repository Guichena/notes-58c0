// A deliberately small, dependency-free DOM fixture for the presentation tests.
// It implements only the standard tree/selector operations used by the module.
// Browser layout and native focus behavior are checked separately in the UI.
const escapeText = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeAttr = s => escapeText(s).replaceAll('"', '&quot;');
const decode = s => s.replace(/&(amp|lt|gt|quot|apos|#39|#\d+|#x[\da-f]+);/gi, (_, entity) => ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",'#39':"'"})[entity] ?? String.fromCodePoint(entity[1] === 'x' ? parseInt(entity.slice(2),16) : Number(entity.slice(1))));
class Node {
  constructor(document) { this.ownerDocument=document; this.parentNode=null; this.childNodes=[]; }
  get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
  get textContent() { return this.childNodes.map(n=>n.textContent).join(''); }
  set textContent(text) { this.replaceChildren(this.ownerDocument.createTextNode(text)); }
  get nextSibling() { const siblings=this.parentNode?.childNodes || []; return siblings[siblings.indexOf(this)+1] || null; }
  get previousElementSibling() { const siblings=this.parentNode?.children || []; return siblings[siblings.indexOf(this)-1] || null; }
  insertBefore(node, before) {
    node.remove();
    const index = before == null ? this.childNodes.length : this.childNodes.indexOf(before);
    if(index < 0) throw new Error('Unknown sibling');
    this.childNodes.splice(index,0,node); node.parentNode=this; return node;
  }
  appendChild(node) { return this.insertBefore(node,null); }
  replaceChildren(...nodes) { for(const n of this.childNodes) n.parentNode=null; this.childNodes=[]; for(const n of nodes) this.appendChild(n); }
  remove() { if(this.parentNode) { const p=this.parentNode; p.childNodes.splice(p.childNodes.indexOf(this),1); this.parentNode=null; } }
}
class Text extends Node {
  constructor(document,text) { super(document); this.nodeType=3; this.data=String(text); }
  get textContent() { return this.data; }
  set textContent(value) { this.data=String(value); }
  get outerHTML() { return escapeText(this.data); }
  cloneNode() { return new Text(this.ownerDocument,this.data); }
}
function matchSimple(element, selector) {
  const attributes = [...selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)];
  selector=selector.replace(/\[[^\]]*\]/g,'');
  for(const [,name,value] of attributes) if(!element.hasAttribute(name) || (value !== undefined && element.getAttribute(name)!==value)) return false;
  const tag=/^[\w-]+/.exec(selector)?.[0];
  if(tag && element.tagName !== tag.toUpperCase()) return false;
  const id=/#([\w-]+)/.exec(selector)?.[1]; if(id && element.id!==id) return false;
  return [...selector.matchAll(/\.([\w-]+)/g)].every(([,name])=>element.classList.contains(name));
}
function matches(element, selector) {
  return selector.split(',').some(part=>{
    const tokens=part.trim().replace(/\s*>\s*/g,' > ').split(/\s+/);
    let cursor=element;
    if(!matchSimple(cursor,tokens.pop())) return false;
    while(tokens.length) {
      let direct=false, rule=tokens.pop();
      if(rule==='>') { direct=true; rule=tokens.pop(); }
      cursor=cursor.parentElement;
      if(direct) { if(!cursor || !matchSimple(cursor,rule)) return false; }
      else { while(cursor && !matchSimple(cursor,rule)) cursor=cursor.parentElement; if(!cursor) return false; }
    }
    return true;
  });
}
class Element extends Node {
  constructor(document,tag) { super(document); this.nodeType=1; this.tagName=tag.toUpperCase(); this.attributes=new Map(); this.listeners=new Map(); this.clientWidth=0; this.scrollWidth=0; }
  get children() { return this.childNodes.filter(n=>n.nodeType===1); }
  get childElementCount() { return this.children.length; }
  get firstElementChild() { return this.children[0] || null; }
  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id',v); }
  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class',v); }
  get classList() { return {contains:name=>this.className.split(/\s+/).includes(name),add:name=>{if(!this.classList.contains(name))this.className=(this.className+' '+name).trim();}}; }
  setAttribute(k,v) { this.attributes.set(k,String(v)); }
  getAttribute(k) { return this.attributes.get(k) ?? null; }
  hasAttribute(k) { return this.attributes.has(k); }
  removeAttribute(k) { this.attributes.delete(k); }
  matches(selector) { return matches(this,selector); }
  closest(selector) { for(let n=this;n;n=n.parentElement)if(n.matches(selector))return n; return null; }
  querySelectorAll(selector) { const found=[];const visit=n=>{for(const child of n.children){if(child.matches(selector))found.push(child);visit(child);}};visit(this);return found; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type,fn) { if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn); }
  removeEventListener(type,fn) { this.listeners.get(type)?.delete(fn); }
  dispatch(type,event={}) { for(const fn of this.listeners.get(type)||[])fn(event); }
  cloneNode(deep=false) { const e=new Element(this.ownerDocument,this.tagName);e.attributes=new Map(this.attributes);if(deep)for(const n of this.childNodes)e.appendChild(n.cloneNode(true));return e; }
  get innerHTML() { return this.childNodes.map(n=>n.outerHTML).join(''); }
  get outerHTML() { const tag=this.tagName.toLowerCase();const attrs=[...this.attributes].map(([k,v])=>` ${k}="${escapeAttr(v)}"`).join('');return `<${tag}${attrs}>${this.innerHTML}</${tag}>`; }
}
export function createPage(html='') {
  const observers=[];
  const view={listeners:new Map(),addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);},removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);},ResizeObserver:class {
    constructor(callback){this.callback=callback;this.observed=[];this.disconnected=false;observers.push(this);}
    observe(node){this.observed.push(node);}
    disconnect(){this.disconnected=true;}
  }};
  const document={defaultView:view,createElement:tag=>new Element(document,tag),createTextNode:text=>new Text(document,text)};
  const page=document.createElement('main');
  const stack=[page];
  const voids=new Set(['br','hr','img','input','meta','link','source','area','base','col','embed','param','track','wbr']);
  for(const token of html.match(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g)||[]) {
    if(token.startsWith('<!--'))continue;
    if(token.startsWith('</')){const tag=token.slice(2,-1).trim().toUpperCase();if(stack.at(-1).tagName!==tag)throw new Error('Unbalanced fixture: '+token);stack.pop();continue;}
    if(token.startsWith('<')) {
      const tag=/^<([\w-]+)/.exec(token)?.[1];if(!tag)throw new Error('Invalid fixture tag');
      const e=document.createElement(tag);
      const attrs=token.slice(tag.length+1,-1).replace(/\/$/,'');
      for(const match of attrs.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+)))?/g))e.setAttribute(match[1],decode(match[2]??match[3]??match[4]??''));
      stack.at(-1).appendChild(e);if(!voids.has(tag)&&!token.endsWith('/>'))stack.push(e);
    } else stack.at(-1).appendChild(document.createTextNode(decode(token)));
  }
  if(stack.length!==1)throw new Error('Unclosed fixture');
  return {page,document,view,observers};
}
