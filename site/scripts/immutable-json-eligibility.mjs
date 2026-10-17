// Proposal only. Production registry validation remains unchanged until root approval.
import {isProxy} from 'node:util/types';
const objectPrototype=Object.prototype,arrayPrototype=Array.prototype,jsonObject=JSON,stringify=JSON.stringify;
const getPrototypeOf=Object.getPrototypeOf,isFrozen=Object.isFrozen,getDescriptors=Object.getOwnPropertyDescriptors,ownKeys=Reflect.ownKeys,hasOwn=Object.hasOwn,isArray=Array.isArray,isFiniteNumber=Number.isFinite;
export function stableJSONIntrinsics(){
 return globalThis.JSON===jsonObject&&JSON.stringify===stringify&&getPrototypeOf(objectPrototype)===null&&getPrototypeOf(arrayPrototype)===objectPrototype&&!hasOwn(objectPrototype,'toJSON')&&!hasOwn(arrayPrototype,'toJSON');
}
export function deeplyFrozenPlainJSON(root){
 const active=new WeakSet(),checked=new WeakSet();
 function visit(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return true;
  if(typeof value==='number')return isFiniteNumber(value);
  if(typeof value!=='object'||isProxy(value)||!isFrozen(value))return false;
  if(active.has(value))return false;if(checked.has(value))return true;
  const array=isArray(value),proto=getPrototypeOf(value);
  if(proto!==(array?arrayPrototype:objectPrototype))return false;
  const descriptors=getDescriptors(value),keys=ownKeys(descriptors);
  if(keys.some(k=>typeof k!=='string'))return false;
  if(array){
   const len=descriptors.length;
   if(!len||!hasOwn(len,'value')||len.enumerable||!Number.isSafeInteger(len.value)||len.value<0||keys.length!==len.value+1)return false;
   for(let i=0;i<len.value;i++)if(!hasOwn(descriptors,String(i)))return false;
  }
  active.add(value);
  for(const key of keys){
   if(array&&key==='length')continue;
   const descriptor=descriptors[key];
   if(!hasOwn(descriptor,'value')||!descriptor.enumerable||!visit(descriptor.value)){active.delete(value);return false;}
  }
  active.delete(value);checked.add(value);return true;
 }
 return stableJSONIntrinsics()&&visit(root);
}
