// A comparison may be suppressed only for an explicitly reviewed, exact pair.
// Content drift is safe: it makes the card visible, not a build/runtime failure.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const COMPARISON_EQUIVALENCE_SHA256='4bf759323874414f9357bc38fff2504503bbaf30990f99a6a9c7deec67e48ee6';
export async function readComparisonEquivalence() {
  return JSON.parse(await readFile(new URL('../content/comparison-equivalence.json',import.meta.url),'utf8'));
}
function validateRegistry(registry) {
  if(!registry || sha(JSON.stringify(registry))!==COMPARISON_EQUIVALENCE_SHA256)throw Error('Comparison visibility: registry integrity mismatch');
  const keys=new Set();
  for(const r of registry.records) {
    if(keys.has(r.key) || r.key!==r.entryId+'#'+r.questionIndex || !Number.isInteger(r.questionIndex) || r.questionIndex<0 || !Number.isInteger(r.tableIndex) || r.tableIndex<0 || typeof r.questionText!=='string')throw Error('Comparison visibility: invalid reviewed identity');
    keys.add(r.key);
    for(const name of ['expectedCardSha256','expectedAnswerSha256','expectedLeadSha256','expectedTableHtmlSha256'])if(!/^[0-9a-f]{64}$/.test(r[name]))throw Error('Comparison visibility: missing exact content hash');
    if(r.coverage!=='every_card_column_dimension_and_cell_mapped_to_one_same_question_table')throw Error('Comparison visibility: incomplete reviewed coverage');
  }
}

// This dependency-free function is also emitted into the classic browser bundle.
// Receipts bind the hydrated entry/item objects as well as every rendered string.
export function createComparisonVerifier({records,cards,digest,entryForId}) {
  const receipts=new Map(),generations=new Map();
  const byEntry=new Map();
  for(const record of records) {
    if(!byEntry.has(record.entryId))byEntry.set(record.entryId,[]);
    byEntry.get(record.entryId).push(record);
  }
  const leadOf=item=>typeof item.lead==='string'?item.lead:'';
  const currentEntry=entry=>!entryForId || entryForId(entry.id)===entry;
  async function verifyEntry(entry,{isCurrent=()=>true}={}) {
    if(!entry || !Array.isArray(entry.items))return;
    const targets=byEntry.get(entry.id)||[],generation=(generations.get(entry.id)||0)+1;
    generations.set(entry.id,generation);
    for(const record of targets)receipts.delete(record.key);
    if(!currentEntry(entry) || !isCurrent())return;
    await Promise.all(targets.map(async record=>{
      try {
        const item=entry.items[record.questionIndex],card=cards[record.key];
        if(!card?.dup || !item || (item.id??null)!==record.questionId || item.q!==record.questionText || typeof item.a!=='string' || (item.lead!=null && typeof item.lead!=='string'))return;
        const answer=item.a,lead=leadOf(item),cardJSON=JSON.stringify(card);
        const table=[...answer.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)][record.tableIndex]?.[0];
        if(!table)return;
        const hashes=await Promise.all([cardJSON,answer,lead,table].map(value=>digest(value)));
        if(hashes.some((hash,index)=>hash!==[record.expectedCardSha256,record.expectedAnswerSha256,record.expectedLeadSha256,record.expectedTableHtmlSha256][index]))return;
        if(generations.get(entry.id)!==generation || !isCurrent() || !currentEntry(entry) || entry.items[record.questionIndex]!==item || item.a!==answer || leadOf(item)!==lead || JSON.stringify(cards[record.key])!==cardJSON || item.q!==record.questionText || (item.id??null)!==record.questionId)return;
        receipts.set(record.key,{entry,item,record,answer,lead,cardJSON,generation});
      } catch { /* Missing WebCrypto, failed digest or malformed data: show card. */ }
    }));
  }
  function isDuplicate(key,question) {
    const proof=receipts.get(key),card=cards[key];
    if(!proof || !question || !card?.dup || !currentEntry(proof.entry) || !Array.isArray(proof.entry.items))return false;
    const {entry,item,record,answer,lead,cardJSON,generation}=proof;
    if((item.lead!=null && typeof item.lead!=='string') || (question.lead!=null && typeof question.lead!=='string'))return false;
    return generations.get(entry.id)===generation && entry.items[record.questionIndex]===item && item.a===answer && leadOf(item)===lead && item.q===record.questionText && (item.id??null)===record.questionId && question.a===answer && leadOf(question)===lead && question.q===record.questionText && (question.id??null)===record.questionId && JSON.stringify(card)===cardJSON;
  }
  return {verifyEntry,isDuplicate};
}
function comparisonDigest(value) {
  if(!globalThis.crypto?.subtle || typeof TextEncoder!=='function')return Promise.resolve(null);
  return globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)).then(bytes=>Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join(''));
}
export function projectComparisonVisibilityRuntime(file,text,registry,{baselineTest=false}={}) {
  if(baselineTest || !['src/app/highlight-map.js','src/app/renderers.js','src/app/routing.js'].includes(file))return text;
  validateRegistry(registry);
  const replace=(before,after,count=1)=>{
    if(text.split(before).length!==count+1)throw Error('Comparison visibility: exact runtime anchor drift '+file);
    text=text.split(before).join(after);
  };
  if(file==='src/app/highlight-map.js') {
    replace("function cmpCard(key) {\n  const c = HLC[key];\n  if (!c) return '';", "function cmpCard(key, question) {\n  const sourceCard = HLC[key];\n  if (!sourceCard) return '';\n  const c = {...sourceCard, dup: comparisonVerifier.isDuplicate(key, question)};");
    const fields=['key','entryId','questionIndex','questionId','questionText','expectedCardSha256','expectedAnswerSha256','expectedLeadSha256','tableIndex','expectedTableHtmlSha256'];
    const records=registry.records.map(record=>Object.fromEntries(fields.map(key=>[key,record[key]])));
    text+='\n'+createComparisonVerifier.toString()+'\n'+comparisonDigest.toString()+'\nconst comparisonVerifier = createComparisonVerifier({records:'+JSON.stringify(records)+',cards:HLC,digest:comparisonDigest,entryForId:id=>byId.get(id)});\n';
  } else if(file==='src/app/renderers.js') {
    // Pass the full original item, never the lead-stripped display fragment.
    replace('cmpCard(it.key)','cmpCard(it.key, it)',2);
  } else {
    if(text.includes('await comparisonVerifier.verifyEntry('))throw Error('Comparison visibility: exact runtime anchor drift '+file+' already projected');
    const anchor="else if (r.view === 'hl') await repository.loadMap(r.mod);";
    replace(anchor,anchor+'\n    if (pendingEntry && sequence === renderSequence) await comparisonVerifier.verifyEntry(byId.get(pendingEntry.id), {isCurrent: () => sequence === renderSequence});');
  }
  return text;
}
