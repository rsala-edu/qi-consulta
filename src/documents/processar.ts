// Preparar els fitxers dels documents (etapa 4E), tot al dispositiu:
// - PDF: tal qual (fins a 25 MB), amb la miniatura de la primera pàgina.
// - Imatges (JPEG, PNG, WebP…): redibuixades a 2.400 px pel costat llarg, en
//   JPEG i sense metadades (EXIF, ubicació…).
// - HEIC (fotos d'iPhone o iPad): si el navegador les sap llegir (Safari), com
//   la resta; si no, es converteixen a JPEG amb heic2any (inclòs a l'app: res
//   d'internet, i només es carrega quan cal).
// - Diverses imatges (escaneig o «Un sol document»): un sol PDF, una pàgina per imatge.

import { COSTAT_MAXIM_DOCUMENT, classeFitxer, MIDA_MAXIMA, midaLlegible, QUALITAT_DOCUMENT } from '../domini/document'
import { prepararImatge, type ImatgePreparada } from '../fotos/processar'
import { formatar, t } from '../i18n/t'
import { carregarPdf } from './pdfjs'

export class ErrorFitxer extends Error {}

/** Una imatge d'un document a punt (girada si cal) */
export type PaginaPreparada = ImatgePreparada

export const OPCIONS_IMATGE = { maxim: COSTAT_MAXIM_DOCUMENT, qualitat: QUALITAT_DOCUMENT }

/** Comprova la mida i el tipus d'un fitxer triat; torna què és */
export async function comprovarFitxer(fitxer: File): Promise<'pdf' | 'imatge' | 'heic'> {
  if (fitxer.size > MIDA_MAXIMA)
    throw new ErrorFitxer(formatar(t.documents.massaGran, { nom: fitxer.name, mida: midaLlegible(fitxer.size), maxim: midaLlegible(MIDA_MAXIMA) }))
  const inici = new Uint8Array(await fitxer.slice(0, 16).arrayBuffer())
  const classe = classeFitxer(fitxer.name, fitxer.type, inici)
  if (classe === 'desconegut') throw new ErrorFitxer(formatar(t.documents.formatNoAdmes, { nom: fitxer.name }))
  return classe
}

/** Una imatge (també HEIC) preparada com a pàgina */
export async function prepararPagina(fitxer: Blob, heic: boolean): Promise<PaginaPreparada> {
  if (heic) {
    try {
      // Safari (iPad, iPhone) les llegeix directament
      return await prepararImatge(fitxer, OPCIONS_IMATGE)
    } catch {
      const { default: heic2any } = await import('heic2any')
      const jpeg = await heic2any({ blob: fitxer, toType: 'image/jpeg', quality: QUALITAT_DOCUMENT })
      return prepararImatge(Array.isArray(jpeg) ? jpeg[0]! : jpeg, OPCIONS_IMATGE)
    }
  }
  return prepararImatge(fitxer, OPCIONS_IMATGE)
}

function canvasDe(img: CanvasImageSource, amplada: number, alcada: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = amplada
  c.height = alcada
  c.getContext('2d')!.drawImage(img, 0, 0, amplada, alcada)
  return c
}

/** Gira una pàgina 90° (en el sentit de les agulles del rellotge) */
export async function girar(p: PaginaPreparada): Promise<PaginaPreparada> {
  const b = await createImageBitmap(new Blob([p.jpeg.buffer as ArrayBuffer], { type: 'image/jpeg' }))
  const c = document.createElement('canvas')
  c.width = b.height
  c.height = b.width
  const ctx = c.getContext('2d')!
  ctx.translate(c.width, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(b, 0, 0)
  return prepararImatge(c, OPCIONS_IMATGE)
}

/** Un PDF amb una pàgina per imatge (cada pàgina, A4 vertical o horitzontal segons la imatge) */
export async function pdfDeImatges(pagines: readonly PaginaPreparada[], titol: string): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  doc.setTitle(titol)
  doc.setCreator('Qi')
  for (const p of pagines) {
    const img = await doc.embedJpg(p.jpeg)
    const vertical = img.height >= img.width
    const [w, h] = vertical ? [595.28, 841.89] : [841.89, 595.28]
    const escala = Math.min(w / img.width, h / img.height)
    const pagina = doc.addPage([w, h])
    pagina.drawImage(img, { x: (w - img.width * escala) / 2, y: (h - img.height * escala) / 2, width: img.width * escala, height: img.height * escala })
  }
  return doc.save()
}

/** Pàgines i miniatura de la primera pàgina d'un PDF (miniatura buida si no es pot llegir) */
export async function infoPdf(bytes: Uint8Array): Promise<{ pagines: number; miniatura: string }> {
  try {
    const { pdf, tancar } = await carregarPdf(bytes)
    try {
      const pagina = await pdf.getPage(1)
      const v1 = pagina.getViewport({ scale: 1 })
      const escala = 240 / Math.max(v1.width, v1.height)
      const v = pagina.getViewport({ scale: escala })
      const c = document.createElement('canvas')
      c.width = Math.ceil(v.width)
      c.height = Math.ceil(v.height)
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, c.width, c.height)
      await pagina.render({ canvas: c, canvasContext: ctx, viewport: v }).promise
      return { pagines: pdf.numPages, miniatura: c.toDataURL('image/jpeg', 0.7) }
    } finally {
      tancar()
    }
  } catch {
    return { pagines: 1, miniatura: '' }
  }
}

export { canvasDe }
