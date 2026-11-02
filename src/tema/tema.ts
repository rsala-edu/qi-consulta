// Tema de l'app: com el sistema, clar o fosc. La tria es desa en aquest
// dispositiu (no és dada de pacient) i s'aplica com a atribut data-theme a
// <html>. index.html l'aplica abans de pintar res, amb el mateix codi de
// lectura que aquí (CLAU_TEMA), perquè en obrir l'app no es vegi ni un instant
// el tema que no toca.

export const TEMES = ['sistema', 'clar', 'fosc'] as const
export type Tema = (typeof TEMES)[number]

export const CLAU_TEMA = 'qi.tema'

/** Ordre del cicle de la icona: Sistema → Clar → Fosc → Sistema */
export function temaSeguent(t: Tema): Tema {
  return TEMES[(TEMES.indexOf(t) + 1) % TEMES.length]!
}

export function esTema(v: unknown): v is Tema {
  return typeof v === 'string' && (TEMES as readonly string[]).includes(v)
}

export function llegirTema(): Tema {
  try {
    const v = window.localStorage.getItem(CLAU_TEMA)
    return esTema(v) ? v : 'sistema'
  } catch {
    return 'sistema'
  }
}

/** Valor de data-theme: sense atribut, segueix el sistema */
export function atributTema(t: Tema): 'light' | 'dark' | null {
  return t === 'clar' ? 'light' : t === 'fosc' ? 'dark' : null
}

const oients = new Set<() => void>()

export function subscriureTema(f: () => void): () => void {
  oients.add(f)
  return () => oients.delete(f)
}

/** Aplica el tema amb una transició suau dels colors (si no es demana menys moviment) i el desa */
export function canviarTema(t: Tema): void {
  try {
    window.localStorage.setItem(CLAU_TEMA, t)
  } catch {
    // Sense emmagatzematge (finestra privada): s'aplica igualment
  }
  const html = document.documentElement
  html.classList.add('canvi-tema')
  aplicarTema(t)
  window.setTimeout(() => html.classList.remove('canvi-tema'), 450)
  for (const f of oients) f()
}

export function aplicarTema(t: Tema): void {
  const a = atributTema(t)
  if (a) document.documentElement.dataset.theme = a
  else delete document.documentElement.dataset.theme
}
