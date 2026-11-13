// Actualitzacions de l'app sense perdre dades (docs/sincronia.md, bloc 2,
// punt 7). Dues versions compilades de l'app i un servidor que passa de l'una
// a l'altra, com quan GitHub Pages publica una versió nova amb l'app oberta.
// Només dades inventades.
import { execSync } from 'node:child_process'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, normalize } from 'node:path'
import type { Page } from '@playwright/test'
import { ENTORN_PROVES } from '../../playwright.config.ts'
import { continuarAmbGoogle, expect as expectBase, test } from './google.js'

const expect = expectBase.configure({ timeout: 30_000 })
const PORT = 5196
const ARREL = `http://localhost:${PORT}/qi-consulta/`
const P = 'contrasenya-inventada-actualitzacio'
const DIR = join(tmpdir(), `qi-actualitzacio-${process.pid}`)
const TIPUS: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
}

let servidor: Server
/** La versió que es publica ara */
let publicada = 'prova-a'

test.describe.configure({ mode: 'serial', timeout: 180_000 })

// Una vegada n'hi ha prou (i el servidor és un de sol)
const nomesEscriptori = (nom: string) => nom === 'escriptori'

// oxlint-disable-next-line no-empty-pattern
test.beforeAll(({}, info) => {
  if (!nomesEscriptori(info.project.name)) return
  // La C té tots els trossos amb un altre nom (com una versió amb el codi canviat):
  // els de l'A ja no hi són
  for (const v of ['prova-a', 'prova-b', 'prova-c']) {
    execSync(`npx vite build --outDir ${join(DIR, v)} --emptyOutDir`, {
      env: { ...process.env, ...ENTORN_PROVES, VITE_VERSIO_APP: v, ...(v === 'prova-c' ? { QI_SAL_TROSSOS: 'c' } : {}) },
      stdio: 'ignore',
    })
  }
  servidor = createServer((req, res) => {
    const ruta = decodeURIComponent((req.url ?? '/').split('?')[0]!).replace(/^\/qi-consulta\//, '/')
    let fitxer = normalize(join(DIR, publicada, ruta))
    if (!fitxer.startsWith(join(DIR, publicada))) return res.writeHead(403).end()
    if (!existsSync(fitxer) || statSync(fitxer).isDirectory()) fitxer = join(DIR, publicada, 'index.html')
    // Com GitHub Pages: memòria cau curta
    res.writeHead(200, { 'Content-Type': TIPUS[extname(fitxer)] ?? 'application/octet-stream', 'Cache-Control': 'max-age=600' })
    createReadStream(fitxer).pipe(res)
  })
  return new Promise<void>((r) => servidor.listen(PORT, r))
})

// oxlint-disable-next-line no-empty-pattern
test.afterAll(({}, info) => (nomesEscriptori(info.project.name) ? new Promise<void>((r) => servidor.close(() => r())) : undefined))

const menu = (page: Page, nom: string) =>
  page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom })

async function versioVisible(page: Page) {
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /Quant a/ }).click()
  return page.getByTestId('versio-app').textContent()
}

async function desbloquejar(page: Page) {
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(menu(page, 'Avui')).toBeVisible()
}

/** Com si la doctora tornés a la pestanya */
const tornarALaPestanya = (page: Page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

test('una versió nova es detecta amb l\'app oberta (sense recarregar), s\'actualitza i no es perd res', async ({ page }) => {
  test.skip(!nomesEscriptori(test.info().project.name), 'Una vegada n\'hi ha prou')
  publicada = 'prova-a'
  await page.goto(ARREL)
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByLabel('Repeteix la contrasenya').fill(P)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill('Aina')
  await page.getByLabel('Llinatges').fill('Provencal Inventada')
  await page.getByRole('button', { name: 'Desar' }).first().click()
  await expect(page.getByRole('heading', { name: 'Aina Provencal Inventada' })).toBeVisible()
  // La versió A ja és la que controla la pàgina (com en obrir l'app un altre dia)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await desbloquejar(page)
  expect(await versioVisible(page)).toBe('Qi prova-a')

  // Es publica la B. L'app és oberta i no es recarrega: en tornar a la pestanya ho detecta
  publicada = 'prova-b'
  await tornarALaPestanya(page)
  const franja = page.locator('.franja-avis').filter({ hasText: 'Hi ha una versió nova' })
  await expect(franja).toBeVisible()
  await expect(page.getByText('Hi ha una versió nova: prova-b')).toBeVisible()
  await franja.getByRole('button', { name: 'Actualitzar' }).click()
  // Torna a carregar amb la B (cal tornar a obrir l'app) i les dades hi són
  await desbloquejar(page)
  expect(await versioVisible(page)).toBe('Qi prova-b')
  await menu(page, 'Pacients').click()
  await expect(page.getByRole('link', { name: /Aina Provencal Inventada/ })).toBeVisible()

  // Amb l'app bloquejada, s'actualitza sola
  await page.getByRole('button', { name: 'Bloquejar' }).click()
  await expect(page.getByRole('button', { name: 'Desbloquejar' })).toBeVisible()
  publicada = 'prova-a'
  const recarrega = page.waitForEvent('load')
  await tornarALaPestanya(page)
  await recarrega
  await desbloquejar(page)
  expect(await versioVisible(page)).toBe('Qi prova-a')
  await menu(page, 'Pacients').click()
  await expect(page.getByRole('link', { name: /Aina Provencal Inventada/ })).toBeVisible()
})

test.describe('un tros de l\'app que ja no és al servidor', () => {
  // Una pestanya que el service worker encara no controla (la primera vegada
  // que s'obre l'app, o si el navegador l'ha esborrat): els trossos van al servidor
  test.use({ serviceWorkers: 'block' })

  test('es publica una versió nova (sense els fitxers vells) amb l\'app oberta i s\'obre el Mapa: es recarrega sola amb la nova i la llista es veu', async ({ page }) => {
    test.skip(!nomesEscriptori(test.info().project.name), 'Una vegada n\'hi ha prou')
    publicada = 'prova-a'
    await page.goto(ARREL)
    await continuarAmbGoogle(page)
    await page.getByLabel('Contrasenya', { exact: true }).fill(P)
    await page.getByLabel('Repeteix la contrasenya').fill(P)
    await page.getByRole('button', { name: 'Crear i entrar' }).click()
    await menu(page, 'Pacients').click()
    await page.getByRole('link', { name: 'Nou pacient' }).click()
    await page.getByLabel('Nom', { exact: true }).fill('Aina')
    await page.getByLabel('Llinatges').fill('Provencal Inventada')
    await page.getByRole('button', { name: 'Desar' }).first().click()
    await expect(page.getByRole('heading', { name: 'Aina Provencal Inventada' })).toBeVisible()

    // Es publica la C: els trossos de l'A (el del Mapa, encara no carregat) ja no hi són
    publicada = 'prova-c'
    const recarrega = page.waitForEvent('load')
    await menu(page, 'Mapa').click()
    await recarrega
    // La C, sense cap pantalla mig buida: l'app s'obre i el Mapa hi és
    await desbloquejar(page)
    await expect(page.getByRole('searchbox', { name: /Cerca un punt/ })).toBeVisible()
    expect(await versioVisible(page)).toBe('Qi prova-c')
    await menu(page, 'Pacients').click()
    const aina = page.getByRole('list', { name: 'Pacients' }).getByRole('link', { name: /Aina Provencal Inventada/ })
    await expect(aina).toBeVisible()
    await expect(aina).toBeInViewport()
  })
})
