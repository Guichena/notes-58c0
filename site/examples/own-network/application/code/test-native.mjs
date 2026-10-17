import assert from 'node:assert/strict';
import http from 'node:http';
import {createSocketStore} from './socket-store.mjs';
import {createDemoServer} from './cors-server.mjs';
import {assetKey, BoundedImageCache} from './cache_identity.mjs';
import {encodeState} from './ssr_state.mjs';
let checks = 0;
const check = (name, f) => { f(); checks++; };
class FakeSocket {
  readyState = 0; bufferedAmount = 0; sent = []; closes = [];
  open() { this.readyState = 1; this.onopen?.(); }
  close(code, reason) { this.readyState = 3; this.closes.push([code, reason]); }
  send(text) { this.sent.push(text); }
}
const sockets = [], timers = new Map(); let timerId = 0;
const store = createSocketStore('wss://fixture.invalid', {
  makeSocket: () => { const ws = new FakeSocket(); sockets.push(ws); return ws; },
  schedule: f => { timers.set(++timerId, f); return timerId; }, cancel: id => timers.delete(id),
  random: () => 0, maxBytes: 8, highWaterBytes: 10,
});
check('idempotent start', () => { store.start(); store.start(); assert.equal(sockets.length, 1); });
check('open and UTF8 send', () => { sockets[0].open(); store.send('中'); assert.deepEqual(sockets[0].sent, ['中']); });
check('UTF8 bounds', () => assert.throws(() => store.send('中文中')));
check('backpressure', () => { sockets[0].bufferedAmount = 8; assert.throws(() => store.send('中')); });
check('reconnect and stale callback', () => {
  const old = sockets[0]; old.onclose({code: 1006});
  const f = [...timers.values()][0]; timers.clear(); f(); sockets[1].open();
  old.onmessage({data: 'stale'}); old.onclose({code: 1006});
  assert.equal(store.getSnapshot().status, 'open'); assert.equal(store.getSnapshot().message, null);
});
check('subscribe cleanup', () => {
  let n = 0; const off = store.subscribe(() => n++);
  sockets[1].onmessage({data:'hi'}); off(); sockets[1].onmessage({data:'ok'}); assert.equal(n,1);
});
check('inbound type closes with browser-valid application code', () => {
  sockets[1].onmessage({data:new Uint8Array(1)});
  assert.equal(store.getSnapshot().status, 'protocol-error'); assert.equal(sockets[1].closes[0][0], 4009);
});
check('stop clears timer', () => {
  store.start(); sockets[2].onclose({code:1006}); assert.equal(timers.size,1);
  store.stop(); assert.equal(timers.size,0); assert.equal(store.getSnapshot().message,null);
});
// Subscribers can synchronously stop/restart the store while receiving a notification.
function lifecycleFixture() {
  const sockets = [], timers = new Map(); let next = 0;
  const store = createSocketStore('wss://fixture.invalid', {
    makeSocket: () => { const s = new FakeSocket(); sockets.push(s); return s; },
    schedule: f => { timers.set(++next, f); return next; }, cancel: n => timers.delete(n), random: () => 0,
  });
  return {store, sockets, timers};
}
check('stop while connecting creates no orphan socket', () => {
  const {store, sockets} = lifecycleFixture(); let once = false;
  store.subscribe(() => { if (!once && store.getSnapshot().status === 'connecting') { once = true; store.stop(); } });
  store.start(); assert.equal(sockets.length, 0); assert.equal(store.getSnapshot().status, 'closed');
});
check('stop while retrying leaves no timer', () => {
  const {store, sockets, timers} = lifecycleFixture(); let once = false;
  store.subscribe(() => { if (!once && store.getSnapshot().status === 'retrying') { once = true; store.stop(); } });
  store.start(); sockets[0].onclose({code: 1006}); assert.equal(timers.size, 0);
});
check('restart while connecting keeps only current generation', () => {
  const {store, sockets} = lifecycleFixture(); let once = false;
  store.subscribe(() => { if (!once && store.getSnapshot().status === 'connecting') { once = true; store.stop(); store.start(); } });
  store.start(); assert.equal(sockets.length, 1); sockets[0].open(); assert.equal(store.getSnapshot().status, 'open');
  store.stop(); assert.equal(sockets[0].closes.length, 1);
});
check('retained cancelled scheduler callback cannot replace current connection', () => {
  const {store, sockets, timers} = lifecycleFixture();
  store.start(); sockets[0].onclose({code: 1006}); const stale = [...timers.values()][0];
  store.stop(); store.start(); sockets[1].open(); stale();
  assert.equal(sockets.length, 2); assert.equal(store.getSnapshot().status, 'open');
  store.stop(); assert.equal(sockets[1].closes.length, 1);
});

const cache = new BoundedImageCache();
check('cache identity includes tenant/version/variant', () => {
  assert.notEqual(assetKey('a','img','v1','small'),assetKey('b','img','v1','small'));
  assert.throws(()=>assetKey('../','img','v1','small'));
});
check('cache owns and returns copies', () => {
  const b = new Uint8Array([1,2]); cache.put('k',b); b[0]=9;
  const c=cache.get('k'); c[0]=8; assert.equal(cache.get('k')[0],1);
});
check('cache eviction and size', () => {
  for(let i=0;i<10;i++) cache.put('k'+i,new Uint8Array(65536));
  assert.deepEqual(cache.stats(),{entries:2,bytes:131072}); cache.clear();
  assert.equal(cache.get('k9'),null); assert.throws(()=>cache.put('big',new Uint8Array(65537)));
});
check('SSR JSON data block escaping roundtrip', () => {
  const value={x:'</script><img onerror="x">&\u2028'};
  const encoded=encodeState(JSON.stringify(value)); assert.equal(encoded.includes('<'),false);
  assert.deepEqual(JSON.parse(encoded),value);
});
check('SSR bounds and numeric policy', () => {
  assert.throws(()=>encodeState('{"n":9007199254740992}'));
  assert.throws(()=>encodeState('{"n":-0}'));
  assert.throws(()=>encodeState('['.repeat(34)+'0'+']'.repeat(34)));
});
const server=createDemoServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
function request(method,headers={}) {
  return new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port:server.address().port,path:'/',method,headers},res=>{
      let body='';res.setEncoding('utf8');res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
    });req.on('error',reject);req.end();
  });
}
try {
  let r=await request('OPTIONS',{Origin:'https://app.example.test','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Content-Type, X-CSRF-Token'});
  check('allowed credentialless preflight',()=>{assert.equal(r.status,204);assert.equal(r.headers['access-control-allow-credentials'],'true');});
  r=await request('OPTIONS',{Origin:'https://evil.example.test','Access-Control-Request-Method':'POST'});
  check('denied origin',()=>assert.equal(r.status,403));
  r=await request('OPTIONS',{Origin:'https://app.example.test','Access-Control-Request-Method':'DELETE'});
  check('denied preflight method',()=>assert.equal(r.status,403));
  r=await request('OPTIONS',{Origin:'https://app.example.test','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Authorization'});
  check('denied request header',()=>assert.equal(r.status,403));
  r=await request('GET',{Origin:'https://app.example.test'});
  check('actual response exact origin and vary',()=>{assert.equal(r.status,200);assert.equal(r.headers['access-control-allow-origin'],'https://app.example.test');assert.match(r.headers.vary,/Origin/);});
  r=await request('DELETE');check('method not allowed',()=>{assert.equal(r.status,405);assert.match(r.headers.allow,/OPTIONS/);});
} finally { await new Promise(resolve=>server.close(resolve)); }
console.log(`native JS: ${checks} groups passed; fake WebSocket and loopback Node HTTP, no real browser/React`);
