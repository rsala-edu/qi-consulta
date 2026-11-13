// Captures de la 4D (informes en PDF). No són proves. Desa també els tres PDF
// (només a ordinador-1440) per passar-ne les pàgines a imatge. Només dades
// inventades.
//
//   CAPTURES_SUFIX=4d npx playwright test -c playwright.disseny.config.ts informes
import { mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { Locator, Page } from '@playwright/test'
import { continuarAmbGoogle, expect, test } from '../e2e/google.js'
import { cervicalgiaInventada, crearEpisodiInventat, idPacient } from '../e2e/evolucio-dades.js'

const SUFIX = process.env.CAPTURES_SUFIX ?? 'proves'
const P = 'contrasenya-inventada-4d'
test.describe.configure({ timeout: 300_000 })
test.use({ actionTimeout: 20_000 })

const menu = (page: Page, nom: string) => page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom, exact: true })

async function capturar(page: Page, nom: string, projecte: string, a?: Locator) {
  const carpeta = `docs/captures/4d/${projecte}`
  mkdirSync(carpeta, { recursive: true })
  if (a) await a.evaluate((e) => window.scrollTo(0, Math.max(0, e.getBoundingClientRect().top + window.scrollY - 16)))
  for (const esquema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: esquema })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${carpeta}/${nom}-${SUFIX}-${esquema === 'light' ? 'clar' : 'fosc'}.jpg`, type: 'jpeg', quality: 82 })
  }
  await page.emulateMedia({ colorScheme: 'light' })
}

/** Genera l'informe; captura el diàleg i, si cal, desa el PDF */
async function informe(page: Page, boto: string, nom: string, projecte: string, desar: boolean) {
  await page.getByRole('button', { name: boto }).click()
  const dialeg = page.getByRole('dialog', { name: boto })
  await expect(dialeg.getByRole('status')).toHaveText('L\'informe és a punt.')
  await capturar(page, `${nom}-dialeg`, projecte)
  if (desar) {
    page.once('dialog', (d) => void d.accept())
    const [baixada] = await Promise.all([page.waitForEvent('download'), dialeg.getByRole('button', { name: 'Descarregar el PDF' }).click()])
    mkdirSync('docs/captures/4d/pdf', { recursive: true })
    writeFileSync(`docs/captures/4d/pdf/${nom}.pdf`, await readFile((await baixada.path())!))
  }
  await dialeg.getByRole('button', { name: 'Tancar' }).click()
}

test('4D: informes en PDF', async ({ page }, info) => {
  const projecte = info.project.name
  const desar = projecte === 'ordinador-1440'
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByLabel('Repeteix la contrasenya').fill(P)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()

  // Ajustos > Consulta
  await menu(page, 'Ajustos').click()
  await capturar(page, '01-ajustos', projecte)
  await page.getByRole('link', { name: /^Consulta/ }).click()
  await page.getByLabel('Nom de la consulta').fill('Consulta Inventada de Medicina Xinesa')
  await page.getByLabel('Nom de la doctora').fill('Dra. Marta Inventada')
  await page.getByLabel('Número de col·legiada').fill('07/00000')
  await page.getByLabel('Adreça').fill('Carrer Inventat, 1 · Palma')
  await page.getByLabel('Telèfon').fill('971 000 000')
  await page.getByRole('button', { name: 'Desar' }).click()
  await expect(page.getByRole('status')).toHaveText('Desat')
  await capturar(page, '02-consulta', projecte)

  // Un episodi inventat amb vuit sessions
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill('Carme')
  await page.getByLabel('Llinatges').fill('Informe Inventada')
  await page.getByRole('button', { name: 'Desar' }).first().click()
  await expect(page.getByRole('heading', { name: 'Carme Informe Inventada' })).toBeVisible()
  await crearEpisodiInventat(page, cervicalgiaInventada(await idPacient(page, 'Carme Informe Inventada')))

  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Carme Informe Inventada/ }).click()
  await page.getByRole('link', { name: 'Tractaments' }).click()
  await capturar(page, '03-tractaments', projecte)
  await informe(page, 'Informe de l\'episodi', '04-episodi', projecte, desar)
  await informe(page, 'Historial complet', '05-historial', projecte, desar)

  // La darrera sessió, en lectura: pestanya Tancar
  await page.locator('.cronologia > li').last().getByRole('link').first().click()
  await page.getByRole('tablist', { name: 'Visita' }).getByRole('tab', { name: 'Tancar' }).click()
  await capturar(page, '06-tancar', projecte)
  await informe(page, 'Informe de la sessió', '07-sessio', projecte, desar)
})
