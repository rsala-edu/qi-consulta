// pdf.js (inclòs a l'app, sense res d'internet) per veure els PDF dins l'app i
// fer-ne la miniatura. Es carrega només quan cal. El PDF desxifrat només és a
// la memòria: no es desa mai al disc ni es fa servir cap URL.

import type { PDFDocumentProxy } from 'pdfjs-dist'

/** El PDF i com alliberar-lo (cal cridar `tancar` en acabar) */
export async function carregarPdf(bytes: Uint8Array): Promise<{ pdf: PDFDocumentProxy; tancar(): void }> {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker
  }
  // Una còpia: pdf.js es queda el buffer (el passa al worker)
  const tasca = pdfjs.getDocument({ data: bytes.slice() })
  return { pdf: await tasca.promise, tancar: () => void tasca.destroy() }
}
