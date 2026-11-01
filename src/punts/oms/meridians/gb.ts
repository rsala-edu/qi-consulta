// Vesícula biliar (GB). Cuixa lateral: del trocànter al plec popliti, 19 cun.
// Cama lateral: del plec popliti al mal·lèol extern, 16 cun.

import { AMUNT, DAVANT, dir, signe, v, type Costat } from '../cos'
import {
  abdomenX,
  capArc,
  capDesDeDins,
  capInterpolat,
  capLateral,
  camaMalleol,
  cara,
  cuixaDir,
  cunCuixaLateral,
  espaiIntercostal,
  esquena,
  nivellVertebra,
  pellLinia,
  pitX,
  troncLateral,
} from '../eines'
import type { DefinicioPunt, Ordre } from '../tipus'

const ref = (descripcio: string) => ({ tipus: 'referencia' as const, descripcio })
const lat = (k: Costat) => v(signe(k), 0, 0)

function capCabell(codi: string, dins: number, lateral: number): DefinicioPunt {
  return { codi, regla: { tipus: 'cap', cun: 3 + dins, lateral }, calcular: (c, r, k) => capArc(c, r, k, 3 + dins, lateral) }
}

/** Distància lateral de la pupil·la mesurada en cun del cap (sobre la pell, aproximada) */
const PUPILLA = 2.25

export const GB: DefinicioPunt[] = [
  {
    codi: 'GB1',
    regla: ref('0,5 cun lateral al cantó extern de l\'ull'),
    calcular: (c, r, k) => {
      const ce = r[k].cantExtern
      return c.pellDesDeFora(v(ce.x + signe(k) * 0.5 * r.cun.cap, ce.y, ce.z - 0.01), dir([lat(k), 0.6], [DAVANT, 1]), 0.2)
    },
  },
  {
    codi: 'GB2',
    regla: ref('davant de l\'escotadura intertràgica'),
    calcular: (c, r, k) => {
      const t = r[k].tragus
      return c.pellDesDeFora(v(t.x, t.y - 0.012, t.z + 0.008), lat(k), 0.2)
    },
  },
  {
    codi: 'GB3',
    regla: ref('sobre el punt mitjà de l\'arc zigomàtic, sobre ST7'),
    calcular: (c, _r, k, p) => {
      const st7 = p('ST7')
      return c.pellDesDeFora(v(st7.x, st7.y + 0.015, st7.z), lat(k), 0.2)
    },
  },
  {
    codi: 'GB7',
    regla: ref('horitzontal de la punta de l\'orella, vora posterior del cabell de la templa'),
    calcular: (c, r, k) => capLateral(c, k, r[k].orellaApex.y, r[k].tragus.z + 0.01),
  },
  ...([
    ['GB4', 0.25],
    ['GB5', 0.5],
    ['GB6', 0.75],
  ] as const).map(
    ([codi, t]): DefinicioPunt => ({
      codi,
      regla: ref(`templa, a ${t * 100} % de la corba de ST8 a GB7`),
      calcular: (c, r, k, p) => capInterpolat(c, r, k, p('ST8'), p('GB7'), t),
    }),
  ),
  {
    codi: 'GB8',
    regla: ref('sobre la punta de l\'orella, 1,5 cun dins la línia del cabell'),
    calcular: (c, r, k, p) => {
      const te20 = p('TE20')
      return capLateral(c, k, te20.y + 1.5 * r.cun.cap, r[k].orellaApex.z)
    },
  },
  {
    codi: 'GB9',
    regla: ref('sobre la vora posterior de l\'orella, 2 cun dins la línia del cabell'),
    calcular: (c, r, k, p) => {
      const te20 = p('TE20')
      return capLateral(c, k, te20.y + 2 * r.cun.cap, r[k].orellaApex.z - 0.5 * r.cun.cap)
    },
  },
  {
    codi: 'GB12',
    regla: ref('darrere i sota l\'apòfisi mastoide'),
    calcular: (c, r, k) => capDesDeDins(c, r, k, r[k].orellaLobul.y - 0.006, 118),
  },
  { codi: 'GB10', regla: ref('a 1/3 de la corba de GB9 a GB12'), calcular: (c, r, k, p) => capInterpolat(c, r, k, p('GB9'), p('GB12'), 1 / 3) },
  { codi: 'GB11', regla: ref('a 2/3 de la corba de GB9 a GB12'), calcular: (c, r, k, p) => capInterpolat(c, r, k, p('GB9'), p('GB12'), 2 / 3) },
  capCabell('GB13', 0.5, 3),
  {
    codi: 'GB14',
    regla: ref('1 cun per sobre de la cella, sobre la pupil·la'),
    calcular: (c, r, k) => cara(c, r, k, Math.abs(r[k].ull.x), r.nivellCellaSuperior + r.cun.cap),
  },
  capCabell('GB15', 0.5, PUPILLA),
  capCabell('GB16', 1.5, PUPILLA),
  capCabell('GB17', 2.5, PUPILLA),
  capCabell('GB18', 4, PUPILLA),
  { codi: 'GB19', regla: { tipus: 'cap', cun: 12.5, lateral: 2.25 }, calcular: (c, r, k) => capArc(c, r, k, 12.5, 2.25) },
  { codi: 'GB20', regla: { tipus: 'cap', cun: 14, lateral: 2.2 }, calcular: (c, r, k) => capArc(c, r, k, 14, 2.2) },
  {
    codi: 'GB21',
    regla: ref('punt mitjà entre C7 i l\'extrem de l\'acromi'),
    calcular: (c, r, k) => {
      const c7 = esquena(c, r, k, nivellVertebra(r, 'C7', false), 0)
      const mig = c7.lerp(r[k].acromi, 0.5)
      return c.pellDesDeFora(v(mig.x, mig.y, mig.z + 0.01), AMUNT, 0.3)
    },
  },
  {
    codi: 'GB22',
    regla: ref('quart espai intercostal, línia axil·lar mitjana'),
    calcular: (c, r, k) => troncLateral(c, k, espaiIntercostal(r, k, 4), 90),
  },
  {
    codi: 'GB23',
    regla: { tipus: 'nivell', com: 'GB22' },
    calcular: (c, r, k) => troncLateral(c, k, espaiIntercostal(r, k, 4), 68),
  },
  { codi: 'GB24', regla: ref('setè espai intercostal, 4 cun lateral'), calcular: (c, r, k) => pitX(c, r, k, 4, espaiIntercostal(r, k, 7)) },
  {
    codi: 'GB25',
    regla: ref('sota l\'extrem lliure de la dotzena costella'),
    calcular: (c, r, k) => troncLateral(c, k, nivellVertebra(r, 'L2', false), 112),
  },
  {
    codi: 'GB26',
    regla: { tipus: 'vertical', ref: 'melic', cun: 0, unitat: 'abdomenSuperior' },
    calcular: (c, r, k) => troncLateral(c, k, r.melic.y, 90),
  },
  {
    codi: 'GB27',
    regla: ref('davant de l\'espina ilíaca anterosuperior, 3 cun sota el melic'),
    calcular: (c, r, k) => abdomenX(c, r, k, -3, (Math.abs(r[k].espinaIliaca.x) - 0.006) / r.cun.pit),
  },
  {
    codi: 'GB28',
    regla: ref('0,5 cun davant i per sota de GB27'),
    calcular: (c, r, k) => abdomenX(c, r, k, -3.5, (Math.abs(r[k].espinaIliaca.x) - 0.016) / r.cun.pit),
  },
  {
    codi: 'GB29',
    regla: ref('punt mitjà entre l\'espina ilíaca anterosuperior i el trocànter major'),
    calcular: (c, r, k) => pellLinia(c, r[k].espinaIliaca, r[k].trocanter, 0.5),
  },
  {
    codi: 'GB30',
    regla: ref('a 1/3 de la línia trocànter – hiat sacre, des del trocànter'),
    calcular: (c, r, k) => pellLinia(c, r[k].trocanter, esquena(c, r, k, r.vertebres.S4!, 0), 1 / 3),
  },
  {
    codi: 'GB31',
    regla: ref('cara lateral de la cuixa, 9 cun sobre el plec popliti'),
    calcular: (c, r, k) =>
      cuixaDir(c, r, k, (r[k].plecPopliti.y + 9 * cunCuixaLateral(r, k) - r[k].genoll.y) / r.cun.cuixa, r.cun.cuixa, (q) => dir([q.lateral, 1], [q.posteriorGenoll, 0.25])),
  },
  {
    codi: 'GB32',
    regla: ref('cara lateral de la cuixa, 7 cun sobre el plec popliti'),
    calcular: (c, r, k) =>
      cuixaDir(c, r, k, (r[k].plecPopliti.y + 7 * cunCuixaLateral(r, k) - r[k].genoll.y) / r.cun.cuixa, r.cun.cuixa, (q) => dir([q.lateral, 1], [q.posteriorGenoll, 0.25])),
  },
  {
    codi: 'GB33',
    regla: ref('sobre l\'epicòndil lateral del fèmur'),
    calcular: (c, r, k) => c.pell(r[k].genoll.clone().addScaledVector(r[k].eixCuixa, -0.03), dir([r[k].lateral, 1], [r[k].posteriorGenoll, 0.3])),
  },
  {
    codi: 'GB34',
    regla: ref('davant i per sota del cap del peroné'),
    calcular: (c, r, k) => c.pell(r[k].genoll.clone().addScaledVector(r[k].eixCama, 0.065), dir([r[k].lateral, 1], [r[k].anteriorGenoll, 0.55])),
  },
  {
    codi: 'GB35',
    regla: { tipus: 'vertical', ref: 'malleolExtern', cun: 7, unitat: 'cama' },
    calcular: (c, r, k) => camaMalleol(c, r, k, 7, 'extern', (q) => dir([q.lateral, 1], [q.posteriorGenoll, 0.5])),
  },
  {
    codi: 'GB36',
    regla: { tipus: 'nivell', com: 'GB35' },
    calcular: (c, r, k) => camaMalleol(c, r, k, 7, 'extern', (q) => dir([q.lateral, 1], [q.anteriorGenoll, 0.3])),
  },
  ...([
    ['GB37', 5],
    ['GB38', 4],
    ['GB39', 3],
  ] as const).map(
    ([codi, cun]): DefinicioPunt => ({
      codi,
      regla: { tipus: 'vertical', ref: 'malleolExtern', cun, unitat: 'cama' },
      calcular: (c, r, k) => camaMalleol(c, r, k, cun, 'extern', (q) => dir([q.lateral, 1], [q.anteriorGenoll, 0.3])),
    }),
  ),
  {
    codi: 'GB40',
    regla: ref('davant i per sota del mal·lèol extern'),
    calcular: (c, r, k) => c.pell(r[k].turmell.clone().add(v(0, -0.012, 0.014)), dir([lat(k), 1], [DAVANT, 0.6])),
  },
  {
    codi: 'GB41',
    regla: ref('davant de la unió de les bases del 4t i el 5è metatarsià'),
    calcular: (c, r, k) => c.pell(r[k].turmell.clone().lerp(c.art('toe-4-1', k).lerp(c.art('toe-5-1', k), 0.5), 0.6).add(v(0, -0.012, 0)), AMUNT),
  },
  {
    codi: 'GB42',
    regla: ref('entre el 4t i el 5è metatarsià, proximal a la 4a articulació metatarsofalàngica'),
    calcular: (c, r, k) => c.pell(c.art('toe-4-1', k).lerp(c.art('toe-5-1', k), 0.5).lerp(r[k].turmell, 0.14).add(v(0, -0.008, 0)), AMUNT),
  },
  {
    codi: 'GB43',
    regla: ref('entre el 4t i el 5è dit, darrere del marge interdigital'),
    calcular: (c, _r, k) => {
      const mtp = c.art('toe-4-1', k).lerp(c.art('toe-5-1', k), 0.5)
      const pip = c.art('toe-4-2', k).lerp(c.art('toe-5-2', k), 0.5)
      return c.pell(mtp.clone().lerp(pip, 0.15).add(v(0, -0.007, 0)), dir([AMUNT, 1], [pip.sub(mtp).normalize(), 0.5]))
    },
  },
  {
    codi: 'GB44',
    regla: ref('4t dit del peu, costat lateral, vora de l\'ungla'),
    calcular: (c, _r, k) => c.pell(c.art('toe-4-3', k).lerp(c.art('toe-4-4', k), 0.45), dir([lat(k), 1], [AMUNT, 0.6])),
  },
]

export const ORDRE_GB: Ordre[] = [
  { codis: ['GB13', 'GB15', 'GB16', 'GB17', 'GB18', 'GB19', 'GB20'], criteri: 'allunya' },
  { codis: ['GB22', 'GB24', 'GB25', 'GB27', 'GB29', 'GB31', 'GB32', 'GB33', 'GB34', 'GB36', 'GB37', 'GB38', 'GB39', 'GB40'], criteri: 'baixa' },
  { codis: ['GB40', 'GB41', 'GB42', 'GB43', 'GB44'], criteri: 'allunya' },
  { codis: ['GB8', 'GB7'], criteri: 'baixa' },
]
