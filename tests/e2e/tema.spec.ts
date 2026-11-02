// Selector de tema: Sistema → Clar → Fosc → Sistema, desat al dispositiu i
// aplicat abans de pintar res.
import { type Page } from '@playwright/test'
import { continuarAmbGoogle, expect, test } from './google.js'

const CONTRASENYA = 'contrasenya-de-prova-e2e'

async function crearContrasenya(page: Page) {
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await page.getByLabel('Repeteix la contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

const fons = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

test('la icona del tema fa el cicle Sistema → Clar → Fosc i es manté en tornar a obrir l\'app', async ({ page }) => {
  // El sistema és clar: «com el sistema» es veu clar
  await page.emulateMedia({ colorScheme: 'light' })
  await crearContrasenya(page)
  const barra = page.getByRole('banner')
  const icona = barra.getByRole('button', { name: /^Tema:/ })
  await expect(icona).toHaveAccessibleName('Tema: com el sistema')
  await expect(icona).toHaveAttribute('title', 'Tema: com el sistema')
  const clar = await fons(page)

  await icona.click()
  await expect(icona).toHaveAccessibleName('Tema: clar')
  expect(await fons(page)).toBe(clar)
  await icona.click()
  await expect(icona).toHaveAccessibleName('Tema: fosc')
  // Paper fosc (#151917), un cop acabada la transició suau
  const fosc = 'rgb(21, 25, 23)'
  await expect.poll(() => fons(page)).toBe(fosc)

  // En tornar a obrir l'app, el tema ja hi és abans de pintar res
  await page.reload({ waitUntil: 'commit' })
  await page.waitForFunction(() => document.documentElement !== null)
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  // A la pantalla d'entrada també hi és la icona, petita
  const entrada = page.locator('.tema-entrada').getByRole('button', { name: 'Tema: fosc' })
  await expect(entrada).toBeVisible()
  expect(await fons(page)).toBe(fosc)

  // Un altre toc: torna a «com el sistema»
  await entrada.click()
  await expect(page.locator('.tema-entrada').getByRole('button')).toHaveAccessibleName('Tema: com el sistema')
  await expect.poll(() => fons(page)).toBe(clar)
})

test('Ajustos > Aparença: les tres opcions en un selector', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await crearContrasenya(page)
  await page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: 'Ajustos' }).click()
  await page.getByRole('link', { name: /Aparença/ }).click()
  const select = page.getByRole('combobox', { name: 'Tema' })
  await expect(select).toHaveValue('sistema')
  await expect(select.locator('option')).toHaveText(['Com el sistema', 'Clar', 'Fosc'])
  await select.selectOption('clar')
  await expect(page.getByRole('banner').getByRole('button', { name: 'Tema: clar' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
})
