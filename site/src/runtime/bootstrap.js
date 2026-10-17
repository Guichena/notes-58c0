import { ContentRepository } from './content-repository.js';
import { enhanceReadingPage } from './reading-presentation.js';
// Relative to this emitted module, never the origin: works under /notes-58c0/.
const baseURL = new URL('../../', import.meta.url);
const repository = new ContentRepository({baseURL});
const scripts = new Map();
function loadScript(relative) {
  if (!scripts.has(relative)) {
    const task = new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=new URL(relative,baseURL).href;
      script.onload=()=>resolve();
      script.onerror=()=>{script.remove();scripts.delete(relative);reject(new Error('Unable to load '+relative));};
      document.head.appendChild(script);
    });
    scripts.set(relative,task);
  }
  return scripts.get(relative);
}
let visualsReady = false;
window.DG={stopAll(){},mountAll(){}};
window.__NOTES_RUNTIME__={
  repository,
  enhanceReadingPage,
  async loadVisuals() {
    if(visualsReady) return;
    await loadScript('assets/visuals.js');
    // Visual engine functions intentionally keep their original classic scope.
    window.injectVizMotion();
    visualsReady=true;
  },
};
function bootError(error) {
  console.error('Notes startup failed',error);
  const page=document.getElementById('page');
  page.innerHTML='<section class="hero load-error" role="alert"><h1>页面加载失败</h1><p>请检查网络后重试。学习进度仍保存在当前浏览器。</p><button type="button" class="btn primary" id="boot-retry">重新加载</button></section>';
  document.getElementById('boot-retry').addEventListener('click',()=>location.reload());
}
try {
  document.getElementById('page').innerHTML='<section class="hero load-state" role="status" aria-live="polite"><p>正在加载目录…</p></section>';
  window.__NOTES_DATA__=await repository.loadCatalog();
  await loadScript('assets/app.js');
} catch(error) {bootError(error);}
