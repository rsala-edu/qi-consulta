// Protocols de punts (etapa 4B): combinacions de punts amb el costat, la
// tècnica i els paràmetres, per aplicar-les a una sessió (substituint els punts
// o afegint-los) i modificar-les després com sempre. Les etiquetes (motiu,
// síndrome) serveixen per suggerir-los. Xifrats i sincronitzats.

import { z } from 'zod'
import { esquemaPuntMarcat, nouPuntMarcat, type PuntMarcat } from './puntMarcat'
import type { Registre } from './registre'
import { copiarTractament, mapaPunts, type DadesSessio } from './sessio'

export const esquemaDadesProtocol = z.object({
  nom: z.string().trim().min(1),
  descripcio: z.string(),
  /** Motius i síndromes per als quals se suggereix */
  etiquetes: z.array(z.string().trim().min(1)),
  punts: z.array(esquemaPuntMarcat),
  notes: z.string(),
  arxivat: z.boolean().default(false),
  /** Un dels exemples inicials («Exemple · revisa-les») */
  exemple: z.boolean().default(false),
})
export type DadesProtocol = z.infer<typeof esquemaDadesProtocol>
export type Protocol = Pick<Registre, 'id' | 'creatAt' | 'modificatAt'> & DadesProtocol

export function nouProtocol(nom = ''): DadesProtocol {
  return { nom, descripcio: '', etiquetes: [], punts: [], notes: '', arxivat: false, exemple: false }
}

/** Aplicar un protocol a una sessió: substituint els punts que hi ha o afegint-los (els comuns, com al protocol) */
export function aplicarProtocol(punts: DadesSessio['punts'], protocol: Pick<DadesProtocol, 'punts'>, substituir: boolean): DadesSessio['punts'] {
  return copiarTractament(punts, mapaPunts(protocol.punts), substituir)
}

/** Duplicar: una còpia editable (sense la marca d'exemple ni d'arxivat) */
export function duplicar(p: DadesProtocol, sufix: string): DadesProtocol {
  return { ...structuredClone(p), nom: `${p.nom} ${sufix}`, arxivat: false, exemple: false }
}

/** Desar com a protocol els punts d'una sessió (sense la palpació, que és exploració) */
export function protocolDeSessio(nom: string, punts: readonly PuntMarcat[], etiquetes: readonly string[]): DadesProtocol {
  return { ...nouProtocol(nom.trim()), etiquetes: [...etiquetes], punts: punts.filter((p) => p.tecnica !== 'palpacio').map((p) => ({ ...p })) }
}

const normalitzar = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Protocols suggerits: els (no arxivats) que tenen alguna etiqueta que coincideix
 * amb el motiu de l'episodi o amb una síndrome (sense accents ni majúscules;
 * una etiqueta coincideix si és dins del text o el text és dins de l'etiqueta).
 */
export function suggerits<P extends Pick<DadesProtocol, 'etiquetes' | 'arxivat'>>(protocols: readonly P[], textos: readonly string[]): P[] {
  const t = textos.map(normalitzar).filter((x) => x.length >= 3)
  if (t.length === 0) return []
  return protocols.filter(
    (p) => !p.arxivat && p.etiquetes.some((e) => {
      const n = normalitzar(e)
      return n.length >= 3 && t.some((x) => x.includes(n) || n.includes(x))
    }),
  )
}

/** Cerca per nom, etiqueta o codi de punt */
export function cercar<P extends Pick<DadesProtocol, 'nom' | 'etiquetes' | 'punts' | 'arxivat'>>(protocols: readonly P[], consulta: string): P[] {
  const q = normalitzar(consulta)
  const actius = protocols.filter((p) => !p.arxivat)
  if (!q) return actius
  return actius.filter((p) => normalitzar([p.nom, ...p.etiquetes, ...p.punts.map((x) => x.codi)].join(' ')).includes(q))
}

// --- Exemples inicials ------------------------------------------------------------

const cos = (codi: string, tecnica: PuntMarcat['tecnica'] = 'agulla', costat: PuntMarcat['costat'] = 'bilateral') => nouPuntMarcat(codi, costat, tecnica, 'cos')
const orella = (codi: string) => nouPuntMarcat(codi, 'bilateral', 'llavor', 'orella')

/** Combinacions clàssiques molt conegudes, perquè la doctora les revisi, les editi o les esborri */
export const EXEMPLES: readonly (Omit<DadesProtocol, 'arxivat' | 'exemple'> & { id: string })[] = [
  {
    id: 'protocol-exemple-quatre-portes',
    nom: 'Quatre portes (Si Guan)',
    descripcio: 'LI4 i LR3 bilaterals: mouen el qi i la sang i calmen.',
    etiquetes: ['Dolor', 'Estrès', 'Ansietat', 'Liver qi stagnation'],
    punts: [cos('LI4'), cos('LR3')],
    notes: '',
  },
  {
    id: 'protocol-exemple-zusanli-sanyinjiao',
    nom: 'Zusanli i Sanyinjiao',
    descripcio: 'ST36 i SP6 bilaterals: tonificar el qi i la sang.',
    etiquetes: ['Cansament', 'Astènia', 'Deficiència'],
    punts: [{ ...cos('ST36'), metode: 'tonificar' }, { ...cos('SP6'), metode: 'tonificar' }],
    notes: 'Amb precaució a l\'embaràs (SP6).',
  },
  {
    id: 'protocol-exemple-cefalea',
    nom: 'Cefalea tensional',
    descripcio: 'GB20, LI4, GV20 i Yintang.',
    etiquetes: ['Cefalea', 'Mal de cap', 'Cervicàlgia'],
    punts: [cos('GB20'), cos('LI4'), cos('GV20', 'agulla', 'bilateral'), cos('EX-HN3', 'agulla', 'bilateral')],
    notes: '',
  },
  {
    id: 'protocol-exemple-calmar-shen',
    nom: 'Calmar el shen',
    descripcio: 'HT7, PC6 i Yintang: ansietat i insomni.',
    etiquetes: ['Insomni', 'Ansietat', 'Estrès'],
    punts: [cos('HT7'), cos('PC6'), cos('EX-HN3', 'agulla', 'bilateral')],
    notes: '',
  },
  {
    id: 'protocol-exemple-nada',
    nom: 'Auricular NADA (5 punts)',
    descripcio: 'Shenmen, Simpàtic, Ronyó, Fetge i Pulmó a l\'orella.',
    etiquetes: ['Ansietat', 'Estrès', 'Insomni', 'Deshabituació'],
    punts: [orella('TF4'), orella('AH6a'), orella('CO10'), orella('CO12'), orella('CO14')],
    notes: 'El protocol original es fa amb agulles; aquí, amb llavors.',
  },
]
