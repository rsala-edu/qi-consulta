// Veure, imprimir i descarregar un PDF desat (xifrat) a l'app. En descarregar
// o imprimir, el fitxer surt de l'app sense xifrar: s'avisa abans.

import { base64ABytes } from './pdf'

/** URL temporal del PDF (cal revocar-la en acabar) */
export function urlPdf(b64: string): string {
  const bytes = base64ABytes(b64)
  return URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }))
}

export function descarregarPdf(b64: string, nom: string): void {
  const url = urlPdf(b64)
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Nom del fitxer sense caràcters estranys: «consentiment-acupuntura-v2-2026-11-13.pdf» */
export function nomFitxer(tipus: string, versio: number, signatAt: string): string {
  return `consentiment-${tipus}-v${versio}-${signatAt.slice(0, 10)}.pdf`
}
