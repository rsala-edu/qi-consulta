// Nom dels fitxers d'informe (etapa 4D)

/** Nom de fitxer sense accents ni espais: «informe-sessio-3-2026-11-13.pdf» */
export function nomFitxerInforme(...parts: string[]): string {
  return `${parts
    .join('-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}.pdf`
}
