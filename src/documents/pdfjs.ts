// pdf.js (inclòs a l'app, sense res d'internet) per veure els PDF dins l'app i
// fer-ne la miniatura. Es carrega només quan cal. El PDF desxifrat només és a
// la memòria: no es desa mai al disc ni es fa servir cap URL.

import type { PDFDocumentProxy } from 'pdfjs-dist'

/** El PDF i com alliberar-lo (cal cridar `tancar` en acabar) */
export async function carregarPdf(bytes: Uint8Array): Promise<{ pdf: PDFDocumentProxy; tancar(): void }> {
  const pdfjs = await import('pdfjs-dist')
  // Un sol worker per a tota la sessió (es crea la primera vegada i es reutilitza)
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    const { default: url } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(url, { type: 'module' })
  }
  // Una còpia: pdf.js es queda el buffer (el passa al worker)
  const tasca = pdfjs.getDocument({ data: bytes.slice() })
  return { pdf: await tasca.promise, tancar: () => void tasca.destroy() }
}
