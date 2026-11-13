// Generador dels informes en PDF (etapa 4D): al dispositiu, amb pdf-lib
// (instal·lada al projecte: res de CDN ni de servidor). Rep el contingut ja
// preparat en blocs (títols, paràgrafs, parelles, taules, imatges i gràfics) i
// el compon en A4 amb la capçalera de Qi i les dades de la consulta.

import type { PDFFont, PDFPage } from 'pdf-lib'
import { bytesABase64, textPerPdf } from '../consentiment/pdf'

export interface DadesConsulta {
  nom: string
  doctora: string
  collegiada: string
  adreca: string
  telefon: string
}

export type Bloc =
  | { tipus: 'titol'; text: string }
  | { tipus: 'subtitol'; text: string }
  | { tipus: 'paragraf'; text: string }
  | { tipus: 'parelles'; files: readonly (readonly [string, string])[] }
  | { tipus: 'taula'; columnes: readonly string[]; files: readonly (readonly string[])[]; amples?: readonly number[] }
  /** PNG en data URL, amb el peu */
  | { tipus: 'imatges'; imatges: readonly { png: string; peu: string }[]; alcada?: number }
  | { tipus: 'grafic'; titol: string; valors: readonly (number | null)[]; etiquetes: readonly string[]; min: number; max: number }
  | { tipus: 'salt' }

export interface Informe {
  titol: string
  /** Sota el títol (pacient, data…) */
  subtitol: string
  blocs: readonly Bloc[]
  consulta: DadesConsulta
  /** «Pàgina», «Confidencial: dades de salut» */
  peu: { pagina: string; confidencial: string; col: string }
}

const A4: [number, number] = [595.28, 841.89]
const MARGE = 48
const JADE = { r: 0.184, g: 0.365, b: 0.314 }
const TINTA = { r: 0.12, g: 0.14, b: 0.13 }
const SUAU = { r: 0.42, g: 0.46, b: 0.44 }

function dataUrlABytes(url: string): Uint8Array {
  const bin = atob(url.slice(url.indexOf(',') + 1))
  const b = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i)
  return b
}

/** Genera el PDF i el torna en base64 */
export async function generarInforme(inf: Informe): Promise<string> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  doc.setTitle(textPerPdf(inf.titol))
  doc.setCreator('Qi')
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const negreta = await doc.embedFont(StandardFonts.HelveticaBold)
  const ample = A4[0] - 2 * MARGE
  const c = (x: { r: number; g: number; b: number }) => rgb(x.r, x.g, x.b)
  let pagina!: PDFPage
  let y = 0

  /** Capçalera de cada pàgina: el logo de Qi (dibuixat), el nom de la consulta i les seves dades */
  const capcalera = () => {
    pagina = doc.addPage(A4)
    const top = A4[1] - MARGE
    // Logo: un cercle obert (pinzellada) amb un punt cinabri, i «Qi»
    pagina.drawCircle({ x: MARGE + 12, y: top - 12, size: 11, borderColor: c(JADE), borderWidth: 2.6, opacity: 0 })
    pagina.drawRectangle({ x: MARGE + 15, y: top - 3, width: 9, height: 8, color: rgb(1, 1, 1) })
    pagina.drawCircle({ x: MARGE + 16, y: top - 12, size: 1.9, color: rgb(0.71, 0.26, 0.18) })
    pagina.drawText('Qi', { x: MARGE + 30, y: top - 19, size: 18, font: negreta, color: c(JADE) })
    const k = inf.consulta
    const dreta = [k.nom, [k.doctora, k.collegiada ? `${inf.peu.col} ${k.collegiada}` : ''].filter(Boolean).join(' · '), [k.adreca, k.telefon].filter(Boolean).join(' · ')]
      .filter(Boolean)
      .map(textPerPdf)
    dreta.forEach((t, i) => {
      const f = i === 0 ? negreta : normal
      const mida = i === 0 ? 10 : 8.5
      pagina.drawText(t, { x: A4[0] - MARGE - f.widthOfTextAtSize(t, mida), y: top - 8 - i * 12, size: mida, font: f, color: c(i === 0 ? TINTA : SUAU) })
    })
    y = top - 44
    pagina.drawLine({ start: { x: MARGE, y }, end: { x: A4[0] - MARGE, y }, thickness: 0.8, color: c(JADE) })
    y -= 18
  }
  const cal = (alt: number) => {
    if (y - alt < MARGE + 24) capcalera()
  }
  const linia = (text: string, mida: number, font: PDFFont, color = TINTA, x = MARGE) => {
    cal(mida * 1.4)
    pagina.drawText(text, { x, y: y - mida, size: mida, font, color: c(color) })
    y -= mida * 1.4
  }
  /** Parteix en línies que hi caben */
  const partir = (text: string, mida: number, font: PDFFont, amplada: number): string[] => {
    const linies: string[] = []
    for (const par of textPerPdf(text).split('\n')) {
      let actual = ''
      for (const paraula of par.split(/\s+/)) {
        const prova = actual ? `${actual} ${paraula}` : paraula
        if (font.widthOfTextAtSize(prova, mida) > amplada && actual) {
          linies.push(actual)
          actual = paraula
        } else actual = prova
      }
      linies.push(actual)
    }
    return linies
  }
  const paragraf = (text: string, mida = 10, font = normal, color = TINTA) => {
    for (const l of partir(text, mida, font, ample)) linia(l, mida, font, color)
  }

  capcalera()
  paragraf(inf.titol, 16, negreta, JADE)
  paragraf(inf.subtitol, 10, normal, SUAU)
  y -= 6

  for (const b of inf.blocs) {
    if (b.tipus === 'salt') {
      capcalera()
    } else if (b.tipus === 'titol') {
      y -= 8
      cal(40)
      paragraf(b.text, 12.5, negreta, JADE)
      y -= 2
    } else if (b.tipus === 'subtitol') {
      y -= 4
      cal(30)
      paragraf(b.text, 10.5, negreta)
    } else if (b.tipus === 'paragraf') {
      paragraf(b.text)
    } else if (b.tipus === 'parelles') {
      const amp = Math.min(170, Math.max(...b.files.map(([e]) => negreta.widthOfTextAtSize(textPerPdf(e), 9.5))) + 12)
      for (const [e, v] of b.files) {
        const linies = partir(v || '—', 9.5, normal, ample - amp)
        cal(linies.length * 13.3)
        pagina.drawText(textPerPdf(e), { x: MARGE, y: y - 9.5, size: 9.5, font: negreta, color: c(SUAU) })
        for (const l of linies) linia(l, 9.5, normal, TINTA, MARGE + amp)
      }
    } else if (b.tipus === 'taula') {
      const n = b.columnes.length
      const amples = b.amples ?? Array(n).fill(1)
      const total = amples.reduce((a, x) => a + x, 0)
      const xs = amples.map((_, i) => MARGE + (amples.slice(0, i).reduce((a, x) => a + x, 0) / total) * ample)
      const w = (i: number) => (amples[i]! / total) * ample - 6
      const fila = (celles: readonly string[], font: PDFFont, color = TINTA) => {
        const parts = celles.map((t, i) => partir(t, 8.5, font, w(i)))
        const alt = Math.max(...parts.map((p) => p.length)) * 11.5 + 4
        cal(alt)
        parts.forEach((p, i) => p.forEach((l, j) => pagina.drawText(l, { x: xs[i]!, y: y - 9 - j * 11.5, size: 8.5, font, color: c(color) })))
        y -= alt
        pagina.drawLine({ start: { x: MARGE, y: y + 1 }, end: { x: A4[0] - MARGE, y: y + 1 }, thickness: 0.3, color: rgb(0.8, 0.84, 0.82) })
      }
      fila(b.columnes, negreta, SUAU)
      for (const f of b.files) fila(f, normal)
    } else if (b.tipus === 'imatges') {
      const alt = b.alcada ?? 220
      cal(alt + 20)
      const amp = ample / b.imatges.length
      for (const [i, im] of b.imatges.entries()) {
        const png = await doc.embedPng(dataUrlABytes(im.png))
        const esc = Math.min((amp - 8) / png.width, alt / png.height)
        const pw = png.width * esc
        const x = MARGE + i * amp + (amp - pw) / 2
        pagina.drawImage(png, { x, y: y - png.height * esc, width: pw, height: png.height * esc })
        const peu = textPerPdf(im.peu)
        pagina.drawText(peu, { x: MARGE + i * amp + (amp - normal.widthOfTextAtSize(peu, 8)) / 2, y: y - alt - 12, size: 8, font: normal, color: c(SUAU) })
      }
      y -= alt + 22
    } else if (b.tipus === 'grafic') {
      const alt = 150
      cal(alt + 40)
      paragraf(b.titol, 9.5, negreta, SUAU)
      const x0 = MARGE + 22
      const amp = ample - 30
      const top = y - 6
      const yv = (v: number) => top - alt + ((v - b.min) / (b.max - b.min || 1)) * alt
      for (const v of [b.min, (b.min + b.max) / 2, b.max]) {
        pagina.drawLine({ start: { x: x0, y: yv(v) }, end: { x: x0 + amp, y: yv(v) }, thickness: 0.3, color: rgb(0.8, 0.84, 0.82) })
        pagina.drawText(String(Math.round(v * 10) / 10), { x: MARGE, y: yv(v) - 3, size: 7.5, font: normal, color: c(SUAU) })
      }
      const n = b.valors.length
      const xv = (i: number) => (n > 1 ? x0 + (i / (n - 1)) * amp : x0 + amp / 2)
      let abans: { x: number; y: number } | null = null
      b.valors.forEach((v, i) => {
        if (v === null) {
          abans = null
          return
        }
        const p = { x: xv(i), y: yv(v) }
        if (abans) pagina.drawLine({ start: abans, end: p, thickness: 1.8, color: c(JADE) })
        pagina.drawCircle({ x: p.x, y: p.y, size: 2.6, color: c(JADE) })
        abans = p
      })
      b.etiquetes.forEach((e, i) => {
        const t = textPerPdf(e)
        pagina.drawText(t, { x: xv(i) - normal.widthOfTextAtSize(t, 7) / 2, y: top - alt - 12, size: 7, font: normal, color: c(SUAU) })
      })
      y = top - alt - 24
    }
  }

  // Peu: confidencial i pàgina
  const pagines = doc.getPages()
  pagines.forEach((p, i) => {
    p.drawText(textPerPdf(`${inf.peu.confidencial} · ${inf.titol}`), { x: MARGE, y: 26, size: 7.5, font: normal, color: c(SUAU) })
    const t = textPerPdf(`${inf.peu.pagina} ${i + 1}/${pagines.length}`)
    p.drawText(t, { x: A4[0] - MARGE - normal.widthOfTextAtSize(t, 7.5), y: 26, size: 7.5, font: normal, color: c(SUAU) })
  })
  return bytesABase64(await doc.save())
}
