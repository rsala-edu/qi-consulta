// Totes les pantalles amb el build de producció (playwright.produccio.config.ts),
// en un perfil buit i amb dades: cap error a la consola i la barra de
// navegació sempre visible. Si falla, GitHub Actions no publica.
//
// Aquí va sortir la pantalla del mapa en blanc a la versió 27a60e3: en un
// navegador sense WebGL, el visor 3D petava i s'enduia tota l'app.
import { continuarAmbGoogle, test } from './google.js'
import {
  anar,
  barra,
  CONTRASENYA,
  cosLlest,
  expect,
  orellaLlesta,
  pantallaBe,
  posarCopia,
  recorrerPantalles,
  recuperar,
  vigilarConsola,
} from './pantalles.js'

test('perfil buit: el mapa obert directament (cap punt marcat ni seleccionat) i totes les pantalles', async ({ page }) => {
  const errors = vigilarConsola(page)
  // Dispositiu nou, ruta /#/mapa carregada directament
  await page.goto('/qi-consulta/#/mapa')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await page.getByLabel('Repeteix la contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await pantallaBe(page, 'Mapa')
  await cosLlest(page)
  await expect(page.getByRole('tab', { name: /Marcats \(0\)/ })).toBeVisible()
  await orellaLlesta(page)

  await recorrerPantalles(page)
  // Una fitxa que no existeix (p. ex. un enllaç vell): missatge, no pantalla en blanc
  await page.goto('/qi-consulta/#/pacients/no-existeix/dades')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(barra(page)).toBeVisible()
  await expect(page.getByText('Aquesta pantalla ha tingut un problema')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('amb dades recuperades de Drive: el mapa obert directament, una fitxa i totes les pantalles', async ({ page, google }) => {
  const errors = vigilarConsola(page)
  posarCopia(google)
  await page.goto('/qi-consulta/#/mapa')
  await recuperar(page)
  await pantallaBe(page, 'Mapa')
  await cosLlest(page)
  await orellaLlesta(page)

  await recorrerPantalles(page)

  await anar(page, '/pacients', 'Pacients')
  await page.getByRole('link', { name: /Aina Provencal Inventada/ }).click()
  await pantallaBe(page, /Aina Provencal Inventada/)
  for (const pestanya of ['Fitxa clínica', 'Cites', 'Dades']) {
    await page.getByRole('link', { name: pestanya, exact: true }).click()
    await pantallaBe(page, /Aina Provencal Inventada/)
  }
  expect(errors).toEqual([])
})
