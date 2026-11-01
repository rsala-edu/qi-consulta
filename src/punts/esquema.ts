// Format del catàleg de punts (src/punts/cataleg.json).
//
// La posició d'un punt sobre el cos NO es guarda com a x/y/z, sinó com un
// triangle de la malla i les coordenades baricèntriques dins d'aquest
// triangle. Si es canvia el cos (més alt, més gran, dona o home) però es
// manté la mateixa malla de MakeHuman, el punt segueix la pell sense recalibrar.
//
// Cada posició porta l'empremta de la topologia de la malla on es va
// calibrar. Si el model carregat té una altra topologia, la posició s'ignora.

import { z } from 'zod'

export const COSTATS_POSICIO = ['E', 'D', 'C'] as const
/** E = esquerre del pacient (+X del model), D = dret (−X), C = línia mitja */
export type CostatPosicio = (typeof COSTATS_POSICIO)[number]

/**
 * D'on surt una posició: calculada amb la regla de l'OMS, corregida per la
 * doctora des del mapa o col·locada a mà amb l'eina de calibratge.
 */
export const ORIGENS_POSICIO = ['oms', 'doctora', 'manual'] as const
export type OrigenPosicio = (typeof ORIGENS_POSICIO)[number]

const baricentrica = z.number().min(-1e-6).max(1 + 1e-6)

export const esquemaPosicio3D = z
  .object({
    /** Empremta de la topologia de la malla (veure src/mapa/geometria/topologia.ts) */
    topologia: z.string().min(1),
    costat: z.enum(COSTATS_POSICIO),
    /** Índex del triangle dins l'índex de la malla (triangle i = índexs 3i, 3i+1, 3i+2) */
    triangle: z.number().int().nonnegative(),
    /** Coordenades baricèntriques; sumen 1 */
    b: z.tuple([baricentrica, baricentrica, baricentrica]),
    origen: z.enum(ORIGENS_POSICIO).default('manual'),
  })
  .refine((p) => Math.abs(p.b[0] + p.b[1] + p.b[2] - 1) < 1e-4, {
    message: 'Les coordenades baricèntriques han de sumar 1',
    path: ['b'],
  })

export type Posicio3D = z.infer<typeof esquemaPosicio3D>

export const esquemaPosicioOrella = z.object({ x: z.number(), y: z.number() })

export const esquemaMeridia = z.object({
  codi: z.string().regex(/^[A-Z]{2}$/),
  nom: z.string().min(1),
  pinyin: z.string().min(1),
  /** Els punts dels meridians bilaterals són parells (E i D) */
  bilateral: z.boolean(),
  /** Nombre de punts del meridià */
  punts: z.number().int().positive(),
})

export type Meridia = z.infer<typeof esquemaMeridia>

export const esquemaPuntCatalog = z.object({
  /** Nomenclatura estàndard de l'OMS: LI4, ST36, CV12… */
  codi: z.string().regex(/^[A-Z]{2}\d{1,2}$/),
  meridia: z.string(),
  numero: z.number().int().positive(),
  pinyin: z.string().min(1),
  hanzi: z.string().min(1),
  /** Pendent de redactar o revisar per la doctora */
  nomCatala: z.string(),
  /** Pendent de redactar o revisar per la doctora */
  localitzacio: z.string(),
  notes: z.string(),
  precaucions: z.object({
    embaras: z.boolean(),
    nota: z.string(),
    /** Cert quan la doctora ha confirmat la precaució */
    confirmada: z.boolean(),
  }),
  /** Cert quan la doctora ha revisat el punt */
  revisat: z.boolean(),
  posicions: z.array(esquemaPosicio3D),
  orella: esquemaPosicioOrella.nullable(),
})

export type PuntCatalog = z.infer<typeof esquemaPuntCatalog>

export const esquemaCataleg = z
  .object({
    versio: z.literal(1),
    meridians: z.array(esquemaMeridia),
    punts: z.array(esquemaPuntCatalog),
  })
  .superRefine((c, ctx) => {
    const codisMeridians = new Set(c.meridians.map((m) => m.codi))
    const vistos = new Set<string>()
    c.punts.forEach((p, i) => {
      if (vistos.has(p.codi)) ctx.addIssue({ code: 'custom', message: `Codi repetit: ${p.codi}`, path: ['punts', i] })
      vistos.add(p.codi)
      if (!codisMeridians.has(p.meridia))
        ctx.addIssue({ code: 'custom', message: `Meridià desconegut: ${p.meridia}`, path: ['punts', i] })
      if (p.codi !== `${p.meridia}${p.numero}`)
        ctx.addIssue({ code: 'custom', message: `El codi ${p.codi} no quadra amb el meridià i el número`, path: ['punts', i] })
      const claus = p.posicions.map((q) => `${q.topologia}:${q.costat}`)
      if (new Set(claus).size !== claus.length)
        ctx.addIssue({ code: 'custom', message: `Posició repetida a ${p.codi}`, path: ['punts', i] })
    })
  })

export type Cataleg = z.infer<typeof esquemaCataleg>
