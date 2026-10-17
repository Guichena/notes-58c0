import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {removeExactIntroRepeat as f} from './remove-exact-intro.mjs';
const lead='<p class="md-p sx-ess"><span class="sx-tag">本质</span>结论 &amp; 条件。</p>',p='<p class="md-p">结论 &amp; 条件。</p>',tail='<p class="md-p">不可删除的独有条件。</p>';
let checks=0;function eq(a,b){assert.equal(a,b);checks++;}
eq(f(lead,p+tail),tail);
for(const heading of ['', '<h2 id="keep" class="md-h">标题</h2>','<h3 id="keep">标题</h3>'])eq(f(lead,' \n'+heading+'\n'+p+tail),' \n'+heading+'\n'+tail);
for(const rest of [p.replace('条件。','条件。额外条件'),p.replace('结论',' 结论'),p.replace('&amp;','&'),p.replace('class="md-p"','class="md-p" id="keep"'),p.replace('结论','<code>结论</code>'),p.replace('结论','<a href="#keep">结论</a>'),p.replace('结论','<span id="keep">结论</span>'),p.replace('结论','<b>结论</b>'),'<ul><li>x</li></ul>'+p,'<table></table>'+p,'<details></details>'+p,'<p class="md-p">别的内容</p>'+p,'<h2>标题</h3>'+p,'<h1>标题</h1>'+p,'<h2><a href="#x">标题</a></h2>'+p,'<h2>一</h2><h3>二</h3>'+p])eq(f(lead,rest+tail),rest+tail);
for(const l of [undefined,null,2,lead+'<p>outline</p>',lead.replace('结论','<b>结论</b>'),lead.replace('class="md-p sx-ess"','class="md-p sx-ess" id="keep"'),lead.replace('本质','要点'),lead+'\n'])eq(f(l,p+tail),p+tail);
eq(f(lead,null),null);
const app=readFileSync(new URL('../../../site/notes-58c0-refactor/dist/assets/app.js',import.meta.url),'utf8');const old=app.slice(app.indexOf('function splitLead(html)'),app.indexOf('function qaListHtml(items'));const needle='? it.a.slice(it.lead.length) : it.a;';assert.equal(old.split(needle).length,2);const next=old.replace(needle,'? removeExactIntroRepeat(it.lead, it.a.slice(it.lead.length)) : it.a;');
function render(code,it){const c=vm.createContext({statusOf:()=>0,h:s=>String(s??''),HLC:{},cmpCard:()=>'',removeExactIntroRepeat:f});vm.runInContext(code,c);return c.qaCardHtml(it);}
for(const it of [{leadType:'legacy',lead,a:lead+p+tail},{leadType:'v9:叙述',lead,a:lead+p+tail},{leadType:'authored',lead,a:p+tail},{leadType:'authored',lead:lead+'<p>outline</p>',a:lead+'<p>outline</p>'+p+tail}])eq(render(old,{...it,key:'x',no:1}),render(next,{...it,key:'x',no:1}));
writeFileSync(new URL('negative-case-receipt.json',import.meta.url),JSON.stringify({checks,status:'passed',scope:'Pure helper plus actual compiled qaCardHtml branch guards; no live writes/build/JVM'},null,2)+'\n');console.log(checks+' checks passed');
