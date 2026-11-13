// PDF del consentiment signat (etapa 4A): el text exacte, la plantilla i la
// versió, la data i l'hora, i les signatures. Es genera al dispositiu (pdf-lib,
// instal·lada al projecte: res de CDN) i es desa xifrat amb el consentiment.

import type { DadesConsentiment } from '../domini/consentiment'

export interface DadesPdfConsentiment extends Omit<DadesConsentiment, 'pdf' | 'estat' | 'revocacio'> {
  /** Nom complet del pacient */
  pacient: string
  /** Textos de l'app (perquè el mòdul no depengui de la interfície) */
  textos: {
    pacient: string
    versio: string
    data: string
    signaturaPacient: string
    signaturaRepresentant: string
    representant: string
    signaturaDoctora: string
    pagina: string
  }
}

const MARGE = 50
const A4: [number, number] = [595.28, 841.89]

/** Els caràcters que les fonts estàndard (WinAnsi) no poden escriure, canviats per equivalents */
export function textPerPdf(t: string): string {
  return t
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/−/g, '-')
    .replace(/[^\n\x20-\x7E -ÿ–—•…€]/g, '?')
}

function dataUrlABytes(url: string): Uint8Array {
  const b64 = url.slice(url.indexOf(',') + 1)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function bytesABase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function base64ABytes(b64: string): Uint8Array {
  return dataUrlABytes(`,${b64}`)
}

/** Genera el PDF i el torna en base64 */
export async function generarPdfConsentiment(d: DadesPdfConsentiment): Promise<string> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  doc.setTitle(textPerPdf(d.titol))
  doc.setSubject(textPerPdf(`${d.textos.versio} ${d.versio}`))
  doc.setCreator('Qi')
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const negreta = await doc.embedFont(StandardFonts.HelveticaBold)
  const ample = A4[0] - 2 * MARGE
  let pagina = doc.addPage(A4)
  let y = A4[1] - MARGE

  const nova = () => {
    pagina = doc.addPage(A4)
    y = A4[1] - MARGE
  }
  const linia = (text: string, mida = 10, font = normal, interlinia = 1.35) => {
    if (y - mida * interlinia < MARGE + 20) nova()
    pagina.drawText(text, { x: MARGE, y: y - mida, size: mida, font, color: rgb(0.12, 0.14, 0.13) })
    y -= mida * interlinia
  }
  /** Parteix un paràgraf en línies que hi caben */
  const paragraf = (text: string, mida = 10, font = normal) => {
    if (text.trim() === '') {
      y -= mida * 0.6
      return
    }
    let actual = ''
    for (const paraula of textPerPdf(text).split(/\s+/)) {
      const prova = actual ? `${actual} ${paraula}` : paraula
      if (font.widthOfTextAtSize(prova, mida) > ample && actual) {
        linia(actual, mida, font)
        actual = paraula
      } else actual = prova
    }
    if (actual) linia(actual, mida, font)
  }

  // Capçalera
  paragraf(d.titol, 15, negreta)
  y -= 4
  paragraf(`${d.textos.pacient}: ${d.pacient}`, 10, negreta)
  paragraf(`${d.textos.versio} ${d.versio} · ${d.textos.data}: ${new Date(d.signatAt).toLocaleString('ca')}`)
  y -= 8
  pagina.drawLine({ start: { x: MARGE, y }, end: { x: A4[0] - MARGE, y }, thickness: 0.6, color: rgb(0.8, 0.85, 0.82) })
  y -= 12

  // El text signat
  for (const p of d.text.split('\n')) paragraf(p)

  // Signatures
  const signatura = async (titol: string, url: string, peu?: string) => {
    const png = await doc.embedPng(dataUrlABytes(url))
    const escala = Math.min(220 / png.width, 90 / png.height, 1)
    const alt = png.height * escala
    if (y - alt - 40 < MARGE) nova()
    y -= 14
    paragraf(titol, 10, negreta)
    pagina.drawImage(png, { x: MARGE, y: y - alt, width: png.width * escala, height: alt })
    y -= alt + 4
    pagina.drawLine({ start: { x: MARGE, y }, end: { x: MARGE + 240, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) })
    y -= 4
    if (peu) paragraf(peu, 9)
  }
  y -= 10
  await signatura(d.textos.signaturaPacient, d.signaturaPacient, d.pacient)
  if (d.representant) {
    await signatura(d.textos.signaturaRepresentant, d.representant.signatura, `${d.textos.representant}: ${d.representant.nom}${d.representant.dni ? ` · ${d.representant.dni}` : ''} · ${d.representant.relacio}`)
  }
  await signatura(d.textos.signaturaDoctora, d.signaturaDoctora)

  // Peu: pàgina i versió
  const pagines = doc.getPages()
  pagines.forEach((p, i) => {
    const peu = textPerPdf(`${d.titol} · ${d.textos.versio} ${d.versio} · ${d.textos.pagina} ${i + 1}/${pagines.length}`)
    p.drawText(peu, { x: MARGE, y: 28, size: 8, font: normal, color: rgb(0.45, 0.48, 0.46) })
  })
  return bytesABase64(await doc.save())
}
