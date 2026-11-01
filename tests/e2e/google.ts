// Google simulat per a les proves: la pàgina d'autorització, el compte i un
// Google Drive en memòria. Cap prova surt a internet. Només dades inventades.
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test'

/** Correus inventats permesos; els seus hashos són a VITE_HASHOS_CORREUS_PERMESOS (playwright.config.ts) */
export const CORREU_DOCTORA = 'doctora@exemple.invalid'
export const CORREU_PROVES = 'proves@exemple.invalid'

export interface FitxerSimulat {
  id: string
  name: string
  modifiedTime: string
  contingut: string
}

export interface GoogleSimulat {
  /** Correu del compte amb què «entra» la persona */
  correu: string
  fitxers: Map<string, FitxerSimulat>
  /** Peticions a l'API de Drive (mètode i ruta), per comprovar què s'ha fet */
  peticions: string[]
  /** Cada obertura de la pàgina d'autorització: el `prompt` i la pista del compte */
  autoritzacions: { prompt: string | null; pista: string | null }[]
  /** Segons que dura cada permís (per simular que caduca aviat) */
  durada: number
  /** La renovació silenciosa (prompt=none) falla, com si Google hagués de preguntar */
  silenciosaFalla: boolean
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }

export async function simularGoogle(context: BrowserContext, google: GoogleSimulat): Promise<void> {
  let rellotge = 0
  const ara = () => new Date(Date.now() + rellotge++).toISOString()
  const sense = ({ contingut: _c, ...f }: FitxerSimulat) => f

  await context.route('https://accounts.google.com/**', async (route) => {
    const u = new URL(route.request().url())
    const retorn = u.searchParams.get('redirect_uri')!
    const estat = u.searchParams.get('state')!
    const prompt = u.searchParams.get('prompt')
    google.autoritzacions.push({ prompt, pista: u.searchParams.get('login_hint') })
    const resposta =
      prompt === 'none' && google.silenciosaFalla
        ? `error=interaction_required&state=${estat}`
        : `access_token=token-simulat-${crypto.randomUUID()}&token_type=Bearer&expires_in=${google.durada}&state=${estat}`
    await route.fulfill({ status: 302, headers: { location: `${retorn}#${resposta}` } })
  })

  await context.route('https://openidconnect.googleapis.com/**', (route) =>
    route.fulfill({ headers: CORS, json: { sub: `sub-${google.correu.split('@')[0]}`, email: google.correu, email_verified: true } }),
  )

  await context.route('https://www.googleapis.com/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const u = new URL(req.url())
    google.peticions.push(`${req.method()} ${u.pathname}`)
    const id = /\/files\/([^/]+)$/.exec(u.pathname)?.[1]
    const json = (cos: unknown) => route.fulfill({ headers: CORS, json: cos })

    if (req.method() === 'GET' && !id) return json({ files: [...google.fitxers.values()].map(sense) })
    if (req.method() === 'GET' && id) {
      const f = google.fitxers.get(id)
      return f ? route.fulfill({ headers: CORS, body: f.contingut }) : route.fulfill({ status: 404, headers: CORS })
    }
    if (req.method() === 'POST') {
      // multipart: metadades (amb el nom) i contingut
      const parts = req.postData()!.split(/--qi-[0-9a-f-]+/)
      const meta = JSON.parse(parts[1]!.split('\r\n\r\n')[1]!.trim()) as { name: string }
      const contingut = parts[2]!.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '')
      const f = { id: crypto.randomUUID(), name: meta.name, modifiedTime: ara(), contingut }
      google.fitxers.set(f.id, f)
      return json(sense(f))
    }
    if (req.method() === 'PATCH' && id) {
      const f = google.fitxers.get(id)!
      Object.assign(f, { contingut: req.postData() ?? '', modifiedTime: ara() })
      return json(sense(f))
    }
    if (req.method() === 'DELETE' && id) {
      google.fitxers.delete(id)
      return route.fulfill({ status: 204, headers: CORS })
    }
    return route.fulfill({ status: 400, headers: CORS })
  })
}

export function nouGoogle(correu = CORREU_DOCTORA): GoogleSimulat {
  return { correu, fitxers: new Map(), peticions: [], autoritzacions: [], durada: 3599, silenciosaFalla: false }
}

/** Totes les proves tenen Google simulat (cada una el seu Drive buit). */
export const test = base.extend<{ google: GoogleSimulat }>({
  // Playwright llegeix els paràmetres per saber quines dependències té cada fixture
  // oxlint-disable-next-line no-empty-pattern
  google: async ({}, usar) => {
    await usar(nouGoogle())
  },
  context: async ({ context, google }, usar) => {
    await simularGoogle(context, google)
    await usar(context)
  },
})

export { expect }

/** Primer ús: «Continuar amb Google» (la finestra s'obre i es tanca sola). */
export async function continuarAmbGoogle(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continuar amb Google' }).click()
  await expect(page.getByRole('button', { name: 'Continuar amb Google' })).toHaveCount(0, { timeout: 15_000 })
}
