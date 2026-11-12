// Punt d'accés als textos. Si s'afegeix el castellà, aquí es triarà l'idioma.
import { ca, type Textos } from './ca'

export const t: Textos = ca

/** Substitueix {clau} per valors: formatar('Hola {nom}', { nom: 'Aina' }) */
export function formatar(plantilla: string, valors: Record<string, string>): string {
  return plantilla.replace(/\{(\w+)\}/g, (tot, clau: string) => valors[clau] ?? tot)
}

const formatDataHora = new Intl.DateTimeFormat('ca', { dateStyle: 'medium', timeStyle: 'short' })

export function dataHora(iso: string): string {
  return formatDataHora.format(new Date(iso))
}

// Dates locals de l'agenda («2026-11-02» o «2026-11-02T10:15»). Es formen a
// mà, amb els noms de ca.ts, perquè Intl no dona el mateix a tots els
// navegadors («de 2026» o «del 2026»).
function parts(dia: string) {
  const [a, m, d] = dia.slice(0, 10).split('-').map(Number)
  return { any: a!, mes: m! - 1, dia: d!, setmana: new Date(a!, m! - 1, d!).getDay() }
}

/** «dilluns, 2 de novembre de 2026» */
export function diaLlarg(dia: string): string {
  const p = parts(dia)
  return `${t.dates.dies[p.setmana]}, ${p.dia} ${t.dates.mesos[p.mes]} de ${p.any}`
}

/** «dl. 2» */
export function diaCurt(dia: string): string {
  const p = parts(dia)
  return `${t.dates.diesCurts[p.setmana]} ${p.dia}`
}

/** «dc. 18/11» */
export function diaCurtAmbMes(dia: string): string {
  const p = parts(dia)
  return `${t.dates.diesCurts[p.setmana]} ${p.dia}/${p.mes + 1}`
}

/** «novembre de 2026» */
export function mesAny(dia: string): string {
  const p = parts(dia)
  return `${t.dates.mesosNom[p.mes]} de ${p.any}`
}

/** «10:15» */
export function hora(diaHora: string): string {
  return diaHora.slice(11, 16)
}

/** «ara mateix», «fa 2 minuts», «fa 3 hores», «fa 2 dies» */
export function faTemps(iso: string, ara: number = Date.now()): string {
  const minuts = Math.max(0, Math.round((ara - new Date(iso).getTime()) / 60_000))
  const f = t.temps
  if (minuts < 1) return f.araMateix
  if (minuts < 60) return formatar(minuts === 1 ? f.minut : f.minuts, { n: String(minuts) })
  const hores = Math.round(minuts / 60)
  if (hores < 24) return formatar(hores === 1 ? f.hora : f.hores, { n: String(hores) })
  const dies = Math.round(hores / 24)
  return formatar(dies === 1 ? f.dia : f.dies, { n: String(dies) })
}
