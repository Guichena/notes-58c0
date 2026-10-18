// Add explicitly reviewed code companions without changing the frozen reading policy.
export function extendFinalAuditReadingPolicy(policy, registry, {baselineTest=false}={}) {
 if(baselineTest)return policy;
 if(registry?.schemaVersion!==1||!Array.isArray(registry.documents))throw Error('Final reading: invalid registry');
 const result=structuredClone(policy),seen=new Set((result.visibleCodeDocuments||[]).map(x=>x.id));
 for(const r of registry.documents){
  if(typeof r.id!=='string'||!r.id||r.kind!=='doc'||r.mod!=='code'||!/^[a-f0-9]{64}$/.test(r.htmlSha256)||typeof r.reason!=='string'||!r.reason.trim())throw Error('Final reading: invalid companion');
  if(seen.has(r.id))throw Error('Final reading: duplicate companion');seen.add(r.id);
  (result.visibleCodeDocuments??=[]).push(structuredClone(r));
 }
 return result;
}
