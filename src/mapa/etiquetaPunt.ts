// Text de l'etiqueta d'un marcador segons el zoom.
//
// Els codis que agrupen diversos punts (Jiaji, Baxie, Bafeng…) no repeteixen
// l'etiqueta a cada punt: fins que no s'amplia molt, només un punt del grup
// per costat porta «codi · pinyin» (a Jiaji, el de T6). Molt a prop, si els
// subpunts tenen noms curts (els nivells T1…L5 de Jiaji), cada punt porta el
// seu; si no (els noms dels dits són llargs), es manté l'etiqueta única.

import type { NivellEtiquetes } from './camera'

export type NivellVisible = Exclude<NivellEtiquetes, 'cap'>

/** Text per a cada nivell; null = aquest marcador no porta etiqueta */
export type EtiquetesPerNivell = Record<NivellVisible, string | null>

export interface PuntEtiquetable {
  codi: string
  pinyin: string
  subpunts?: readonly string[]
}

/** Llargada màxima d'un nom de subpunt per posar-lo com a etiqueta (T12, L5) */
const NOM_SUBPUNT_CURT = 3

/** Quin subpunt porta l'etiqueta del grup: a Jiaji el de T6; si no, el del mig */
export function representantDelGrup(subpunts: readonly string[]): number {
  const t6 = subpunts.indexOf('T6')
  return t6 >= 0 ? t6 : Math.floor((subpunts.length - 1) / 2)
}

export function etiquetesDelPunt(p: PuntEtiquetable, index = 0): EtiquetesPerNivell {
  const llarga = `${p.codi} · ${p.pinyin}`
  if (!p.subpunts || p.subpunts.length < 2) return { cos: p.codi, codi: p.codi, pinyin: llarga, detall: llarga }
  const grup = index === representantDelGrup(p.subpunts) ? llarga : null
  const curts = p.subpunts.every((s) => s.length <= NOM_SUBPUNT_CURT)
  return { cos: grup, codi: grup, pinyin: grup, detall: curts ? (p.subpunts[index] ?? null) : grup }
}

/** Text i alternativa curta (si el llarg no hi cap) per a un nivell */
export function textEtiqueta(e: EtiquetesPerNivell, nivell: NivellVisible): { text: string; curt: string } | null {
  const text = e[nivell]
  return text === null ? null : { text, curt: text.split(' · ')[0]! }
}
