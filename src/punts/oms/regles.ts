// Regles de localització dels punts (estàndard de l'OMS, 2008), expressades
// com a càlcul sobre les referències anatòmiques del cos. Cada punt té una
// `regla` declarativa que les proves fan servir per comprovar-lo.

import { Vector3 } from 'three'
import { AMUNT, CosMesurable, DARRERE, DAVANT, dir, signe, v, type Costat } from './cos'
import type { Referencies, UnitatsCun } from './referencies'

export type Regla =
  /** A `cun` de `de` en direcció a `a`; tot el segment `de`–`a` fa `total` cun */
  | { tipus: 'segment'; de: string; a: string; cun: number; total: number }
  /** A `cun` per sobre (positiu) o per sota (negatiu) d'una referència i, si cal, a `lateral` cun de la línia mitja */
  | { tipus: 'vertical'; ref: 'melic' | 'basePatella'; cun: number; unitat: keyof UnitatsCun; lateral?: number }
  /** A la mateixa alçada que un altre punt */
  | { tipus: 'nivell'; com: string }
  /** Sobre una referència anatòmica concreta (mugró, espai intercostal…) */
  | { tipus: 'referencia'; descripcio: string }

export interface DefinicioPunt {
  codi: string
  regla: Regla
  /** Punt de la pell en aquest costat */
  calcular(c: CosMesurable, r: Referencies, costat: Costat): Vector3
}

// --- Intestí gros (LI) -------------------------------------------------------

function avantbrac(c: CosMesurable, r: Referencies, costat: Costat, cunDesDelCanell: number): Vector3 {
  const k = r[costat]
  const t = cunDesDelCanell / 12
  const origen = k.canell.clone().lerp(k.colze, t)
  const aCanell = dir([k.radial, 1], [k.dorsal, 0.5])
  const aColze = dir([k.lateralColze, 1], [k.anteriorColze, 0.35])
  return c.pell(origen, aCanell.lerp(aColze, t).normalize())
}

function brac(c: CosMesurable, r: Referencies, costat: Costat, cunSobreColze: number, anterior = 0): Vector3 {
  const k = r[costat]
  const origen = k.colze.clone().addScaledVector(k.eixBrac, -cunSobreColze * r.cun.brac)
  return c.pell(origen, dir([k.lateralColze, 1], [k.anteriorColze, anterior]))
}

const dits = (costat: Costat, nom: string, c: CosMesurable) => c.art(nom, costat)

const LI: DefinicioPunt[] = [
  {
    codi: 'LI1',
    regla: { tipus: 'referencia', descripcio: 'costat radial de la falange distal de l\'índex, vora de l\'ungla' },
    calcular: (c, r, k) =>
      c.pell(dits(k, 'finger-2-3', c).lerp(dits(k, 'finger-2-4', c), 0.55), dir([r[k].radial, 1], [r[k].dorsal, 0.7])),
  },
  {
    codi: 'LI2',
    regla: { tipus: 'referencia', descripcio: 'distal a la 2a articulació metacarpofalàngica, costat radial' },
    calcular: (c, r, k) => c.pell(r[k].mcp2.clone().lerp(dits(k, 'finger-2-2', c), 0.3), dir([r[k].radial, 1], [r[k].dorsal, 0.15])),
  },
  {
    codi: 'LI3',
    regla: { tipus: 'referencia', descripcio: 'proximal a la 2a articulació metacarpofalàngica, costat radial' },
    calcular: (c, r, k) => c.pell(r[k].mcp2.clone().lerp(r[k].canell, 0.14), dir([r[k].radial, 1], [r[k].dorsal, 0.15])),
  },
  {
    codi: 'LI4',
    regla: { tipus: 'referencia', descripcio: 'dors de la mà, costat radial del punt mitjà del 2n metacarpià' },
    calcular: (c, r, k) => {
      const base = r[k].canell.clone().lerp(r[k].mcp2, 0.15)
      return c.pell(base.lerp(r[k].mcp2, 0.5), dir([r[k].dorsal, 1], [r[k].radial, 0.7]))
    },
  },
  {
    codi: 'LI5',
    regla: { tipus: 'referencia', descripcio: 'plec dorsal del canell, costat radial (tabaquera anatòmica)' },
    calcular: (c, r, k) => avantbrac(c, r, k, 0),
  },
  ...([
    ['LI6', 3],
    ['LI7', 5],
    ['LI8', 8],
    ['LI9', 9],
    ['LI10', 10],
  ] as const).map(
    ([codi, cun]): DefinicioPunt => ({
      codi,
      regla: { tipus: 'segment', de: 'LI5', a: 'LI11', cun, total: 12 },
      calcular: (c, r, k) => avantbrac(c, r, k, cun),
    }),
  ),
  {
    codi: 'LI11',
    regla: { tipus: 'referencia', descripcio: 'extrem lateral del plec del colze' },
    calcular: (c, r, k) => avantbrac(c, r, k, 12),
  },
  {
    codi: 'LI12',
    regla: { tipus: 'segment', de: 'LI11', a: 'LI15', cun: 1, total: 10 },
    calcular: (c, r, k) => brac(c, r, k, 1, -0.3),
  },
  {
    codi: 'LI13',
    regla: { tipus: 'segment', de: 'LI11', a: 'LI15', cun: 3, total: 10 },
    calcular: (c, r, k) => brac(c, r, k, 3),
  },
  {
    codi: 'LI14',
    regla: { tipus: 'segment', de: 'LI11', a: 'LI15', cun: 7, total: 10 },
    calcular: (c, r, k) => brac(c, r, k, 7, 0.25),
  },
  {
    codi: 'LI15',
    regla: { tipus: 'referencia', descripcio: 'davant i sota de l\'acromi, entre l\'acromi i el troquíter' },
    calcular: (c, r, k) => c.pell(r[k].espatlla, dir([v(signe(k), 0, 0), 1], [AMUNT, 0.45], [DAVANT, 0.6])),
  },
  {
    codi: 'LI16',
    regla: { tipus: 'referencia', descripcio: 'entre l\'extrem acromial de la clavícula i l\'espina de l\'escàpula' },
    calcular: (c, r, k) => c.pell(r[k].espatlla.clone().add(v(-signe(k) * 0.015, 0, -0.012)), dir([AMUNT, 1], [DARRERE, 0.25])),
  },
  {
    codi: 'LI17',
    regla: { tipus: 'referencia', descripcio: 'nivell del cricoide, vora posterior de l\'esternocleidomastoidal' },
    calcular: (c, r, k) => coll(c, r, k, r.nivellCricoide, 78),
  },
  {
    codi: 'LI18',
    regla: { tipus: 'referencia', descripcio: 'nivell de la vora superior del tiroide, entre els dos caps de l\'ECM' },
    calcular: (c, r, k) => coll(c, r, k, r.nivellTiroide, 62),
  },
  {
    codi: 'LI19',
    regla: { tipus: 'referencia', descripcio: 'sota la vora lateral de la narina, a mitja alçada del filtre' },
    calcular: (c, r, k) => cara(c, r, k, 0.011, (r.nivellBaseNas + r.nivellBoca) / 2),
  },
  {
    codi: 'LI20',
    regla: { tipus: 'referencia', descripcio: 'solc nasogenià, a l\'alçada del punt mitjà de la vora lateral de l\'ala del nas' },
    calcular: (c, r, k) => cara(c, r, k, 0.021, r.nivellAlaNas),
  },
]

// --- Coll i cara --------------------------------------------------------------

/** Pell del coll a una alçada, girant `graus` des de davant cap al costat. */
function coll(c: CosMesurable, _r: Referencies, costat: Costat, y: number, graus: number): Vector3 {
  const a = (graus * Math.PI) / 180
  const centre = c.art('neck')
  return c.pell(v(0, y, centre.z), v(signe(costat) * Math.sin(a), 0, Math.cos(a)))
}

/** Pell de la cara (vista des de davant) a una distància lateral de la línia mitja (m) i una alçada. */
function cara(c: CosMesurable, _r: Referencies, costat: Costat, lateral: number, y: number): Vector3 {
  return c.pellDesDeFora(v(signe(costat) * lateral, y, 0), DAVANT)
}

/** Pell del cap a una alçada, vista des d'un angle de `graus` entre davant i el costat. */
function cap(c: CosMesurable, r: Referencies, costat: Costat, y: number, graus: number): Vector3 {
  const a = (graus * Math.PI) / 180
  return c.pellDesDeFora(v(0, y, r.centreCap.z), v(signe(costat) * Math.sin(a), 0, Math.cos(a)))
}

/**
 * Punt del front a una alçada, a una distància de la línia mitja mesurada
 * sobre la pell (seguint l'arc), com es mesuren els cun.
 */
function arcFront(c: CosMesurable, r: Referencies, costat: Costat, y: number, longitud: number): Vector3 {
  let anterior = cap(c, r, costat, y, 0)
  let recorregut = 0
  for (let graus = 1; graus <= 120; graus++) {
    const actual = cap(c, r, costat, y, graus)
    const pas = actual.distanceTo(anterior)
    if (recorregut + pas >= longitud) return anterior.lerp(actual, (longitud - recorregut) / pas)
    recorregut += pas
    anterior = actual
  }
  throw new Error('El front no és prou ample per a aquesta distància')
}

// --- Estómac (ST) -------------------------------------------------------------

function pit(c: CosMesurable, r: Referencies, costat: Costat, y: number, amunt = 0): Vector3 {
  return c.pell(v(r[costat].mugro.x, y, 0), dir([DAVANT, 1], [AMUNT, amunt]))
}

function abdomen(c: CosMesurable, r: Referencies, costat: Costat, cun: number, unitat: keyof UnitatsCun): Vector3 {
  return c.pell(v(signe(costat) * 2 * r.cun.pit, r.melic.y + cun * r.cun[unitat], -0.02), DAVANT)
}

/** Cuixa: sobre la línia espina ilíaca – base de la ròtula, a `cun` per sobre de la ròtula. */
function cuixa(c: CosMesurable, r: Referencies, costat: Costat, cunSobreRotula: number): Vector3 {
  const k = r[costat]
  const t = (cunSobreRotula * r.cun.cuixa) / (k.espinaIliaca.y - k.basePatella.y)
  return c.puntDe(c.aLaPell(k.basePatella.clone().lerp(k.espinaIliaca, t)))
}

/** Cama: a `cun` per sota del genoll, a un través de dit lateral de la cresta de la tíbia. */
function cama(c: CosMesurable, r: Referencies, costat: Costat, cunSotaGenoll: number, lateral = 0.22): Vector3 {
  const k = r[costat]
  const origen = k.genoll.clone().addScaledVector(k.eixCama, (cunSotaGenoll * r.cun.cama) / -k.eixCama.y)
  return c.pell(origen, dir([k.anteriorGenoll, 1], [k.lateral, lateral]))
}

const ST: DefinicioPunt[] = [
  {
    codi: 'ST1',
    regla: { tipus: 'referencia', descripcio: 'sota la pupil·la, entre el globus ocular i la vora infraorbitària' },
    calcular: (c, r, k) => c.pellDesDeFora(r[k].ull.clone().add(v(0, -0.017, 0)), DAVANT),
  },
  {
    codi: 'ST2',
    regla: { tipus: 'referencia', descripcio: 'forat infraorbitari, sota la pupil·la' },
    calcular: (c, r, k) => c.pellDesDeFora(r[k].ull.clone().add(v(0, -0.027, 0)), DAVANT),
  },
  {
    codi: 'ST3',
    regla: { tipus: 'referencia', descripcio: 'sota la pupil·la, a l\'alçada de la vora inferior de l\'ala del nas' },
    calcular: (c, r, k) => cara(c, r, k, Math.abs(r[k].ull.x), r.nivellBaseNas),
  },
  {
    codi: 'ST4',
    regla: { tipus: 'referencia', descripcio: '0,4 cun lateral a la comissura de la boca' },
    calcular: (c, r, k) => cara(c, r, k, 0.8 * Math.abs(r[k].ull.x) + 0.4 * r.cun.cap, r.nivellBoca),
  },
  {
    codi: 'ST5',
    regla: { tipus: 'referencia', descripcio: 'davant de l\'angle de la mandíbula, vora anterior del masseter' },
    calcular: (c, r, k) => cap(c, r, k, r.nivellBoca - 0.02, 50),
  },
  {
    codi: 'ST6',
    regla: { tipus: 'referencia', descripcio: 'un través de dit per sobre i per davant de l\'angle de la mandíbula' },
    calcular: (c, r, k) => cap(c, r, k, r.nivellBoca - 0.002, 66),
  },
  {
    codi: 'ST7',
    regla: { tipus: 'referencia', descripcio: 'depressió entre l\'arc zigomàtic i l\'escotadura de la mandíbula' },
    calcular: (c, r, k) => cap(c, r, k, r[k].ull.y - 0.028, 78),
  },
  {
    codi: 'ST8',
    regla: { tipus: 'referencia', descripcio: '0,5 cun dins la línia del cabell, 4,5 cun lateral a la línia mitja' },
    calcular: (c, r, k) => arcFront(c, r, k, r.nivellST8, 4.5 * r.cun.cap),
  },
  {
    codi: 'ST9',
    regla: { tipus: 'nivell', com: 'LI18' },
    calcular: (c, r, k) => coll(c, r, k, r.nivellTiroide, 35),
  },
  {
    codi: 'ST10',
    regla: { tipus: 'nivell', com: 'LI17' },
    calcular: (c, r, k) => coll(c, r, k, r.nivellCricoide, 38),
  },
  {
    codi: 'ST11',
    regla: { tipus: 'referencia', descripcio: 'sobre l\'extrem esternal de la clavícula, entre els caps de l\'ECM' },
    calcular: (c, r, k) => c.pell(v(signe(k) * 0.018, r.fossaSupraesternal.y + 0.012, 0), dir([DAVANT, 1], [AMUNT, 0.2])),
  },
  {
    codi: 'ST12',
    regla: { tipus: 'referencia', descripcio: 'fossa supraclavicular, 4 cun lateral a la línia mitja' },
    calcular: (c, r, k) => pit(c, r, k, r[k].clavicula.y + 0.028, 0.35),
  },
  {
    codi: 'ST13',
    regla: { tipus: 'referencia', descripcio: 'sota la clavícula, 4 cun lateral a la línia mitja' },
    calcular: (c, r, k) => pit(c, r, k, r[k].clavicula.y),
  },
  ...([
    ['ST14', 0.4],
    ['ST15', 1.4],
    ['ST16', 2.4],
  ] as const).map(
    ([codi, espais]): DefinicioPunt => ({
      codi,
      regla: { tipus: 'referencia', descripcio: `${codi === 'ST14' ? '1r' : codi === 'ST15' ? '2n' : '3r'} espai intercostal, 4 cun lateral` },
      calcular: (c, r, k) => pit(c, r, k, r[k].clavicula.y - espais * r[k].espaiIntercostal),
    }),
  ),
  {
    codi: 'ST17',
    regla: { tipus: 'referencia', descripcio: 'centre del mugró (4t espai intercostal)' },
    calcular: (_c, r, k) => r[k].mugro.clone(),
  },
  {
    codi: 'ST18',
    regla: { tipus: 'referencia', descripcio: '5è espai intercostal, 4 cun lateral' },
    calcular: (c, r, k) => pit(c, r, k, r[k].mugro.y - r[k].espaiIntercostal),
  },
  ...([
    ['ST19', 6],
    ['ST20', 5],
    ['ST21', 4],
    ['ST22', 3],
    ['ST23', 2],
    ['ST24', 1],
    ['ST25', 0],
  ] as const).map(
    ([codi, cun]): DefinicioPunt => ({
      codi,
      regla: { tipus: 'vertical', ref: 'melic', cun, unitat: 'abdomenSuperior', lateral: 2 },
      calcular: (c, r, k) => abdomen(c, r, k, cun, 'abdomenSuperior'),
    }),
  ),
  ...([
    ['ST26', -1],
    ['ST27', -2],
    ['ST28', -3],
    ['ST29', -4],
    ['ST30', -5],
  ] as const).map(
    ([codi, cun]): DefinicioPunt => ({
      codi,
      regla: { tipus: 'vertical', ref: 'melic', cun, unitat: 'abdomenInferior', lateral: 2 },
      calcular: (c, r, k) => abdomen(c, r, k, cun, 'abdomenInferior'),
    }),
  ),
  {
    codi: 'ST31',
    regla: { tipus: 'referencia', descripcio: 'línia espina ilíaca – ròtula, a l\'alçada de la vora inferior de la símfisi' },
    calcular: (c, r, k) => {
      const q = r[k]
      const y = r.simfisi.y - 0.035
      const t = (y - q.basePatella.y) / (q.espinaIliaca.y - q.basePatella.y)
      return c.puntDe(c.aLaPell(q.basePatella.clone().lerp(q.espinaIliaca, t)))
    },
  },
  ...([
    ['ST32', 6],
    ['ST33', 3],
    ['ST34', 2],
  ] as const).map(
    ([codi, cun]): DefinicioPunt => ({
      codi,
      regla: { tipus: 'vertical', ref: 'basePatella', cun, unitat: 'cuixa' },
      calcular: (c, r, k) => cuixa(c, r, k, cun),
    }),
  ),
  {
    codi: 'ST35',
    regla: { tipus: 'referencia', descripcio: 'genoll, depressió lateral al lligament rotulià' },
    calcular: (c, r, k) => c.pell(r[k].genoll.clone().addScaledVector(r[k].eixCama, 0.012), dir([r[k].anteriorGenoll, 1], [r[k].lateral, 0.35])),
  },
  ...([
    ['ST36', 3],
    ['ST37', 6],
    ['ST38', 8],
    ['ST39', 9],
  ] as const).map(
    ([codi, cun]): DefinicioPunt => ({
      codi,
      regla: { tipus: 'segment', de: 'ST35', a: 'ST41', cun, total: 16 },
      calcular: (c, r, k) => cama(c, r, k, cun),
    }),
  ),
  {
    codi: 'ST40',
    regla: { tipus: 'nivell', com: 'ST38' },
    calcular: (c, r, k) => cama(c, r, k, 8, 0.6),
  },
  {
    codi: 'ST41',
    regla: { tipus: 'referencia', descripcio: 'centre de la cara anterior del turmell, entre els tendons extensors' },
    calcular: (c, r, k) => c.pell(r[k].turmell.clone().add(v(0, -0.004, 0)), dir([DAVANT, 1], [AMUNT, 0.25])),
  },
  {
    codi: 'ST42',
    regla: { tipus: 'referencia', descripcio: 'dors del peu, base del 2n metatarsià' },
    calcular: (c, r, k) => {
      const origen = r[k].turmell.clone().lerp(c.art('toe-2-1', k), 0.62).add(v(0, -0.012, 0))
      return c.pell(origen, AMUNT)
    },
  },
  {
    codi: 'ST43',
    regla: { tipus: 'referencia', descripcio: 'entre el 2n i el 3r metatarsià, proximal a la 2a articulació metatarsofalàngica' },
    calcular: (c, r, k) => {
      const mtp = c.art('toe-2-1', k).lerp(c.art('toe-3-1', k), 0.5)
      const eixPeu = mtp.clone().sub(r[k].turmell).setY(0).normalize()
      return c.pell(mtp.addScaledVector(eixPeu, -0.02).add(v(0, -0.008, 0)), AMUNT)
    },
  },
  {
    codi: 'ST44',
    regla: { tipus: 'referencia', descripcio: 'entre el 2n i el 3r dit, just per darrere del marge interdigital' },
    calcular: (c, _r, k) => {
      const mtp = c.art('toe-2-1', k).lerp(c.art('toe-3-1', k), 0.5)
      const pip = c.art('toe-2-2', k).lerp(c.art('toe-3-2', k), 0.5)
      const eixPeu = pip.clone().sub(mtp).normalize()
      // Des de dins del peu, just abans d'on se separen els dits
      return c.pell(mtp.lerp(pip, 0.15).add(v(0, -0.008, 0)), dir([AMUNT, 1], [eixPeu, 0.5]))
    },
  },
  {
    codi: 'ST45',
    regla: { tipus: 'referencia', descripcio: 'costat lateral de la falange distal del 2n dit, vora de l\'ungla' },
    calcular: (c, _r, k) =>
      c.pell(c.art('toe-2-3', k).lerp(c.art('toe-2-4', k), 0.45), dir([v(signe(k), 0, 0), 1], [AMUNT, 0.6])),
  },
]

export const REGLES: readonly DefinicioPunt[] = [...LI, ...ST]
