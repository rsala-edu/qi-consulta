import { z } from 'zod'

/**
 * Esborrany d'un formulari obert que encara no s'ha desat.
 * `clau` identifica el formulari (p. ex. «pacient:<id>:fitxa-clinica») i
 * només conté UUID; la resta (descripció amb el nom, valors) va xifrada.
 */
export const esquemaEsborranyGuardat = z.object({
  ruta: z.string(),
  descripcio: z.string(),
  valors: z.unknown(),
})

export type EsborranyGuardat = z.infer<typeof esquemaEsborranyGuardat>

export type Esborrany = EsborranyGuardat & { clau: string; modificatAt: string }

/** Cada quant es desa l'esborrany del formulari obert. */
export const INTERVAL_ESBORRANY = 5000
