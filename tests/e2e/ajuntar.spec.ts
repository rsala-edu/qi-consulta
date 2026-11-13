// Ajuntar dues fitxes de la mateixa persona (part 2): comparació, cites
// repetides, fitxa arxivada «Ajuntada amb …», «Desfer», i una cita creada a la
// fitxa vella en un altre dispositiu que acaba a la que es queda. Només dades inventades.
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test'
import { continuarAmbGoogle, expect as expectBase, simularGoogle, test, type GoogleSimulat } from './google.js'

const expect = expectBase.configure({ timeout: 20_000 })
const P = 'contrasenya-inventada-ajuntar'
// Dimecres 4 de novembre de 2026, a les 9:00
const ARA = new Date(2026, 10, 4, 9, 0)

test.describe.configure({ timeout: 240_000 })

const menu = (page: Page, nom: string) =>
  page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom })

async function entrar(page: Page) {
  await page.clock.install({ time: ARA })
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByLabel('Repeteix la contrasenya').fill(P)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

async function nouPacient(page: Page, nom: string, llinatges: string, telefon: string, professio = '') {
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill(nom)
  await page.getByLabel('Llinatges').fill(llinatges)
  await page.getByLabel('Telèfon').fill(telefon)
  if (professio) await page.getByLabel('Professió').fill(professio)
  await page.getByRole('button', { name: 'Desar' }).first().click()
  await expect(page.getByRole('heading', { name: `${nom} ${llinatges}` })).toBeVisible()
}

async function novaCita(page: Page, pacient: string, dia: string, hora: string) {
  await menu(page, 'Agenda').click()
  await page.getByRole('main').getByRole('button', { name: 'Nova cita', exact: true }).first().click()
  const dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  await dialeg.getByLabel('Data').fill(dia)
  await dialeg.getByLabel('Hora').fill(hora)
  await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).fill(pacient)
  await dialeg.getByRole('button', { name: new RegExp(pacient) }).first().click()
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(dialeg).toBeHidden()
}

async function obrirFitxa(page: Page, nom: string, arxivada = false) {
  await menu(page, 'Pacients').click()
  if (arxivada) await page.getByLabel('Mostrar arxivats').check()
  await page.getByRole('list', { name: 'Pacients' }).getByRole('link', { name: new RegExp(nom) }).click()
  await expect(page.getByRole('heading', { name: nom })).toBeVisible()
}

async function altreNavegador(browser: Browser, info: TestInfo, google: GoogleSimulat): Promise<{ context: BrowserContext; page: Page }> {
  const { viewport, baseURL, locale, isMobile, hasTouch, userAgent, deviceScaleFactor } = info.project.use
  const context = await browser.newContext({ viewport, baseURL, locale, isMobile, hasTouch, userAgent, deviceScaleFactor })
  await simularGoogle(context, google)
  const page = await context.newPage()
  return { context, page }
}

async function desarAra(page: Page) {
  await page.bringToFront()
  await page.locator('.indicador-copia').click()
  const panell = page.getByRole('dialog', { name: 'Còpia a Google Drive' })
  const boto = panell.getByRole('button', { name: /Desar ara a Drive|Tornar-ho a provar/ })
  if (await boto.isVisible()) await boto.click()
  await expect(page.locator('.indicador-copia')).toHaveAttribute('aria-label', 'Drive: al dia')
  await page.keyboard.press('Escape')
}

test('ajuntar dues fitxes: comparació, cita repetida, cita d\'un altre dispositiu redirigida i desfer', async ({ page, google, browser }, info) => {
  test.skip(info.project.name !== 'escriptori', 'Amb dos navegadors, una vegada n\'hi ha prou')
  await entrar(page)
  await nouPacient(page, 'Carla', 'Exemple', '600 111 222')
  await nouPacient(page, 'Karla', 'Exemple', '600 999 888', 'Mestra')
  // La mateixa cita a totes dues fitxes (mateix dia, hora i durada) i una altra només a la segona
  await novaCita(page, 'Carla Exemple', '2026-11-05', '10:00')
  await novaCita(page, 'Karla Exemple', '2026-11-05', '10:00')
  await novaCita(page, 'Karla Exemple', '2026-11-12', '10:00')
  await desarAra(page)

  // L'altre dispositiu recupera les dades
  const b = await altreNavegador(browser, info, google)
  await b.page.clock.install({ time: ARA })
  await b.page.goto('/qi-consulta/')
  await continuarAmbGoogle(b.page)
  await b.page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await b.page.getByRole('button', { name: 'Obrir' }).click()
  await expect(b.page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()

  // A ajunta Karla a Carla
  await page.bringToFront()
  await obrirFitxa(page, 'Carla Exemple')
  await page.getByRole('link', { name: 'Ajuntar amb una altra fitxa…' }).click()
  await page.getByRole('searchbox', { name: 'Cerca per nom o telèfon' }).fill('Karla')
  await page.getByRole('list', { name: 'Ajuntar fitxes' }).getByRole('link', { name: /Karla Exemple/ }).click()

  const diferents = page.getByRole('region', { name: 'Diferents: tria quin es queda' })
  // El nom: per defecte el més recent (Karla); es tria Carla
  const nom = diferents.getByRole('group', { name: 'Nom' })
  await expect(nom.getByRole('radio', { name: /Karla/ })).toBeChecked()
  await nom.getByRole('radio', { name: /Carla/ }).check()
  await expect(diferents.getByRole('group', { name: 'Telèfon' })).toBeVisible()
  // La professió només és a una fitxa: es queda sense triar res; els llinatges són iguals
  await expect(page.getByRole('region', { name: 'Només en una fitxa (es queda)' })).toContainText('Mestra')
  await expect(page.getByRole('region', { name: 'Iguals a totes dues' })).toContainText('Exemple')
  await expect(page.getByRole('note').filter({ hasText: 'se\'n quedarà una' })).toContainText('1 cites són a totes dues fitxes')
  await page.getByRole('button', { name: 'Confirmar: ajuntar les fitxes' }).click()

  await expect(page.getByRole('heading', { name: 'Carla Exemple' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Fitxes ajuntades' })).toContainText('1 cites')
  await expect(page.getByText('S\'han tret 1 cites repetides')).toBeVisible()
  await expect(page.getByLabel('Professió')).toHaveValue('Mestra')

  // Mentrestant, B (que encara no ho sap) dona una cita a la fitxa vella
  await b.page.bringToFront()
  await novaCita(b.page, 'Karla Exemple', '2026-11-19', '10:00')

  await desarAra(page)
  await desarAra(b.page)
  await desarAra(b.page)
  await desarAra(page)

  // A tots dos dispositius, Carla té les tres cites i Karla és arxivada «Ajuntada»
  for (const x of [page, b.page]) {
    await x.bringToFront()
    await obrirFitxa(x, 'Carla Exemple')
    await x.getByRole('link', { name: 'Cites', exact: true }).click()
    for (const dia of ['5 de novembre', '12 de novembre', '19 de novembre']) await expect(x.getByRole('main')).toContainText(dia)
    await menu(x, 'Pacients').click()
    await expect(x.getByRole('list', { name: 'Pacients' }).getByRole('link', { name: /Karla/ })).toHaveCount(0)
    await x.getByLabel('Mostrar arxivats').check()
    await expect(x.getByRole('list', { name: 'Pacients' }).getByRole('link', { name: /Karla/ })).toContainText('Ajuntada')
  }

  // Desfer (a A): les cites de Karla tornen, també la de B i la repetida
  await page.bringToFront()
  await obrirFitxa(page, 'Karla Exemple', true)
  await expect(page.getByRole('note').filter({ hasText: 'es va ajuntar amb Carla Exemple' })).toBeVisible()
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: /^Desfer \(fins al/ }).click()
  await expect(page.getByText('Ajuntament desfet')).toBeVisible()
  await page.getByRole('link', { name: 'Cites', exact: true }).click()
  for (const dia of ['5 de novembre', '12 de novembre', '19 de novembre']) await expect(page.getByRole('main')).toContainText(dia)
  await obrirFitxa(page, 'Carla Exemple')
  await expect(page.getByLabel('Professió')).toHaveValue('')
  await page.getByRole('link', { name: 'Cites', exact: true }).click()
  await expect(page.getByRole('main')).toContainText('5 de novembre')
  await expect(page.getByRole('main')).not.toContainText('12 de novembre')
  await b.context.close()
})
