// A separate adapter keeps every existing projected source block byte-contiguous.
// Install immediately before events.js, whose final statement starts rendering.
export const READING_PRESENTATION_LIFECYCLE = `
/* Reading presentation lifecycle adapter */
(() => {
  const originalHydrateCode = hydrateCode;
  if (originalHydrateCode.__notesReadingPresentation) return;
  function hydrateReadingPage() {
    const page = arguments[0];
    if (page === document.getElementById('page')) {
      const entry = state.route?.view === 'entry' ? byId.get(state.route.id) : null;
      window.__NOTES_RUNTIME__.enhanceReadingPage?.(page, entry);
      page.querySelectorAll('.sec-h > .n').forEach((node, i) => { node.textContent = pad2(i + 1); });
    }
    return originalHydrateCode.apply(this, arguments);
  }
  Object.defineProperty(hydrateReadingPage, '__notesReadingPresentation', {value: true});
  hydrateCode = hydrateReadingPage;
})();
`;

export function addReadingPresentationLifecycle(dir, files, blocks, {baselineTest = false} = {}) {
  if (baselineTest || dir !== 'app') return blocks;
  const fail = reason => { throw new Error('Reading presentation: ' + reason); };
  if (!Array.isArray(files) || !Array.isArray(blocks) || files.length !== blocks.length ||
      blocks.some(block => typeof block !== 'string')) fail('invalid source blocks');
  const slot = name => {
    const positions = files.flatMap((file, i) => file === name ? [i] : []);
    if (positions.length !== 1) fail(name + ' lifecycle slot must occur exactly once');
    return positions[0];
  };
  const eventIndex = slot('events'), fragmentIndex = slot('fragments'), routingIndex = slot('routing');
  if (fragmentIndex >= routingIndex || routingIndex >= eventIndex) fail('invalid hydration lifecycle order');
  if (blocks[fragmentIndex].split('function hydrateCode(root) {').length !== 2 ||
      blocks[routingIndex].split('    hydrateCode(page);').length !== 2 ||
      blocks[routingIndex].split('    buildRail();').length !== 2 ||
      blocks[routingIndex].indexOf('    hydrateCode(page);') >= blocks[routingIndex].indexOf('    buildRail();'))
    fail('hydration lifecycle contract changed');
  if (blocks.some(block => block.includes('/* Reading presentation lifecycle adapter */'))) fail('adapter already installed');
  return [...blocks.slice(0, eventIndex), READING_PRESENTATION_LIFECYCLE, ...blocks.slice(eventIndex)];
}
