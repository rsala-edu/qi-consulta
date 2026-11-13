// Captures de l'etapa 3C (evolució del pacient): un episodi inventat de 8
// sessions (l'escala baixa de 8 a 3 amb un rebrot) i un altre d'una sola
// sessió. No són proves. Només dades inventades.
//
//   CAPTURES_SUFIX=3c npx playwright test -c playwright.disseny.config.ts evolucio
import { mkdirSync } from 'node:fs'
import type { Locator, Page } from '@playwright/test'
import { continuarAmbGoogle, expect, test } from '../e2e/google.js'
import { cervicalgiaInventada, crearEpisodiInventat, idPacient } from '../e2e/evolucio-dades.js'

const SUFIX = process.env.CAPTURES_SUFIX ?? 'proves'
const P = 'contrasenya-inventada-3c'
test.describe.configure({ timeout: 300_000 })
test.use({ actionTimeout: 20_000 })

const menu = (page: Page, nom: string) => page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom, exact: true })

/** La pantalla amb `on` a dalt (sota la capçalera), en clar i en fosc */
async function capturar(page: Page, on: Locator, nom: string, projecte: string) {
  const carpeta = `docs/captures/evolucio/${projecte}`
  mkdirSync(carpeta, { recursive: true })
  await on.evaluate((e) => {
    const y = e.getBoundingClientRect().top + window.scrollY - 16
    window.scrollTo(0, Math.max(0, y))
  })
  for (const esquema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: esquema })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${carpeta}/${nom}-${SUFIX}-${esquema === 'light' ? 'clar' : 'fosc'}.jpg`, type: 'jpeg', quality: 82 })
  }
  await page.emulateMedia({ colorScheme: 'light' })
}

async function entrar(page: Page) {
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByLabel('Repeteix la contrasenya').fill(P)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

async function pacient(page: Page, nom: string, llinatges: string): Promise<string> {
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill(nom)
  await page.getByLabel('Llinatges').fill(llinatges)
  await page.getByRole('button', { name: 'Desar' }).first().click()
  await expect(page.getByRole('heading', { name: `${nom} ${llinatges}` })).toBeVisible()
  return idPacient(page, `${nom} ${llinatges}`)
}

async function tractaments(page: Page, qui: RegExp) {
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: qui }).click()
  await page.getByRole('link', { name: 'Tractaments' }).click()
}

test('3C: evolució del pacient', async ({ page }, info) => {
  const projecte = info.project.name
  const tactil = !!info.project.use.hasTouch
  await entrar(page)
  const carme = await pacient(page, 'Carme', 'Evolució Inventada')
  await crearEpisodiInventat(page, cervicalgiaInventada(carme))
  const dolors = await pacient(page, 'Dolors', 'Una Sessió Inventada')
  await crearEpisodiInventat(page, {
    pacientId: dolors,
    motiu: 'Lumbàlgia',
    sessions: [{ dia: '2026-11-11', escala: 6, punts: [{ codi: 'BL23' }, { codi: 'BL40' }, { codi: 'GV4' }], retencio: 25 }],
  })

  await tractaments(page, /Carme Evolució Inventada/)
  const episodi = page.getByRole('article', { name: 'Cervicàlgia' })

  // 1. El gràfic de l'escala amb els secundaris (i el globus d'una sessió)
  await episodi.getByRole('switch', { name: 'Mostrar els símptomes secundaris' }).check()
  const grafic = episodi.getByRole('group', { name: 'Escala del símptoma principal (0–10)' })
  const s5 = grafic.getByRole('button', { name: /^Sessió 5,/ })
  if (tactil) await s5.tap()
  else await s5.hover()
  await capturar(page, episodi.locator('.apartat-evolucio'), '1-grafic-escala', projecte)

  // 2. Punts més usats: barres, llista i al mapa
  const usats = episodi.getByRole('region', { name: 'Punts més usats' })
  await usats.getByRole('radio', { name: 'Barres' }).click()
  await capturar(page, usats, '2-punts-barres', projecte)
  await usats.getByRole('radio', { name: 'Llista' }).click()
  await capturar(page, usats, '2-punts-llista', projecte)
  await usats.getByRole('radio', { name: 'Al mapa' }).click()
  await expect(usats.getByTestId('visor2d')).toBeVisible({ timeout: 60_000 })
  await usats.getByTestId('visor2d').locator('.marcador-2d[data-id^="ST36|"]').first().click()
  await capturar(page, usats, '2-punts-mapa', projecte)
  await usats.getByRole('radio', { name: 'Barres' }).click()

  // 3. Comparar la primera i l'última
  await episodi.getByRole('button', { name: 'Comparar' }).click()
  await capturar(page, episodi.getByRole('region', { name: 'Comparar dues sessions' }), '3-comparar', projecte)
  await episodi.getByRole('button', { name: 'Tancar la comparació' }).click()

  // 4. La cronologia
  await capturar(page, episodi.getByRole('region', { name: 'Sessions' }), '4-cronologia', projecte)

  // 5. El minigràfic a «Com està» (la sessió 8)
  await episodi.getByRole('link', { name: /^Sessió 8/ }).click()
  await page.getByRole('tablist', { name: 'Visita' }).getByRole('tab', { name: 'Com està' }).click()
  await expect(page.getByRole('img', { name: /Evolució de l'escala/ })).toBeVisible()
  await capturar(page, page.locator('.capcalera-visita'), '5-minigrafic', projecte)

  // 6. Una sola sessió
  await tractaments(page, /Dolors Una Sessió Inventada/)
  await capturar(page, page.getByRole('article', { name: 'Lumbàlgia' }), '6-una-sessio', projecte)
})
