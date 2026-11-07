// Build de producció en un navegador sense WebGL (ordinador amb la GPU
// bloquejada o l'acceleració per maquinari desactivada): el visor 3D no es
// pot crear. Abans (27a60e3) això deixava tota l'app en blanc. Ara el mapa
// s'obre en 2D (SVG); si es tria el 3D, l'avís explica com activar
// l'acceleració i ofereix tornar al 2D.
import { test } from './google.js'
import { anar, expect, orellaLlesta, pantallaBe, posarCopia, recuperar, vigilarConsola } from './pantalles.js'

test.use({ launchOptions: { args: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl'] } })

test('sense WebGL el mapa s\'obre en 2D; el 3D explica com activar-lo i torna al 2D', async ({ page, google }) => {
  const errors = vigilarConsola(page)
  posarCopia(google)
  await page.goto('/qi-consulta/#/mapa')
  await recuperar(page)

  await pantallaBe(page, 'Mapa')
  const visor2d = page.getByTestId('visor2d')
  await expect(visor2d).toBeVisible()
  await expect(page.getByRole('radiogroup', { name: 'Tipus de mapa' }).getByRole('radio', { name: '2D' })).toBeChecked()
  // El cercador, el dibuix i la fitxa del punt funcionen en 2D
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).fill('LI4')
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).press('Enter')
  await page.getByRole('button', { name: 'Marcar' }).click()
  await expect(page.getByRole('tab', { name: /Marcats \(1\)/ })).toBeVisible()
  await expect(visor2d.locator('[data-id^="LI4|"]').first()).toBeAttached()

  // Si es tria el 3D: l'avís, l'ajuda per a Chrome i Firefox, i «Fer servir el mapa 2D»
  await page.getByRole('radiogroup', { name: 'Tipus de mapa' }).getByRole('radio', { name: '3D' }).click()
  const avis = page.getByRole('alert')
  await expect(avis).toContainText("No s'ha pogut mostrar el cos en 3D")
  await avis.getByText('Com activar el cos 3D en aquest ordinador').click()
  await expect(avis).toContainText('chrome://gpu')
  await expect(avis).toContainText('about:support')
  await avis.getByRole('button', { name: 'Fer servir el mapa 2D' }).click()
  await expect(visor2d).toBeVisible()
  await orellaLlesta(page)
  await anar(page, '/avui', 'Avui')

  // A la consola: els avisos de Three.js i el resum del límit, sense el missatge
  const nostres = errors.filter((e) => !e.startsWith('THREE.'))
  expect(nostres).toHaveLength(1)
  expect(nostres[0]).toMatch(/^\[UI-COS3D\] Error a /)
  expect(nostres[0]).not.toContain('Error creating WebGL context')
})
