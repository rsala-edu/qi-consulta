// Mapa sense 3D (part 3): els contextos WebGL s'alliberen en sortir del mapa,
// el cos es recupera si el navegador en perd el context, i el mapa 2D (SVG)
// fa el mateix que el 3D: punts projectats, marcar, cercar i fitxa.
import { type Page } from '@playwright/test'
import { continuarAmbGoogle, expect as expectBase, test } from './google.js'

// Proves del cos 3D: amb WebGL (per programari)
test.use({ cos3D: true })

const CONTRASENYA = 'contrasenya-de-prova-mapa2d'
const expect = expectBase.configure({ timeout: 15_000 })
test.describe.configure({ timeout: 240_000 })

async function entrar(page: Page) {
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await page.getByLabel('Repeteix la contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

const menu = (page: Page, nom: string) =>
  page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom })

/** El context WebGL del cos és viu (no perdut) */
const contextViu = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('.visor3d canvas')
    const gl = c?.getContext('webgl2') ?? c?.getContext('webgl')
    return !!gl && !gl.isContextLost()
  })

test('obrir i tancar el mapa i canviar Cos–Orella 30 vegades: un sol context WebGL i el cos continua viu', async ({ page }, info) => {
  test.skip(info.project.name !== 'escriptori', 'Una vegada n\'hi ha prou')
  const avisos: string[] = []
  page.on('console', (m) => {
    if (/WebGL context|CONTEXT_LOST|Too many active/i.test(m.text())) avisos.push(m.text())
  })
  await entrar(page)
  for (let i = 0; i < 30; i++) {
    await menu(page, 'Mapa').click()
    await expect(page.getByTestId('visor3d').locator('canvas')).toBeVisible()
    await page.getByRole('tab', { name: 'Orella' }).click()
    await page.getByRole('tab', { name: 'Cos' }).click()
    await menu(page, 'Avui').click()
    await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
  }
  await menu(page, 'Mapa').click()
  await expect(page.getByTestId('visor3d')).toHaveAttribute('data-llest', 'si')
  // Només un llenç a la pàgina, i viu
  await expect(page.locator('canvas')).toHaveCount(1)
  expect(await contextViu(page)).toBe(true)
  expect(avisos).toEqual([])
})

test('si el navegador perd el context WebGL: «Recuperant el cos 3D…» i torna', async ({ page }, info) => {
  test.skip(info.project.name !== 'escriptori', 'Una vegada n\'hi ha prou')
  await entrar(page)
  await menu(page, 'Mapa').click()
  // Que Three.js ja hagi creat el seu context (si no, el de la prova seria el primer)
  await expect(page.getByTestId('visor3d')).toHaveAttribute('data-llest', 'si')
  await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('.visor3d canvas')!
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl'))!
    const ext = gl.getExtension('WEBGL_lose_context')!
    ;(window as unknown as { perdreContext: WEBGL_lose_context }).perdreContext = ext
    ext.loseContext()
  })
  await expect(page.getByRole('status').filter({ hasText: 'Recuperant el cos 3D…' })).toBeVisible()
  await page.evaluate(() => (window as unknown as { perdreContext: WEBGL_lose_context }).perdreContext.restoreContext())
  await expect(page.getByText('Recuperant el cos 3D…')).toHaveCount(0)
  expect(await contextViu(page)).toBe(true)
  // El cos continua responent
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).fill('LI4')
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).press('Enter')
  await expect(page.getByRole('region', { name: 'LI4' })).toBeVisible()
})

test('mapa 2D: vistes, punts projectats, tocar un punt i marcar-lo; la tria es recorda', async ({ page }) => {
  await entrar(page)
  await menu(page, 'Mapa').click()
  await page.getByRole('radiogroup', { name: 'Tipus de mapa' }).getByRole('radio', { name: '2D' }).click()
  const visor = page.getByTestId('visor2d')
  await expect(visor).toHaveAttribute('data-vista', 'davant')
  // En 2D no hi ha cap llenç WebGL
  await expect(page.locator('canvas')).toHaveCount(0)
  const davant = Number(await visor.getAttribute('data-marcadors'))
  expect(davant).toBeGreaterThan(200)

  // Cercar un punt: va a la vista des d'on es veu i hi amplia
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).fill('zusanli')
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).press('Enter')
  const fitxa = page.getByRole('region', { name: 'ST36' })
  await expect(fitxa.getByRole('heading')).toContainText('ST36 · Zusanli')
  await expect(fitxa).toContainText('La posició dels punts es corregeix amb el mapa 3D.')
  await fitxa.getByRole('button', { name: 'Tancar' }).click()

  // Tocar el punt al dibuix obre la fitxa; es marca amb moxa i surt del color de la moxa
  await visor.locator('[data-id="ST36|E"] circle').first().click({ force: true })
  await expect(fitxa).toBeVisible()
  await fitxa.getByRole('radio', { name: 'Moxa' }).click()
  await fitxa.getByRole('button', { name: 'Marcar' }).click()
  await expect(page.getByRole('tab', { name: 'Marcats (1)' })).toBeVisible()
  await expect(visor.locator('[data-id="ST36|E"] circle').last()).not.toHaveAttribute('fill', '#8aa096')
  await expect(visor.locator('.etiqueta-2d', { hasText: 'ST36' }).first()).toBeVisible()

  // Des de darrere, el punt de davant no hi és
  await page.getByRole('button', { name: 'Darrere' }).click()
  await expect(visor).toHaveAttribute('data-vista', 'darrere')
  await expect(visor.locator('[data-id="ST36|E"]')).toHaveCount(0)
  await expect(visor.locator('[data-id^="BL23|"]').first()).toBeAttached()

  // Es recorda en tornar al mapa
  await menu(page, 'Avui').click()
  await menu(page, 'Mapa').click()
  await expect(page.getByTestId('visor2d')).toBeVisible()
  await page.getByRole('radiogroup', { name: 'Tipus de mapa' }).getByRole('radio', { name: '3D' }).click()
  await expect(page.getByTestId('visor3d').locator('canvas')).toBeVisible()
})
