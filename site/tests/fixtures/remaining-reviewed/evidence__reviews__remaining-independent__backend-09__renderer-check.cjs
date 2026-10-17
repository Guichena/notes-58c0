const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const app=fs.readFileSync('site/notes-58c0-refactor/dist/assets/app.js','utf8');
const c={statusOf:()=>0,h:String,HLC:{},cmpCard:()=>'',pageHead:()=>'',callout:(t,v)=>v,pager:()=>'',ICON:{img:''},learnerLabel:(k,v)=>v};vm.createContext(c);
for(const [a,b]of [['function splitLead(', 'function qaListHtml('],['function renderDoc(', '/* ---------------- 问答卡']])vm.runInContext(app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a))),c);
const entries=JSON.parse(fs.readFileSync('reviews/remaining-independent/backend-09/composed-entries.json'));let results=[];
for(const [id,e]of Object.entries(entries)){
 if(e.kind==='qa')for(const [i,q]of e.items.entries()) {const r=c.qaCardHtml({...q,no:i+1,key:id+'/'+i});if(q.leadType==='authored'&&r.split(q.lead).length!==2)throw Error(id+' lead occurrence');results.push({id,index:i,actualQaRenderer:true,leadOnce:true});}
 else {const r=c.renderDoc(e);if(!r.includes(e.html))throw Error(id);results.push({id,actualDocRenderer:true,bodyIntact:true});}
}
fs.writeFileSync('reviews/remaining-independent/backend-09/renderer-check.json',JSON.stringify({appSha256:crypto.createHash('sha256').update(app).digest('hex'),results,scope:'Actual compiled renderer functions in VM with presentation helpers stubbed; no DOM/layout or full-site suite.'},null,2));console.log('PASS',results.length,'actual renderer cases');
