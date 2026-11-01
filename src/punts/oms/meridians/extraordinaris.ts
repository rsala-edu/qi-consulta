// Punts extraordinaris (fora dels meridians) de l'estàndard de l'OMS (2008):
// 48 codis al cap i coll (EX-HN), tòrax i abdomen (EX-CA), esquena (EX-B),
// extremitat superior (EX-UE) i inferior (EX-LE). Alguns codis agrupen
// diversos punts (Jiaji, Baxie, Shixuan…): són els `subpunts`.
//
// Es calculen després dels 14 meridians, perquè molts es mesuren des d'un
// punt d'un meridià (GV20, ST35, GB34, TE17…).

import { Vector3 } from 'three'
import { AMUNT, DARRERE, DAVANT, dir, signe, v, type Costat, type CosMesurable } from '../cos'
import { abdomenX, aPell, avantbracDir, bracDir, capArc, capInterpolat, cara, cuixaDir, esquena, nivellVertebra } from '../eines'
import type { Referencies } from '../referencies'
import type { DefinicioPunt, Ordre } from '../tipus'

type K = Referencies['E']
const ref = (descripcio: string) => ({ tipus: 'referencia' as const, descripcio })
const art = (c: CosMesurable, k: Costat, nom: string) => c.art(nom, k)
const mig = (a: Vector3, b: Vector3) => a.clone().lerp(b, 0.5)
const lat = (k: Costat) => v(signe(k), 0, 0)
const AVALL = new Vector3(0, -1, 0)

/** Vertebres de Jiaji (EX-B2): de T1 a L5 */
export const VERTEBRES_JIAJI = [...Array.from({ length: 12 }, (_, i) => `T${i + 1}`), 'L1', 'L2', 'L3', 'L4', 'L5'] as const

/** Dits de la mà (1 = polze) i del peu (1 = dit gros) */
const DITS = ['polze', 'índex', 'mig', 'anular', 'petit'] as const
const DITS_PEU = ['dit gros', '2n dit', '3r dit', '4t dit', '5è dit'] as const

/** Esquena: a l'alçada de la depressió de sota l'apòfisi d'una vertebra i a `lateral` cun */
const vertebra = (codi: string, vert: string, lateral: number): DefinicioPunt => ({
  codi,
  regla: { tipus: 'vertebra', vertebra: vert, sota: true, lateral },
  calcular: (c, r, k) => esquena(c, r, k, nivellVertebra(r, vert, true), lateral),
})

/** Línia mitja de l'esquena, sota l'apòfisi espinosa */
const espinosa = (codi: string, vert: string): DefinicioPunt => ({
  codi,
  mitja: true,
  regla: { tipus: 'vertebra', vertebra: vert, sota: true, lateral: 0 },
  calcular: (c, r) => c.pellDesDeFora(v(0, nivellVertebra(r, vert, true), 0), DARRERE, 0.5),
})

/**
 * Punt de la pell al voltant d'un eix vertical: des de `punt`, recorre `arc`
 * metres per la pell, a la mateixa alçada, cap a fora (`sentit` = +1) o cap a
 * dins (−1).
 */
function alVoltant(c: CosMesurable, centre: Vector3, punt: Vector3, arc: number, sentit: 1 | -1, k: Costat): Vector3 {
  const origen = v(centre.x, punt.y, centre.z)
  const angle0 = Math.atan2(punt.x - centre.x, punt.z - centre.z)
  let anterior = punt.clone()
  let recorregut = 0
  for (let graus = 0.5; graus <= 120; graus += 0.5) {
    const a = angle0 + (sentit * signe(k) * graus * Math.PI) / 180
    const actual = c.pell(origen, v(Math.sin(a), 0, Math.cos(a)))
    const pas = actual.distanceTo(anterior)
    if (recorregut + pas >= arc) return anterior.lerp(actual, (arc - recorregut) / pas)
    recorregut += pas
    anterior = actual
  }
  throw new Error('La cuixa no és prou ampla per a aquesta distància')
}

/** Punt de l'eix de la cuixa a una alçada */
function eixCuixaA(r: Referencies, k: Costat, y: number): Vector3 {
  const q = r[k]
  return q.genoll.clone().addScaledVector(q.eixCuixa, (q.genoll.y - y) / -q.eixCuixa.y)
}

/** Punta d'un dit: una mica abans de l'extrem, entrant des de dins en la direcció del dit */
function puntaDit(c: CosMesurable, k: Costat, base: string, punta: string): Vector3 {
  const a = art(c, k, base)
  const b = art(c, k, punta)
  return c.pell(a.clone().lerp(b, 0.6), b.clone().sub(a))
}

// --- Cap i coll (EX-HN) -----------------------------------------------------------

const HN: DefinicioPunt[] = [
  {
    codi: 'EX-HN1',
    mitja: true,
    subpunts: ['davant', 'darrere', 'esquerra', 'dreta'],
    regla: ref('1 cun al davant, al darrere i a cada costat de GV20'),
    calcular: (c, r, _k, _p, i) =>
      i === 0 ? capArc(c, r, 'E', 7, 0) : i === 1 ? capArc(c, r, 'E', 9, 0) : capArc(c, r, i === 2 ? 'E' : 'D', 8, 1),
  },
  {
    codi: 'EX-HN2',
    // 1 cun dins la línia del cabell, sobre la pupil·la: a mig camí entre
    // GB15 (0,5 cun dins) i GB16 (1,5 cun dins), seguint la pell
    regla: ref('sobre la pupil·la, 1 cun dins la línia anterior del cabell'),
    calcular: (c, r, k, p) => capInterpolat(c, r, k, p('GB15'), p('GB16'), 0.5),
  },
  {
    codi: 'EX-HN3',
    mitja: true,
    regla: ref('entre els extrems interns de les celles'),
    calcular: (c, _r, _k, p) => c.pellDesDeFora(v(0, p('BL2', 'E').y, 0), DAVANT),
  },
  {
    codi: 'EX-HN4',
    regla: ref('centre de la cella, sobre la pupil·la'),
    calcular: (c, r, k) => cara(c, r, k, Math.abs(r[k].ull.x), r.nivellCellaSuperior - 0.004),
  },
  {
    codi: 'EX-HN5',
    regla: ref('templa, un través de dit per darrere del punt mitjà entre l\'extrem extern de la cella i el cantó extern'),
    calcular: (c, r, k, p) => {
      const m = mig(p('TE23'), r[k].cantExtern)
      return c.pellDesDeFora(v(m.x, m.y, m.z - r.cun.cap), lat(k), 0.25)
    },
  },
  {
    codi: 'EX-HN6',
    regla: ref('àpex de l\'orella, amb l\'orella plegada endavant'),
    calcular: (_c, r, k) => r[k].orellaApex.clone(),
  },
  {
    codi: 'EX-HN7',
    regla: ref('vora infraorbitària, a la unió del quart extern amb els tres quarts interns'),
    calcular: (c, r, k, p) => {
      const x = r[k].cantIntern.x + (r[k].cantExtern.x - r[k].cantIntern.x) * 0.75
      return c.pellDesDeFora(v(x, p('ST1').y, 0), DAVANT)
    },
  },
  {
    codi: 'EX-HN8',
    regla: ref('extrem superior del solc nasogenià, on l\'ala del nas s\'uneix amb el cartílag'),
    calcular: (c, r, k) => cara(c, r, k, 0.011, r.nivellAlaNas + 0.011),
  },
  {
    codi: 'EX-HN9',
    regla: ref('dins la narina, a la mucosa; al mapa, a l\'entrada de la narina'),
    // El punt real és a la mucosa de dins el nas: es marca a la vora de la narina
    calcular: (c, r, k) =>
      c.pellDesDeFora(v(signe(k) * 0.009, r.nivellBaseNas + 0.002, r.nas.z - 0.012), dir([AVALL, 1], [DAVANT, 0.3]), 0.08),
  },
  {
    codi: 'EX-HN10',
    mitja: true,
    regla: ref('dins la boca, al centre del dors de la llengua; al mapa, entre els llavis'),
    calcular: (c, r) => c.pellDesDeFora(v(0, r.nivellBoca, 0), DAVANT),
  },
  {
    codi: 'EX-HN11',
    mitja: true,
    regla: ref('dins la boca, al punt mitjà del fre de la llengua; al mapa, al llavi inferior'),
    calcular: (c, r) => c.pellDesDeFora(v(0, r.nivellBoca - 0.005, 0), DAVANT),
  },
  {
    codi: 'EX-HN12',
    mitja: true,
    regla: ref('dins la boca, a la vena de l\'esquerra del fre de la llengua; al mapa, al llavi inferior'),
    calcular: (c, r) => c.pellDesDeFora(v(0.008, r.nivellBoca - 0.005, 0), DAVANT),
  },
  {
    codi: 'EX-HN13',
    mitja: true,
    regla: ref('dins la boca, a la vena de la dreta del fre de la llengua; al mapa, al llavi inferior'),
    calcular: (c, r) => c.pellDesDeFora(v(-0.008, r.nivellBoca - 0.005, 0), DAVANT),
  },
  {
    codi: 'EX-HN14',
    regla: ref('1 cun per darrere de TE17'),
    calcular: (c, r, k, p) => {
      const te17 = p('TE17')
      return c.pellDesDeFora(v(te17.x, te17.y, te17.z - r.cun.cap), lat(k), 0.25)
    },
  },
  {
    codi: 'EX-HN15',
    regla: ref('2 cun per sobre de GV14, 1 cun lateral a la línia mitja'),
    calcular: (c, r, k, p) => esquena(c, r, k, p('GV14').y + 2 * r.cun.capPosterior, 1),
  },
]

// --- Tòrax i abdomen (EX-CA) ------------------------------------------------------

const CA: DefinicioPunt[] = [
  {
    codi: 'EX-CA1',
    regla: { tipus: 'vertical', ref: 'melic', cun: -4, unitat: 'abdomenInferior', lateral: 3 },
    calcular: (c, r, k) => abdomenX(c, r, k, -4, 3),
  },
]

// --- Esquena (EX-B) ----------------------------------------------------------------

const B: DefinicioPunt[] = [
  vertebra('EX-B1', 'C7', 0.5),
  {
    codi: 'EX-B2',
    subpunts: VERTEBRES_JIAJI,
    regla: ref('sota cada apòfisi espinosa de T1 a L5, 0,5 cun lateral a la línia mitja'),
    calcular: (c, r, k, _p, i) => esquena(c, r, k, nivellVertebra(r, VERTEBRES_JIAJI[i]!, true), 0.5),
  },
  vertebra('EX-B3', 'T8', 1.5),
  vertebra('EX-B4', 'L1', 3.5),
  espinosa('EX-B5', 'L3'),
  vertebra('EX-B6', 'L4', 3),
  vertebra('EX-B7', 'L4', 3.5),
  espinosa('EX-B8', 'L5'),
  {
    codi: 'EX-B9',
    mitja: true,
    regla: ref('2 cun per sobre de la punta del còccix, entre les banyes del sacre'),
    calcular: (c, r) => c.pellDesDeFora(v(0, r.vertebres.coccix! + 2 * r.cun.abdomenInferior, 0), DARRERE, 0.5),
  },
]

// --- Extremitat superior (EX-UE) ---------------------------------------------------

/** Dors de la mà, entre dos metacarpians, a la fracció `t` del canell als artells */
function dorsMa(c: CosMesurable, r: Referencies, k: Costat, a: number, b: number, t: number): Vector3 {
  const artells = mig(art(c, k, `finger-${a}-1`), art(c, k, `finger-${b}-1`))
  return c.pell(r[k].canell.clone().lerp(artells, t), r[k].dorsal)
}

const UE: DefinicioPunt[] = [
  {
    codi: 'EX-UE1',
    regla: ref('punta de l\'olècranon, amb el colze flexionat'),
    calcular: (c, r, k) => bracDir(c, r, k, 0, (q) => q.posteriorColze.clone()),
  },
  {
    codi: 'EX-UE2',
    subpunts: ['costat radial del tendó', 'costat cubital del tendó'],
    regla: { tipus: 'segment', de: 'PC7', a: 'PC3', cun: 4, total: 12, desviacio: 0.03 },
    calcular: (c, r, k, _p, i) =>
      avantbracDir(
        c,
        r,
        k,
        4,
        (q: K) => dir([q.palmar, 1], [q.radial, i === 0 ? 0.75 : 0.3]),
        (q: K) => dir([q.anteriorColze, 1], [q.lateralColze, i === 0 ? 0.3 : 0.1]),
      ),
  },
  {
    codi: 'EX-UE3',
    regla: ref('plec dorsal del canell, radial al tendó de l\'extensor comú dels dits'),
    calcular: (c, r, k) => avantbracDir(c, r, k, 0, (q: K) => dir([q.dorsal, 1], [q.radial, 0.35]), (q: K) => q.posteriorColze.clone()),
  },
  {
    codi: 'EX-UE4',
    regla: ref('dors del dit del mig, centre de l\'articulació interfalàngica proximal'),
    calcular: (c, r, k) => c.pell(art(c, k, 'finger-3-2'), r[k].dorsal),
  },
  {
    codi: 'EX-UE5',
    regla: ref('dors del polze, centre de l\'articulació interfalàngica'),
    calcular: (c, r, k) => c.pell(art(c, k, 'finger-1-3'), dir([r[k].dorsal, 1], [r[k].radial, 0.8])),
  },
  {
    codi: 'EX-UE6',
    regla: ref('dors del dit petit, centre de l\'articulació interfalàngica proximal'),
    calcular: (c, r, k) => c.pell(art(c, k, 'finger-5-2'), r[k].dorsal),
  },
  {
    codi: 'EX-UE7',
    subpunts: ['entre el 2n i el 3r metacarpià', 'entre el 4t i el 5è metacarpià'],
    regla: ref('dors de la mà, entre el 2n i el 3r i entre el 4t i el 5è metacarpià, a mig camí del canell als artells'),
    calcular: (c, r, k, _p, i) => (i === 0 ? dorsMa(c, r, k, 2, 3, 0.5) : dorsMa(c, r, k, 4, 5, 0.5)),
  },
  {
    codi: 'EX-UE8',
    regla: ref('dors de la mà, entre el 2n i el 3r metacarpià, 0,5 cun proximal a les articulacions metacarpofalàngiques'),
    calcular: (c, r, k) => {
      const artells = mig(art(c, k, 'finger-2-1'), art(c, k, 'finger-3-1'))
      const cap = r[k].canell.clone().sub(artells).normalize()
      return c.pell(artells.addScaledVector(cap, 0.5 * r.cun.avantbrac), r[k].dorsal)
    },
  },
  {
    codi: 'EX-UE9',
    subpunts: ['entre el polze i l\'índex', 'entre l\'índex i el mig', 'entre el mig i l\'anular', 'entre l\'anular i el petit'],
    regla: ref('dors de la mà, just per sobre de la vora de la membrana entre els dits'),
    calcular: (c, r, k, _p, i) => {
      // Entre el polze i l'índex, l'artell del polze és el «1-2»
      const a = i === 0 ? art(c, k, 'finger-1-2') : art(c, k, `finger-${i + 1}-1`)
      const b = art(c, k, `finger-${i + 2}-1`)
      const pa = i === 0 ? art(c, k, 'finger-1-3') : art(c, k, `finger-${i + 1}-2`)
      const pb = art(c, k, `finger-${i + 2}-2`)
      // Venint de fora, pel dors: entre els dits no hi ha pell des de dins
      return c.pellDesDeFora(mig(a, b).lerp(mig(pa, pb), i === 0 ? 0.1 : 0.15), r[k].dorsal, 0.06)
    },
  },
  {
    codi: 'EX-UE10',
    subpunts: DITS.slice(1),
    regla: ref('cara palmar dels dits 2n a 5è, centre de l\'articulació interfalàngica proximal'),
    calcular: (c, r, k, _p, i) => c.pell(art(c, k, `finger-${i + 2}-2`), r[k].palmar),
  },
  {
    codi: 'EX-UE11',
    subpunts: DITS,
    regla: ref('punta de cada dit, 0,1 cun de la vora lliure de l\'ungla'),
    calcular: (c, _r, k, _p, i) => puntaDit(c, k, `finger-${i + 1}-3`, `finger-${i + 1}-4`),
  },
]

// --- Extremitat inferior (EX-LE) ---------------------------------------------------

const LE: DefinicioPunt[] = [
  {
    codi: 'EX-LE1',
    subpunts: ['lateral', 'medial'],
    regla: { tipus: 'nivell', com: 'ST34' },
    calcular: (c, r, k, p, i) => {
      const st34 = p('ST34')
      return alVoltant(c, eixCuixaA(r, k, st34.y), st34, 1.5 * r.cun.cuixa, i === 0 ? 1 : -1, k)
    },
  },
  {
    codi: 'EX-LE2',
    regla: ref('depressió per sobre del punt mitjà de la base de la ròtula'),
    calcular: (c, r, k) => {
      const q = r[k]
      const centre = eixCuixaA(r, k, q.basePatella.y + 0.012)
      return c.pell(centre, q.anteriorGenoll)
    },
  },
  {
    codi: 'EX-LE3',
    regla: ref('3 cun per sobre de l\'angle intern de la base de la ròtula (1 cun per sobre de SP10)'),
    calcular: (c, r, k) =>
      cuixaDir(c, r, k, 3 + (r[k].basePatella.y - r[k].genoll.y) / r.cun.cuixa, r.cun.cuixa, (q) => dir([q.anteriorGenoll, 1], [q.medial, 0.5])),
  },
  {
    codi: 'EX-LE4',
    regla: ref('genoll, depressió medial al lligament rotulià'),
    calcular: (c, r, k) => c.pell(r[k].genoll.clone().addScaledVector(r[k].eixCama, 0.012), dir([r[k].anteriorGenoll, 1], [r[k].medial, 0.35])),
  },
  {
    codi: 'EX-LE5',
    subpunts: ['intern (EX-LE4)', 'extern (ST35)'],
    regla: ref('genoll, depressions a banda i banda del lligament rotulià'),
    calcular: (_c, _r, _k, p, i) => (i === 0 ? p('EX-LE4') : p('ST35')),
  },
  {
    codi: 'EX-LE6',
    regla: ref('2 cun per sota de GB34'),
    calcular: (c, r, k) => {
      const q = r[k]
      return c.pell(q.genoll.clone().addScaledVector(q.eixCama, 0.065 + (2 * r.cun.cama) / -q.eixCama.y), dir([q.lateral, 1], [q.anteriorGenoll, 0.55]))
    },
  },
  {
    codi: 'EX-LE7',
    regla: { tipus: 'segment', de: 'ST35', a: 'ST41', cun: 5, total: 16 },
    calcular: (c, r, k) => {
      const q = r[k]
      return c.pell(q.genoll.clone().addScaledVector(q.eixCama, (5 * r.cun.cama) / -q.eixCama.y), dir([q.anteriorGenoll, 1], [q.lateral, 0.22]))
    },
  },
  {
    codi: 'EX-LE8',
    regla: ref('punt més prominent del mal·lèol intern'),
    calcular: (c, r, k) => aPell(c, r[k].malleolIntern),
  },
  {
    codi: 'EX-LE9',
    regla: ref('punt més prominent del mal·lèol extern'),
    calcular: (c, r, k) => aPell(c, r[k].malleolExtern),
  },
  {
    codi: 'EX-LE10',
    subpunts: ['entre el 1r i el 2n dit', 'entre el 2n i el 3r dit', 'entre el 3r i el 4t dit', 'entre el 4t i el 5è dit'],
    regla: ref('dors del peu, just per darrere de la vora de la membrana entre els dits'),
    calcular: (c, _r, k, _p, i) => {
      const a = art(c, k, `toe-${i + 1}-1`)
      const b = art(c, k, `toe-${i + 2}-1`)
      const pa = art(c, k, `toe-${i + 1}-2`)
      const pb = art(c, k, `toe-${i + 2}-2`)
      // Per darrere de la membrana, venint de dalt (entre els dits no hi ha pell)
      return c.pellDesDeFora(mig(a, b).lerp(mig(pa, pb), 0.1), AMUNT, 0.06)
    },
  },
  {
    codi: 'EX-LE11',
    regla: ref('planta del 2n dit, centre de l\'articulació interfalàngica distal'),
    calcular: (c, _r, k) => c.pell(art(c, k, 'toe-2-3'), AVALL),
  },
  {
    codi: 'EX-LE12',
    subpunts: DITS_PEU,
    regla: ref('punta de cada dit del peu, 0,1 cun de la vora lliure de l\'ungla'),
    calcular: (c, _r, k, _p, i) => (i === 0 ? puntaDit(c, k, 'toe-1-2', 'toe-1-3') : puntaDit(c, k, `toe-${i + 1}-3`, `toe-${i + 1}-4`)),
  },
]

export const EX: DefinicioPunt[] = [...HN, ...CA, ...B, ...UE, ...LE]

export const ORDRE_EX: Ordre[] = [
  { codis: ['EX-HN2', 'EX-HN4', 'EX-HN7'], criteri: 'baixa' },
  { codis: ['EX-HN15', 'EX-B1', 'EX-B3', 'EX-B4', 'EX-B6'], criteri: 'baixa' },
  { codis: ['EX-B5', 'EX-B8', 'EX-B9'], criteri: 'baixa' },
  { codis: ['EX-LE1', 'EX-LE2', 'EX-LE4', 'EX-LE6', 'EX-LE7', 'EX-LE9'], criteri: 'baixa' },
]
