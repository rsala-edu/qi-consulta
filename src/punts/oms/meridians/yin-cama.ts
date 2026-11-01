// Meridians yin de la cama: SP, KI i LR. Cara medial de la cama: del
// mal·lèol intern a SP9 hi ha 13 cun. Abdomen: del melic a la símfisi, 5 cun;
// del melic a la unió xifoesternal, 8 cun. Tòrax: entre els mugrons, 8 cun.

import { Vector3 } from 'three'
import { AMUNT, DAVANT, dir, signe, v, type Costat, type CosMesurable } from '../cos'
import {
  abdomenX,
  camaMalleol,
  cuixaDir,
  espaiIntercostal,
  nivellClavicula,
  pitX,
  troncLateral,
} from '../eines'
import type { Referencies } from '../referencies'
import type { DefinicioPunt, Ordre } from '../tipus'

type K = Referencies['E']
const art = (c: CosMesurable, k: Costat, nom: string) => c.art(nom, k)
const mig = (a: Vector3, b: Vector3) => a.clone().lerp(b, 0.5)
const ref = (descripcio: string) => ({ tipus: 'referencia' as const, descripcio })
const vertical = (ref: 'melic' | 'malleolIntern', cun: number, unitat: 'abdomenSuperior' | 'abdomenInferior' | 'cama', lateral?: number) =>
  ({ tipus: 'vertical' as const, ref, cun, unitat, ...(lateral !== undefined ? { lateral } : {}) })

/** Direcció lateral (+X a l'esquerra) i medial del peu */
const lat = (k: Costat) => v(signe(k), 0, 0)
const med = (k: Costat) => v(-signe(k), 0, 0)
/** Eix del peu (del turmell cap als dits), horitzontal */
function eixPeu(c: CosMesurable, r: Referencies, k: Costat): Vector3 {
  return art(c, k, 'toe-2-1').sub(r[k].turmell).setY(0).normalize()
}

const medialTibia = (posterior: number) => (q: K) => dir([q.medial, 1], [q.posteriorGenoll, posterior])

// --- Melsa (SP) --------------------------------------------------------------------

export const SP: DefinicioPunt[] = [
  {
    codi: 'SP1',
    regla: ref('dit gros, costat medial, vora de l\'ungla'),
    calcular: (c, _r, k) => c.pell(art(c, k, 'toe-1-2').lerp(art(c, k, 'toe-1-3'), 0.5), dir([med(k), 1], [AMUNT, 0.7])),
  },
  {
    codi: 'SP2',
    regla: ref('distal a la 1a articulació metatarsofalàngica, costat medial'),
    calcular: (c, _r, k) => c.pell(art(c, k, 'toe-1-1').lerp(art(c, k, 'toe-1-2'), 0.3), med(k)),
  },
  {
    codi: 'SP3',
    regla: ref('proximal al cap del 1r metatarsià, costat medial'),
    calcular: (c, r, k) => c.pell(art(c, k, 'toe-1-1').addScaledVector(eixPeu(c, r, k), -0.016), med(k)),
  },
  {
    codi: 'SP4',
    regla: ref('davant i per sota de la base del 1r metatarsià'),
    calcular: (c, r, k) => c.pell(r[k].turmell.clone().lerp(art(c, k, 'toe-1-1'), 0.5).add(v(0, -0.012, 0)), dir([med(k), 1], [AMUNT, -0.3])),
  },
  {
    codi: 'SP5',
    regla: ref('davant i per sota del mal·lèol intern'),
    calcular: (c, r, k) => c.pell(r[k].turmell.clone().add(v(0, -0.012, 0.016)), dir([med(k), 1], [DAVANT, 0.5])),
  },
  { codi: 'SP6', regla: vertical('malleolIntern', 3, 'cama'), calcular: (c, r, k) => camaMalleol(c, r, k, 3, 'intern', medialTibia(0.35)) },
  { codi: 'SP7', regla: vertical('malleolIntern', 6, 'cama'), calcular: (c, r, k) => camaMalleol(c, r, k, 6, 'intern', medialTibia(0.35)) },
  { codi: 'SP9', regla: ref('sota el còndil medial de la tíbia'), calcular: (c, r, k) => camaMalleol(c, r, k, 13, 'intern', (q) => dir([q.medial, 1], [q.anteriorGenoll, 0.3])) },
  { codi: 'SP8', regla: { tipus: 'segment', de: 'SP9', a: 'SP6', cun: 3, total: 10 }, calcular: (c, r, k) => camaMalleol(c, r, k, 10, 'intern', medialTibia(0.3)) },
  {
    codi: 'SP10',
    regla: ref('2 cun per sobre de l\'angle intern de la base de la ròtula, vast intern'),
    calcular: (c, r, k) => cuixaDir(c, r, k, 2 + (r[k].basePatella.y - r[k].genoll.y) / r.cun.cuixa, r.cun.cuixa, (q) => dir([q.anteriorGenoll, 1], [q.medial, 0.5])),
  },
  {
    codi: 'SP12',
    regla: ref('engonal, vora superior de la símfisi, 3,5 cun lateral'),
    calcular: (c, r, k) => c.pell(v(signe(k) * 3.5 * r.cun.pit, r.simfisi.y, -0.02), DAVANT),
  },
  {
    codi: 'SP11',
    regla: { tipus: 'segment', de: 'SP12', a: 'SP10', cun: 1, total: 3 },
    calcular: (c, _r, _k, p) => {
      const a = p('SP12')
      const b = p('SP10')
      return c.puntDe(c.aLaPell(a.lerp(b, 1 / 3)))
    },
  },
  {
    codi: 'SP13',
    regla: ref('0,7 cun sobre SP12, 4 cun lateral'),
    calcular: (c, r, k) => c.pell(v(signe(k) * 4 * r.cun.pit, r.simfisi.y + 0.7 * r.cun.abdomenInferior, -0.02), DAVANT),
  },
  { codi: 'SP14', regla: vertical('melic', -1.3, 'abdomenInferior', 4), calcular: (c, r, k) => abdomenX(c, r, k, -1.3, 4) },
  { codi: 'SP15', regla: vertical('melic', 0, 'abdomenSuperior', 4), calcular: (c, r, k) => abdomenX(c, r, k, 0, 4) },
  { codi: 'SP16', regla: vertical('melic', 3, 'abdomenSuperior', 4), calcular: (c, r, k) => abdomenX(c, r, k, 3, 4) },
  ...([
    ['SP17', 5],
    ['SP18', 4],
    ['SP19', 3],
    ['SP20', 2],
  ] as const).map(
    ([codi, n]): DefinicioPunt => ({
      codi,
      regla: ref(`${n}è espai intercostal, 6 cun lateral`),
      calcular: (c, r, k) => pitX(c, r, k, 6, espaiIntercostal(r, k, n)),
    }),
  ),
  {
    codi: 'SP21',
    regla: ref('sisè espai intercostal, línia axil·lar mitjana'),
    calcular: (c, r, k) => troncLateral(c, k, espaiIntercostal(r, k, 6), 90),
  },
]

// --- Ronyó (KI) --------------------------------------------------------------------

export const KI: DefinicioPunt[] = [
  {
    codi: 'KI1',
    regla: ref('planta del peu, a 1/3 de la base dels dits 2n–3r al taló'),
    calcular: (c, r, k) => {
      const dits = mig(art(c, k, 'toe-2-1'), art(c, k, 'toe-3-1'))
      const talo = r[k].turmell.clone().addScaledVector(eixPeu(c, r, k), -0.045)
      const origen = dits.lerp(talo, 1 / 3)
      origen.y = 0.02
      return c.pell(origen, v(0, -1, 0))
    },
  },
  {
    codi: 'KI2',
    regla: ref('sota la tuberositat del navicular'),
    calcular: (c, r, k) => c.pell(r[k].turmell.clone().lerp(art(c, k, 'toe-1-1'), 0.33).add(v(0, -0.016, 0)), dir([med(k), 1], [AMUNT, -0.4])),
  },
  {
    codi: 'KI3',
    regla: ref('entre la punta del mal·lèol intern i el tendó d\'Aquil·les'),
    calcular: (c, r, k) => c.pell(r[k].turmell.clone().add(v(0, 0.004, 0)), dir([med(k), 1], [DAVANT, -1])),
  },
  {
    codi: 'KI4',
    regla: ref('darrere i sota el mal·lèol intern, davant de la inserció del tendó d\'Aquil·les'),
    calcular: (c, r, k) => c.pell(r[k].turmell.clone().add(v(0, -0.01, 0)), dir([med(k), 1], [DAVANT, -1.2])),
  },
  {
    codi: 'KI5',
    regla: ref('1 cun sota KI3, al calcani'),
    calcular: (c, r, k) => c.pell(r[k].turmell.clone().add(v(0, -0.02, -0.006)), dir([med(k), 1], [DAVANT, -0.9])),
  },
  {
    codi: 'KI6',
    regla: ref('1 cun sota la punta del mal·lèol intern'),
    calcular: (c, r, k) => c.pell(r[k].turmell.clone().add(v(0, -0.02, 0.004)), med(k)),
  },
  { codi: 'KI7', regla: vertical('malleolIntern', 2, 'cama'), calcular: (c, r, k) => camaMalleol(c, r, k, 2, 'intern', (q) => dir([q.medial, 0.8], [q.posteriorGenoll, 1])) },
  { codi: 'KI8', regla: { tipus: 'nivell', com: 'KI7' }, calcular: (c, r, k) => camaMalleol(c, r, k, 2, 'intern', medialTibia(0.3)) },
  { codi: 'KI9', regla: vertical('malleolIntern', 5, 'cama'), calcular: (c, r, k) => camaMalleol(c, r, k, 5, 'intern', (q) => dir([q.medial, 1], [q.posteriorGenoll, 0.9])) },
  {
    codi: 'KI10',
    regla: ref('costat medial del plec popliti'),
    calcular: (c, r, k) => c.pell(r[k].genoll, dir([r[k].posteriorGenoll, 1], [r[k].medial, 0.8])),
  },
  ...([
    ['KI11', -5],
    ['KI12', -4],
    ['KI13', -3],
    ['KI14', -2],
    ['KI15', -1],
    ['KI16', 0],
    ['KI17', 2],
    ['KI18', 3],
    ['KI19', 4],
    ['KI20', 5],
    ['KI21', 6],
  ] as const).map(
    ([codi, cun]): DefinicioPunt => ({
      codi,
      regla: vertical('melic', cun, cun < 0 ? 'abdomenInferior' : 'abdomenSuperior', 0.5),
      calcular: (c, r, k) => abdomenX(c, r, k, cun, 0.5),
    }),
  ),
  ...([
    ['KI22', 5],
    ['KI23', 4],
    ['KI24', 3],
    ['KI25', 2],
    ['KI26', 1],
  ] as const).map(
    ([codi, n]): DefinicioPunt => ({
      codi,
      regla: ref(`${n}è espai intercostal, 2 cun lateral`),
      calcular: (c, r, k) => pitX(c, r, k, 2, espaiIntercostal(r, k, n)),
    }),
  ),
  {
    codi: 'KI27',
    regla: ref('sota la clavícula, 2 cun lateral'),
    calcular: (c, r, k) => pitX(c, r, k, 2, nivellClavicula(c, r, k, 2 * r.cun.pit), 0.15),
  },
]

// --- Fetge (LR) --------------------------------------------------------------------

export const LR: DefinicioPunt[] = [
  {
    codi: 'LR1',
    regla: ref('dit gros, costat lateral, vora de l\'ungla'),
    calcular: (c, _r, k) => c.pell(art(c, k, 'toe-1-2').lerp(art(c, k, 'toe-1-3'), 0.5), dir([lat(k), 1], [AMUNT, 0.7])),
  },
  {
    codi: 'LR2',
    regla: ref('entre el 1r i el 2n dit, darrere del marge interdigital'),
    calcular: (c, r, k) => {
      const mtp = mig(art(c, k, 'toe-1-1'), art(c, k, 'toe-2-1'))
      return c.pell(mtp.lerp(mig(art(c, k, 'toe-1-2'), art(c, k, 'toe-2-2')), 0.15).add(v(0, -0.008, 0)), dir([AMUNT, 1], [eixPeu(c, r, k), 0.5]))
    },
  },
  {
    codi: 'LR3',
    regla: ref('entre el 1r i el 2n metatarsià, davant de la unió de les bases'),
    calcular: (c, r, k) => c.pell(mig(art(c, k, 'toe-1-1'), art(c, k, 'toe-2-1')).lerp(r[k].turmell, 0.35).add(v(0, -0.01, 0)), AMUNT),
  },
  {
    codi: 'LR4',
    regla: ref('davant del mal·lèol intern, medial al tibial anterior'),
    calcular: (c, r, k) => c.pell(r[k].turmell.clone().add(v(0, -0.002, 0.012)), dir([DAVANT, 1], [med(k), 0.6])),
  },
  { codi: 'LR5', regla: vertical('malleolIntern', 5, 'cama'), calcular: (c, r, k) => camaMalleol(c, r, k, 5, 'intern', (q) => dir([q.medial, 1], [q.anteriorGenoll, 0.5])) },
  { codi: 'LR6', regla: vertical('malleolIntern', 7, 'cama'), calcular: (c, r, k) => camaMalleol(c, r, k, 7, 'intern', (q) => dir([q.medial, 1], [q.anteriorGenoll, 0.5])) },
  {
    codi: 'LR7',
    regla: ref('darrere i sota el còndil medial de la tíbia, 1 cun darrere de SP9'),
    calcular: (c, r, k) => camaMalleol(c, r, k, 13, 'intern', (q) => dir([q.medial, 1], [q.posteriorGenoll, 0.5])),
  },
  {
    codi: 'LR8',
    regla: ref('extrem medial del plec popliti, davant dels tendons'),
    calcular: (c, r, k) => c.pell(r[k].genoll.clone().addScaledVector(r[k].eixCuixa, -0.01), dir([r[k].medial, 1], [r[k].posteriorGenoll, 0.15])),
  },
  {
    codi: 'LR9',
    regla: ref('4 cun sobre l\'epicòndil medial del fèmur'),
    calcular: (c, r, k) => cuixaDir(c, r, k, 4.5, r.cun.cuixa, (q) => dir([q.medial, 1], [q.posteriorGenoll, 0.2])),
  },
  {
    codi: 'LR10',
    regla: ref('3 cun sota ST30, cara medial de la cuixa'),
    calcular: (c, r, k) => cuixaDir(c, r, k, (r.simfisi.y - 3 * r.cun.cuixa - r[k].genoll.y) / r.cun.cuixa, r.cun.cuixa, (q) => dir([q.anteriorGenoll, 1], [q.medial, 0.5])),
  },
  {
    codi: 'LR12',
    regla: ref('engonal, vora superior de la símfisi, 2,5 cun lateral'),
    calcular: (c, r, k) => c.pell(v(signe(k) * 2.5 * r.cun.pit, r.simfisi.y - 0.004, -0.02), DAVANT),
  },
  {
    codi: 'LR11',
    // 2 cun sota ST30: sobre la línia de LR12 (alçada de la símfisi) a LR10 (3 cun més avall)
    regla: { tipus: 'segment', de: 'LR12', a: 'LR10', cun: 2, total: 3 },
    calcular: (c, _r, _k, p) => c.puntDe(c.aLaPell(p('LR12').lerp(p('LR10'), 2 / 3))),
  },
  {
    codi: 'LR13',
    regla: ref('sota l\'extrem lliure de l\'onzena costella'),
    calcular: (c, r, k) => troncLateral(c, k, r.melic.y + 2 * r.cun.abdomenSuperior, 72),
  },
  { codi: 'LR14', regla: ref('sisè espai intercostal, 4 cun lateral'), calcular: (c, r, k) => pitX(c, r, k, 4, espaiIntercostal(r, k, 6)) },
]

export const ORDRE_YIN_CAMA: Ordre[] = [
  { codis: ['SP5', 'SP6', 'SP7', 'SP8', 'SP9', 'SP10', 'SP11', 'SP12', 'SP13', 'SP14', 'SP15', 'SP16', 'SP17', 'SP18', 'SP19', 'SP20'], criteri: 'puja' },
  { codis: ['KI6', 'KI7', 'KI9', 'KI10'], criteri: 'puja' },
  { codis: ['KI11', 'KI12', 'KI13', 'KI14', 'KI15', 'KI16', 'KI17', 'KI18', 'KI19', 'KI20', 'KI21', 'KI22', 'KI23', 'KI24', 'KI25', 'KI26', 'KI27'], criteri: 'puja' },
  { codis: ['LR4', 'LR5', 'LR6', 'LR7', 'LR9', 'LR10', 'LR11', 'LR12'], criteri: 'puja' },
  { codis: ['SP1', 'SP2', 'SP3', 'SP4'], criteri: 'allunya' },
  { codis: ['LR1', 'LR2', 'LR3'], criteri: 'allunya' },
]
