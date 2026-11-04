/**
 * Loads PptxGenJS from self-hosted classic scripts (/jszip.bundle.js then
 * /pptxgen.min.js — PptxGenJS expects JSZip as a global).
 * Loading it this way (instead of bundling) keeps its unused Node code
 * paths out of the webpack graph entirely — the browser build references
 * node:fs/node:https only inside Node-only branches that never run here.
 * The script lives in /public, so it also works fully offline once installed.
 */
let promise = null;

function injectScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

export function loadPptxGenJS() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('PowerPoint export is client-side only.'));
  }
  if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
  if (promise) return promise;

  promise = (async () => {
    // PptxGenJS expects JSZip as a global — load it first.
    if (!window.JSZip) await injectScript('/jszip.bundle.js');
    if (!window.PptxGenJS) await injectScript('/pptxgen.min.js');
    if (!window.PptxGenJS) throw new Error('PowerPoint library did not initialise.');
    return window.PptxGenJS;
  })();
  promise.catch(() => {
    promise = null; // allow a retry after a failed load
  });
  return promise;
}
