// Client mínim de Google Drive per a la carpeta privada de l'app
// (appDataFolder). Aquesta carpeta no es veu des de Drive i l'app no pot
// llegir cap altre fitxer de la doctora. Només es fa servir fetch.

export interface FitxerDrive {
  id: string
  name: string
  modifiedTime: string
  /** Número de versió que Drive puja a cada canvi del fitxer (no sempre hi és) */
  version?: string
}

export interface Drive {
  llistar(): Promise<FitxerDrive[]>
  baixar(id: string): Promise<string>
  crear(nom: string, contingut: string): Promise<FitxerDrive>
  actualitzar(id: string, contingut: string): Promise<FitxerDrive>
  esborrar(id: string): Promise<void>
  /** Només Drive de Google: pujada en tancar la pestanya (keepalive) */
  actualitzarEnTancar?(id: string, contingut: string): boolean
}

/** El permís de Google ha caducat o s'ha retirat: cal tornar a connectar. */
export class ErrorAutoritzacio extends Error {
  constructor() {
    super('Cal tornar a connectar amb Google')
    this.name = 'ErrorAutoritzacio'
  }
}

export class ErrorDrive extends Error {
  estat: number
  constructor(estat: number) {
    super(`Google Drive ha respost ${estat}`)
    this.estat = estat
    this.name = 'ErrorDrive'
  }
}

const API = 'https://www.googleapis.com/drive/v3/files'
const PUJADA = 'https://www.googleapis.com/upload/drive/v3/files'
const CAMPS = 'id,name,modifiedTime,version'

/**
 * `alHora`: l'hora de Google (capçalera Date de la resposta, si el navegador
 * la deixa llegir), per saber si el rellotge d'aquest dispositiu va desfasat.
 */
export function driveGoogle(
  token: () => string | null,
  fetchFn: typeof fetch = (...a) => fetch(...a),
  alHora?: (msGoogle: number, msAqui: number) => void,
): Drive {
  async function demanar(url: string, init: RequestInit = {}): Promise<Response> {
    const t = token()
    if (!t) throw new ErrorAutoritzacio()
    const r = await fetchFn(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${t}` } })
    const data = Date.parse(r.headers?.get?.('date') ?? '')
    if (alHora && Number.isFinite(data)) alHora(data, Date.now())
    if (r.status === 401 || r.status === 403) throw new ErrorAutoritzacio()
    if (!r.ok) throw new ErrorDrive(r.status)
    return r
  }

  return {
    async llistar() {
      const fitxers: FitxerDrive[] = []
      let pagina: string | undefined
      do {
        const q = new URLSearchParams({ spaces: 'appDataFolder', fields: `nextPageToken,files(${CAMPS})`, pageSize: '200' })
        if (pagina) q.set('pageToken', pagina)
        const r = (await (await demanar(`${API}?${q}`)).json()) as { files: FitxerDrive[]; nextPageToken?: string }
        fitxers.push(...r.files)
        pagina = r.nextPageToken
      } while (pagina)
      return fitxers
    },

    async baixar(id) {
      return (await demanar(`${API}/${encodeURIComponent(id)}?alt=media`)).text()
    },

    async crear(nom, contingut) {
      const limit = `qi-${crypto.randomUUID()}`
      const cos =
        `--${limit}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify({ name: nom, parents: ['appDataFolder'] })}\r\n` +
        `--${limit}\r\nContent-Type: application/json\r\n\r\n${contingut}\r\n--${limit}--`
      const r = await demanar(`${PUJADA}?uploadType=multipart&fields=${CAMPS}`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${limit}` },
        body: cos,
      })
      return (await r.json()) as FitxerDrive
    },

    async actualitzar(id, contingut) {
      const r = await demanar(`${PUJADA}/${encodeURIComponent(id)}?uploadType=media&fields=${CAMPS}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: contingut,
      })
      return (await r.json()) as FitxerDrive
    },

    /**
     * Puja un fitxer en tancar la pestanya: la petició continua encara que la
     * pàgina es tanqui (keepalive, com a molt ~64 KB). No s'espera la resposta.
     */
    actualitzarEnTancar(id, contingut) {
      const t = token()
      if (!t) return false
      void fetchFn(`${PUJADA}/${encodeURIComponent(id)}?uploadType=media&fields=${CAMPS}`, {
        method: 'PATCH',
        keepalive: true,
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: contingut,
      }).catch(() => {})
      return true
    },

    async esborrar(id) {
      await demanar(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },
  }
}
