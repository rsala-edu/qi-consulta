// Meridians de l'extremitat superior: LU, HT, SI, PC i TE.
// Avantbraç: del plec del canell al del colze, 12 cun. Braç: del plec
// axil·lar anterior al del colze, 9 cun. Tòrax: entre els mugrons, 8 cun.

import { Vector3 } from 'three'
import { AMUNT, DARRERE, dir, signe, v, type Costat } from '../cos'
import {
  avantbracDir,
  bracDir,
  capDesDeDins,
  coll,
  espaiIntercostal,
  nivellClavicula,
  nivellVertebra,
  esquena,
  pitX,
} from '../eines'
import type { CosMesurable } from '../cos'
import type { Referencies } from '../referencies'
import type { DefinicioPunt, Ordre } from '../tipus'

type K = Referencies['E']
const art = (c: CosMesurable, k: Costat, nom: string) => c.art(nom, k)
const mig = (a: Vector3, b: Vector3) => a.clone().lerp(b, 0.5)

/** Punt d'un dit a prop de l'ungla, en una direcció (vora radial/cubital + dors). */
function ungla(c: CosMesurable, k: Costat, dit: number, d: Vector3, t = 0.55): Vector3 {
  return c.pell(art(c, k, `finger-${dit}-3`).lerp(art(c, k, `finger-${dit}-4`), t), d)
}

/** Línies de l'avantbraç: direcció del raig al canell i al colze */
const LINIA = {
  LU: [(q: K) => dir([q.palmar, 1], [q.radial, 0.8]), (q: K) => dir([q.anteriorColze, 1], [q.lateralColze, 0.45])],
  PC: [(q: K) => q.palmar.clone(), (q: K) => dir([q.anteriorColze, 1], [q.medialColze, 0.15])],
  HT: [(q: K) => dir([q.palmar, 1], [q.cubital, 0.8]), (q: K) => dir([q.medialColze, 1], [q.anteriorColze, 0.35])],
  TE: [(q: K) => q.dorsal.clone(), (q: K) => q.posteriorColze.clone()],
  SI: [(q: K) => dir([q.cubital, 1], [q.dorsal, 0.5]), (q: K) => dir([q.medialColze, 1], [q.posteriorColze, 1])],
} as const

const avb = (linia: keyof typeof LINIA, cun: number) => (c: CosMesurable, r: Referencies, k: Costat) =>
  avantbracDir(c, r, k, cun, LINIA[linia][0], LINIA[linia][1])

const seg = (de: string, a: string, cun: number, total: number) => ({ tipus: 'segment' as const, de, a, cun, total })
const ref = (descripcio: string) => ({ tipus: 'referencia' as const, descripcio })

// --- Pulmó (LU) -----------------------------------------------------------------

export const LU: DefinicioPunt[] = [
  {
    codi: 'LU2',
    regla: ref('fossa infraclavicular, 6 cun lateral a la línia mitja'),
    calcular: (c, r, k) => pitX(c, r, k, 6, nivellClavicula(c, r, k, 6 * r.cun.pit) - 0.01),
  },
  {
    codi: 'LU1',
    regla: ref('primer espai intercostal, 6 cun lateral, 1 cun sota LU2'),
    calcular: (c, r, k, p) => pitX(c, r, k, 6, Math.min(espaiIntercostal(r, k, 1), p('LU2').y - r.cun.pit)),
  },
  { codi: 'LU3', regla: ref('braç, vora radial del bíceps, 3 cun sota el plec axil·lar'), calcular: (c, r, k) => bracDir(c, r, k, 6, (q) => dir([q.anteriorColze, 1], [q.lateralColze, 0.5])) },
  { codi: 'LU4', regla: ref('braç, vora radial del bíceps, 4 cun sota el plec axil·lar'), calcular: (c, r, k) => bracDir(c, r, k, 5, (q) => dir([q.anteriorColze, 1], [q.lateralColze, 0.5])) },
  { codi: 'LU9', regla: ref('plec del canell, costat radial, sobre el pols radial'), calcular: avb('LU', 0) },
  { codi: 'LU5', regla: ref('plec del colze, costat radial del tendó del bíceps'), calcular: avb('LU', 12) },
  { codi: 'LU6', regla: seg('LU9', 'LU5', 7, 12), calcular: avb('LU', 7) },
  {
    codi: 'LU7',
    regla: seg('LU9', 'LU5', 1.5, 12),
    calcular: (c, r, k) => avantbracDir(c, r, k, 1.5, (q) => dir([q.radial, 1], [q.palmar, 0.3]), LINIA.LU[1]),
  },
  { codi: 'LU8', regla: seg('LU9', 'LU5', 1, 12), calcular: avb('LU', 1) },
  {
    codi: 'LU10',
    regla: ref('punt mitjà del 1r metacarpià, vora entre palmell i dors'),
    calcular: (c, r, k) => c.pell(mig(art(c, k, 'finger-1-1'), art(c, k, 'finger-1-2')), dir([r[k].palmar, 1], [r[k].radial, 0.9])),
  },
  {
    codi: 'LU11',
    regla: ref('polze, costat radial, vora de l\'ungla'),
    calcular: (c, r, k) => c.pell(art(c, k, 'finger-1-3').lerp(art(c, k, 'finger-1-4'), 0.55), dir([r[k].radial, 1], [r[k].dorsal, 0.7])),
  },
]

// --- Cor (HT) --------------------------------------------------------------------

export const HT: DefinicioPunt[] = [
  { codi: 'HT1', regla: ref('centre de l\'aixella'), calcular: (_c, r, k) => r[k].aixella.clone() },
  { codi: 'HT2', regla: ref('braç, solc medial del bíceps, 3 cun sobre el plec del colze'), calcular: (c, r, k) => bracDir(c, r, k, 3, (q) => dir([q.medialColze, 1], [q.anteriorColze, 0.6])) },
  { codi: 'HT7', regla: ref('plec del canell, costat cubital, radial al flexor cubital del carp'), calcular: avb('HT', 0) },
  { codi: 'HT3', regla: ref('extrem medial del plec del colze'), calcular: avb('HT', 12) },
  { codi: 'HT4', regla: seg('HT7', 'HT3', 1.5, 12), calcular: avb('HT', 1.5) },
  { codi: 'HT5', regla: seg('HT7', 'HT3', 1, 12), calcular: avb('HT', 1) },
  { codi: 'HT6', regla: seg('HT7', 'HT3', 0.5, 12), calcular: avb('HT', 0.5) },
  {
    codi: 'HT8',
    regla: ref('palmell, entre el 4t i el 5è metacarpià'),
    calcular: (c, r, k) => c.pell(r[k].canell.clone().lerp(mig(art(c, k, 'finger-4-1'), art(c, k, 'finger-5-1')), 0.72), r[k].palmar),
  },
  { codi: 'HT9', regla: ref('dit petit, costat radial, vora de l\'ungla'), calcular: (c, r, k) => ungla(c, k, 5, dir([r[k].radial, 1], [r[k].dorsal, 0.7])) },
]

// --- Intestí prim (SI) -------------------------------------------------------------

export const SI: DefinicioPunt[] = [
  { codi: 'SI1', regla: ref('dit petit, costat cubital, vora de l\'ungla'), calcular: (c, r, k) => ungla(c, k, 5, dir([r[k].cubital, 1], [r[k].dorsal, 0.7])) },
  {
    codi: 'SI2',
    regla: ref('distal a la 5a articulació metacarpofalàngica, costat cubital'),
    calcular: (c, r, k) => c.pell(art(c, k, 'finger-5-1').lerp(art(c, k, 'finger-5-2'), 0.3), dir([r[k].cubital, 1], [r[k].dorsal, 0.15])),
  },
  {
    codi: 'SI3',
    regla: ref('proximal a la 5a articulació metacarpofalàngica, costat cubital'),
    calcular: (c, r, k) => c.pell(art(c, k, 'finger-5-1').lerp(r[k].canell, 0.14), dir([r[k].cubital, 1], [r[k].dorsal, 0.15])),
  },
  {
    codi: 'SI4',
    regla: ref('entre la base del 5è metacarpià i el piramidal'),
    calcular: (c, r, k) => c.pell(r[k].canell.clone().lerp(art(c, k, 'finger-5-1'), 0.2), dir([r[k].cubital, 1], [r[k].dorsal, 0.2])),
  },
  { codi: 'SI5', regla: ref('plec dorsal del canell, costat cubital'), calcular: avb('SI', 0) },
  { codi: 'SI8', regla: ref('entre l\'olècranon i l\'epicòndil medial'), calcular: avb('SI', 12) },
  {
    codi: 'SI6',
    regla: seg('SI5', 'SI8', 1, 12),
    calcular: (c, r, k) => avantbracDir(c, r, k, 1, (q) => dir([q.dorsal, 1], [q.cubital, 0.6]), LINIA.SI[1]),
  },
  { codi: 'SI7', regla: seg('SI5', 'SI8', 5, 12), calcular: avb('SI', 5) },
  {
    codi: 'SI9',
    regla: ref('1 cun per sobre del plec axil·lar posterior'),
    calcular: (c, r, k) => c.pell(r[k].espatlla.clone().add(v(-signe(k) * 0.03, -0.05, 0)), DARRERE),
  },
  {
    codi: 'SI10',
    regla: ref('sobre SI9, sota l\'espina de l\'escàpula'),
    calcular: (c, r, k) => c.pell(r[k].espatlla.clone().add(v(-signe(k) * 0.03, -0.005, 0)), dir([DARRERE, 1], [AMUNT, 0.2])),
  },
  { codi: 'SI11', regla: ref('centre de la fossa infraespinosa'), calcular: (c, r, k) => esquena(c, r, k, r.vertebres.T4!, 3.6) },
  { codi: 'SI12', regla: ref('centre de la fossa supraespinosa'), calcular: (c, r, k) => esquena(c, r, k, r.vertebres.T2!, 3.6) },
  { codi: 'SI13', regla: ref('extrem medial de la fossa supraespinosa'), calcular: (c, r, k) => esquena(c, r, k, r.vertebres.T2!, 2.8) },
  {
    codi: 'SI14',
    regla: { tipus: 'vertebra', vertebra: 'T1', sota: true, lateral: 3 },
    calcular: (c, r, k) => esquena(c, r, k, nivellVertebra(r, 'T1', true), 3),
  },
  {
    codi: 'SI15',
    regla: { tipus: 'vertebra', vertebra: 'C7', sota: true, lateral: 2 },
    calcular: (c, r, k) => esquena(c, r, k, nivellVertebra(r, 'C7', true), 2),
  },
  { codi: 'SI16', regla: ref('vora posterior de l\'ECM, nivell del tiroide'), calcular: (c, r, k) => coll(c, r, k, r.nivellTiroide, 98) },
  {
    codi: 'SI17',
    regla: ref('darrere de l\'angle de la mandíbula, davant de l\'ECM'),
    calcular: (c, r, k) => c.pellDesDeFora(v(0, r.nivellBoca - 0.028, r.centreCap.z - 0.01), v(signe(k), 0, 0), 0.25),
  },
  {
    codi: 'SI18',
    regla: ref('sota l\'os zigomàtic, en la vertical del cantó extern de l\'ull'),
    calcular: (c, r, k) => {
      const ce = r[k].cantExtern
      return c.pellDesDeFora(v(ce.x, r.nivellBaseNas + 0.004, ce.z - 0.01), dir([v(signe(k), 0, 0), 0.45], [v(0, 0, 1), 1]), 0.2)
    },
  },
  {
    codi: 'SI19',
    regla: ref('davant del tragus'),
    calcular: (c, r, k) => {
      const t = r[k].tragus
      return c.pellDesDeFora(v(t.x, t.y, t.z + 0.008), v(signe(k), 0, 0), 0.2)
    },
  },
]

// --- Pericardi (PC) ---------------------------------------------------------------

export const PC: DefinicioPunt[] = [
  {
    codi: 'PC1',
    regla: ref('quart espai intercostal, 1 cun lateral al mugró'),
    calcular: (c, r, k) => pitX(c, r, k, Math.abs(r[k].mugro.x) / r.cun.pit + 1, r[k].mugro.y),
  },
  { codi: 'PC2', regla: ref('braç, entre els caps del bíceps, 2 cun sota el plec axil·lar'), calcular: (c, r, k) => bracDir(c, r, k, 7, (q) => q.anteriorColze.clone()) },
  { codi: 'PC7', regla: ref('centre del plec del canell'), calcular: avb('PC', 0) },
  { codi: 'PC3', regla: ref('plec del colze, costat cubital del tendó del bíceps'), calcular: avb('PC', 12) },
  { codi: 'PC4', regla: seg('PC7', 'PC3', 5, 12), calcular: avb('PC', 5) },
  { codi: 'PC5', regla: seg('PC7', 'PC3', 3, 12), calcular: avb('PC', 3) },
  { codi: 'PC6', regla: seg('PC7', 'PC3', 2, 12), calcular: avb('PC', 2) },
  {
    codi: 'PC8',
    regla: ref('palmell, entre el 2n i el 3r metacarpià'),
    calcular: (c, r, k) => c.pell(r[k].canell.clone().lerp(mig(art(c, k, 'finger-2-1'), art(c, k, 'finger-3-1')), 0.75), r[k].palmar),
  },
  {
    codi: 'PC9',
    regla: ref('centre de la punta del dit del mig'),
    calcular: (c, _r, k) => {
      const a = art(c, k, 'finger-3-3')
      const b = art(c, k, 'finger-3-4')
      return c.pell(a.clone().lerp(b, 0.7), b.clone().sub(a).normalize())
    },
  },
]

// --- Triple escalfador (TE) -------------------------------------------------------

export const TE: DefinicioPunt[] = [
  { codi: 'TE1', regla: ref('dit anular, costat cubital, vora de l\'ungla'), calcular: (c, r, k) => ungla(c, k, 4, dir([r[k].cubital, 1], [r[k].dorsal, 0.7])) },
  {
    codi: 'TE2',
    regla: ref('entre el 4t i el 5è dit, darrere del marge interdigital'),
    calcular: (c, r, k) => {
      const mcp = mig(art(c, k, 'finger-4-1'), art(c, k, 'finger-5-1'))
      // des de dins de la mà, just abans d'on se separen els dits
      const origen = mcp.lerp(mig(art(c, k, 'finger-4-2'), art(c, k, 'finger-5-2')), 0.1).addScaledVector(r[k].palmar, 0.006)
      return c.pell(origen, r[k].dorsal)
    },
  },
  {
    codi: 'TE3',
    regla: ref('entre el 4t i el 5è metacarpià, proximal a la 4a articulació metacarpofalàngica'),
    calcular: (c, r, k) => c.pell(mig(art(c, k, 'finger-4-1'), art(c, k, 'finger-5-1')).lerp(r[k].canell, 0.2), r[k].dorsal),
  },
  { codi: 'TE4', regla: ref('plec dorsal del canell, cubital al tendó extensor comú'), calcular: avb('TE', 0) },
  { codi: 'TE10', regla: ref('1 cun per sobre de la punta de l\'olècranon'), calcular: (c, r, k) => bracDir(c, r, k, 1, (q) => q.posteriorColze.clone()) },
  { codi: 'TE5', regla: seg('TE4', 'TE10', 2, 13), calcular: avb('TE', 2) },
  { codi: 'TE6', regla: seg('TE4', 'TE10', 3, 13), calcular: avb('TE', 3) },
  {
    codi: 'TE7',
    // a la mateixa distància del canell que TE6, però al costat cubital (fora de la línia)
    regla: { ...seg('TE4', 'TE10', 3, 13), desviacio: 0.035 },
    calcular: (c, r, k) => avantbracDir(c, r, k, 3, (q) => dir([q.dorsal, 0.6], [q.cubital, 1]), (q) => dir([q.posteriorColze, 0.6], [q.medialColze, 1])),
  },
  { codi: 'TE8', regla: seg('TE4', 'TE10', 4, 13), calcular: avb('TE', 4) },
  { codi: 'TE9', regla: seg('TE4', 'TE10', 7, 13), calcular: avb('TE', 7) },
  { codi: 'TE11', regla: ref('2 cun per sobre de la punta de l\'olècranon'), calcular: (c, r, k) => bracDir(c, r, k, 2, (q) => q.posteriorColze.clone()) },
  {
    codi: 'TE12',
    regla: ref('5 cun per sobre de l\'olècranon, línia cap a l\'angle de l\'acromi'),
    calcular: (c, r, k) => bracDir(c, r, k, 5, (q) => dir([q.posteriorColze, 1], [q.lateralColze, 0.35])),
  },
  {
    codi: 'TE13',
    regla: ref('vora posterior del deltoide, 3 cun sota l\'angle de l\'acromi'),
    calcular: (c, r, k) => c.pell(r[k].espatlla.clone().addScaledVector(r[k].eixBrac, 3 * r.cun.brac), dir([r[k].posteriorColze, 1], [r[k].lateralColze, 0.6])),
  },
  {
    codi: 'TE14',
    regla: ref('clot posterior de sota l\'acromi'),
    calcular: (c, r, k) => c.pell(r[k].espatlla, dir([v(signe(k), 0, 0), 1], [AMUNT, 0.45], [DARRERE, 0.6])),
  },
  {
    codi: 'TE15',
    regla: ref('fossa supraespinosa, entre GB21 i SI13'),
    calcular: (c, r, k) => c.pellDesDeFora(v(signe(k) * 3.4 * r.cun.pit, nivellVertebra(r, 'T1', false), 0), dir([DARRERE, 1], [AMUNT, 0.8]), 0.4),
  },
  { codi: 'TE16', regla: ref('darrere de l\'ECM, a l\'alçada de l\'angle de la mandíbula'), calcular: (c, r, k) => coll(c, r, k, r.nivellBoca - 0.03, 104) },
  {
    codi: 'TE17',
    regla: ref('darrere del lòbul de l\'orella, entre la mastoide i la mandíbula'),
    calcular: (c, r, k) => capDesDeDins(c, r, k, r[k].orellaLobul.y - 0.004, 96),
  },
  {
    codi: 'TE20',
    regla: ref('just per sobre de la punta de l\'orella'),
    calcular: (c, r, k) => {
      const a = r[k].orellaApex
      return c.pellDesDeFora(v(0, a.y + 0.008, a.z), v(signe(k), 0, 0), 0.25)
    },
  },
  { codi: 'TE18', regla: ref('arrel posterior de l\'orella, a 1/3 de TE17 a TE20'), calcular: (c, r, k, p) => arrelOrella(c, r, k, p('TE17'), p('TE20'), 1 / 3) },
  { codi: 'TE19', regla: ref('arrel posterior de l\'orella, a 2/3 de TE17 a TE20'), calcular: (c, r, k, p) => arrelOrella(c, r, k, p('TE17'), p('TE20'), 2 / 3) },
  {
    codi: 'TE21',
    regla: ref('davant de l\'escotadura supratràgica'),
    calcular: (c, r, k) => {
      const t = r[k].tragus
      return c.pellDesDeFora(v(t.x, t.y + 0.011, t.z + 0.008), v(signe(k), 0, 0), 0.2)
    },
  },
  {
    codi: 'TE22',
    regla: ref('davant de la part alta de l\'arrel de l\'orella'),
    calcular: (c, r, k) => {
      const a = r[k].orellaApex
      return c.pellDesDeFora(v(0, a.y - 0.01, r[k].tragus.z + 0.012), v(signe(k), 0, 0), 0.25)
    },
  },
  {
    codi: 'TE23',
    regla: ref('clot de l\'extrem extern de la cella'),
    calcular: (c, r, k) => {
      const ce = r[k].cantExtern
      return c.pellDesDeFora(v(ce.x + signe(k) * 0.008, ce.y + 0.016, ce.z - 0.01), dir([v(signe(k), 0, 0), 0.5], [v(0, 0, 1), 1]), 0.2)
    },
  },
]

/** Punt de l'arrel posterior de l'orella entre dos punts (alçada i angle interpolats). */
function arrelOrella(c: CosMesurable, r: Referencies, k: Costat, a: Vector3, b: Vector3, t: number): Vector3 {
  const y = a.y + (b.y - a.y) * t
  // just darrere de l'orella: l'angle de la vora posterior de l'orella i una mica més
  const post = r[k].orellaPosterior
  const graus = (Math.atan2(Math.abs(post.x), post.z - r.centreCap.z) * 180) / Math.PI + 6
  return capDesDeDins(c, r, k, y, graus)
}

export const ORDRE_SUPERIOR: Ordre[] = [
  { codis: ['LU11', 'LU10', 'LU9', 'LU8', 'LU7', 'LU6', 'LU5', 'LU4', 'LU3'], criteri: 'allunya' },
  { codis: ['HT9', 'HT8', 'HT7', 'HT6', 'HT5', 'HT4', 'HT3', 'HT2'], criteri: 'allunya' },
  { codis: ['SI1', 'SI2', 'SI3', 'SI4', 'SI5', 'SI6', 'SI7', 'SI8'], criteri: 'allunya' },
  { codis: ['PC9', 'PC8', 'PC7', 'PC6', 'PC5', 'PC4', 'PC3', 'PC2'], criteri: 'allunya' },
  { codis: ['TE1', 'TE2', 'TE3', 'TE4', 'TE5', 'TE6', 'TE8', 'TE9', 'TE10', 'TE11', 'TE12'], criteri: 'allunya' },
  { codis: ['TE20', 'TE19', 'TE18', 'TE17'], criteri: 'baixa' },
  { codis: ['SI11', 'SI14'], criteri: 'puja' },
]
