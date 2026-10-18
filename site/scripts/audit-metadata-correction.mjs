import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export const COMPARISON_FACTUAL_SHA256='7ed4bc962727d7ea3f21f233a0aa490d9aea05b3d92e30a89a85267e95472e16';

// Keep the comparison card consistent with the already reviewed answer.
export function projectAuditMetadata(metadata,{baselineTest=false}={}) {
  if(baselineTest) return metadata;
  const key='ai-agent-6#9';
  const card=metadata?.HL?.cards?.[key];
  const expected={title:'Claude Code vs Cursor',cols:['Claude Code','Cursor'],rows:[{dim:'更像',cells:['终端型 agent、工程执行助手','编辑器里的高质量搭档']},{dim:'适合任务',cells:['需要走完整链路的任务','局部补全、单文件改造、边写边改']}],dup:1};
  if(JSON.stringify(card)!==JSON.stringify(expected)) throw Error('Audit metadata: reviewed comparison changed');
  const corrected={...card,rows:[{dim:'常用入口',cells:['终端中的代码库任务与工程执行','编辑器中的交互修改与 Agent 任务']},{dim:'任务能力',cells:['代码库理解、跨文件修改、测试与任务执行','补全、代码库理解、多文件修改与任务执行']},{dim:'选型依据',cells:['按版本核对权限、审查、测试和恢复能力','按版本核对权限、审查、测试和恢复能力']}]};
  return {...metadata,HL:{...metadata.HL,cards:{...metadata.HL.cards,[key]:corrected}}};
}

export async function readReviewedComparisonCorrections() {
  return JSON.parse(await readFile(new URL('../content/comparison-card-factual-corrections.json',import.meta.url),'utf8'));
}

// This final metadata phase consumes the final, raw QA answers. Paired table
// corrections have already run; accepting either old/new answer hash here would
// conceal a partially integrated release. Metadata provenance is not emitted.
export function projectReviewedComparisonMetadata(metadata,entries,registry,{baselineTest=false,reverse=false}={}) {
  if(baselineTest)return metadata;
  const fail=message=>{throw Error('Reviewed comparison metadata: '+message);};
  if(!registry || registry.schemaVersion!==1 || !Array.isArray(registry.records) || sha(JSON.stringify(registry))!==COMPARISON_FACTUAL_SHA256)fail('registry integrity mismatch');
  const byId=new Map(entries.map(entry=>[entry.id,entry]));
  if(byId.size!==entries.length)fail('duplicate entry identity');
  const cards={...metadata.HL.cards},keys=new Set();
  for(const record of registry.records) {
    const match=/^(.+)#(0|[1-9]\d*)$/.exec(record.key);
    if(!match || keys.has(record.key))fail('invalid or duplicate card identity');
    keys.add(record.key);
    const question=byId.get(match[1])?.items?.[Number(match[2])];
    if(!question || (question.id??null)!==record.questionId || question.q!==record.questionText)fail('question identity drift '+record.key);
    if(typeof question.a!=='string' || (question.lead!==undefined && typeof question.lead!=='string') || sha(question.a)!==record.expectedAnswerSha256 || sha(question.lead||'')!==record.expectedLeadSha256)fail('final answer/lead changed '+record.key);
    if(sha(JSON.stringify(record.oldCard))!==record.expectedOriginalHash || sha(JSON.stringify(record.newCard))!==record.newCardHash)fail('reviewed card hash mismatch '+record.key);
    const expected=structuredClone(record.oldCard),paths=new Set();
    for(const edit of record.exactFieldChanges) {
      if(JSON.stringify(edit.metadataPath.slice(0,3))!==JSON.stringify(['HL','cards',record.key]))fail('field outside reviewed card');
      const path=edit.metadataPath.slice(3),pathKey=JSON.stringify(path);
      if(!path.length || paths.has(pathKey) || path.some(part=>['__proto__','prototype','constructor'].includes(part)))fail('invalid or repeated field path');
      paths.add(pathKey);
      let owner=expected;
      for(const part of path.slice(0,-1))owner=owner?.[part];
      if(!owner || !Object.hasOwn(owner,path.at(-1)) || owner[path.at(-1)]!==edit.oldValue)fail('field input changed');
      owner[path.at(-1)]=edit.newValue;
    }
    if(JSON.stringify(expected)!==JSON.stringify(record.newCard))fail('changes exceed reviewed fields');
    const before=reverse?record.newCard:record.oldCard,after=reverse?record.oldCard:record.newCard;
    if(JSON.stringify(cards[record.key])!==JSON.stringify(before))fail('card input changed '+record.key);
    cards[record.key]=structuredClone(after);
  }
  return {...metadata,HL:{...metadata.HL,cards}};
}
