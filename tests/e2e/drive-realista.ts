// Google Drive simulat que es comporta com el real, per a les proves de la
// matriu de sincronia (docs/sincronia.md). Només dades inventades; cap prova
// surt a internet.
//
// Diferències amb google.ts (el simulat senzill):
// - un «món» amb diversos comptes de Google, cadascun amb el seu Drive, i
//   diversos dispositius (contextos de navegador) que hi accedeixen alhora;
// - cada fitxer té un número de versió i una ETag; les respostes porten la
//   capçalera ETag i, si la petició porta If-Match i no coincideix, Drive
//   respon 412 (com ho faria un servidor que respecta les escriptures
//   condicionals);
// - latència configurable a cada petició;
// - errors programats (412, 429, 503…) per a les peticions següents;
// - es poden retenir les escriptures (PATCH) per provocar una cursa;
// - un dispositiu es pot quedar sense connexió (la petició falla com sense xarxa).
import type { BrowserContext } from '@playwright/test'

export interface FitxerReal {
  id: string
  name: string
  modifiedTime: string
  /** Número de versió de Drive: puja a cada escriptura */
  version: number
  contingut: string
}

export interface Peticio {
  dispositiu: string
  correu: string
  metode: string
  ruta: string
  /** Capçalera If-Match de la petició (null si no en porta) */
  ifMatch: string | null
  estat: number
}

export interface ErrorProgramat {
  estat: number
  /** Només per a aquest mètode (GET, POST, PATCH…) */
  metode?: string
  /** Només per a aquest dispositiu */
  dispositiu?: string
}

export interface Mon {
  /** Drive de cada compte (pel correu) */
  drives: Map<string, Map<string, FitxerReal>>
  /** Compte de cada permís que s'ha donat */
  tokens: Map<string, string>
  peticions: Peticio[]
  /** Errors per a les peticions següents (es consumeixen per ordre) */
  errors: ErrorProgramat[]
  /** Latència de cada petició a Drive, en mil·lisegons */
  latenciaMs: number
  /** Si és > 0: les escriptures (PATCH) s'aturen fins que n'hi ha tantes d'esperant */
  retenirPatch: number
  /** Permisos revocats (com si la persona hagués tancat la sessió de Google) */
  revocats: Set<string>
  /** Hora de Google (ms): la de les dates dels fitxers i la capçalera Date */
  ara: () => number
}

export interface Dispositiu {
  nom: string
  /** Compte amb què entra a Google ara mateix */
  correu: string
  senseXarxa: boolean
  /** La renovació silenciosa (prompt=none) falla */
  silenciosaFalla: boolean
  /** Segons que dura cada permís */
  durada: number
  autoritzacions: { prompt: string | null; pista: string | null; correu: string }[]
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Expose-Headers': 'ETag, Date',
}

export function nouMon(): Mon {
  retingudes = []
  return {
    drives: new Map(),
    tokens: new Map(),
    peticions: [],
    errors: [],
    latenciaMs: 150,
    retenirPatch: 0,
    revocats: new Set(),
    ara: () => Date.now(),
  }
}

export function nouDispositiu(nom: string, correu: string): Dispositiu {
  return { nom, correu, senseXarxa: false, silenciosaFalla: false, durada: 3599, autoritzacions: [] }
}

export function driveDe(mon: Mon, correu: string): Map<string, FitxerReal> {
  let d = mon.drives.get(correu)
  if (!d) mon.drives.set(correu, (d = new Map()))
  return d
}

/** El diari d'un dispositiu del compte (el primer, si no se'n diu cap): format 2 */
export const principalDe = (mon: Mon, correu: string): FitxerReal | undefined =>
  [...driveDe(mon, correu).values()].find((f) => f.name.startsWith('qi-dispositiu-'))

const etag = (f: FitxerReal) => `"v${f.version}"`
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Escriptures retingudes (cursa): es deixen anar totes alhora
let retingudes: (() => void)[] = []

export async function simularDispositiu(context: BrowserContext, mon: Mon, disp: Dispositiu): Promise<void> {
  // Rellotge del servidor (real, no el de la pàgina): com Drive
  let pas = 0
  const ara = () => new Date(mon.ara() + pas++).toISOString()
  const sense = ({ contingut: _c, ...f }: FitxerReal) => f

  await context.route('https://accounts.google.com/**', async (route) => {
    const u = new URL(route.request().url())
    const retorn = u.searchParams.get('redirect_uri')!
    const estat = u.searchParams.get('state')!
    const prompt = u.searchParams.get('prompt')
    disp.autoritzacions.push({ prompt, pista: u.searchParams.get('login_hint'), correu: disp.correu })
    let resposta: string
    if (prompt === 'none' && disp.silenciosaFalla) resposta = `error=interaction_required&state=${estat}`
    else {
      const token = `token-${disp.nom}-${crypto.randomUUID()}`
      mon.tokens.set(token, disp.correu)
      resposta = `access_token=${token}&token_type=Bearer&expires_in=${disp.durada}&state=${estat}`
    }
    await route.fulfill({ status: 302, headers: { location: `${retorn}#${resposta}` } })
  })

  await context.route('https://openidconnect.googleapis.com/**', (route) => {
    const token = (route.request().headers()['authorization'] ?? '').replace(/^Bearer /, '')
    const correu = mon.tokens.get(token) ?? disp.correu
    return route.fulfill({ headers: CORS, json: { sub: `sub-${correu.split('@')[0]}`, email: correu, email_verified: true } })
  })

  await context.route('https://www.googleapis.com/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    if (disp.senseXarxa) return route.abort('internetdisconnected')
    await espera(mon.latenciaMs)
    if (disp.senseXarxa) return route.abort('internetdisconnected')

    const u = new URL(req.url())
    const token = (req.headers()['authorization'] ?? '').replace(/^Bearer /, '')
    const correu = mon.tokens.get(token)
    const ifMatch = req.headers()['if-match'] ?? null
    const anotar = (estat: number) =>
      mon.peticions.push({ dispositiu: disp.nom, correu: correu ?? '?', metode: req.method(), ruta: u.pathname, ifMatch, estat })

    if (!correu || mon.revocats.has(token)) {
      anotar(401)
      return route.fulfill({ status: 401, headers: CORS, body: '' })
    }
    const i = mon.errors.findIndex((e) => (!e.metode || e.metode === req.method()) && (!e.dispositiu || e.dispositiu === disp.nom))
    if (i >= 0) {
      const [e] = mon.errors.splice(i, 1)
      anotar(e!.estat)
      return route.fulfill({ status: e!.estat, headers: CORS, body: '' })
    }

    const fitxers = driveDe(mon, correu)
    const id = /\/files\/([^/]+)$/.exec(u.pathname)?.[1]
    const data = { Date: new Date(mon.ara()).toUTCString() }
    const json = (cos: unknown, f?: FitxerReal) => {
      anotar(200)
      return route.fulfill({ headers: { ...CORS, ...data, ...(f ? { ETag: etag(f) } : {}) }, json: cos })
    }

    if (req.method() === 'GET' && !id) return json({ files: [...fitxers.values()].map(sense) })
    if (req.method() === 'GET' && id) {
      const f = fitxers.get(id)
      if (!f) {
        anotar(404)
        return route.fulfill({ status: 404, headers: CORS })
      }
      anotar(200)
      return route.fulfill({ headers: { ...CORS, ...data, ETag: etag(f) }, body: f.contingut })
    }
    if (req.method() === 'POST') {
      const parts = req.postData()!.split(/--qi-[0-9a-f-]+/)
      const meta = JSON.parse(parts[1]!.split('\r\n\r\n')[1]!.trim()) as { name: string }
      const contingut = parts[2]!.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '')
      // Com el Drive real: dos fitxers poden tenir el mateix nom
      const f: FitxerReal = { id: crypto.randomUUID(), name: meta.name, modifiedTime: ara(), version: 1, contingut }
      fitxers.set(f.id, f)
      return json(sense(f), f)
    }
    if (req.method() === 'PATCH' && id) {
      const cos = req.postData() ?? ''
      if (mon.retenirPatch > 0) {
        await new Promise<void>((deixar) => {
          retingudes.push(deixar)
          if (retingudes.length >= mon.retenirPatch) {
            mon.retenirPatch = 0
            const totes = retingudes
            retingudes = []
            // Una darrere l'altra, en l'ordre en què han arribat
            totes.forEach((d, n) => setTimeout(d, n * 50))
          }
        })
      }
      const f = fitxers.get(id)
      if (!f) {
        anotar(404)
        return route.fulfill({ status: 404, headers: CORS })
      }
      if (ifMatch !== null && ifMatch !== etag(f)) {
        anotar(412)
        return route.fulfill({ status: 412, headers: CORS, body: '' })
      }
      Object.assign(f, { contingut: cos, modifiedTime: ara(), version: f.version + 1 })
      return json(sense(f), f)
    }
    if (req.method() === 'DELETE' && id) {
      fitxers.delete(id)
      anotar(204)
      return route.fulfill({ status: 204, headers: CORS })
    }
    anotar(400)
    return route.fulfill({ status: 400, headers: CORS })
  })
}
