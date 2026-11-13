// Disseny de la visita (revisió de la 3B, part B): capçalera en una fila,
// escala 0–10 en barra (tocar i lliscar), símptomes secundaris amagats fins
// que s'afegeixen i la pestanya Tractament sense desplaçar la pàgina.
// Només dades inventades.
import type { Page } from '@playwright/test'
import { test } from './google.js'
import { capcalera, comencarVisita, entrar, expect, novaCita, nouPacient, pestanya } from './ajudes-visita.js'

// Passa pel cos 3D (Tractament i «Ampliar»)
test.use({ cos3D: true })

test.describe.configure({ timeout: 240_000 })

/**
 * Part de l'alçada del requadre que ocupa el cos sencer (1,66 m), segons la
 * distància de la càmera (fov vertical de 35°). Si el requadre és estret,
 * l'alçada que queda limitada per l'amplada.
 */
async function ocupacioCos(page: Page): Promise<number> {
  const visor = page.getByTestId('visor3d')
  const d = Number(await visor.getAttribute('data-distancia'))
  const caixa = (await visor.boundingBox())!
  const tan = Math.tan((35 * Math.PI) / 360)
  const perAlcada = 1.66 / (2 * d * tan)
  const perAmplada = 1.05 / (2 * d * tan * (caixa.width / caixa.height))
  return Math.max(perAlcada, perAmplada)
}

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
  // (a sota hi ha la barra de les vistes i, des del bloc 3, «Anterior / Següent»)
  expect(visor.y + visor.height).toBeGreaterThan((page.viewportSize()!.height) * 0.72)
  // La barra fina, sobre el mapa
  await expect(page.locator('.capcalera-mapa .barra-tractament')).toBeVisible()

  // Llegenda de colors: amb poca alçada, amagada darrere «ⓘ Colors» (un globus en tocar-lo)
  const llegenda = page.getByRole('list', { name: 'Tècnica' })
  const colors = page.getByRole('button', { name: 'ⓘ Colors' })
  if (page.viewportSize()!.height <= 800) {
    await expect(llegenda).toBeHidden()
    await colors.click()
    await expect(colors).toHaveAttribute('aria-expanded', 'true')
    await expect(llegenda.getByText('Moxa')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(llegenda).toBeHidden()
    await colors.click()
    await page.getByRole('searchbox', { name: /Cerca un punt/ }).click()
    await expect(llegenda).toBeHidden()
  } else {
    await expect(colors).toBeHidden()
    await expect(llegenda.getByText('Moxa')).toBeVisible()
  }
})

test('Tractament: cos sencer en entrar, etiquetes només dels marcats, «⤢ Ampliar» i l\'orella sencera', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Aina', 'Provencal Inventada')
  await novaCita(page, 'Aina', '2026-11-04', '10:00', 'Lumbàlgia')
  await comencarVisita(page)
  await pestanya(page, 'Tractament').click()
  const visor = page.getByTestId('visor3d')
  await expect(visor).toBeVisible()
  const etiquetes = visor.locator('.visor3d-etiquetes .etiqueta-punt')

  // En entrar, el cos sencer: cap etiqueta (cap punt marcat)
  await page.waitForTimeout(800)
  await expect(etiquetes).toHaveCount(0)

  // Es marca LI4 (la càmera hi va i, ampliat, surten totes les etiquetes)
  const cerca = page.getByRole('searchbox', { name: /Cerca un punt/ })
  await cerca.fill('LI4')
  await cerca.press('Enter')
  const fitxa = page.getByRole('region', { name: 'LI4' })
  await fitxa.getByRole('radio', { name: 'Bilateral' }).click()
  await fitxa.getByRole('button', { name: 'Marcar' }).click()
  await expect.poll(() => etiquetes.count()).toBeGreaterThan(2)

  // Amb el cos sencer, només les del punt marcat
  await page.getByRole('button', { name: 'Tot el cos' }).click()
  await expect(visor).toHaveAttribute('data-moviment', 'no')
  // I el cos omple el requadre (uns 85–90 % de l'alçada)
  await expect.poll(() => ocupacioCos(page)).toBeGreaterThan(0.83)
  expect(await ocupacioCos(page)).toBeLessThan(0.93)
  await expect.poll(() => etiquetes.count()).toBeLessThanOrEqual(2)
  for (const text of await etiquetes.allTextContents()) expect(text).toBe('LI4')
  expect(await etiquetes.count()).toBeGreaterThan(0)

  // «⤢ Ampliar»: sense capçalera, pestanyes ni barra de l'app; el temporitzador, sí
  const ampliar = page.getByRole('button', { name: '⤢ Ampliar' })
  await ampliar.click()
  await expect(page.getByRole('tablist', { name: 'Visita' })).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Navegació principal' })).toBeHidden()
  await expect(page.locator('.capcalera-visita').getByRole('button', { name: 'Finalitzar visita' })).toBeHidden()
  await expect(page.locator('.capcalera-visita .temporitzador')).toBeVisible()
  // El cos creix amb el requadre: n'ocupa la mateixa part
  await expect.poll(() => ocupacioCos(page)).toBeGreaterThan(0.83)
  expect(await ocupacioCos(page)).toBeLessThan(0.93)
  const desplacament = await page.evaluate(() => document.scrollingElement!.scrollHeight - window.innerHeight)
  expect(desplacament).toBeLessThanOrEqual(1)
  // Es torna amb el mateix botó (o amb Esc)
  await page.getByRole('button', { name: '⤡ Reduir' }).click()
  await expect(page.getByRole('tablist', { name: 'Visita' })).toBeVisible()
  await ampliar.click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('navigation', { name: 'Navegació principal' })).toBeVisible()

  // L'orella s'obre sencera i centrada, també amb el botó «⤢ Ampliar»
  await page.getByRole('tab', { name: 'Orella' }).click()
  const orella = page.getByTestId('visor-orella')
  await expect(orella).toHaveAttribute('data-escala', '1.00')
  await expect(page.getByRole('button', { name: '⤢ Ampliar' })).toBeVisible()
  const caixa = (await orella.boundingBox())!
  const dibuix = (await orella.locator('svg path').first().boundingBox())!
  expect(dibuix.x).toBeGreaterThanOrEqual(caixa.x)
  expect(dibuix.y).toBeGreaterThanOrEqual(caixa.y)
  expect(dibuix.x + dibuix.width).toBeLessThanOrEqual(caixa.x + caixa.width + 1)
  expect(dibuix.y + dibuix.height).toBeLessThanOrEqual(caixa.y + caixa.height + 1)
})

test.describe('tauleta vertical', () => {
  test.use({ viewport: { width: 640, height: 1024 }, hasTouch: true })

  test('Tractament compacte: capçalera en dues línies, pestanyes en una fila i el mapa omple la resta sense desplaçar la pàgina', async ({ page }, info) => {
    test.skip(info.project.name !== 'tauleta', 'una sola vegada')
    await entrar(page)
    await nouPacient(page, 'Aina', 'Provencal Inventada')
    await novaCita(page, 'Aina', '2026-11-04', '10:00', 'Lumbàlgia')
    await comencarVisita(page)
    await pestanya(page, 'Tractament').click()
    const visor = page.getByTestId('visor3d')
    await expect(visor).toHaveAttribute('data-llest', 'si', { timeout: 60_000 })
    const mig = async (sel: ReturnType<Page['locator']>) => {
      const b = (await sel.boundingBox())!
      return b.y + b.height / 2
    }

    // Capçalera: nom i «episodi · sessió» en una línia; temporitzador i «Finalitzar visita» en una altra
    const cap = capcalera(page)
    const nom = await mig(cap.locator('h1'))
    expect(Math.abs((await mig(cap.locator('.qui-visita p'))) - nom)).toBeLessThan(12)
    const temps = await mig(cap.locator('.temporitzador'))
    expect(Math.abs((await mig(cap.getByRole('button', { name: 'Finalitzar visita' }))) - temps)).toBeLessThan(12)
    expect(temps).toBeGreaterThan(nom + 15)

    // Les pestanyes, en una sola fila (que es desplaça de costat)
    const pestanyes = page.getByRole('tablist', { name: 'Visita' }).getByRole('tab')
    const ys = new Set<number>()
    for (const p of await pestanyes.all()) ys.add(Math.round(await mig(p)))
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2)

    // Cos/Orella i les agulles a la mateixa fila
    const fila = await mig(page.getByRole('tablist', { name: 'Mapa', exact: true }))
    expect(Math.abs((await mig(page.locator('.barra-tractament .agulles-posades'))) - fila)).toBeLessThan(12)

    // El mapa omple la resta: la pàgina no es desplaça i la barra de sota el mapa hi cap
    const desplacament = await page.evaluate(() => document.scrollingElement!.scrollHeight - window.innerHeight)
    expect(desplacament).toBeLessThanOrEqual(1)
    const zona = (await page.locator('.mapa-visita .zona-visor').first().boundingBox())!
    expect(zona.height).toBeGreaterThan(1024 * 0.5)
    const barra = (await page.locator('.mapa-visita .barra-visor').first().boundingBox())!
    expect(barra.y + barra.height).toBeLessThanOrEqual(1024)
    expect(barra.height).toBeLessThan(60)
    await expect(page.getByRole('button', { name: 'Tot el cos' })).toBeInViewport({ ratio: 1 })

    // I el cos sencer l'omple
    await expect(visor).toHaveAttribute('data-moviment', 'no', { timeout: 15_000 })
    expect(await ocupacioCos(page)).toBeGreaterThan(0.83)
  })
})
