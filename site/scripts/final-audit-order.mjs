import {buildLearningOrder} from './interview-learning-order.mjs';
// Explicit reviewed membership moves. Legacy IDs, progress keys and QA arrays are untouched.
export function projectFinalAuditOrderRegistry(registry){
 const out=structuredClone(registry);let source,target;
 for(const m of out.modules)for(const p of m.parts)for(const c of p.categories){
  if(c.entryIds.includes('nonlc-1-10'))source={m,p,c};
  if(c.entryIds.includes('p-dp'))target={m,p,c};
 }
 if(!source||!target||source.m.mod!=='algo'||target.m.mod!=='algo'||source.c===target.c)throw Error('Final order: flower source/target drift');
 source.c.entryIds=source.c.entryIds.filter(id=>id!=='nonlc-1-10');
 if(!source.c.entryIds.length)throw Error('Final order: unexpected empty source group');
 target.c.entryIds.push('nonlc-1-10');
 // The reviewed DSL chapter now belongs to the existing Java I/O group.
 // Move only registry membership; the canonical entry, question index and progress key stay stable.
 let dslSource,dslTarget;
 for(const m of out.modules)for(const p of m.parts)for(const c of p.categories){
  if(c.entryIds.includes('own-mysql-ch37'))dslSource={m,p,c};
  if(c.entryIds.includes('own-java-io'))dslTarget={m,p,c};
 }
 if(!dslSource||!dslTarget||dslSource.m.mod!=='bagu'||dslTarget.m.mod!=='bagu'||dslSource.c===dslTarget.c||dslSource.c.entryIds.length!==1)throw Error('Final order: DSL source/target drift');
 dslSource.p.categories=dslSource.p.categories.filter(c=>c!==dslSource.c);
 if(!dslSource.p.categories.length)throw Error('Final order: unexpected empty DSL source part');
 dslTarget.c.entryIds.push('own-mysql-ch37');
 buildLearningOrder([],out,()=>{});return out;
}
export function projectFinalAuditOrderRuntime(file,source,registry,{baselineTest=false}={}){
 if(baselineTest||file!=='src/app/structure.js')return source;
 const encode=x=>JSON.stringify(x).replaceAll('<','\\u003c');
 const before='const LEARNING_ORDER_REGISTRY = '+encode(registry)+';';
 if(source.split(before).length!==2)throw Error('Final order: runtime anchor drift');
 return source.replace(before,'const LEARNING_ORDER_REGISTRY = '+encode(projectFinalAuditOrderRegistry(registry))+';');
}
