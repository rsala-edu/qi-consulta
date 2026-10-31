// Punt d'accés als textos. Si s'afegeix el castellà, aquí es triarà l'idioma.
import { ca, type Textos } from './ca'

export const t: Textos = ca

/** Substitueix {clau} per valors: formatar('Hola {nom}', { nom: 'Aina' }) */
export function formatar(plantilla: string, valors: Record<string, string>): string {
  return plantilla.replace(/\{(\w+)\}/g, (tot, clau: string) => valors[clau] ?? tot)
}

const formatDataHora = new Intl.DateTimeFormat('ca', { dateStyle: 'medium', timeStyle: 'short' })

export function dataHora(iso: string): string {
  return formatDataHora.format(new Date(iso))
}
