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

  // Si no, cada paraula ha d'aparèixer (en qualsevol posició) al nom, als
  // llinatges o al telèfon: «sala» troba «Raül Sala Grau»
  const text = normalitzar(`${p.nom} ${p.llinatges} ${p.telefon}`)
  const digits = nomesDigits(p.telefon)
  return normalitzar(consulta)
    .split(/\s+/)
    .every((paraula) => text.includes(paraula) || (/^\d+$/.test(paraula) && digits.includes(paraula)))
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

/**
 * Els pacients que s'han vist fa menys temps (les cites ja passades o fetes,
 * de la més recent a la més antiga), sense repetir-ne cap.
 */
export function pacientsRecents(
  cites: readonly { pacientId: string; inici: string; estat: string }[],
  ara: Date,
  maxim = 5,
): string[] {
  const araLocal = new Date(ara.getTime() - ara.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  const ids: string[] = []
  for (const c of [...cites]
    .filter((c) => c.pacientId && c.estat !== 'anullada' && (c.estat === 'feta' || c.inici <= araLocal))
    .sort((a, b) => b.inici.localeCompare(a.inici))) {
    if (!ids.includes(c.pacientId)) ids.push(c.pacientId)
    if (ids.length >= maxim) break
  }
  return ids
}
