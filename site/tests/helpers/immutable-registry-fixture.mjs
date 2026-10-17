// Opt in only for a stable canonical registry parsed from a pinned JSON fixture.
// Corruption tests must continue to use mutable structured clones.
export function freezeStableRegistry(value){
 if(value&&typeof value==='object'){for(const child of Object.values(value))freezeStableRegistry(child);Object.freeze(value);}
 return value;
}
