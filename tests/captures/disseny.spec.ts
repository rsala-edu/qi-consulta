// Captures d'abans i després de la part B de la revisió de la 3B (disseny).
// Funciona amb el codi d'abans i amb el de després: on el disseny nou té un
// botó que l'antic no tenia, només el toca si hi és. Només dades inventades.
//
//   CAPTURES_SUFIX=abans|despres npx playwright test -c playwright.disseny.config.ts
import { mkdirSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { continuarAmbGoogle, expect, test } from '../e2e/google.js'

const SUFIX = process.env.CAPTURES_SUFIX ?? 'proves'
const P = 'contrasenya-inventada-disseny'
test.describe.configure({ timeout: 300_000 })
test.use({ actionTimeout: 20_000 })

const dia = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** D'aquí a `h` hores, en punt */
const horaDaqui = (h: number) => `${String(Math.min(23, new Date().getHours() + h)).padStart(2, '0')}:00`

const menu = (page: Page, nom: string) => page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom, exact: true })
const pestanya = (page: Page, nom: string) => page.getByRole('tablist', { name: 'Visita' }).getByRole('tab', { name: nom })

/** La pantalla tal com es veu (des de dalt), en clar i en fosc */
async function capturar(page: Page, nom: string, projecte: string) {
  const carpeta = `docs/captures/disseny/${projecte}`
  mkdirSync(carpeta, { recursive: true })
  await page.evaluate(() => window.scrollTo(0, 0))
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

async function pacient(page: Page, nom: string, llinatges: string) {
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill(nom)
  await page.getByLabel('Llinatges').fill(llinatges)
  await page.getByRole('button', { name: 'Desar' }).first().click()
  await expect(page.getByRole('heading', { name: `${nom} ${llinatges}` })).toBeVisible()
}

async function cita(page: Page, qui: string, d: string, hora: string, motiu: string) {
  await menu(page, 'Agenda').click()
  await page.getByRole('main').getByRole('button', { name: 'Nova cita', exact: true }).first().click()
  const dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  await dialeg.getByLabel('Data').fill(d)
  await dialeg.getByLabel('Hora').fill(hora)
  await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).fill(qui)
  await dialeg.getByRole('button', { name: new RegExp(qui) }).first().click()
  await dialeg.getByLabel('Motiu').fill(motiu)
  await dialeg.getByRole('button', { name: /^(Desar|Registrar)/ }).click()
  await expect(dialeg).toBeHidden()
}

async function comencar(page: Page) {
  await menu(page, 'Avui').click()
  await page.getByRole('button', { name: /^(Començar visita|Continuar la visita)$/ }).first().click()
  await expect(page.locator('.capcalera-visita')).toBeVisible()
}

async function marcarCos(page: Page, cerca: string, codi: string, costat: string) {
  const fitxa = page.getByRole('region', { name: codi })
  // El cos es pot estar carregant encara: es torna a cercar fins que surt la fitxa del punt
  await expect(async () => {
    const camp = page.getByRole('searchbox', { name: /Cerca un punt/ })
    await camp.fill(cerca)
    await camp.press('Enter')
    await expect(fitxa).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 60_000 })
  // A la tauleta vertical, una barra fixa pot quedar a sobre: l'esdeveniment va directament al botó
  await fitxa.getByRole('radio', { name: costat }).dispatchEvent('click')
  await fitxa.getByRole('radio', { name: 'Agulla' }).dispatchEvent('click')
  const marcats = page.getByRole('tab', { name: /^Marcats/ })
  const abans = await marcats.textContent()
  await fitxa.getByRole('button', { name: 'Marcar' }).dispatchEvent('click')
  // S'ha marcat de debò
  await expect(marcats).not.toHaveText(abans ?? '')
}

async function obrirSeccio(page: Page, nom: string) {
  const boto = page.locator('.capcalera-seccio button').filter({ hasText: nom }).first()
  if ((await boto.getAttribute('aria-expanded')) !== 'true') await boto.click()
  return page.getByRole('region', { name: nom, exact: true })
}

test('disseny de la visita, la barra i el mapa', async ({ page }, info) => {
  const projecte = info.project.name
  await entrar(page)

  // B6 · Barra superior
  await capturar(page, '6-barra-avui', projecte)

  // Primera sessió: pla de 6 sessions, escala 7 i tres punts
  await pacient(page, 'Aina', 'Provencal Inventada')
  await cita(page, 'Aina', dia(0), horaDaqui(1), 'Lumbàlgia')
  await cita(page, 'Aina', dia(0), horaDaqui(2), 'Lumbàlgia')
  await comencar(page)
  const motiu = await obrirSeccio(page, 'Motiu de consulta i malaltia actual')
  await motiu.getByLabel('Motiu de consulta', { exact: true }).fill('Lumbàlgia de fa tres mesos (inventat)')
  await pestanya(page, 'Diagnòstic').click()
  await page.getByRole('region', { name: 'Pla de tractament' }).getByLabel('Sessions previstes').fill('6')
  await pestanya(page, 'Com està').click()
  await page.getByRole('radiogroup', { name: 'Símptoma principal (0–10)' }).getByRole('radio', { name: '7' }).click()
  await pestanya(page, 'Tractament').click()
  await marcarCos(page, 'LI4', 'LI4', 'Bilateral')
  await marcarCos(page, 'zusanli', 'ST36', 'Bilateral')
  await marcarCos(page, 'sanyinjiao', 'SP6', 'Esquerre')
  await page.locator('.capcalera-visita').getByRole('button', { name: 'Finalitzar visita' }).click()
  const panell = page.getByRole('region', { name: 'Finalitzar visita' })
  await panell.getByRole('button', { name: 'Confirmar i finalitzar' }).click()
  await expect(page.getByText(/Visita finalitzada/)).toBeVisible()

  // Segona sessió: «Sessió 2 de 6»
  await comencar(page)
  await expect(page.locator('.capcalera-visita')).toContainText('Sessió 2 de 6')
  // B1 · Capçalera i amplada (Valoració)
  await pestanya(page, 'Valoració').click()
  await obrirSeccio(page, 'Motiu de consulta i malaltia actual')
  await capturar(page, '1-visita-capcalera', projecte)

  // B3 i B4 · Escala i símptomes secundaris (Com està)
  await pestanya(page, 'Com està').click()
  await page.getByLabel('Canvis des de l\'última sessió').fill('Dorm millor; el dolor lumbar continua al matí (inventat).')
  await page.getByRole('radiogroup', { name: 'Símptoma principal (0–10)' }).getByRole('radio', { name: '4' }).click()
  await capturar(page, '3-4-escala-i-secundaris', projecte)
  const afegir = page.getByRole('button', { name: '+ Afegir símptoma secundari' })
  if (await afegir.isVisible()) await afegir.click()
  await page.getByLabel('Símptoma secundari 1 · Quin').fill('Insomni (inventat)')
  await page.getByRole('radiogroup', { name: 'Símptoma secundari 1 · Escala (0–10)' }).getByRole('radio', { name: '3' }).click()
  await capturar(page, '3-4-escala-amb-secundari', projecte)

  // B5 · «Normal / sense alteracions» (Exploració)
  await pestanya(page, 'Exploració').click()
  const shen = await obrirSeccio(page, 'Vitalitat (shen)')
  await shen.getByRole('group', { name: 'Shen', exact: true }).getByRole('button', { name: /^Present/ }).click()
  const tez = await obrirSeccio(page, 'Color de la tez')
  await tez.getByRole('button', { name: 'Normal / sense alteracions' }).click()
  await capturar(page, '5-normal', projecte)

  // B2 · Tractament (repetir l'última sessió i canviar-ne un punt)
  await pestanya(page, 'Tractament').click()
  await page.getByRole('button', { name: 'Repetir el tractament de l\'última sessió' }).click()
  await marcarCos(page, 'PC6', 'PC6', 'Bilateral')
  await page.waitForTimeout(1500)
  await capturar(page, '2-tractament', projecte)

  // B7 i B8 · Mapa: cos i orella
  await menu(page, 'Mapa').click()
  await marcarCos(page, 'LI4', 'LI4', 'Bilateral')
  await marcarCos(page, 'zusanli', 'ST36', 'Dret')
  await page.waitForTimeout(1500)
  await capturar(page, '7-mapa-cos', projecte)
  await page.getByRole('tab', { name: 'Orella' }).click()
  for (const codi of ['TF4', 'CO10', 'AH6a']) {
    const cerca = page.getByRole('searchbox', { name: /Cerca un punt de l'orella/ })
    await cerca.fill(codi)
    await cerca.press('Enter')
    await page.getByRole('region', { name: codi }).getByRole('button', { name: 'Marcar' }).dispatchEvent('click')
  }
  await page.waitForTimeout(800)
  await capturar(page, '8-orella', projecte)
  const zones = page.getByRole('button', { name: 'Mostrar zones' })
  if (await zones.isVisible()) {
    await zones.click()
    await capturar(page, '8-orella-zones', projecte)
  }
})
