import {removeExactIntroRepeat} from './remove-exact-intro.mjs';
export function projectExactIntroRuntime(file,text,{baselineTest=false}={}){
 if(baselineTest||file!=='src/app/renderers.js')return text;
 const before="? it.a.slice(it.lead.length) : it.a;";
 if(text.split(before).length!==2)throw Error('Exact intro display: expected exactly one authored lead branch');
 const guard="it.leadType === 'authored' && it.lead && typeof it.a === 'string' && it.a.startsWith(it.lead)";
 if(!text.includes(guard))throw Error('Exact intro display: missing authored exact-prefix guard');
 return text.replace(before,'? removeExactIntroRepeat(it.lead, it.a.slice(it.lead.length)) : it.a;')+'\n'+removeExactIntroRepeat.toString()+'\n';
}
