import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const recordID=(r,index)=>({index,entryId:r.entryId,path:r.path,checks:['stale','missing',...(r.questionIdentity?['question:q','question:id','question:mk']:[])]});
export function validateReceipt(receipt,{registrySHA256,records,start,end,mode}){
 assert.equal(receipt?.terminal,true,'missing terminal receipt');
 assert.equal(receipt.registrySHA256,registrySHA256,'wrong registry hash');
 assert.equal(receipt.mode,mode,'wrong mode');
 assert.equal(receipt.start,start,'wrong range start');assert.equal(receipt.end,end,'wrong range end');
 assert.ok(Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&end<=records.length&&end>=start,'invalid range');
 const expected=mode==='globals'?[]:records.slice(start,end).map((r,i)=>recordID(r,start+i));
 assert.deepEqual(receipt.records,expected,'wrong record IDs/order/assertion coverage');
 assert.deepEqual(receipt.globalChecks,mode==='globals'?['double-apply','duplicate-entry']:[],'wrong global checks');
 const calls=expected.reduce((n,r)=>n+r.checks.length,0)+(mode==='globals'?2:0);
 assert.equal(receipt.calls,calls,'wrong call count');
 return receipt;
}
export function validateComplete(receipts,registrySHA256,records){
 assert.equal(receipts.length,1+Math.ceil(records.length/50),'missing or duplicate ranges');
 validateReceipt(receipts[0],{registrySHA256,records,start:0,end:0,mode:'globals'});
 for(let start=0,index=1;start<records.length;start+=50,index++)validateReceipt(receipts[index],{registrySHA256,records,start,end:Math.min(start+50,records.length),mode:'range'});
 const covered=receipts.flatMap(r=>r.records);assert.equal(covered.length,records.length);
 assert.equal(new Set(covered.map(r=>r.index)).size,records.length,'duplicate indices');
 const calls=receipts.reduce((n,r)=>n+r.calls,0),expectedCalls=2+records.reduce((n,r)=>n+2+(r.questionIdentity?3:0),0);
 assert.equal(calls,expectedCalls);return {records:covered.length,calls,registrySHA256,ranges:receipts.length-1};
}
