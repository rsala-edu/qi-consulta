// Agenda redissenyada: s'obre a l'hora actual, crear una cita tocant un
// espai buit, vistes Dia i Setmana, minicalendari i dies tancats.
// Rellotge fix (dimarts 3 de novembre de 2026, 16:20) i només dades inventades.
import { type Page } from '@playwright/test'
import { continuarAmbGoogle, expect as expectBase, test } from './google.js'

const CONTRASENYA = 'contrasenya-de-prova-e2e'
const expect = expectBase.configure({ timeout: 10_000 })
const ARA = new Date(2026, 10, 3, 16, 20)
const menu = (page: Page, nom: string) =>
  page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom })

async function entrar(page: Page, ara = ARA) {
  await page.clock.setFixedTime(ara)
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await page.getByLabel('Repeteix la contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

async function nouPacient(page: Page, nom: string, llinatges: string) {
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill(nom)
  await page.getByLabel('Llinatges').fill(llinatges)
  await page.getByRole('button', { name: /Crear|Desar/ }).first().click()
  await expect(page.getByRole('heading', { name: `${nom} ${llinatges}` })).toBeVisible()
}

/** El minicalendari: a l'ordinador, a la columna lateral; a la tauleta, en un desplegable */
async function minicalendari(page: Page) {
  const graella = page.getByRole('grid', { name: 'Calendari del mes' })
  await expect(page.getByTestId('graella-agenda')).toBeVisible()
  if (!(await graella.isVisible())) await page.getByRole('button', { name: 'Calendari' }).click()
  await expect(graella).toBeVisible()
  return graella
}

test('l\'Agenda s\'obre a l\'hora actual, amb la línia de l\'hora només avui', async ({ page }) => {
  await entrar(page)
  await menu(page, 'Agenda').click()
  // Setmana a l'ordinador i a la tauleta horitzontal
  await expect(page.getByRole('radio', { name: 'Setmana' })).toHaveAttribute('aria-checked', 'true')
  const graella = page.getByTestId('graella-agenda')
  const linia = page.locator('.linia-ara')
  await expect(linia).toHaveCount(1)
  await expect(linia).toHaveAttribute('data-minut', String(16 * 60 + 20))
  // La línia és dins la part visible de la graella (no a dalt de tot, a les 8:30)
  const caixa = (await graella.boundingBox())!
  const l = (await linia.boundingBox())!
  expect(l.y).toBeGreaterThan(caixa.y + 52)
  expect(l.y).toBeLessThan(caixa.y + caixa.height)
  // La línia és a la columna d'avui
  await expect(page.getByRole('region', { name: 'Cites del dimarts, 3 de novembre de 2026' }).locator('.linia-ara')).toHaveCount(1)
  // Setmana sense cites: missatge suau amb «Nova cita»
  const buida = page.getByRole('status').filter({ hasText: 'Aquesta setmana no hi ha cap cita.' })
  await expect(buida).toBeVisible()
  // Una franja sobre la graella: no tapa cap columna
  const franja = (await buida.boundingBox())!
  expect(franja.y + franja.height).toBeLessThanOrEqual(caixa.y)
})

test('tocar un espai buit crea una cita amb el dia i l\'hora posats', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Aina', 'Provencal Inventada')
  await menu(page, 'Agenda').click()
  const dijous = page.getByRole('region', { name: 'Cites del dijous, 5 de novembre de 2026' })
  await dijous.getByRole('button', { name: 'Nova cita el dijous, 5 de novembre de 2026 a les 11:15' }).click()
  const dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  await expect(dialeg.getByLabel('Data')).toHaveValue('2026-11-05')
  await expect(dialeg.getByLabel('Hora')).toHaveValue('11:15')
  await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).fill('aina')
  await dialeg.getByRole('button', { name: /Aina Provencal Inventada/ }).click()
  await dialeg.getByLabel('Tipus').selectOption('primera')
  await dialeg.getByLabel('Motiu').fill('Acúfens')
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(dialeg).toBeHidden()
  const cita = dijous.getByRole('button', { name: /11:15–12:15 Aina Provencal Inventada/ })
  // A la setmana: nom i hora d'inici a la vista; tota la informació al tooltip
  await expect(cita).toContainText('Aina Provencal Inventada')
  await expect(cita).toContainText('11:15')
  await expect(cita).toHaveAttribute('title', '11:15–12:15 Aina Provencal Inventada · Primera visita · Acúfens · 60 min')
  await expect(cita).toHaveClass(/tipus-primera/)
  // El missatge de setmana buida ja no hi és
  await expect(page.getByText('Aquesta setmana no hi ha cap cita.')).toHaveCount(0)
  // Tocar-la n'obre la fitxa; no és d'avui: sense «Començar visita»
  await cita.click()
  const fitxa = page.getByRole('dialog', { name: 'Cita de Aina Provencal Inventada' })
  await expect(fitxa).toContainText('11:15–12:15 · 60 min')
  await expect(fitxa.getByRole('button', { name: 'Començar visita' })).toHaveCount(0)
})

test('canviar de vista: es recorda en aquest dispositiu', async ({ page }) => {
  await entrar(page)
  await menu(page, 'Agenda').click()
  await expect(page.getByRole('region', { name: /^Cites del / })).toHaveCount(7)
  await page.getByRole('radio', { name: 'Dia' }).click()
  await expect(page.getByRole('region', { name: /^Cites del / })).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'dimarts, 3 de novembre de 2026' })).toBeVisible()
  // Sortir i tornar a entrar a l'Agenda: continua en «Dia»
  await menu(page, 'Avui').click()
  await menu(page, 'Agenda').click()
  await expect(page.getByRole('radio', { name: 'Dia' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('region', { name: /^Cites del / })).toHaveCount(1)
  // ‹ i › van d'un dia a l'altre
  await page.getByRole('button', { name: 'Següent', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'dimecres, 4 de novembre de 2026' })).toBeVisible()
  await page.getByRole('button', { name: 'Avui', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'dimarts, 3 de novembre de 2026' })).toBeVisible()
})

test('el minicalendari salta a qualsevol dia i marca un dia com a tancat', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Biel', 'Prova Inventat')
  await menu(page, 'Agenda').click()
  let cal = await minicalendari(page)
  // Al mes següent, el 8 de desembre
  await page.getByRole('button', { name: 'Mes següent' }).click()
  await cal.getByRole('gridcell', { name: 'dimarts, 8 de desembre de 2026' }).click()
  const dia = page.getByRole('region', { name: 'Cites del dimarts, 8 de desembre de 2026' })
  await expect(dia).toBeVisible()
  await expect(page.getByRole('heading', { name: 'desembre de 2026' })).toBeVisible()

  // Marcar-lo com a tancat: surt ombrejat a la graella i al minicalendari
  cal = await minicalendari(page)
  // El dia triat ja és el marcat al calendari
  await expect(cal.getByRole('gridcell', { name: 'dimarts, 8 de desembre de 2026' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Marcar com a tancat' }).click()
  await expect(dia).toHaveClass(/tancat/)
  await expect(dia).toContainText('Tancat')
  cal = await minicalendari(page)
  await expect(cal.getByRole('gridcell', { name: 'dimarts, 8 de desembre de 2026 · Tancat' })).toHaveClass(/tancat/)

  // Una cita en un dia tancat: avisa, però deixa desar-la
  await dia.getByRole('button', { name: 'Nova cita el dimarts, 8 de desembre de 2026 a les 10:00' }).click()
  const dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  await expect(dialeg.getByRole('status')).toHaveText(
    'Atenció: aquest dia la consulta està tancada. Es pot desar igualment.',
  )
  // Fora d'horari en un dia obert, també
  await dialeg.getByLabel('Data').fill('2026-12-09')
  await dialeg.getByLabel('Hora').fill('20:30')
  await expect(dialeg.getByRole('status')).toContainText('fora de l\'horari de consulta (09:00–20:00)')
  await dialeg.getByLabel('Data').fill('2026-12-08')
  await dialeg.getByLabel('Hora').fill('10:00')
  await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).fill('biel')
  await dialeg.getByRole('button', { name: /Biel Prova Inventat/ }).click()
  await dialeg.getByLabel('Tipus').selectOption('primera')
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(dia.getByRole('button', { name: /10:00–11:00 Biel/ })).toBeVisible()

  // Tornar-lo a obrir
  await minicalendari(page)
  await page.getByRole('button', { name: 'Tornar a obrir' }).click()
  await expect(dia).not.toHaveClass(/tancat/)
})

test('Ajustos > Agenda: l\'horari canvia les hores de la graella', async ({ page }) => {
  await entrar(page)
  await menu(page, 'Ajustos').click()
  await page.getByRole('main').getByRole('link', { name: /^Agenda Horari/ }).click()
  const horari = page.getByRole('region', { name: 'Horari de consulta' })
  await expect(horari.getByLabel('Hora d\'inici')).toHaveValue('09:00')
  await expect(horari.getByLabel('Hora de final')).toHaveValue('20:00')
  await expect(horari.getByLabel('Dissabte')).not.toBeChecked()
  await horari.getByLabel('Hora d\'inici').fill('15:00')
  await horari.getByLabel('Dissabte').check()
  await horari.getByRole('button', { name: 'Desar' }).click()
  await expect(horari.getByRole('status')).toHaveText('Desat')

  await menu(page, 'Agenda').click()
  // La graella comença a les 14:30 (mitja hora abans)
  const dissabte = page.getByRole('region', { name: 'Cites del dissabte, 7 de novembre de 2026' })
  await expect(dissabte.getByRole('button', { name: /a les 14:30$/ })).toHaveCount(1)
  await expect(dissabte.getByRole('button', { name: /a les 14:15$/ })).toHaveCount(0)
  await expect(dissabte).not.toHaveClass(/tancat/)
})

test('a la tauleta, lliscar el dit canvia de setmana', async ({ page }) => {
  test.skip(test.info().project.name !== 'tauleta', 'Només a la tauleta (pantalla tàctil)')
  await entrar(page)
  await menu(page, 'Agenda').click()
  const caixa = (await page.getByTestId('graella-agenda').boundingBox())!
  const y = caixa.y + caixa.height / 2
  const cdp = await page.context().newCDPSession(page)
  const lliscar = async (x1: number, x2: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y }] })
    for (let i = 1; i <= 5; i++)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + ((x2 - x1) * i) / 5, y }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  // Cap a l'esquerra: la setmana següent
  await lliscar(caixa.x + caixa.width * 0.8, caixa.x + caixa.width * 0.3)
  await expect(page.getByRole('region', { name: 'Cites del dilluns, 9 de novembre de 2026' })).toBeVisible()
  // Cap a la dreta: torna enrere
  await lliscar(caixa.x + caixa.width * 0.3, caixa.x + caixa.width * 0.8)
  await expect(page.getByRole('region', { name: 'Cites del dilluns, 2 de novembre de 2026' })).toBeVisible()
})

test('a la tauleta vertical, per defecte la vista de dia', async ({ page }) => {
  test.skip(test.info().project.name !== 'tauleta', 'Només a la tauleta')
  await page.setViewportSize({ width: 640, height: 1024 })
  await entrar(page)
  await menu(page, 'Agenda').click()
  await expect(page.getByRole('radio', { name: 'Dia' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('region', { name: /^Cites del / })).toHaveCount(1)
})

test('ordinador: tota la jornada (8:30–20:30) a la pantalla sense desplaçar-se', async ({ page }) => {
  test.skip(test.info().project.name !== 'escriptori', 'A l\'ordinador')
  await page.setViewportSize({ width: 1440, height: 900 })
  await entrar(page)
  await menu(page, 'Agenda').click()
  const graella = page.getByTestId('graella-agenda')
  await expect(page.locator('.linia-ara')).toHaveCount(1)
  const mida = await graella.evaluate((g) => ({ scroll: g.scrollHeight, client: g.clientHeight, top: g.scrollTop }))
  expect(mida.scroll).toBeLessThanOrEqual(mida.client + 1)
  expect(mida.top).toBe(0)
  // Una hora fa com a mínim 48 px
  const hores = page.locator('.agenda-hores span')
  await expect(hores.first()).toHaveText('09:00')
  await expect(hores.last()).toHaveText('20:00')
  const h10 = (await hores.nth(1).boundingBox())!
  const h11 = (await hores.nth(2).boundingBox())!
  expect(h11.y - h10.y).toBeGreaterThanOrEqual(48)
})

test('quan cal desplaçar-se, la vista comença una hora abans de l\'hora actual, en punt', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 })
  // A les 11:20: la vista comença a les 10:00
  await entrar(page, new Date(2026, 10, 3, 11, 20))
  await menu(page, 'Agenda').click()
  const graella = page.getByTestId('graella-agenda')
  await expect(page.locator('.linia-ara')).toHaveCount(1)
  // Les 10:00 just sota la capçalera dels dies
  expect(await graella.evaluate((g) => g.scrollTop)).toBeGreaterThan(0)
  const caixa = (await graella.boundingBox())!
  const h10 = (await page.locator('.agenda-hores span', { hasText: '10:00' }).boundingBox())!
  expect(h10.y + h10.height / 2 - (caixa.y + 52)).toBeGreaterThanOrEqual(0)
  expect(h10.y + h10.height / 2 - (caixa.y + 52)).toBeLessThan(14)
})
