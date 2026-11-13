// Captures dels blocs 1 i 2 (errors i coses que es mouen a la visita). No
// són proves. Només dades inventades.
//
//   CAPTURES_SUFIX=blocs npx playwright test -c playwright.disseny.config.ts blocs
import { mkdirSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { continuarAmbGoogle, expect, test } from '../e2e/google.js'

const SUFIX = process.env.CAPTURES_SUFIX ?? 'proves'
const P = 'contrasenya-inventada-blocs'
test.describe.configure({ timeout: 300_000 })
test.use({ actionTimeout: 20_000 })

const menu = (page: Page, nom: string) => page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom, exact: true })
const pestanya = (page: Page, nom: string) => page.getByRole('tablist', { name: 'Visita' }).getByRole('tab', { name: nom })
const capcalera = (page: Page) => page.locator('.capcalera-visita')

async function capturar(page: Page, nom: string, projecte: string, temes: readonly ('light' | 'dark')[] = ['light', 'dark']) {
  const carpeta = `docs/captures/blocs/${projecte}`
  mkdirSync(carpeta, { recursive: true })
  for (const esquema of temes) {
    await page.emulateMedia({ colorScheme: esquema })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${carpeta}/${nom}-${SUFIX}-${esquema === 'light' ? 'clar' : 'fosc'}.jpg`, type: 'jpeg', quality: 82 })
  }
  await page.emulateMedia({ colorScheme: 'light' })
}

async function entrar(page: Page) {
  await page.clock.install({ time: new Date(2026, 10, 12, 9, 0) })
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByLabel('Repeteix la contrasenya').fill(P)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

async function pacient(page: Page, nom: string, llinatges: string) {
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill(nom)
  await page.getByLabel('Llinatges').fill(llinatges)
  await page.getByRole('button', { name: 'Desar' }).first().click()
  await expect(page.getByRole('heading', { name: `${nom} ${llinatges}` })).toBeVisible()
}

async function cita(page: Page, qui: string, hora: string, motiu: string) {
  await menu(page, 'Agenda').click()
  await page.getByRole('main').getByRole('button', { name: 'Nova cita', exact: true }).first().click()
  const dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  await dialeg.getByLabel('Data').fill('2026-11-12')
  await dialeg.getByLabel('Hora').fill(hora)
  await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).fill(qui)
  await dialeg.getByRole('button', { name: new RegExp(qui) }).first().click()
  if (motiu) await dialeg.getByLabel('Motiu').fill(motiu)
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(dialeg).toBeHidden()
}

async function comencar(page: Page) {
  await menu(page, 'Avui').click()
  await page.getByRole('button', { name: /^(Començar visita|Continuar la visita)$/ }).first().click()
  await expect(capcalera(page)).toBeVisible()
}

async function finalitzar(page: Page) {
  await capcalera(page).getByRole('button', { name: 'Finalitzar visita' }).click()
  await page.getByRole('region', { name: 'Finalitzar visita' }).getByRole('button', { name: 'Confirmar i finalitzar' }).click()
  await expect(page.getByText(/Visita finalitzada/)).toBeVisible()
}

async function marcar(page: Page, consulta: string, codi: string) {
  const cerca = page.getByRole('searchbox', { name: /Cerca un punt/ })
  await cerca.fill(consulta)
  await cerca.press('Enter')
  const fitxa = page.getByRole('region', { name: codi })
  await fitxa.getByRole('radio', { name: 'Bilateral' }).click()
  await fitxa.getByRole('button', { name: 'Marcar' }).click()
}

test('blocs 1 i 2', async ({ page }, info) => {
  const projecte = info.project.name
  await entrar(page)
  await pacient(page, 'Marta', 'Blocs Inventada')
  await cita(page, 'Marta', '10:00', 'Lumbàlgia')
  await cita(page, 'Marta', '12:00', 'Lumbàlgia')

  // Primera sessió: diagnòstic i pla, i dos punts
  await comencar(page)
  await pestanya(page, 'Diagnòstic').click()
  const boto = page.locator('.capcalera-seccio button').filter({ hasText: 'Els vuit principis' }).first()
  await boto.click()
  await page.getByRole('region', { name: 'Els vuit principis', exact: true }).getByRole('group', { name: 'Interior o exterior', exact: true }).getByRole('button', { name: /^Interior/ }).click()
  const pla = page.getByRole('region', { name: 'Pla de tractament' })
  await pla.getByLabel('Sessions previstes').fill('10')
  await pla.getByRole('group', { name: 'Freqüència' }).getByRole('button', { name: 'Setmanal' }).click()
  await pestanya(page, 'Tractament').click()
  await marcar(page, 'LI4', 'LI4')
  await marcar(page, 'zusanli', 'ST36')
  await finalitzar(page)

  // Bloc 2: la capçalera i la barra mentre es desa i es puja, i un cop desat
  await comencar(page)
  await capcalera(page).getByRole('button', { name: 'Agulles posades: començar' }).click()
  await pestanya(page, 'Com està').click()
  await expect(page.locator('.indicador-copia')).toHaveAttribute('aria-label', 'Drive: al dia', { timeout: 30_000 })
  // Drive tarda a respondre: la píndola es queda uns segons «pujant» o «pendent»
  await page.context().route('https://www.googleapis.com/upload/**', async (route) => {
    await new Promise((r) => setTimeout(r, 4000))
    await route.fallback()
  })
  await page.getByLabel('Canvis des de l\'última sessió').fill('Dorm millor (inventat)')
  await expect(page.locator('.indicador-copia')).not.toHaveAttribute('aria-label', 'Drive: al dia', { timeout: 10_000 })
  await capturar(page, 'b2-desant-i-pujant', projecte, ['light'])
  await expect(page.locator('.indicador-copia')).toHaveAttribute('aria-label', 'Drive: al dia', { timeout: 30_000 })
  await expect(capcalera(page).getByRole('status')).toHaveText('Desat')
  await capturar(page, 'b2-desat-i-al-dia', projecte, ['light'])
  await page.context().unroute('https://www.googleapis.com/upload/**')

  // Bloc 1: diagnòstic de la valoració, de només lectura (la segona sessió)
  await pestanya(page, 'Diagnòstic').click()
  await page.locator('.capcalera-seccio button').filter({ hasText: 'Els vuit principis' }).first().click()
  await page.locator('.franja-lectura').evaluate((e) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 220))
  await capturar(page, 'b1-diagnostic-lectura', projecte)
  await finalitzar(page)

  // Bloc 1: la primera sessió, 25 hores després (només lectura)
  await page.clock.fastForward('25:00:00')
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Marta Blocs Inventada/ }).click()
  await page.getByRole('link', { name: 'Tractaments' }).click()
  await page.getByRole('link', { name: /^Sessió 1/ }).click()
  await pestanya(page, 'Tractament').click()
  // (a la tauleta vertical, la llista és a sota del mapa, dins la mateixa zona desplaçable)
  await page.locator('.disseny-mapa').first().evaluate((e) => e.scrollTo(0, e.scrollHeight))
  await page.getByRole('tab', { name: /Marcats/ }).click()
  await page.locator('.disseny-mapa').first().evaluate((e) => e.scrollTo(0, e.scrollHeight))
  await page.getByRole('region', { name: 'Punts marcats' }).getByRole('button', { name: /LI4/ }).click()
  await expect(page.getByRole('region', { name: 'LI4' })).toBeVisible()
  await page.waitForTimeout(800)
  await capturar(page, 'b1-tancada-tractament', projecte)
  await page.locator('.avis-sessio-tancada').getByRole('button', { name: 'Afegir una addenda' }).click()
  await page.getByLabel('Nova addenda').fill('Ha trucat: va millor (inventat)')
  await capturar(page, 'b1-tancada-addenda', projecte)
})
