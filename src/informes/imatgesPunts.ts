// Imatges dels punts marcats per a l'informe de sessió (etapa 4D): el cos en
// 2D (davant i darrere, la mateixa projecció del mapa 2D, amb les correccions
// de la doctora) i l'orella. Es dibuixen en SVG i es passen a PNG al navegador.

import { llistarCalibratge } from '../db/calibratge'
import { llegirCorreccionsOrella } from '../db/calibratgeOrella'
import type { QiDB } from '../db/esquema'
import { COLOR_TECNICA, tecnicaDelMarcador, type PuntMarcat } from '../domini/puntMarcat'
import { puntsSobreModel } from '../mapa/marcadors'
import { carregarModel } from '../mapa/model'
import { esVeu, projectar, silueta } from '../mapa/projeccio2d'
import type { Vista } from '../mapa/camera'
import { camiArrodonit, CONTORN, POLIGONS, ZONES_ORELLA } from '../orella/dibuix'
import { posicioOrella, PUNTS_ORELLA } from '../orella/cataleg'
import { LIMITS } from '../orella/vista'
import { ambCalibratge, cataleg } from '../punts/cataleg'
import type { ImatgesPunts } from './contingut'

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** SVG → PNG (data URL) amb un canvas */
async function aPng(svg: string, amplada: number, alcada: number): Promise<string> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = amplada
    c.height = alcada
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, amplada, alcada)
    ctx.drawImage(img, 0, 0, amplada, alcada)
    return c.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

let model: ReturnType<typeof carregarModel> | null = null

async function svgCos(db: QiDB, marcats: readonly PuntMarcat[], vista: Vista): Promise<string> {
  const m = await (model ??= carregarModel())
  const efectiu = ambCalibratge(cataleg, await llistarCalibratge(db, m.topologia))
  const s = silueta(m.geometria, vista)
  const marge = 0.06
  const [x, y, w, h] = s.caixa
  const vb = [x - marge, y - marge, w + 2 * marge, h + 2 * marge]
  const del = marcats.filter((p) => p.mapa === 'cos' && p.tecnica !== 'palpacio')
  const punts = puntsSobreModel(efectiu, m).flatMap((p) => {
    const tecnica = tecnicaDelMarcador(del, p.punt.codi, p.costat)
    if (!tecnica || !esVeu(p.normal, vista)) return []
    const q = projectar(p.posicio, vista)
    return [`<circle cx="${q.x}" cy="${q.y}" r="0.016" fill="${COLOR_TECNICA[tecnica]}" stroke="#fff" stroke-width="0.005"/>` + `<text x="${q.x + 0.022}" y="${q.y + 0.01}" font-size="0.04" font-family="Helvetica, Arial, sans-serif" fill="#1f2421">${esc(p.punt.codi)}</text>`]
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="400" height="${Math.round((400 * vb[3]!) / vb[2]!)}"><path d="${s.cami}" fill="#e9d8c8"/>${punts.join('')}</svg>`
}

async function svgOrella(db: QiDB, marcats: readonly PuntMarcat[]): Promise<string> {
  const correccions = await llegirCorreccionsOrella(db)
  const del = marcats.filter((p) => p.mapa === 'orella')
  const zones = ZONES_ORELLA.flatMap((z) => POLIGONS[z].map((pol) => `<path d="${camiArrodonit(pol)}" fill="none" stroke="#c9ab96" stroke-width="0.8"/>`))
  const punts = PUNTS_ORELLA.flatMap((p) => {
    const m = del.find((x) => x.codi === p.codi)
    if (!m) return []
    const pos = posicioOrella(p, correccions)
    return [`<circle cx="${pos.x}" cy="${pos.y}" r="6" fill="${COLOR_TECNICA[m.tecnica]}" stroke="#fff" stroke-width="1.5"/><text x="${pos.x + 9}" y="${pos.y + 4}" font-size="13" font-family="Helvetica, Arial, sans-serif" fill="#1f2421">${esc(p.codi)}</text>`]
  })
  const vb = [LIMITS.x1, LIMITS.y1, LIMITS.x2 - LIMITS.x1, LIMITS.y2 - LIMITS.y1]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="380" height="${Math.round((380 * vb[3]!) / vb[2]!)}"><path d="${camiArrodonit(CONTORN)}" fill="#f0dfd2" stroke="#b89c88" stroke-width="1"/>${zones.join('')}${punts.join('')}</svg>`
}

/** Les imatges que calen (només les dels mapes que tenen punts) */
export async function imatgesPunts(db: QiDB, marcats: readonly PuntMarcat[]): Promise<ImatgesPunts> {
  const r: ImatgesPunts = {}
  if (marcats.some((p) => p.mapa === 'cos' && p.tecnica !== 'palpacio')) {
    const [davant, darrere] = await Promise.all([svgCos(db, marcats, 'davant'), svgCos(db, marcats, 'darrere')])
    const mida = (svg: string) => {
      const m = /width="(\d+)" height="(\d+)"/.exec(svg)!
      return [Number(m[1]) * 2, Number(m[2]) * 2] as const
    }
    r.cos = { davant: await aPng(davant, ...mida(davant)), darrere: await aPng(darrere, ...mida(darrere)) }
  }
  if (marcats.some((p) => p.mapa === 'orella')) {
    const svg = await svgOrella(db, marcats)
    const m = /width="(\d+)" height="(\d+)"/.exec(svg)!
    r.orella = await aPng(svg, Number(m[1]) * 2, Number(m[2]) * 2)
  }
  return r
}
