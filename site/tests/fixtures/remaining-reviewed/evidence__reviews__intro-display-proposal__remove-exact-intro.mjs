// Proposal only: this function consumes the already prefix-deduplicated authored body.
// Compare literal, plain HTML text. Preserve every heading and all source data.
export function removeExactIntroRepeat(lead, rest) {
  if (typeof lead !== 'string' || typeof rest !== 'string') return rest;
  const essence = /^<p class="md-p sx-ess"><span class="sx-tag">本质<\/span>([^<>]+)<\/p>$/.exec(lead);
  if (!essence) return rest;
  const intro = /^(\s*(?:<h([23])\b[^>]*>[^<>]*<\/h\2>\s*)?)(<p class="md-p">([^<>]+)<\/p>)/.exec(rest);
  if (!intro || intro[4] !== essence[1]) return rest;
  return intro[1] + rest.slice(intro[0].length);
}
