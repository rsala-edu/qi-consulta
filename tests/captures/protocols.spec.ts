// Captures de la 4B (protocols de punts). No són proves. Només dades inventades.
//
//   CAPTURES_SUFIX=4b npx playwright test -c playwright.disseny.config.ts protocols
import { mkdirSync } from 'node:fs'
import type { Locator, Page } from '@playwright/test'
import { continuarAmbGoogle, expect, test } from '../e2e/google.js'
import { continuarSenseConsentiment } from '../e2e/ajudes-visita.js'

const SUFIX = process.env.CAPTURES_SUFIX ?? 'proves'
const P = 'contrasenya-inventada-4b'
test.describe.configure({ timeout: 300_000 })
test.use({ actionTimeout: 20_000 })

const menu = (page: Page, nom: string) => page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom, exact: true })

async function capturar(page: Page, nom: string, projecte: string, a?: Locator) {
  const carpeta = `docs/captures/4b/${projecte}`
  mkdirSync(carpeta, { recursive: true })
  if (a) await a.evaluate((e) => window.scrollTo(0, Math.max(0, e.getBoundingClientRect().top + window.scrollY - 16)))
  else await page.evaluate(() => window.scrollTo(0, 0))
  for (const esquema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: esquema })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${carpeta}/${nom}-${SUFIX}-${esquema === 'light' ? 'clar' : 'fosc'}.jpg`, type: 'jpeg', quality: 82 })
  }
  await page.emulateMedia({ colorScheme: 'light' })
}

const avui = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test('4B: protocols de punts', async ({ page }, info) => {
  const projecte = info.project.name
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByLabel('Repeteix la contrasenya').fill(P)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()

  // 1. Ajustos > Protocols, amb un de propi
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /^Protocols/ }).click()
  await page.getByRole('button', { name: 'Nou protocol' }).click()
  await page.getByLabel('Nom', { exact: true }).fill('Lumbàlgia (inventat)')
  await page.getByLabel('Descripció').fill('Punts locals i distals per al dolor lumbar.')
  await page.getByLabel(/^Etiquetes/).fill('Lumbàlgia, Dolor lumbar')
  for (const c of ['BL23', 'BL25', 'BL40', 'GV4']) {
    await page.getByLabel(/^Afegir un punt/).fill(c)
    await page.getByRole('button', { name: new RegExp(`^${c} `) }).first().click()
  }
  await page.getByLabel('GV4 · Tècnica').selectOption({ label: 'Moxa' })
  await capturar(page, '2-editor', projecte)
  await page.getByRole('button', { name: 'Desar el protocol' }).click()
  await capturar(page, '1-llista', projecte)

  // Pacient i cita d'avui (motiu: Lumbàlgia)
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill('Pere')
  await page.getByLabel('Llinatges').fill('Protocol Inventat')
  await page.getByRole('button', { name: 'Desar' }).first().click()
  await menu(page, 'Agenda').click()
  await page.getByRole('main').getByRole('button', { name: 'Nova cita', exact: true }).first().click()
  const dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  await dialeg.getByLabel('Data').fill(avui())
  await dialeg.getByLabel('Hora').fill(`${String(Math.min(22, new Date().getHours() + 1)).padStart(2, '0')}:00`)
  await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).fill('Pere')
  await dialeg.getByRole('button', { name: /Pere/ }).first().click()
  await dialeg.getByLabel('Motiu').fill('Lumbàlgia')
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await menu(page, 'Avui').click()
  await page.getByRole('button', { name: 'Començar visita' }).first().click()
  await continuarSenseConsentiment(page)

  // 3. Tractament > Protocols: els suggerits a dalt
  await page.getByRole('tablist', { name: 'Visita' }).getByRole('tab', { name: 'Tractament' }).click()
  await page.getByRole('button', { name: 'Protocols', exact: true }).click()
  const prot = page.getByRole('dialog', { name: 'Protocols' })
  await expect(prot.getByRole('region', { name: 'Protocols suggerits' })).toBeVisible()
  await capturar(page, '3-cercador-suggerits', projecte)
  await prot.getByRole('region', { name: 'Protocols suggerits' }).getByRole('button', { name: /Lumbàlgia/ }).click()

  // 4. Un altre: substituir o afegir
  await page.getByRole('button', { name: 'Protocols', exact: true }).click()
  await prot.getByRole('searchbox').fill('quatre')
  await prot.getByRole('button', { name: /Quatre portes/ }).click()
  await capturar(page, '4-substituir-o-afegir', projecte)
  await prot.getByRole('button', { name: 'Afegir-los' }).click()
  await page.waitForTimeout(800)
  await capturar(page, '5-aplicat', projecte)

  // 6. Finalitzar i la cronologia
  await page.locator('.capcalera-visita').getByRole('button', { name: 'Finalitzar visita' }).click()
  await page.getByRole('region', { name: 'Finalitzar visita' }).getByRole('button', { name: 'Confirmar i finalitzar' }).click()
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Pere Protocol Inventat/ }).click()
  await page.getByRole('link', { name: 'Tractaments' }).click()
  await capturar(page, '6-cronologia', projecte, page.locator('.sessions-episodi'))
})
