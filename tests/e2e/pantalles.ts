// Ajudes de les proves del build de producció (produccio*.spec.ts).
import { readFileSync } from 'node:fs'
import { type Page } from '@playwright/test'
import { expect as expectBase, type GoogleSimulat } from './google.js'

export const CONTRASENYA = 'contrasenya-de-prova-e2e'
const COPIA = readFileSync(new URL('./dades/copia-versio-13709c4.json', import.meta.url), 'utf8')
export const expect = expectBase.configure({ timeout: 20_000 })

/** Errors de la consola i excepcions sense atrapar de la pàgina */
export function vigilarConsola(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(`${e.name}: ${e.message}`))
  return errors
}

export const barra = (page: Page) => page.getByRole('navigation', { name: 'Navegació principal' })

/** La pantalla s'ha dibuixat: barra, títol i cap avís de pantalla trencada */
export async function pantallaBe(page: Page, titol: string | RegExp) {
  await expect(page.getByRole('heading', { level: 1, name: titol }).first()).toBeVisible()
  await expect(barra(page)).toBeVisible()
  await expect(page.getByText('Aquesta pantalla ha tingut un problema')).toHaveCount(0)
}

export async function anar(page: Page, ruta: string, titol: string | RegExp) {
  await page.goto(`/qi-consulta/#${ruta}`)
  await pantallaBe(page, titol)
}

export async function cosLlest(page: Page) {
  const visor = page.getByTestId('visor3d')
  await expect(visor).toHaveAttribute('data-marcadors', /^[1-9]\d*$/)
  await expect(visor.locator('canvas')).toBeVisible()
  await expect(page.getByText(/No s'ha pogut mostrar el cos/)).toHaveCount(0)
}

export async function orellaLlesta(page: Page) {
  await page.getByRole('tab', { name: 'Orella' }).click()
  await expect(page.getByTestId('visor-orella')).toBeVisible()
  await expect(barra(page)).toBeVisible()
}

/** Totes les pantalles que no depenen de tenir pacients */
export async function recorrerPantalles(page: Page) {
  await anar(page, '/avui', 'Avui')
  await anar(page, '/agenda', 'Agenda')
  await anar(page, '/pacients', 'Pacients')
  await anar(page, '/pacients/nou', /pacient/i)
  await anar(page, '/mapa', 'Mapa')
  await cosLlest(page)
  await orellaLlesta(page)
  await anar(page, '/ajustos', 'Ajustos')
  await anar(page, '/ajustos/calibratge', 'Calibratge del mapa')
  await anar(page, '/ajustos/precaucions', 'Precaucions per revisar')
  await anar(page, '/ajustos/seguretat', 'Seguretat i còpia')
  await anar(page, '/ajustos/drive', 'Còpia a Google Drive')
  await anar(page, '/ajustos/aparenca', 'Aparença')
  await anar(page, '/ajustos/agenda', 'Agenda')
  await anar(page, '/ajustos/quant-a', 'Quant a')
}

export function posarCopia(google: GoogleSimulat) {
  google.fitxers.set('copia-1', { id: 'copia-1', name: 'qi-dades.json', modifiedTime: '2026-10-20T09:00:00.000Z', contingut: COPIA })
}


/** Entra recuperant la còpia de Drive (dispositiu nou) */
export async function recuperar(page: Page) {
  await page.getByRole('button', { name: 'Continuar amb Google' }).click()
  await expect(page.getByRole('heading', { name: 'Recuperar les dades' })).toBeVisible()
  await page.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Obrir' }).click()
}

/** Iteracions de PBKDF2 de l'embolcall de la clau mestra desat (taula meta, clau «clauMestra») */
export async function iteracionsDesades(page: Page): Promise<number[]> {
  return page.evaluate(async () => {
    const obrir = (nom: string) =>
      new Promise<IDBDatabase>((resol, falla) => {
        const r = indexedDB.open(nom)
        r.onsuccess = () => resol(r.result)
        r.onerror = () => falla(r.error)
      })
    const llegir = (db: IDBDatabase) =>
      new Promise<{ valor?: { iteracions?: number } } | undefined>((resol, falla) => {
        const r = db.transaction('meta').objectStore('meta').get('clauMestra')
        r.onsuccess = () => resol(r.result)
        r.onerror = () => falla(r.error)
      })
    const totes: number[] = []
    for (const { name } of await indexedDB.databases()) {
      if (!name) continue
      const db = await obrir(name)
      if (db.objectStoreNames.contains('meta')) {
        const r = await llegir(db)
        if (r?.valor?.iteracions !== undefined) totes.push(r.valor.iteracions)
      }
      db.close()
    }
    return totes
  })
}
