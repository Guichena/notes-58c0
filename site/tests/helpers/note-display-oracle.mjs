import assert from 'node:assert/strict';
// Independent expected final display transformation; never remove fields from comparisons.
// Replace only the numeric token of an explicit whole QA-count label.
export const expectedNoteDisplay = entries => entries.map(entry => {
  if (entry.kind !== 'qa' || !Array.isArray(entry.items) ||
      typeof entry.number !== 'string' || !/^\s*[0-9]+\s*问\s*$/.test(entry.number)) return entry;
  return {...entry, number:entry.number.replace(/[0-9]+/, String(entry.items.length))};
});

// Reverse only the validated derived number for upstream registry identity tests.
// The source counts come from the independent authoring/content pipeline, never
// the output being checked. No other field is normalized or ignored.
export function restoreExpectedNoteDisplay(entries, originals) {
  const byId=new Map(originals.map(e=>[e.id,e]));
  return entries.map(e=>{
    const original=byId.get(e.id);
    assert.ok(original,'independent upstream entry '+e.id);
    const expected=expectedNoteDisplay([original])[0];
    if(expected.number===original.number)return e;
    assert.equal(e.number,expected.number,'derived QA count '+e.id);
    return {...e,number:original.number};
  });
}
