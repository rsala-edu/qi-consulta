import { z } from 'zod'
import { t } from '../i18n/t'
import type { Registre } from './registre'

const text = z.string().trim()

export const SEXES = ['dona', 'home', 'altre'] as const

/** Dades d'un pacient tal com les edita el formulari (tot són cadenes). */
export const esquemaDadesPacient = z.object({
  nom: text.min(1, t.errors.nomObligatori),
  llinatges: text,
  dataNaixement: z
    .string()
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), t.errors.dataInvalida)
    .refine((v) => v === '' || v <= new Date().toISOString().slice(0, 10), t.errors.dataFutura),
  sexe: z.enum(['', ...SEXES]),
  telefon: text.refine((v) => v === '' || /^[+\d][\d\s.-]{5,}$/.test(v), t.errors.telefonInvalid),
  correu: text.refine((v) => v === '' || z.email().safeParse(v).success, t.errors.correuInvalid),
  adreca: text,
  professio: text,
  comEnsHaConegut: text,
})

export type DadesPacient = z.infer<typeof esquemaDadesPacient>

/** El que es xifra i es guarda (sense id ni dates, que van a part). */
export const esquemaPacientGuardat = esquemaDadesPacient.extend({ arxivat: z.boolean() })
export type PacientGuardat = z.infer<typeof esquemaPacientGuardat>

export type Pacient = Registre & PacientGuardat

export function dadesPacientBuides(): DadesPacient {
  return {
    nom: '',
    llinatges: '',
    dataNaixement: '',
    sexe: '',
    telefon: '',
    correu: '',
    adreca: '',
    professio: '',
    comEnsHaConegut: '',
  }
}

export function nomComplet(p: Pick<Pacient, 'nom' | 'llinatges'>): string {
  return [p.nom, p.llinatges].filter(Boolean).join(' ')
}

/** Només els camps editables del pacient (sense id, dates ni arxivat). */
export function dadesDePacient(p: Pacient): DadesPacient {
  return {
    nom: p.nom,
    llinatges: p.llinatges,
    dataNaixement: p.dataNaixement,
    sexe: p.sexe,
    telefon: p.telefon,
    correu: p.correu,
    adreca: p.adreca,
    professio: p.professio,
    comEnsHaConegut: p.comEnsHaConegut,
  }
}
