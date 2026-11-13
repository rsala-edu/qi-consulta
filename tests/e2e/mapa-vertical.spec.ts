// Tauleta vertical, pantalla Mapa: la barra de sota el mapa (3D/2D, vistes,
// orella esquerra/dreta…) no queda tapada per Punt/Marcats, i el panell es veu
// sencer a sota. Només dades inventades.
import { devices } from '@playwright/test'
import { test } from './google.js'
import { entrar, expect, menu } from './ajudes-visita.js'

test.use({ ...devices['Galaxy Tab S9'] })

test('tauleta vertical: la barra de sota el mapa i el panell no es trepitgen', async ({ page }, info) => {
  test.skip(info.project.name !== 'tauleta', 'una vegada n\'hi ha prou')
  await entrar(page)
  await menu(page, 'Mapa').click()
  for (const mapa of ['Cos', 'Orella']) {
    await page.getByRole('tab', { name: mapa, exact: true }).click()
    const barra = (await page.locator('.barra-visor:visible').first().boundingBox())!
    const panell = (await page.locator('.panell-mapa:visible').first().boundingBox())!
    expect(barra.y + barra.height, mapa).toBeLessThanOrEqual(panell.y)
    await expect(page.locator('.panell-mapa:visible').first().getByRole('searchbox')).toBeVisible()
  }
})
