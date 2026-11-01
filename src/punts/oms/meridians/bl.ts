// Bufeta (BL). Cap: sobre l'arc de la línia mitja (glabel·la–vèrtex 8 cun;
// línia anterior del cabell a 3 cun; posterior a 15 cun). Esquena: línia
// interna a 1,5 cun i externa a 3 cun de la línia mitja, a l'alçada de les
// vertebres. Cuixa posterior: del plec gluti al popliti, 14 cun. Cama: del
// plec popliti al mal·lèol extern, 16 cun.

import { AMUNT, DARRERE, DAVANT, dir, signe, v, type Costat, type CosMesurable } from '../cos'
import {
  camaMalleol,
  camaPopliti,
  capArc,
  capLiniaCabell,
  cara,
  cunCuixaPosterior,
  esquena,
  nivellVertebra,
  pellLinia,
} from '../eines'
import type { Referencies } from '../referencies'
import type { DefinicioPunt, Ordre } from '../tipus'

const ref = (descripcio: string) => ({ tipus: 'referencia' as const, descripcio })
const lat = (k: Costat) => v(signe(k), 0, 0)

/** Punt de la línia interna (1,5) o externa (3) a l'alçada d'una vertebra */
function linia(codi: string, vertebra: string, lateral: number, sota = true): DefinicioPunt {
  return {
    codi,
    regla: { tipus: 'vertebra', vertebra, sota, lateral },
    calcular: (c, r, k) => esquena(c, r, k, nivellVertebra(r, vertebra, sota), lateral),
  }
}

/** Punt del cap a `dins` cun de la línia anterior del cabell (3 cun de la glabel·la) */
function capCabell(codi: string, dins: number, lateral: number): DefinicioPunt {
  return {
    codi,
    regla: { tipus: 'cap', cun: 3 + dins, lateral },
    calcular: (c, r, k) => (dins === 0.5 ? capLiniaCabell(c, r, k, lateral) : capArc(c, r, k, 3 + dins, lateral)),
  }
}

/** Costat lateral del peu, a la vora entre dors i planta */
function peuLateral(c: CosMesurable, r: Referencies, k: Costat, t: number, avall = 0.01) {
  const origen = r[k].turmell.clone().lerp(c.art('toe-5-1', k), t).add(v(0, -avall, 0))
  return c.pell(origen, dir([lat(k), 1], [AMUNT, -0.2]))
}

export const BL: DefinicioPunt[] = [
  {
    codi: 'BL1',
    regla: ref('per sobre i per dins del cantó intern de l\'ull'),
    calcular: (c, r, k) => {
      const ci = r[k].cantIntern
      return c.pellDesDeFora(v(ci.x - signe(k) * 0.003, ci.y + 0.003, ci.z), dir([DAVANT, 1], [lat(k), -0.4]), 0.2)
    },
  },
  {
    codi: 'BL2',
    regla: ref('extrem intern de la cella'),
    calcular: (c, r, k) => cara(c, r, k, Math.abs(r[k].cantIntern.x), r[k].cantIntern.y + 0.018),
  },
  {
    codi: 'BL3',
    regla: { tipus: 'cap', cun: 3.5, lateral: 1 },
    calcular: (c, r, k) => capArc(c, r, k, 3.5, Math.abs(r[k].cantIntern.x) / r.cun.cap),
  },
  capCabell('BL4', 0.5, 1.5),
  capCabell('BL5', 1, 1.5),
  capCabell('BL6', 2.5, 1.5),
  capCabell('BL7', 4, 1.5),
  capCabell('BL8', 5.5, 1.5),
  { codi: 'BL9', regla: { tipus: 'cap', cun: 12.5, lateral: 1.3 }, calcular: (c, r, k) => capArc(c, r, k, 12.5, 1.3) },
  { codi: 'BL10', regla: { tipus: 'cap', cun: 14.5, lateral: 1.3 }, calcular: (c, r, k) => capArc(c, r, k, 14.5, 1.3) },
  linia('BL11', 'T1', 1.5),
  linia('BL12', 'T2', 1.5),
  linia('BL13', 'T3', 1.5),
  linia('BL14', 'T4', 1.5),
  linia('BL15', 'T5', 1.5),
  linia('BL16', 'T6', 1.5),
  linia('BL17', 'T7', 1.5),
  linia('BL18', 'T9', 1.5),
  linia('BL19', 'T10', 1.5),
  linia('BL20', 'T11', 1.5),
  linia('BL21', 'T12', 1.5),
  linia('BL22', 'L1', 1.5),
  linia('BL23', 'L2', 1.5),
  linia('BL24', 'L3', 1.5),
  linia('BL25', 'L4', 1.5),
  linia('BL26', 'L5', 1.5),
  linia('BL27', 'S1', 1.5, false),
  linia('BL28', 'S2', 1.5, false),
  linia('BL29', 'S3', 1.5, false),
  linia('BL30', 'S4', 1.5, false),
  // Forats sacres posteriors: convergeixen cap avall
  linia('BL31', 'S1', 0.95, false),
  linia('BL32', 'S2', 0.85, false),
  linia('BL33', 'S3', 0.75, false),
  linia('BL34', 'S4', 0.65, false),
  {
    codi: 'BL35',
    regla: ref('0,5 cun lateral a la punta del còccix'),
    calcular: (c, r, k) => esquena(c, r, k, r.vertebres.coccix!, 0.5),
  },
  { codi: 'BL36', regla: ref('punt mitjà del plec gluti'), calcular: (_c, r, k) => r[k].plecGluti.clone() },
  { codi: 'BL40', regla: ref('punt mitjà del plec popliti'), calcular: (_c, r, k) => r[k].plecPopliti.clone() },
  {
    codi: 'BL37',
    regla: { tipus: 'segment', de: 'BL36', a: 'BL40', cun: 6, total: 14 },
    calcular: (c, _r, _k, p) => pellLinia(c, p('BL36'), p('BL40'), 6 / 14),
  },
  {
    codi: 'BL39',
    regla: ref('extrem lateral del plec popliti, medial al tendó del bíceps femoral'),
    calcular: (c, r, k) => c.pell(r[k].genoll, dir([r[k].posteriorGenoll, 1], [r[k].lateral, 0.6])),
  },
  {
    codi: 'BL38',
    regla: ref('1 cun per sobre de BL39'),
    calcular: (c, r, k) =>
      c.pell(r[k].genoll.clone().addScaledVector(r[k].eixCuixa, -cunCuixaPosterior(r, k)), dir([r[k].posteriorGenoll, 1], [r[k].lateral, 0.55])),
  },
  ...([
    ['BL41', 'T2'],
    ['BL42', 'T3'],
    ['BL43', 'T4'],
    ['BL44', 'T5'],
    ['BL45', 'T6'],
    ['BL46', 'T7'],
    ['BL47', 'T9'],
    ['BL48', 'T10'],
    ['BL49', 'T11'],
    ['BL50', 'T12'],
    ['BL51', 'L1'],
    ['BL52', 'L2'],
  ] as const).map(([codi, vert]) => linia(codi, vert, 3)),
  linia('BL53', 'S2', 3, false),
  linia('BL54', 'S4', 3, false),
  {
    codi: 'BL55',
    regla: { tipus: 'vertical', ref: 'plecPopliti', cun: -2, unitat: 'cama' },
    calcular: (c, r, k) => camaPopliti(c, r, k, 2, (q) => q.posteriorGenoll.clone()),
  },
  {
    codi: 'BL56',
    regla: { tipus: 'vertical', ref: 'plecPopliti', cun: -5, unitat: 'cama' },
    calcular: (c, r, k) => camaPopliti(c, r, k, 5, (q) => q.posteriorGenoll.clone()),
  },
  {
    codi: 'BL57',
    regla: { tipus: 'vertical', ref: 'plecPopliti', cun: -8, unitat: 'cama' },
    calcular: (c, r, k) => camaPopliti(c, r, k, 8, (q) => q.posteriorGenoll.clone()),
  },
  {
    codi: 'BL58',
    regla: { tipus: 'vertical', ref: 'malleolExtern', cun: 7, unitat: 'cama' },
    calcular: (c, r, k) => camaMalleol(c, r, k, 7, 'extern', (q) => dir([q.posteriorGenoll, 1], [q.lateral, 0.55])),
  },
  {
    codi: 'BL59',
    regla: { tipus: 'vertical', ref: 'malleolExtern', cun: 3, unitat: 'cama' },
    calcular: (c, r, k) => camaMalleol(c, r, k, 3, 'extern', (q) => dir([q.posteriorGenoll, 0.8], [q.lateral, 1])),
  },
  {
    codi: 'BL60',
    regla: ref('entre la punta del mal·lèol extern i el tendó d\'Aquil·les'),
    calcular: (c, r, k) => c.pell(r[k].turmell.clone().add(v(0, -0.004, 0)), dir([lat(k), 0.8], [DARRERE, 1])),
  },
  {
    codi: 'BL61',
    regla: ref('sota BL60, vora lateral del calcani'),
    calcular: (c, r, k) => c.pell(r[k].turmell.clone().add(v(0, -0.032, -0.02)), lat(k)),
  },
  {
    codi: 'BL62',
    regla: ref('just a sota de la punta del mal·lèol extern'),
    calcular: (c, r, k) => c.pell(r[k].turmell.clone().add(v(0, -0.022, 0)), lat(k)),
  },
  { codi: 'BL63', regla: ref('davant i per sota de BL62, sota el cuboide'), calcular: (c, r, k) => peuLateral(c, r, k, 0.3, 0.035) },
  { codi: 'BL64', regla: ref('davant de la tuberositat del 5è metatarsià'), calcular: (c, r, k) => peuLateral(c, r, k, 0.55, 0.03) },
  {
    codi: 'BL65',
    regla: ref('darrere de la 5a articulació metatarsofalàngica'),
    calcular: (c, r, k) => peuLateral(c, r, k, 0.88, 0.012),
  },
  {
    codi: 'BL66',
    regla: ref('davant de la 5a articulació metatarsofalàngica'),
    calcular: (c, _r, k) => c.pell(c.art('toe-5-1', k).lerp(c.art('toe-5-2', k), 0.35), lat(k)),
  },
  {
    codi: 'BL67',
    regla: ref('dit petit del peu, costat lateral, vora de l\'ungla'),
    calcular: (c, _r, k) => c.pell(c.art('toe-5-3', k).lerp(c.art('toe-5-4', k), 0.45), dir([lat(k), 1], [AMUNT, 0.6])),
  },
]

export const ORDRE_BL: Ordre[] = [
  { codis: ['BL11', 'BL12', 'BL13', 'BL14', 'BL15', 'BL16', 'BL17', 'BL18', 'BL19', 'BL20', 'BL21', 'BL22', 'BL23', 'BL24', 'BL25', 'BL26', 'BL27', 'BL28', 'BL29', 'BL30'], criteri: 'baixa' },
  { codis: ['BL31', 'BL32', 'BL33', 'BL34', 'BL35'], criteri: 'baixa' },
  { codis: ['BL41', 'BL42', 'BL43', 'BL44', 'BL45', 'BL46', 'BL47', 'BL48', 'BL49', 'BL50', 'BL51', 'BL52', 'BL53', 'BL54'], criteri: 'baixa' },
  { codis: ['BL36', 'BL37', 'BL38', 'BL40', 'BL55', 'BL56', 'BL57', 'BL58', 'BL59', 'BL60'], criteri: 'baixa' },
  { codis: ['BL4', 'BL5', 'BL6', 'BL7', 'BL8', 'BL9', 'BL10'], criteri: 'allunya' },
  { codis: ['BL62', 'BL63', 'BL64', 'BL65', 'BL66', 'BL67'], criteri: 'allunya' },
]
