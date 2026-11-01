// Inici de sessió amb Google, sense cap script de Google: s'obre una finestra
// amb la pàgina d'autorització i la resposta torna per public/oauth.html.
//
// Es demana només `openid email` (per saber quin compte és) i
// `drive.appdata` (la carpeta privada de l'app). El permís dura una hora i es
// guarda només en memòria; després cal tornar-lo a demanar (un toc).

import { hashCorreu } from '../crypto'

export const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
/**
 * Hashos SHA-256 (en hexadecimal) dels correus que poden entrar, separats per
 * comes: el de la doctora i el de qui fa proves amb dades inventades.
 */
export function llegirHashos(text: string | undefined): string[] {
  return (text ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => /^[0-9a-f]{64}$/.test(h))
}
const HASHOS_PERMESOS = llegirHashos(import.meta.env.VITE_HASHOS_CORREUS_PERMESOS)

const AUTORITZACIO = 'https://accounts.google.com/o/oauth2/v2/auth'
const USUARI = 'https://openidconnect.googleapis.com/v1/userinfo'
export const PERMISOS = 'openid email https://www.googleapis.com/auth/drive.appdata'

export function googleConfigurat(): boolean {
  return CLIENT_ID !== ''
}

export class ErrorGoogle extends Error {
  motiu: 'cancellat' | 'bloquejat' | 'compte' | 'xarxa'
  constructor(motiu: ErrorGoogle['motiu']) {
    super(`Google: ${motiu}`)
    this.name = 'ErrorGoogle'
    this.motiu = motiu
  }
}

export interface PermisGoogle {
  token: string
  caducaAt: number
}

// --- Permís en memòria (no es guarda enlloc) ---
let permis: PermisGoogle | null = null
const subscriptors = new Set<() => void>()

/** Marge per renovar el permís abans que caduqui (amb el pròxim toc) */
export const MARGE_RENOVACIO = 10 * 60_000

/** No hi ha permís, o caduca d'aquí a menys de deu minuts. */
export function calRenovarPermis(ara: number = Date.now()): boolean {
  return !permis || permis.caducaAt - MARGE_RENOVACIO < ara
}

export function tokenGoogle(): string | null {
  // Un minut de marge abans que caduqui
  return permis && permis.caducaAt - 60_000 > Date.now() ? permis.token : null
}

export function oblidarPermis(): void {
  permis = null
  subscriptors.forEach((f) => f())
}

export function quanCanviiElPermis(f: () => void): () => void {
  subscriptors.add(f)
  return () => subscriptors.delete(f)
}

function urlRetorn(): string {
  return new URL(`${import.meta.env.BASE_URL}oauth.html`, location.origin).href
}

/**
 * Obre la finestra de Google. S'ha de cridar directament des d'un toc (els
 * navegadors bloquegen les finestres que no obre la persona).
 * - `triar`: el primer cop es deixa triar el compte.
 * - `normal`: torna a connectar; Google només pregunta si cal.
 * - `silenciosa`: renovació sense cap pregunta (`prompt=none`); la finestra
 *   s'obre i es tanca sola. Si Google necessita preguntar res, falla.
 * `pista`: l'identificador intern del compte de Google (no el correu), perquè
 *   Google sàpiga quin compte renovar si n'hi ha més d'un d'obert.
 */
export function iniciarSessioGoogle({
  mode,
  pista,
}: {
  mode: 'triar' | 'normal' | 'silenciosa'
  pista?: string
}): Promise<PermisGoogle> {
  const estat = crypto.randomUUID()
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: urlRetorn(),
    response_type: 'token',
    scope: PERMISOS,
    state: estat,
    include_granted_scopes: 'true',
  })
  if (mode === 'triar') params.set('prompt', 'select_account')
  if (mode === 'silenciosa') params.set('prompt', 'none')
  if (pista) params.set('login_hint', pista)
  const finestra = window.open(`${AUTORITZACIO}?${params}`, 'qi-google', 'popup,width=500,height=640')
  if (!finestra) return Promise.reject(new ErrorGoogle('bloquejat'))

  return new Promise((resoldre, rebutjar) => {
    // Si la finestra es tanca sense resposta, és que s'ha cancel·lat. La
    // pàgina de retorn envia la resposta i es tanca tot seguit: es deixa un
    // marge perquè el missatge arribi abans de donar-ho per cancel·lat.
    let acabat = false
    const vigilant = window.setInterval(() => {
      if (!finestra.closed) return
      window.clearInterval(vigilant)
      window.setTimeout(() => acabar(() => rebutjar(new ErrorGoogle('cancellat'))), 2_000)
    }, 500)
    function acabar(f: () => void) {
      if (acabat) return
      acabat = true
      window.clearInterval(vigilant)
      window.removeEventListener('message', rebre)
      f()
    }
    function rebre(ev: MessageEvent) {
      if (ev.origin !== location.origin || (ev.data as { tipus?: string })?.tipus !== 'qi-oauth') return
      const r = new URLSearchParams((ev.data as { resposta: string }).resposta)
      if (r.get('state') !== estat) return
      const token = r.get('access_token')
      if (!token) return acabar(() => rebutjar(new ErrorGoogle('cancellat')))
      const nou = { token, caducaAt: Date.now() + Number(r.get('expires_in') ?? '3600') * 1000 }
      acabar(() => resoldre(nou))
    }
    window.addEventListener('message', rebre)
  })
}

/**
 * Comprova que el compte és un dels permesos (pel hash del correu) i guarda
 * el permís. Torna l'identificador intern del compte (`sub`), que serveix de
 * pista per a les renovacions; el correu no es guarda.
 */
export async function acceptarPermis(nou: PermisGoogle, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<{ sub: string }> {
  let usuari: { email?: string; sub?: string }
  try {
    const r = await fetchFn(USUARI, { headers: { Authorization: `Bearer ${nou.token}` } })
    if (!r.ok) throw new Error(String(r.status))
    usuari = (await r.json()) as { email?: string; sub?: string }
  } catch {
    throw new ErrorGoogle('xarxa')
  }
  if (!(await esCorreuPermes(usuari.email ?? ''))) {
    // El permís d'un altre compte no es fa servir per a res
    throw new ErrorGoogle('compte')
  }
  permis = nou
  subscriptors.forEach((f) => f())
  return { sub: usuari.sub ?? '' }
}

export async function esCorreuPermes(correu: string, hashos: readonly string[] = HASHOS_PERMESOS): Promise<boolean> {
  return hashos.length > 0 && correu !== '' && hashos.includes(await hashCorreu(correu))
}
