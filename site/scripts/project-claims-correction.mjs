import {createHash} from 'node:crypto';
export const PROJECT_CLAIMS_REGISTRY_SHA256='4b4822b9b5ede7dd0cec0d331d07a9309bb331adf58925f95543b190d3ded850';
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail=m=>{throw Error('Project claims correction: '+m);};
export const PROJECT_TEXT_PARTS=/(<pre\b[^>]*>[\s\S]*?<\/pre>|<code\b[^>]*>[\s\S]*?<\/code>|<[^>]*>)/g;
export function projectClaimExamples(entries,registry,{baselineTest=false}={}) {
 if(baselineTest)return entries;
 if(!registry||sha(registry)!==PROJECT_CLAIMS_REGISTRY_SHA256)fail('registry integrity mismatch');
 if(registry.schemaVersion!==1||registry.fields.length!==1)fail('finite scope mismatch');
 const ids=new Map();for(const e of entries){if(ids.has(e.id))fail('duplicate entry');ids.set(e.id,e);}
 const target=ids.get('doc-19');if(!target)fail('missing target doc-19');
 for(const [k,v] of Object.entries(registry.identities['doc-19']))if(target[k]!==v)fail('target identity mismatch');
 const f=registry.fields[0];if(f.entryId!=='doc-19'||JSON.stringify(f.path)!=='["html"]'||f.edits.length!==17)fail('finite scope mismatch');
 if(target.html===f.after)fail('already applied');
 if(typeof target.html!=='string'||target.html!==f.before||sha(target.html)!==f.beforeSha256)fail('stale input doc-19 html');
 if(typeof f.after!=='string'||sha(f.after)!==f.afterSha256)fail('output hash mismatch');
 const nodes=target.html.split(PROJECT_TEXT_PARTS),seen=new Set();
 for(const edit of f.edits){const i=edit.nodeIndex;if(!Number.isInteger(i)||i<0||i%2||seen.has(i)||nodes[i]!==edit.before||/[<>]/.test(edit.after))fail('text-node edit mismatch');seen.add(i);nodes[i]=edit.after;}
 if(nodes.join('')!==f.after)fail('edit replay mismatch');
 const output=structuredClone(entries);output.find(e=>e.id==='doc-19').html=f.after;return output;
}
