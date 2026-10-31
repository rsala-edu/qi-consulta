import { z } from 'zod'
import type { Registre } from './registre'

const text = z.string().trim()

export const esquemaDadesFitxaClinica = z.object({
  antecedentsPersonals: text,
  antecedentsFamiliars: text,
  medicacioActual: text,
  alergies: text,
  contraindicacions: z.object({
    anticoagulants: z.boolean(),
    embaras: z.boolean(),
    marcapassos: z.boolean(),
    altres: text,
  }),
  habits: z.object({
    son: text,
    tabac: text,
    alcohol: text,
    exercici: text,
  }),
})

export type DadesFitxaClinica = z.infer<typeof esquemaDadesFitxaClinica>

/** Una fitxa per pacient. El pacientId (un UUID) es guarda en clar per poder-la trobar. */
export type FitxaClinica = Registre & { pacientId: string } & DadesFitxaClinica

export function fitxaClinicaBuida(): DadesFitxaClinica {
  return {
    antecedentsPersonals: '',
    antecedentsFamiliars: '',
    medicacioActual: '',
    alergies: '',
    contraindicacions: { anticoagulants: false, embaras: false, marcapassos: false, altres: '' },
    habits: { son: '', tabac: '', alcohol: '', exercici: '' },
  }
}

export function teContraindicacions(f: DadesFitxaClinica): boolean {
  const c = f.contraindicacions
  return c.anticoagulants || c.embaras || c.marcapassos || c.altres !== ''
}
