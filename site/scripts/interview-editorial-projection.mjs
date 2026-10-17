// Reviewed question-local prose only. Runs after projectClaimExamples; sourceArchive is upstream.
import {createHash} from 'node:crypto';
export const EDITORIAL_REGISTRY_SHA256 = 'f5f661ac515217247b8c361cf1e95a0b873e3b001a68397cb5fceef4d1362f82';
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = message => { throw Error('Interview editorial projection: ' + message); };
const scope = [
 ['own-mq-reliability', 'q-own-mq-relay-ownership'],
 ['own-spring-async', 'q-own-spring-webflux-model'],
 ['bg-redis-4', null], ['ai-agent-1', null], ['bg-mysql-1', null], ['bg-mysql-1', null]
];
function selectQuestion(entry, record) {
 const legacy = record.questionId === null;
 const matches = entry.items?.filter(q => legacy ? q.q === record.questionText : q.id === record.questionId) || [];
 if (matches.length !== 1) fail('missing or duplicate target question');
 const question = matches[0];
 if (legacy && (Object.hasOwn(question, 'id') || entry.items.indexOf(question) !== record.questionIndex)) fail('legacy question identity/index mismatch');
 return question;
}
export function projectInterviewEditorial(entries, registry, {baselineTest = false} = {}) {
 if (baselineTest) return entries;
 if (!registry || sha(registry) !== EDITORIAL_REGISTRY_SHA256) fail('registry integrity mismatch');
 if (registry.schemaVersion !== 1 || JSON.stringify(registry.records.map(r => [r.entryId, r.questionId])) !== JSON.stringify(scope)) fail('finite scope mismatch');
 const byId = new Map();
 for (const entry of entries) {
  if (byId.has(entry.id)) fail('duplicate entry');
  byId.set(entry.id, entry);
 }
 const practiceId='own-practice-mysql-isolation-workbook';
 if (registry.records.some(r => r.fields.a.after.includes('#/e/'+practiceId)) && !byId.has(practiceId)) fail('missing linked practice entry');
 // Validate every target before copying or changing any field.
 for (const record of registry.records) {
  const entry = byId.get(record.entryId);
  if (!entry) fail('missing target entry ' + record.entryId);
  for (const [key, value] of Object.entries(record.entryIdentity)) if (entry[key] !== value) fail('entry identity mismatch');
  const question = selectQuestion(entry, record);
  for (const [key, value] of Object.entries(record.questionIdentity)) if (question[key] !== value) fail('question identity mismatch');
  if (Object.keys(record.fields).sort().join(',') !== 'a,lead') fail('field scope mismatch');
  for (const [field, edit] of Object.entries(record.fields)) {
   if (question[field] === edit.after) fail('already applied');
   if (typeof question[field] !== 'string' || question[field] !== edit.before || sha(question[field]) !== edit.beforeSha256) fail('stale input ' + record.questionId + ' ' + field);
   if (typeof edit.after !== 'string' || sha(edit.after) !== edit.afterSha256) fail('output hash mismatch');
  }
 }
 const output = structuredClone(entries);
 for (const record of registry.records) {
  const question = selectQuestion(output.find(e => e.id === record.entryId), record);
  for (const [field, edit] of Object.entries(record.fields)) question[field] = edit.after;
 }
 return output;
}
