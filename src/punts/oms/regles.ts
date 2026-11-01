// Regles de localització dels punts (estàndard de l'OMS, 2008), expressades
// com a càlcul sobre les referències anatòmiques del cos. Cada punt té una
// `regla` declarativa que les proves fan servir per comprovar-lo.


import { AMUNT, DARRERE, DAVANT, dir, signe, v } from './cos'
import {
  abdomen,
  avantbrac,
  brac,
  cama,
  cap,
  cara,
  coll,
  cuixa,
  capLiniaCabell,
  dits,
  pit,
} from './eines'
import type { DefinicioPunt } from './tipus'

export type { DefinicioPunt, Regla } from './tipus'

// --- Intestí gros (LI) -------------------------------------------------------

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

// --- Estómac (ST) -------------------------------------------------------------

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
    regla: { tipus: 'referencia', descripcio: 'davant del tragus, depressió entre l\'arc zigomàtic i l\'escotadura de la mandíbula' },
    calcular: (c, r, k) => {
      // 1 cun davant del tragus, una mica per sota (sota l'arc zigomàtic), entrant des de fora
      const t = r[k].tragus
      return c.pellDesDeFora(v(t.x, t.y - 0.004, t.z + r.cun.cap), v(signe(k), 0, 0), 0.2)
    },
  },
  {
    codi: 'ST8',
    // Angle del front, 0,5 cun dins la línia anterior del cabell i 4,5 cun
    // de la línia mitja: a la mateixa alçada que GV24, GB15 i GB13
    regla: { tipus: 'cap', cun: 3.5, lateral: 4.5 },
    calcular: (c, r, k) => capLiniaCabell(c, r, k, 4.5),
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

import { BL, ORDRE_BL } from './meridians/bl'
import { EX, ORDRE_EX } from './meridians/extraordinaris'
import { GB, ORDRE_GB } from './meridians/gb'
import { CV, GV, ORDRE_MITJA } from './meridians/mitja'
import { HT, LU, ORDRE_SUPERIOR, PC, SI, TE } from './meridians/superior'
import { KI, LR, ORDRE_YIN_CAMA, SP } from './meridians/yin-cama'
import type { Ordre } from './tipus'

/**
 * Totes les regles, en un ordre on cada punt només depèn de punts anteriors
 * (p. ex. GB3 depèn de ST7, GB4–GB6 de ST8 i GB7, GB8 de TE20). Els
 * extraordinaris van al final: es mesuren des de punts dels meridians.
 */
export const REGLES: readonly DefinicioPunt[] = [...LI, ...ST, ...LU, ...SP, ...HT, ...SI, ...BL, ...KI, ...PC, ...TE, ...GB, ...LR, ...CV, ...GV, ...EX]

export const ORDRES: readonly Ordre[] = [...ORDRE_SUPERIOR, ...ORDRE_YIN_CAMA, ...ORDRE_BL, ...ORDRE_GB, ...ORDRE_MITJA, ...ORDRE_EX]
