import {removeExactIntroRepeat} from './remove-exact-intro.mjs';
// Only a complete, byte-identical first paragraph qualifies. Never compare textContent.
function exactLeadAnswerRest(lead, answer) {
 if(typeof lead!=='string'||typeof answer!=='string')return answer;
 const snippet=lead.trim(), first=answer.trimStart();
 if(!/^<p(?:\s[^>]*)?>(?:(?!<\/?(?:p|div|table|thead|tbody|tfoot|tr|td|th|ul|ol|li|h[1-6]|pre|section|article|blockquote)\b)[\s\S])*<\/p>$/.test(snippet)||!first.startsWith(snippet))return answer;
 const stack=[];let balanced=true;
 const text=snippet.replace(/<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)\b(?:[^<>"']|"[^"]*"|'[^']*')*>/gi,(tag,name)=>{
  if(!name)return '';name=name.toLowerCase();
  if(tag.startsWith('</')){if(stack.pop()!==name)balanced=false;}
  else if(!/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(name))stack.push(name);
  return '';
 });
 if(!balanced||stack.length||/<\/?[a-z]/i.test(text))return answer;
 const offset=answer.length-first.length, rest=answer.slice(0,offset)+first.slice(snippet.length);
 return rest.trim()?rest:'';
}
export function projectExactIntroRuntime(file,text,{baselineTest=false}={}){
 if(baselineTest||file!=='src/app/renderers.js')return text;
 const before="? it.a.slice(it.lead.length) : it.a;";
 if(text.split(before).length!==2)throw Error('Exact intro display: expected exactly one authored lead branch');
 const guard="it.leadType === 'authored' && it.lead && typeof it.a === 'string' && it.a.startsWith(it.lead)";
 if(!text.includes(guard))throw Error('Exact intro display: missing authored exact-prefix guard');
 return text.replace(before,'? removeExactIntroRepeat(it.lead, it.a.slice(it.lead.length)) : exactLeadAnswerRest(it.lead, it.a);')+'\n'+removeExactIntroRepeat.toString()+'\n'+exactLeadAnswerRest.toString()+'\n';
}
