// Disseny de la visita (revisió de la 3B, part B): capçalera en una fila,
// escala 0–10 en barra (tocar i lliscar), símptomes secundaris amagats fins
// que s'afegeixen i la pestanya Tractament sense desplaçar la pàgina.
// Només dades inventades.
import { test } from './google.js'
import { capcalera, comencarVisita, entrar, expect, novaCita, nouPacient, pestanya } from './ajudes-visita.js'

test.describe.configure({ timeout: 240_000 })

test('visita: capçalera en una fila, escala en barra, secundaris a demanda i Tractament sense desplaçar la pàgina', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Aina', 'Provencal Inventada')
  await novaCita(page, 'Aina', '2026-11-04', '10:00', 'Lumbàlgia')
  await comencarVisita(page)

  // Capçalera en una sola fila
  const caixa = (await capcalera(page).boundingBox())!
  expect(caixa.height).toBeLessThan(90)

  // Escala: una sola fila d'11 caselles; es tria tocant o lliscant
  await pestanya(page, 'Com està').click()
  const escala = page.getByRole('radiogroup', { name: 'Símptoma principal (0–10)' })
  const caselles = escala.getByRole('radio')
  await expect(caselles).toHaveCount(11)
  const primera = (await caselles.first().boundingBox())!
  const darrera = (await caselles.last().boundingBox())!
  expect(Math.abs(primera.y - darrera.y)).toBeLessThan(2)
  await caselles.nth(2).click()
  await expect(caselles.nth(2)).toHaveAttribute('aria-checked', 'true')
  // Lliscar del 2 al 8
  const de = (await caselles.nth(2).boundingBox())!
  const a = (await caselles.nth(8).boundingBox())!
  await page.mouse.move(de.x + de.width / 2, de.y + de.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(caselles.nth(8)).toHaveAttribute('aria-checked', 'true')
  await expect(escala.getByRole('radio', { checked: true })).toHaveCount(1)
  // Tocar el triat el treu
  await caselles.nth(8).click()
  await expect(escala.getByRole('radio', { checked: true })).toHaveCount(0)
  // Amb el teclat
  await caselles.first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(caselles.nth(0)).toHaveAttribute('aria-checked', 'true')

  // Símptomes secundaris: amagats; «+ Afegir símptoma secundari», fins a 2
  await expect(page.getByLabel('Símptoma secundari 1 · Quin')).toHaveCount(0)
  const afegir = page.getByRole('button', { name: '+ Afegir símptoma secundari' })
  await afegir.click()
  await expect(page.getByLabel('Símptoma secundari 1 · Quin')).toBeFocused()
  await page.getByLabel('Símptoma secundari 1 · Quin').fill('Insomni (inventat)')
  await afegir.click()
  await expect(page.getByLabel('Símptoma secundari 2 · Quin')).toBeVisible()
  await expect(afegir).toHaveCount(0)
  // En tornar, el que té alguna cosa es veu; el buit, no
  await pestanya(page, 'Exploració').click()
  await pestanya(page, 'Com està').click()
  await expect(page.getByLabel('Símptoma secundari 1 · Quin')).toHaveValue('Insomni (inventat)')
  await expect(page.getByLabel('Símptoma secundari 2 · Quin')).toHaveCount(0)

  // Tractament: el mapa ocupa l'alçada que queda i la pàgina no es desplaça
  await pestanya(page, 'Tractament').click()
  await expect(page.getByRole('searchbox', { name: /Cerca un punt/ })).toBeVisible()
  const desplacament = await page.evaluate(() => document.scrollingElement!.scrollHeight - window.innerHeight)
  expect(desplacament).toBeLessThanOrEqual(1)
  const visor = (await page.locator('.mapa-visita .zona-visor').first().boundingBox())!
  expect(visor.y + visor.height).toBeGreaterThan((page.viewportSize()!.height) * 0.8)
  // La barra fina, sobre el mapa
  await expect(page.locator('.capcalera-mapa .barra-tractament')).toBeVisible()
})
