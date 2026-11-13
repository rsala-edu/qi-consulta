// Catàleg de l'exploració ORL (etapa 3B): s'activa sol quan el motiu és ORL
// (o a mà). Otoscòpia, rinoscòpia, orofaringe, laringe, acumetria,
// audiometria, timpanometria, exploració vestibular i escales.

import type { Grup } from './tipus'
import { o } from './valoracio'

const CAE = [
  o('normal', 'Normal'),
  o('cerumen', 'Tap de cerumen'),
  o('otitisExterna', 'Otitis externa'),
  o('exostosi', 'Exostosis'),
  o('cosEstrany', 'Cos estrany'),
  o('otorrea', 'Otorrea'),
  o('otomicosi', 'Otomicosi'),
]

const MEMBRANA = [
  o('normal', 'Normal'),
  o('retraccio', 'Retracció'),
  o('abombament', 'Abombament'),
  o('hiperemia', 'Hiperèmia'),
  o('liquid', 'Líquid o nivell hidroaeri'),
  o('perforacioCentral', 'Perforació central'),
  o('perforacioMarginal', 'Perforació marginal'),
  o('timpanosclerosi', 'Timpanosclerosi'),
  o('tub', 'Tub de drenatge'),
  o('colesteatoma', 'Colesteatoma'),
  o('noEsVeu', 'No es veu'),
]

const TIMPANOGRAMA = [o('A', 'A'), o('As', 'As'), o('Ad', 'Ad'), o('B', 'B'), o('C', 'C')]
const POSITIU_NEGATIU = [o('negatiu', 'Negatiu'), o('positiu', 'Positiu')]

export const ORL: Grup = {
  id: 'orl',
  ca: 'Exploració ORL',
  seccions: [
    {
      id: 'orl:otoscopia',
      ca: 'Otoscòpia',
      ref: 'orl-clinica',
      camps: [
        { id: 'caeD', ca: 'Orella dreta: conducte auditiu extern', tipus: 'multiple', opcions: CAE },
        { id: 'membranaD', ca: 'Orella dreta: membrana timpànica', tipus: 'multiple', opcions: MEMBRANA },
        { id: 'caeE', ca: 'Orella esquerra: conducte auditiu extern', tipus: 'multiple', opcions: CAE },
        { id: 'membranaE', ca: 'Orella esquerra: membrana timpànica', tipus: 'multiple', opcions: MEMBRANA },
      ],
    },
    {
      id: 'orl:rinoscopia',
      ca: 'Rinoscòpia anterior',
      ref: 'orl-clinica',
      camps: [
        {
          id: 'septe',
          ca: 'Septe',
          tipus: 'simple',
          opcions: [o('centrat', 'Centrat'), o('desviatD', 'Desviat a la dreta'), o('desviatE', 'Desviat a l\'esquerra'), o('espero', 'Esperó'), o('perforat', 'Perforat')],
        },
        {
          id: 'cornets',
          ca: 'Cornets',
          tipus: 'simple',
          opcions: [o('normals', 'Normals'), o('hipertrofiaD', 'Hipertròfia dreta'), o('hipertrofiaE', 'Hipertròfia esquerra'), o('hipertrofiaBilateral', 'Hipertròfia bilateral')],
        },
        {
          id: 'mucosa',
          ca: 'Mucosa',
          tipus: 'multiple',
          opcions: [
            o('normal', 'Normal'),
            o('congestiva', 'Congestiva'),
            o('palidaEdematosa', 'Pàl·lida i edematosa'),
            o('seca', 'Seca o amb crostes'),
            o('secrecioMucosa', 'Secreció mucosa'),
            o('secrecioPurulenta', 'Secreció purulenta'),
          ],
        },
        {
          id: 'polips',
          ca: 'Pòlips',
          tipus: 'simple',
          opcions: [o('no', 'No'), o('dreta', 'Fossa dreta'), o('esquerra', 'Fossa esquerra'), o('bilateral', 'Bilaterals')],
        },
      ],
    },
    {
      id: 'orl:orofaringe',
      ca: 'Orofaringe',
      ref: 'orl-clinica',
      camps: [
        {
          id: 'amigdales',
          ca: 'Amígdales (Brodsky)',
          tipus: 'simple',
          opcions: [o('absents', 'Absents (amigdalectomia)'), o('g1', 'Grau 1'), o('g2', 'Grau 2'), o('g3', 'Grau 3'), o('g4', 'Grau 4')],
        },
        {
          id: 'faringe',
          ca: 'Faringe',
          tipus: 'multiple',
          opcions: [o('normal', 'Normal'), o('hiperemia', 'Hiperèmia'), o('granular', 'Faringe granular'), o('mocPosterior', 'Moc posterior'), o('exsudat', 'Exsudat')],
        },
        { id: 'mallampati', ca: 'Mallampati', tipus: 'simple', opcions: [o('I', 'I'), o('II', 'II'), o('III', 'III'), o('IV', 'IV')] },
      ],
    },
    {
      id: 'orl:laringe',
      ca: 'Laringe',
      ref: 'orl-clinica',
      camps: [
        {
          id: 'metode',
          ca: 'Mètode',
          tipus: 'simple',
          opcions: [o('indirecta', 'Laringoscòpia indirecta'), o('fibroscopia', 'Fibroscòpia'), o('estroboscopia', 'Estroboscòpia')],
        },
        {
          id: 'troballes',
          ca: 'Troballes',
          tipus: 'multiple',
          opcions: [
            o('normal', 'Normal'),
            o('nodols', 'Nòduls'),
            o('polip', 'Pòlip'),
            o('edemaReinke', 'Edema de Reinke'),
            o('reflux', 'Signes de reflux'),
            o('paralisiD', 'Paràlisi de la corda dreta'),
            o('paralisiE', 'Paràlisi de la corda esquerra'),
            o('leucoplasia', 'Leucoplàsia'),
            o('lesioSospitosa', 'Lesió sospitosa'),
          ],
        },
      ],
    },
    {
      id: 'orl:acumetria',
      ca: 'Acumetria',
      ref: 'orl-clinica',
      camps: [
        { id: 'diapaso', ca: 'Diapasó', tipus: 'simple', opcions: [o('512', '512 Hz'), o('256', '256 Hz')] },
        { id: 'rinneD', ca: 'Rinne: orella dreta', tipus: 'simple', opcions: [o('positiu', 'Positiu'), o('negatiu', 'Negatiu')] },
        { id: 'rinneE', ca: 'Rinne: orella esquerra', tipus: 'simple', opcions: [o('positiu', 'Positiu'), o('negatiu', 'Negatiu')] },
        {
          id: 'weber',
          ca: 'Weber',
          tipus: 'simple',
          opcions: [o('centrat', 'Centrat'), o('dreta', 'Lateralitzat a la dreta'), o('esquerra', 'Lateralitzat a l\'esquerra')],
        },
      ],
    },
    {
      id: 'orl:audiometria',
      ca: 'Audiometria tonal',
      ref: 'orl-clinica',
      camps: [
        { id: 'llindars', ca: 'Llindars (dB HL)', tipus: 'especial', component: 'audiograma' },
        {
          id: 'tipus',
          ca: 'Tipus d\'hipoacúsia',
          tipus: 'multiple',
          opcions: [
            o('normal', 'Audició normal'),
            o('neurosensorialD', 'Neurosensorial dreta'),
            o('neurosensorialE', 'Neurosensorial esquerra'),
            o('transmissioD', 'De transmissió dreta'),
            o('transmissioE', 'De transmissió esquerra'),
            o('mixtaD', 'Mixta dreta'),
            o('mixtaE', 'Mixta esquerra'),
          ],
        },
      ],
    },
    {
      id: 'orl:timpanometria',
      ca: 'Timpanometria',
      ref: 'orl-clinica',
      camps: [
        { id: 'tipusD', ca: 'Orella dreta (Jerger)', tipus: 'simple', opcions: TIMPANOGRAMA },
        { id: 'tipusE', ca: 'Orella esquerra (Jerger)', tipus: 'simple', opcions: TIMPANOGRAMA },
        { id: 'reflexosD', ca: 'Reflexos estapedials: dreta', tipus: 'simple', opcions: [o('presents', 'Presents'), o('absents', 'Absents')] },
        { id: 'reflexosE', ca: 'Reflexos estapedials: esquerra', tipus: 'simple', opcions: [o('presents', 'Presents'), o('absents', 'Absents')] },
      ],
    },
    {
      id: 'orl:vestibular',
      ca: 'Exploració vestibular',
      ref: 'orl-clinica',
      camps: [
        {
          id: 'nistagme',
          ca: 'Nistagme',
          tipus: 'multiple',
          opcions: [
            o('cap', 'Sense nistagme'),
            o('espontani', 'Espontani'),
            o('evocatMirada', 'Evocat per la mirada'),
            o('horitzontal', 'Horitzontal'),
            o('vertical', 'Vertical'),
            o('torsional', 'Torsional'),
            o('capDreta', 'Cap a la dreta'),
            o('capEsquerra', 'Cap a l\'esquerra'),
          ],
        },
        {
          id: 'romberg',
          ca: 'Romberg',
          tipus: 'simple',
          opcions: [o('negatiu', 'Negatiu'), o('dreta', 'Positiu, cau a la dreta'), o('esquerra', 'Positiu, cau a l\'esquerra'), o('inespecific', 'Positiu, inespecífic')],
        },
        {
          id: 'unterberger',
          ca: 'Unterberger',
          tipus: 'simple',
          opcions: [o('normal', 'Normal'), o('dreta', 'Gira a la dreta (més de 45°)'), o('esquerra', 'Gira a l\'esquerra (més de 45°)')],
        },
        { id: 'dixHallpikeD', ca: 'Dix-Hallpike: dreta', tipus: 'simple', opcions: POSITIU_NEGATIU },
        { id: 'dixHallpikeE', ca: 'Dix-Hallpike: esquerra', tipus: 'simple', opcions: POSITIU_NEGATIU },
        {
          id: 'hit',
          ca: 'Head impulse test',
          tipus: 'simple',
          opcions: [o('normal', 'Normal'), o('sacadaD', 'Sacada correctora cap a la dreta'), o('sacadaE', 'Sacada correctora cap a l\'esquerra'), o('bilateral', 'Bilateral')],
        },
      ],
    },
    {
      id: 'orl:escales',
      ca: 'Escales',
      ref: 'escala',
      senseNormal: true,
      camps: [
        { id: 'thi', ca: 'THI (acúfens)', tipus: 'especial', component: 'escala', config: 'thi' },
        { id: 'dhi', ca: 'DHI (vertigen)', tipus: 'especial', component: 'escala', config: 'dhi' },
        { id: 'snot22', ca: 'SNOT-22 (nas i sins)', tipus: 'especial', component: 'escala', config: 'snot22' },
        // Alternativa lliure al SNOT-22 (que requereix llicència): una sola puntuació 0–10
        { id: 'nasal010', ca: 'Símptomes nasals (0–10)', tipus: 'especial', component: 'barra010', ajuda: 'Obstrucció, mucositat, esternuts, olfacte… en conjunt: 0 cap molèstia, 10 la pitjor' },
      ],
    },
  ],
}

/** Paraules del motiu o del diagnòstic que activen el mòdul ORL sol */
const PARAULES_ORL = [
  'acufen', 'acúfen', 'tinnitus', 'orella', 'oida', 'oïda', 'hipoacus', 'sordesa', 'otitis', 'otalg', 'vertigen', 'vèrtig', 'mareig',
  'sinusitis', 'rinitis', 'nas\\b', 'nasal', 'polip', 'pòlip', 'faring', 'laring', 'disfonia', 'afonia', 'ronquera', 'amigdal', 'amígdal', 'ronc\\b',
]

/**
 * El mòdul ORL s'activa sol si el motiu de l'episodi, el motiu de consulta o
 * el diagnòstic occidental en parlen (o si el codi CIM-11 és de l'orella, AB,
 * o de les vies respiratòries altes, CA0); `triat` (true/false) mana sobre això.
 */
export function orlActiu(triat: boolean | null, textos: readonly string[], codiCim?: string | null): boolean {
  if (triat !== null) return triat
  if (codiCim && (/^AB/.test(codiCim) || /^CA0/.test(codiCim))) return true
  const t = textos.join(' ').toLowerCase()
  return PARAULES_ORL.some((p) => new RegExp(`(^|[^a-zà-ú])${p}`).test(t))
}
