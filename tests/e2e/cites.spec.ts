// Agenda (dia i setmana), cites lligades al pacient, avís de solapament i
// pestanya Cites de la fitxa del pacient. Només dades inventades.
import { type Locator, type Page } from '@playwright/test'
import { continuarAmbGoogle, expect as expectBase, test } from './google.js'

const CONTRASENYA = 'contrasenya-de-prova-e2e'
const expect = expectBase.configure({ timeout: 10_000 })
/** Les dues cites que se solapen: una al costat de l'altra, cap sobre l'altra */
async function alCostat(dia: Locator) {
  const aina = dia.getByRole('button', { name: /10:00–11:00 Aina/ })
  const biel = dia.getByRole('button', { name: /10:30–11:30 Biel/ })
  await expect(aina).toBeVisible()
  await expect(biel).toBeVisible()
  const columna = (await dia.locator('.agenda-cos').boundingBox())!
  const a = (await aina.boundingBox())!
  const b = (await biel.boundingBox())!
  for (const x of [a, b]) {
    expect(x.width).toBeGreaterThan(columna.width * 0.4)
    expect(x.width).toBeLessThan(columna.width * 0.55)
  }
  // No es trepitgen: la de l'esquerra acaba abans que comenci l'altra
  const [esq, dre] = a.x < b.x ? [a, b] : [b, a]
  expect(esq.x + esq.width).toBeLessThanOrEqual(dre.x)
}

const menu = (page: Page, nom: string) =>
  page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom })

/** Un dilluns fix, perquè la prova no depengui del dia que es passa */
const DIA = '2026-11-02'

async function entrar(page: Page) {
  // Rellotge fix: el diumenge abans, perquè les cites de la prova siguin futures
  await page.clock.setFixedTime(new Date(2026, 10, 1, 8, 0))
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await page.getByLabel('Repeteix la contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

/** Sense recarregar (l'app es bloquejaria): només canvia la ruta */
async function anarAAgenda(page: Page) {
  await page.evaluate((dia) => {
    location.hash = `#/agenda?dia=${dia}&vista=dia`
  }, DIA)
}

async function nouPacient(page: Page, nom: string, llinatges: string) {
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill(nom)
  await page.getByLabel('Llinatges').fill(llinatges)
  await page.getByRole('button', { name: /Crear|Desar/ }).first().click()
  await expect(page.getByRole('heading', { name: `${nom} ${llinatges}` })).toBeVisible()
}

test('agenda: crear cites, avís de solapament, setmana i pestanya Cites del pacient', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Aina', 'Provencal Inventada')
  await nouPacient(page, 'Biel', 'Prova Inventat')

  await anarAAgenda(page)
  await expect(page.getByRole('heading', { name: 'dilluns, 2 de novembre de 2026' })).toBeVisible()
  const dia = page.getByRole('region', { name: 'Cites del dilluns, 2 de novembre de 2026' })

  // Tocar la franja de les 10:00 i triar l'Aina: és la seva primera cita, primera visita (60 min)
  await dia.getByRole('button', { name: 'Nova cita el dilluns, 2 de novembre de 2026 a les 10:00' }).click()
  let dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).fill('aina')
  await dialeg.getByRole('button', { name: /Aina Provencal Inventada/ }).click()
  await expect(dialeg.getByRole('status', { name: 'Tipus' })).toHaveText('Primera visita')
  await expect(dialeg.getByLabel('Durada (minuts)')).toHaveValue('60')
  await dialeg.getByLabel('Motiu').fill('Acúfens')
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(dialeg).toBeHidden()
  await expect(dia.getByRole('button', { name: /10:00–11:00 Aina Provencal Inventada/ })).toBeVisible()

  // Una altra a les 10:30 amb el Biel (la franja és sota la de l'Aina: amb
  // el botó «Nova cita»): avisa del solapament però es pot desar
  await page.getByRole('main').getByRole('button', { name: 'Nova cita', exact: true }).click()
  dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  await expect(dialeg.getByLabel('Data')).toHaveValue(DIA)
  await dialeg.getByLabel('Hora').fill('10:30')
  await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).fill('biel')
  await dialeg.getByRole('button', { name: /Biel Prova Inventat/ }).click()
  // El Biel encara no té cap cita: primera visita, sola
  await expect(dialeg.getByRole('status', { name: 'Tipus' })).toHaveText('Primera visita')
  await expect(dialeg.getByLabel('Durada (minuts)')).toHaveValue('60')
  await expect(dialeg.getByRole('alert')).toHaveText(
    'Coincideix amb la cita de Aina Provencal Inventada a les 10:00. Es pot desar igualment.',
  )
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(dia.getByRole('button', { name: /Se solapa/ })).toHaveCount(2)
  // Una al costat de l'altra, cadascuna amb la meitat de l'amplada (al dia i a la setmana)
  await alCostat(dia)
  await page.getByRole('radio', { name: 'Setmana' }).click()
  await alCostat(dia)
  await page.getByRole('radio', { name: 'Dia' }).click()

  // Moure la del Biel a les 11:00: ja no se solapa
  // Tocar la cita n'obre la fitxa; «Editar» obre el formulari
  await dia.getByRole('button', { name: /10:30–11:30 Biel/ }).click()
  dialeg = page.getByRole('dialog', { name: 'Cita de Biel Prova Inventat' })
  await expect(dialeg).toContainText('Primera visita')
  await dialeg.getByRole('button', { name: 'Editar' }).click()
  await dialeg.getByLabel('Hora').fill('11:00')
  await expect(dialeg.getByRole('alert')).toHaveCount(0)
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(dia.getByRole('button', { name: /11:00–12:00 Biel/ })).toBeVisible()
  await expect(dia.getByRole('button', { name: /Se solapa/ })).toHaveCount(0)

  // Vista de setmana: les dues cites el dilluns; el dimarts buit
  await page.getByRole('radio', { name: 'Setmana' }).click()
  await expect(page.getByRole('region', { name: /^Cites del / })).toHaveCount(7)
  await expect(dia.getByRole('button', { name: /Aina|Biel/ })).toHaveCount(2)
  const dimarts = page.getByRole('region', { name: 'Cites del dimarts, 3 de novembre de 2026' })
  await expect(dimarts.locator('.cita-agenda')).toHaveCount(0)
  await page.getByRole('button', { name: 'Següent', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Cites del dilluns, 9 de novembre de 2026' })).toBeVisible()

  // Pestanya Cites de l'Aina: marcar la cita com a feta
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Aina Provencal Inventada/ }).click()
  await page.getByRole('link', { name: 'Cites' }).click()
  const historial = page.getByRole('list', { name: 'Historial de cites' })
  await expect(historial.getByRole('listitem')).toHaveCount(1)
  await expect(historial).toContainText('dilluns, 2 de novembre de 2026, 10:00')
  await expect(historial).toContainText('Primera visita · Acúfens')
  await expect(historial).toContainText('Programada')
  await expect(historial).toContainText('Sense sessió')
  await historial.getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Estat').selectOption('feta')
  await page.getByRole('button', { name: 'Desar' }).click()
  await expect(historial).toContainText('Feta')
  await expect(page.getByRole('status').filter({ hasText: /^Fetes:/ })).toHaveText('Fetes: 1 · Anul·lades: 0 · No presentat: 0')

  // Nova cita des de la fitxa: el pacient ja hi és; després no presentat
  await page.getByRole('button', { name: 'Nova cita' }).click()
  const panell = page.getByRole('region', { name: 'Nova cita' })
  await expect(panell).toContainText('Aina Provencal Inventada')
  await panell.getByLabel('Data').fill('2026-11-09')
  await panell.getByLabel('Hora').fill('09:00')
  await panell.getByRole('button', { name: 'Desar' }).click()
  await expect(historial.getByRole('listitem')).toHaveCount(2)
  await historial.getByRole('listitem').filter({ hasText: '9 de novembre' }).getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Estat').selectOption('noPresentat')
  await page.getByRole('button', { name: 'Desar' }).click()
  await expect(page.getByRole('status').filter({ hasText: /^Fetes:/ })).toHaveText('Fetes: 1 · Anul·lades: 0 · No presentat: 1')

  // Es conserva després de tancar l'app
  await page.reload()
  await page.getByLabel('Contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(menu(page, 'Agenda')).toBeVisible()
  await anarAAgenda(page)
  await expect(dia.getByRole('button', { name: /10:00–11:00 Aina.*Feta/ })).toBeVisible()
})
