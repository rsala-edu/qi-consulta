// Build de producció en un navegador sense WebGL (ordinador amb la GPU
// bloquejada o l'acceleració per maquinari desactivada): el visor 3D no es
// pot crear. Abans (27a60e3) això deixava tota l'app en blanc; ara només cau
// el cos i la resta del mapa continua.
import { test } from './google.js'
import { anar, expect, orellaLlesta, pantallaBe, posarCopia, recuperar, vigilarConsola } from './pantalles.js'

test.use({ launchOptions: { args: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl'] } })

test('el mapa no queda en blanc: missatge al lloc del cos i la resta funciona', async ({ page, google }) => {
  const errors = vigilarConsola(page)
  posarCopia(google)
  await page.goto('/qi-consulta/#/mapa')
  await recuperar(page)

  await pantallaBe(page, 'Mapa')
  await expect(page.getByRole('alert')).toContainText("No s'ha pogut mostrar el cos en 3D")
  // El cercador i la fitxa del punt continuen funcionant
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).fill('LI4')
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).press('Enter')
  await page.getByRole('button', { name: 'Marcar' }).click()
  await expect(page.getByRole('tab', { name: /Marcats \(1\)/ })).toBeVisible()
  await orellaLlesta(page)
  await anar(page, '/avui', 'Avui')

  // A la consola: els avisos de Three.js i el resum del límit, sense el missatge
  const nostres = errors.filter((e) => !e.startsWith('THREE.'))
  expect(nostres).toHaveLength(1)
  expect(nostres[0]).toMatch(/^\[UI-COS3D\] Error a /)
  expect(nostres[0]).not.toContain('Error creating WebGL context')
})
