// Recuperar les dades en un dispositiu nou a partir de la còpia de Drive.
// La còpia antiga la va fer el codi de la versió 13709c4 (abans de l'orella i
// de l'agenda nova), amb dades inventades: la versió actual l'ha d'obrir.
// La recuperació no escriu mai res a Drive si la còpia no es pot obrir.
import { readFileSync } from 'node:fs'
import { type Page } from '@playwright/test'
import { expect as expectBase, test, type GoogleSimulat } from './google.js'

const CONTRASENYA = 'contrasenya-de-prova-e2e'
const COPIA_ANTIGA = readFileSync(new URL('./dades/copia-versio-13709c4.json', import.meta.url), 'utf8')
const expect = expectBase.configure({ timeout: 20_000 })

function posarCopia(google: GoogleSimulat, contingut: string) {
  google.fitxers.set('copia-1', { id: 'copia-1', name: 'qi-dades.json', modifiedTime: '2026-10-20T09:00:00.000Z', contingut })
}

async function obrirIRecuperar(page: Page, contrasenya: string) {
  await page.getByLabel('Contrasenya', { exact: true }).fill(contrasenya)
  await page.getByRole('button', { name: 'Obrir' }).click()
}

test('una còpia feta per una versió anterior es recupera amb la versió actual', async ({ page, google }) => {
  posarCopia(google, COPIA_ANTIGA)
  await page.goto('/qi-consulta/')
  await page.getByRole('button', { name: 'Continuar amb Google' }).click()
  await expect(page.getByRole('heading', { name: 'Recuperar les dades' })).toBeVisible()

  // Contrasenya incorrecta: el seu missatge, no «error inesperat»
  await obrirIRecuperar(page, 'no-es-aquesta')
  await expect(page.getByRole('alert')).toHaveText('La contrasenya no és correcta.')
  expect(google.fitxers.get('copia-1')!.contingut).toBe(COPIA_ANTIGA)

  await obrirIRecuperar(page, CONTRASENYA)
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
  await expect(page.getByText(/error inesperat/)).toHaveCount(0)
  await page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: 'Pacients' }).click()
  await expect(page.getByRole('link', { name: /Aina Provencal Inventada/ })).toBeVisible()
  // L'agenda nova funciona amb la còpia antiga (horari per defecte)
  await page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: 'Agenda' }).click()
  await expect(page.getByTestId('graella-agenda')).toBeVisible()
})

test('recuperació amb el permís de Google caducat: les dades s\'obren igualment', async ({ page, google }) => {
  posarCopia(google, COPIA_ANTIGA)
  // El permís dura 70 s: amb el minut de marge, en 10 s ja no serveix
  google.durada = 70
  await page.goto('/qi-consulta/')
  await page.getByRole('button', { name: 'Continuar amb Google' }).click()
  await expect(page.getByRole('heading', { name: 'Recuperar les dades' })).toBeVisible()
  google.durada = 3599
  await page.waitForTimeout(10_500)

  // La còpia ja és al dispositiu: obrir-la no necessita Drive
  await obrirIRecuperar(page, CONTRASENYA)
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: 'Pacients' }).click()
  await expect(page.getByRole('link', { name: /Aina Provencal Inventada/ })).toBeVisible()
})

test('còpia danyada: missatge clar amb codi, i Drive intacte', async ({ page, google }) => {
  const danyada = COPIA_ANTIGA.slice(0, 200)
  posarCopia(google, danyada)
  await page.goto('/qi-consulta/')
  await page.getByRole('button', { name: 'Continuar amb Google' }).click()
  const alerta = page.getByRole('alert')
  await expect(alerta).toContainText('La còpia de Google Drive està danyada i no es pot obrir. No s\'ha tocat res de Drive.')
  await expect(alerta.locator('code')).toHaveText('REC-B')
  await expect(alerta.getByRole('button', { name: 'Copiar el codi' })).toBeVisible()
  expect(google.fitxers.get('copia-1')!.contingut).toBe(danyada)
  expect(google.peticions.some((p) => !p.startsWith('GET'))).toBe(false)
})

test('còpia d\'una versió més nova: missatge propi, i Drive intacte', async ({ page, google }) => {
  const nova = JSON.stringify({ ...JSON.parse(COPIA_ANTIGA), versio: 2 })
  posarCopia(google, nova)
  await page.goto('/qi-consulta/')
  await page.getByRole('button', { name: 'Continuar amb Google' }).click()
  await expect(page.getByRole('alert')).toContainText('l\'ha feta una versió més nova de Qi')
  expect(google.fitxers.get('copia-1')!.contingut).toBe(nova)
})
