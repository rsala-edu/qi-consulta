// Ajudes compartides per a les proves de la visita (etapa 3B). Només dades inventades.
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test'
import { continuarAmbGoogle, expect as expectBase, simularGoogle, type GoogleSimulat } from './google.js'

export const expect = expectBase.configure({ timeout: 20_000 })
export const P = 'contrasenya-inventada-3b'
/** Dimecres 4 de novembre de 2026, a les 9:00 */
export const ARA = new Date(2026, 10, 4, 9, 0)

export const menu = (page: Page, nom: string) =>
  page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom })
export const pestanya = (page: Page, nom: string) => page.getByRole('tablist', { name: 'Visita' }).getByRole('tab', { name: nom })
export const capcalera = (page: Page) => page.locator('.capcalera-visita')

export async function entrar(page: Page, ara: Date | null = ARA) {
  if (ara) await page.clock.install({ time: ara })
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByLabel('Repeteix la contrasenya').fill(P)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

export async function nouPacient(page: Page, nom: string, llinatges: string, sexe = 'Dona') {
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill(nom)
  await page.getByLabel('Llinatges').fill(llinatges)
  await page.getByLabel('Sexe').selectOption({ label: sexe })
  await page.getByRole('button', { name: 'Desar' }).first().click()
  await expect(page.getByRole('heading', { name: `${nom} ${llinatges}` })).toBeVisible()
}

export async function novaCita(page: Page, pacient: string, dia: string, hora: string, motiu = '') {
  await menu(page, 'Agenda').click()
  await page.getByRole('main').getByRole('button', { name: 'Nova cita', exact: true }).first().click()
  const dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  await dialeg.getByLabel('Data').fill(dia)
  await dialeg.getByLabel('Hora').fill(hora)
  await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).fill(pacient)
  await dialeg.getByRole('button', { name: new RegExp(pacient) }).first().click()
  if (motiu) await dialeg.getByLabel('Motiu').fill(motiu)
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(dialeg).toBeHidden()
}

export async function comencarVisita(page: Page) {
  await menu(page, 'Avui').click()
  await page.getByRole('button', { name: /^(Començar visita|Continuar la visita)$/ }).first().click()
  await expect(capcalera(page)).toBeVisible()
}

export async function finalitzar(page: Page) {
  await capcalera(page).getByRole('button', { name: 'Finalitzar visita' }).click()
  const panell = page.getByRole('region', { name: 'Finalitzar visita' })
  await panell.getByRole('button', { name: 'Confirmar i finalitzar' }).click()
  await expect(page.getByText(/Visita finalitzada/)).toBeVisible()
}

/** Obre una secció plegable d'un catàleg i torna la seva regió */
export async function obrirSeccio(page: Page, nom: string | RegExp) {
  const boto = page.locator('.capcalera-seccio button').filter({ hasText: nom }).first()
  if ((await boto.getAttribute('aria-expanded')) !== 'true') await boto.click()
  return page.getByRole('region', { name: nom, exact: typeof nom === 'string' })
}

/** Toca un xip dins un camp (grup) d'una secció */
export async function xip(regio: ReturnType<Page['getByRole']>, camp: string, opcio: string | RegExp) {
  await regio.getByRole('group', { name: camp, exact: true }).getByRole('button', { name: opcio }).click()
}

export async function estatDesat(page: Page) {
  await expect(page.locator('.pestanya-valoracio [role="status"]').first()).toHaveText(/Desat/)
}

/** Un altre navegador amb el mateix compte (el mateix Drive simulat) */
export async function altreNavegador(browser: Browser, info: TestInfo, google: GoogleSimulat): Promise<{ context: BrowserContext; page: Page }> {
  const { viewport, baseURL, locale, isMobile, hasTouch, userAgent, deviceScaleFactor } = info.project.use
  const context = await browser.newContext({ viewport, baseURL, locale, isMobile, hasTouch, userAgent, deviceScaleFactor })
  await simularGoogle(context, google)
  const page = await context.newPage()
  return { context, page }
}

export async function obrirAltre(b: { page: Page }, ara: Date = ARA) {
  await b.page.clock.install({ time: ara })
  await b.page.goto('/qi-consulta/')
  await continuarAmbGoogle(b.page)
  await b.page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await b.page.getByRole('button', { name: 'Obrir' }).click()
  await expect(b.page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

export async function desarAra(page: Page) {
  await page.bringToFront()
  await page.locator('.indicador-copia').click()
  const panell = page.getByRole('dialog', { name: 'Còpia a Google Drive' })
  const boto = panell.getByRole('button', { name: /Desar ara a Drive|Tornar-ho a provar/ })
  if (await boto.isVisible()) await boto.click()
  await expect(page.locator('.indicador-copia')).toHaveAttribute('aria-label', 'Drive: al dia')
  await page.keyboard.press('Escape')
}

/** Ajustos > Catàlegs: activa escales amb llicència d'ús clínic (MYMOP, SNOT-22) */
export async function activarEscales(page: Page, noms: readonly string[]) {
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /^Catàlegs/ }).click()
  const seccio = page.getByRole('region', { name: 'Escales amb llicència' })
  for (const nom of noms) await seccio.getByRole('checkbox', { name: `Activar el ${nom}` }).check()
}
