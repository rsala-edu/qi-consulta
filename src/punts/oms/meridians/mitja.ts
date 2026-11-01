// Meridians de la línia mitja: CV (Ren Mai) i GV (Du Mai). Una sola posició
// per punt (costat «C»).

import { DARRERE, DAVANT, dir, v } from '../cos'
import { abdomenX, capArc, espaiIntercostal, nivellVertebra } from '../eines'
import type { DefinicioPunt, Ordre } from '../tipus'

const ref = (descripcio: string) => ({ tipus: 'referencia' as const, descripcio })

// --- Vas de la concepció (CV) ------------------------------------------------------

const abdomen = (codi: string, cun: number): DefinicioPunt => ({
  codi,
  mitja: true,
  regla: { tipus: 'vertical', ref: 'melic', cun, unitat: cun < 0 ? 'abdomenInferior' : 'abdomenSuperior', lateral: 0 },
  calcular: (c, r, k) => abdomenX(c, r, k, cun, 0),
})

const torax = (codi: string, y: (r: Parameters<DefinicioPunt['calcular']>[1]) => number): DefinicioPunt => ({
  codi,
  mitja: true,
  regla: ref('línia mitja del tòrax'),
  calcular: (c, r) => c.pell(v(0, y(r), -0.02), DAVANT),
})

export const CV: DefinicioPunt[] = [
  {
    codi: 'CV1',
    mitja: true,
    regla: ref('perineu, entre l\'anus i els genitals'),
    calcular: (c, r) => c.pell(v(0, r.simfisi.y - 0.04, -0.03), v(0, -1, 0)),
  },
  abdomen('CV2', -5),
  abdomen('CV3', -4),
  abdomen('CV4', -3),
  abdomen('CV5', -2),
  abdomen('CV6', -1.5),
  abdomen('CV7', -1),
  { codi: 'CV8', mitja: true, regla: ref('centre del melic'), calcular: (_c, r) => r.melic.clone() },
  abdomen('CV9', 1),
  abdomen('CV10', 2),
  abdomen('CV11', 3),
  abdomen('CV12', 4),
  abdomen('CV13', 5),
  abdomen('CV14', 6),
  torax('CV15', (r) => r.unioXifoesternal.y - r.cun.abdomenSuperior),
  torax('CV16', (r) => r.unioXifoesternal.y),
  torax('CV17', (r) => espaiIntercostal(r, 'E', 4)),
  torax('CV18', (r) => espaiIntercostal(r, 'E', 3)),
  torax('CV19', (r) => espaiIntercostal(r, 'E', 2)),
  torax('CV20', (r) => espaiIntercostal(r, 'E', 1)),
  torax('CV21', (r) => r.fossaSupraesternal.y - r.cun.pit),
  { codi: 'CV22', mitja: true, regla: ref('centre de la fossa supraesternal'), calcular: (_c, r) => r.fossaSupraesternal.clone() },
  {
    codi: 'CV23',
    mitja: true,
    regla: ref('sobre l\'os hioide, sota el mentó'),
    calcular: (c) => {
      const mento = c.art('jaw')
      return c.pellDesDeFora(v(0, mento.y - 0.012, mento.z - 0.035), dir([v(0, -1, 0), 1], [DAVANT, 0.6]), 0.2)
    },
  },
  {
    codi: 'CV24',
    mitja: true,
    regla: ref('centre del solc mentolabial'),
    calcular: (c, r) => {
      // el punt més enfonsat de la línia mitja entre el llavi inferior i el mentó
      let millor = c.pellDesDeFora(v(0, r.nivellBoca - 0.012, 0), DAVANT)
      for (let y = r.nivellBoca - 0.008; y >= r.nivellBoca - 0.03; y -= 0.001) {
        const p = c.pellDesDeFora(v(0, y, 0), DAVANT)
        if (p.z < millor.z) millor = p
      }
      return millor
    },
  },
]

// --- Vas governador (GV) -----------------------------------------------------------

const espinosa = (codi: string, vertebra: string): DefinicioPunt => ({
  codi,
  mitja: true,
  regla: { tipus: 'vertebra', vertebra, sota: true, lateral: 0 },
  calcular: (c, r) => c.pellDesDeFora(v(0, nivellVertebra(r, vertebra, true), 0), DARRERE, 0.5),
})

const capMig = (codi: string, cun: number): DefinicioPunt => ({
  codi,
  mitja: true,
  regla: { tipus: 'cap', cun, lateral: 0 },
  calcular: (c, r, k) => capArc(c, r, k, cun, 0),
})

export const GV: DefinicioPunt[] = [
  {
    codi: 'GV1',
    mitja: true,
    regla: ref('sota la punta del còccix'),
    calcular: (c, r) => c.pellDesDeFora(v(0, r.vertebres.coccix! - 0.015, -0.03), dir([DARRERE, 1], [v(0, -1, 0), 0.5]), 0.3),
  },
  {
    codi: 'GV2',
    mitja: true,
    regla: ref('hiat sacre'),
    calcular: (c, r) => c.pellDesDeFora(v(0, r.vertebres.S4! - 0.006, 0), DARRERE, 0.5),
  },
  espinosa('GV3', 'L4'),
  espinosa('GV4', 'L2'),
  espinosa('GV5', 'L1'),
  espinosa('GV6', 'T11'),
  espinosa('GV7', 'T10'),
  espinosa('GV8', 'T9'),
  espinosa('GV9', 'T7'),
  espinosa('GV10', 'T6'),
  espinosa('GV11', 'T5'),
  espinosa('GV12', 'T3'),
  espinosa('GV13', 'T1'),
  espinosa('GV14', 'C7'),
  capMig('GV15', 14.5),
  capMig('GV16', 14),
  capMig('GV17', 12.5),
  capMig('GV18', 11),
  capMig('GV19', 9.5),
  capMig('GV20', 8),
  capMig('GV21', 6.5),
  capMig('GV22', 5),
  capMig('GV23', 4),
  capMig('GV24', 3.5),
  { codi: 'GV25', mitja: true, regla: ref('punta del nas'), calcular: (_c, r) => r.nas.clone() },
  {
    codi: 'GV26',
    mitja: true,
    regla: ref('filtre, a 1/3 de la base del nas al llavi'),
    calcular: (c, r) => c.pellDesDeFora(v(0, r.nivellBaseNas - (r.nivellBaseNas - (r.nivellBoca + 0.007)) / 3, 0), DAVANT),
  },
  {
    codi: 'GV27',
    mitja: true,
    regla: ref('tubercle del llavi superior'),
    calcular: (c, r) => c.pellDesDeFora(v(0, r.nivellBoca + 0.006, 0), DAVANT),
  },
  {
    codi: 'GV28',
    mitja: true,
    regla: ref('dins la boca, fre del llavi superior'),
    // El punt real és dins la boca; al mapa es marca a la vora del llavi
    // superior (si fos a la cara interna, es veuria a través del cap)
    calcular: (c, r) => c.pellDesDeFora(v(0, r.nivellBoca + 0.002, 0), DAVANT),
  },
]

export const ORDRE_MITJA: Ordre[] = [
  { codis: ['CV22', 'CV21', 'CV20', 'CV19', 'CV18', 'CV17', 'CV16', 'CV15', 'CV14', 'CV13', 'CV12', 'CV11', 'CV10', 'CV9', 'CV8', 'CV7', 'CV6', 'CV5', 'CV4', 'CV3', 'CV2'], criteri: 'baixa' },
  { codis: ['GV14', 'GV13', 'GV12', 'GV11', 'GV10', 'GV9', 'GV8', 'GV7', 'GV6', 'GV5', 'GV4', 'GV3', 'GV2', 'GV1'], criteri: 'baixa' },
  { codis: ['GV24', 'GV23', 'GV22', 'GV21', 'GV20'], criteri: 'puja' },
  { codis: ['GV25', 'GV26', 'GV27', 'GV28'], criteri: 'baixa' },
  { codis: ['GV19', 'GV18', 'GV17', 'GV16', 'GV15', 'GV14'], criteri: 'baixa' },
]
