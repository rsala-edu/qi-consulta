import type { Pacient } from './pacient'

/** Minúscules i sense accents: «Martí» troba «marti» i a l'inrevés. */
export function normalitzar(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

function nomesDigits(text: string): string {
  return text.replace(/\D/g, '')
}

function coincideix(p: Pacient, consulta: string): boolean {
  if (consulta.trim() === '') return true

  // Si només hi ha xifres (i espais, guions, punts o +), és una cerca per telèfon
  if (/^[\d\s+.-]+$/.test(consulta.trim())) {
    return nomesDigits(p.telefon).includes(nomesDigits(consulta))
  }

  // Si no, cada paraula ha d'aparèixer al nom o als llinatges
  const nom = normalitzar(`${p.nom} ${p.llinatges}`)
  return normalitzar(consulta)
    .split(/\s+/)
    .every((paraula) => nom.includes(paraula))
}

export function compararPerNom(a: Pacient, b: Pacient): number {
  return (
    a.llinatges.localeCompare(b.llinatges, 'ca', { sensitivity: 'base' }) ||
    a.nom.localeCompare(b.nom, 'ca', { sensitivity: 'base' })
  )
}

/** Cerca per nom, llinatges o telèfon. Els arxivats només surten si es demana. */
export function cercarPacients(
  pacients: readonly Pacient[],
  consulta: string,
  { incloureArxivats = false }: { incloureArxivats?: boolean } = {},
): Pacient[] {
  return pacients
    .filter((p) => incloureArxivats || !p.arxivat)
    .filter((p) => coincideix(p, consulta))
    .sort(compararPerNom)
}
