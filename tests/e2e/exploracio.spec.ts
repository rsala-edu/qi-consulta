// Exploració amb catàlegs (etapa 3B, part 2): llengua amb zones, pols amb la
// graella de 6 posicions, punts dolorosos al mapa i, al seguiment, l'última
// exploració en gris amb «Igual que l'última». Només dades inventades.
import { test } from './google.js'
import { capcalera, comencarVisita, entrar, expect, finalitzar, novaCita, nouPacient, obrirSeccio, pestanya, xip } from './ajudes-visita.js'

test.describe.configure({ timeout: 240_000 })

test('exploració a la primera visita i, al seguiment, prefixada amb «Igual que l\'última»', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Nil', 'Exemple Inventat', 'Home')
  await novaCita(page, 'Nil', '2026-11-04', '10:00', 'Lumbàlgia')
  await comencarVisita(page)
  await pestanya(page, 'Exploració').click()

  // Llengua: xips i una zona (també amb el dibuix)
  const llengua = await obrirSeccio(page, 'Llengua')
  await xip(llengua, 'Cos: color', /^Pàl·lid/)
  await xip(llengua, 'Cos: forma', /^Inflada/)
  await xip(llengua, 'Cos: forma', /^Amb marques de dents/)
  await xip(llengua, 'Saburra: color', /^Blanca/)
  await xip(llengua, 'Zones de la llengua', /^Centre/)
  await expect(llengua.locator('.zona-llengua.triada')).toHaveCount(1)

  // Pols: velocitat, qualitats i la graella per posició
  const pols = await obrirSeccio(page, 'Pols')
  await pols.getByLabel('Velocitat').fill('64')
  await xip(pols, 'Qualitats (general)', /^Profund/)
  await xip(pols, 'Qualitats (general)', /^Feble/)
  await pols.getByRole('button', { name: 'Esquerra · Guan', exact: true }).click()
  await xip(pols, 'Esquerra · Guan', /^De corda/)
  await expect(pols.getByRole('button', { name: 'Esquerra · Guan', exact: true })).toHaveText('De corda')

  // Palpació: un punt dolorós al mapa, amb el seu color
  const palp = await obrirSeccio(page, 'Palpació')
  await palp.getByRole('button', { name: 'Marcar punts dolorosos al mapa' }).click()
  await palp.getByRole('searchbox', { name: /Cerca un punt/ }).fill('BL23')
  await palp.getByRole('searchbox', { name: /Cerca un punt/ }).press('Enter')
  const fitxa = palp.getByRole('region', { name: 'BL23' })
  await fitxa.getByRole('radio', { name: 'Bilateral' }).click()
  await expect(fitxa.getByRole('radio', { name: 'Dolor a la palpació' })).toHaveAttribute('aria-checked', 'true')
  await fitxa.getByRole('button', { name: 'Marcar' }).click()
  await expect(palp.getByRole('list', { name: 'Punts dolorosos' })).toContainText('BL23 · B')
  await palp.getByRole('button', { name: 'Tancar el mapa' }).click()
  await expect(capcalera(page).locator('.accions-visita [role="status"]')).toHaveText('Desat')
  // Els punts dolorosos no són agulles del tractament
  await pestanya(page, 'Tractament').click()
  await expect(page.getByRole('tab', { name: /Marcats \(0\)/ })).toBeVisible()
  await finalitzar(page)

  // Seguiment: l'última exploració surt en gris; un toc la copia tota
  await novaCita(page, 'Nil', '2026-11-04', '12:00')
  await comencarVisita(page)
  await pestanya(page, 'Exploració').click()
  const capLlengua = page.locator('.capcalera-seccio button').filter({ hasText: /^Llengua/ })
  await expect(capLlengua.locator('.resum-seccio.anterior')).toContainText('Última sessió: Pàl·lid · Inflada, Amb marques de dents · Blanca')
  // Una secció sola
  const pols2 = await obrirSeccio(page, 'Pols')
  await expect(pols2.locator('.anterior')).toContainText('Profund, Feble')
  await pols2.getByRole('button', { name: 'Igual que l\'última' }).click()
  await expect(pols2.getByRole('button', { name: 'Esquerra · Guan', exact: true })).toHaveText('De corda')
  await expect(pols2.getByLabel('Velocitat')).toHaveValue('64')
  // I tota l'exploració
  await page.getByRole('button', { name: 'Tota l\'exploració igual que l\'última' }).click()
  await expect(capLlengua.locator('.resum-seccio:not(.anterior)')).toContainText('Pàl·lid · Inflada, Amb marques de dents · Blanca')
  await expect(page.locator('.capcalera-seccio button').filter({ hasText: /^Palpació/ })).toContainText(/BL23|Punts dolorosos/)
  await expect(capcalera(page).locator('.accions-visita [role="status"]')).toHaveText('Desat')
})
