import {readFile,readdir,writeFile,mkdir,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {compileAuthoring,readAuthoring,prepareMergedQuestionAuthoring,MODULES,extensionTarget,authoredExtensionTarget,originalContentHash} from './authoring.mjs';
const argv=process.argv.slice(2),command=argv.shift();
const flags={};
while(argv.length){const k=argv.shift();if(!k.startsWith('--'))throw new Error('Expected --option, got '+k);flags[k.slice(2)]=argv[0]&&!argv[0].startsWith('--')?argv.shift():true;}
const root=path.resolve(flags.root||fileURLToPath(new URL('../',import.meta.url)));
const readJSON=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
async function originals(){const meta=await readJSON('content/metadata.json');const byId=new Map();for(const name of (await readdir(path.join(root,'content/chapters'))).filter(n=>n.endsWith('.json')))for(const e of (await readJSON('content/chapters/'+name)).entries)byId.set(e.id,e);return meta.entryOrder.map(id=>byId.get(id));}
const question=id=>({id,question:'填写问题',commonPhrasings:[],shortAnswer:'填写简短结论',explanation:{format:'text',value:'填写完整解释'},followUps:[],code:[],tags:[],related:[],mustKnow:false});
const requireFlag=name=>{const value=flags[name];if(typeof value!=='string'||!value.trim())throw new Error('Required --'+name);return value;};
const validateID=value=>{if(!/^[a-z][a-z0-9-]*$/.test(value))throw new Error('ID must contain lowercase letters, digits and hyphens, starting with a letter');return value;};
async function create(file,data) {
 const target=path.join(root,file);try{await access(target);throw new Error('File already exists: '+file);}catch(e){if(e.code!=='ENOENT')throw e;}
 const out=JSON.stringify(data,null,2)+'\n';
 if(flags['dry-run']){console.log(JSON.stringify({dryRun:true,path:file,data},null,2));return;}
 await mkdir(path.dirname(target),{recursive:true});await writeFile(target,out,{flag:'wx'});console.log('Created draft: '+file+'\nFill the fields, set draft to false, then run npm run validate && npm run build.');
}
try {
 if(command==='validate') {
  const docs=await readAuthoring(root);let registry=null;
  try{registry=await readJSON('content/question-bank-merge.json');}catch(error){if(error.code!=='ENOENT')throw error;}
  const prepared=registry?prepareMergedQuestionAuthoring(docs,registry):{documents:docs};
  if(prepared.documents.length!==docs.length) {
   // Only the real merge pipeline can validate registry-created targets. Do not
   // synthesize target entries or treat a deferred document as already checked.
   const validationScript=path.join(root,'scripts/build.mjs');
   let validationSource;try{validationSource=await readFile(validationScript,'utf8');}catch(error){throw new Error('Selected root lacks scripts/build.mjs for complete merge-target validation: '+root+'; '+error.message);}
   if(!validationSource.includes("if(process.argv.includes('--validate-only'))"))throw new Error('Selected root build lacks validate-only support: '+root);
   const checked=JSON.parse(execFileSync(process.execPath,[validationScript,'--validate-only'],{encoding:'utf8'}));
   if(checked.mode!=='validate-only'||checked.authoringFiles!==docs.length)throw new Error('complete compile validation result mismatch');
   console.log(`Valid: ${checked.entries} entries, ${checked.reviewUnits} review units; ${docs.length} authoring files checked. ${checked.deferredQuestionFiles.length} merge-target questions checked through the complete pipeline; dist unchanged.`);
  } else {
   const source=await originals(),identity=await readJSON('content/legacy-identities.json'),result=compileAuthoring(source,docs,identity);
   console.log(`Valid: ${result.length} entries, ${result.reduce((n,e)=>n+(e.kind==='qa'?e.items.length:1),0)} review units; ${docs.length} authoring files checked. Drafts excluded from the compiled corpus.`);
  }
 } else if(command==='new-answer-addition'||command==='new-supplement') {
  const type=command==='new-answer-addition'?'answer-additions':'supplements';
  const id=validateID(requireFlag('id'));if(!id.startsWith('add-'))throw new Error('Extension ID must start with add-');
  const data={schemaVersion:1,draft:true,id,entryId:requireFlag('entry')};
  if(type==='answer-additions')data.questionId=requireFlag('question');
  const docs=await readAuthoring(root);
  if(flags['target-origin']!==undefined) {
   if(!['original','authored'].includes(flags['target-origin']))throw new Error('--target-origin must be original or authored');
   data.targetOrigin=flags['target-origin'];
  }
  if(type==='supplements'&&data.targetOrigin==='authored')throw new Error('Authored targets support answer-additions only');
  const source=await originals();
  const target=data.targetOrigin==='authored'
   ?authoredExtensionTarget(source,docs,await readJSON('content/legacy-identities.json'),data)
   :extensionTarget(source,type,data);
  data.expectedOriginalHash=originalContentHash(target);data.title='填写补充标题';
  data.body={format:'text',value:'填写经过核对的补充内容'};data.code=[];data.related=[];
  if(docs.some(d=>['answer-additions','supplements'].includes(d.type)&&d.data.id===id))throw new Error('Duplicate addition ID '+id);
  await create('authoring/'+type+'/'+id+'.json',data);
 } else if(command==='new-entry') {
  const id=validateID(requireFlag('id'));const kind=requireFlag('kind');if(!['qa','doc'].includes(kind))throw new Error('--kind must be qa or doc');
  const mod=requireFlag('module');if(!MODULES.includes(mod))throw new Error('Unknown --module');
  const source=await originals(),docs=await readAuthoring(root);if(source.some(e=>e.id===id)||docs.some(d=>d.type==='entries'&&d.data.id===id))throw new Error('Duplicate entry ID '+id);
  const data={schemaVersion:1,draft:true,id,kind,module:mod,part:requireFlag('part'),category:requireFlag('category'),title:requireFlag('title'),tags:[],related:[]};
  if(kind==='qa')data.questions=[question('q-'+randomUUID())];else data.sections=[{id:'section-overview',title:'知识点概述',body:{format:'text',value:'填写完整知识点'},code:[]}];
  await create('authoring/entries/'+id+'.json',data);
 } else if(command==='new-question') {
  const entryId=requireFlag('entry');const id=validateID(flags.id||'q-'+randomUUID());if(!id.startsWith('q-'))throw new Error('Question ID must start with q-');
  const source=await originals(),docs=await readAuthoring(root);const target=source.find(e=>e.id===entryId)||docs.find(d=>d.type==='entries'&&d.data.id===entryId)?.data;
  if(!target||target.kind!=='qa')throw new Error('--entry must name an existing QA entry (including a draft QA entry)');
  if(docs.some(d=>(d.type==='questions'&&d.data.entryId===entryId&&d.data.id===id)||(d.type==='entries'&&d.data.id===entryId&&d.data.questions?.some(q=>q.id===id))))throw new Error('Duplicate question ID '+entryId+'#'+id);
  await create('authoring/questions/'+entryId+'--'+id+'.json',{schemaVersion:1,draft:true,entryId,order:0,...question(id)});
 } else {
  console.log('Commands:\n  node scripts/content.mjs validate\n  node scripts/content.mjs new-entry --id ID --kind qa|doc --module MOD --part PART --category CATEGORY --title TITLE [--dry-run]\n  node scripts/content.mjs new-question --entry ENTRY_ID [--id q-STABLE_ID] [--dry-run]\n  new-answer-addition --entry ENTRY_ID --question ZERO_BASED_INDEX_OR_STABLE_ID [--target-origin original|authored] --id add-STABLE_ID [--dry-run]\n  new-supplement --entry ENTRY_ID --id add-STABLE_ID [--dry-run]\nOptional --root DIRECTORY is useful for disposable example/test workspaces.');
  if(command)process.exitCode=1;
 }
} catch(error){console.error(error.message);process.exitCode=1;}
