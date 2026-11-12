// Mapa de l'orella (escola xinesa, GB/T 13734-2008): orella esquerra i dreta
// en mirall, zoom, marcatge amb les tècniques de l'orella, correcció de la
// posició i punts del cos i de l'orella a la mateixa llista.
import { type Locator, type Page } from '@playwright/test'
import { continuarAmbGoogle, expect, test } from './google.js'

const CONTRASENYA = 'contrasenya-de-prova-e2e'

async function entrar(page: Page) {
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await page.getByLabel('Repeteix la contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

async function obrirOrella(page: Page) {
  await page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: 'Mapa', exact: true }).click()
  await page.getByRole('tab', { name: 'Orella' }).click()
  await expect(page.getByTestId('visor-orella')).toHaveAttribute('data-punts', '84')
}

async function cercar(page: Page, consulta: string) {
  const cerca = page.getByRole('searchbox', { name: /Cerca un punt de l'orella/ })
  await cerca.fill(consulta)
  await cerca.press('Enter')
}

/** Centre del punt dibuixat a la pantalla */
async function centrePunt(page: Page, codi: string) {
  const caixa = (await page.locator(`[data-punt="${codi}"] circle`).last().boundingBox())!
  return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 }
}

test('84 punts per zones, orella esquerra i dreta en mirall', async ({ page }) => {
  await entrar(page)
  await obrirOrella(page)
  const visor = page.getByTestId('visor-orella')
  await expect(visor).toHaveAttribute('data-costat', 'E')
  await expect(page.getByRole('img', { name: 'Orella esquerra' })).toBeVisible()

  // Els noms de les zones, amagats per defecte; amb «Mostrar zones», amb l'orella sencera
  await expect(visor.getByText('Conca', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Mostrar zones' }).click()
  await expect(page.getByRole('button', { name: 'Amagar zones' })).toHaveAttribute('aria-pressed', 'true')
  for (const zona of ['Hèlix', 'Escafa', 'Antihèlix', 'Fossa triangular', 'Tragus', 'Antitragus', 'Conca', 'Lòbul'])
    await expect(visor.getByText(zona, { exact: true })).toBeVisible()

  // A l'esquerra el tragus (cara) queda a l'esquerra del dibuix, i l'hèlix a la dreta; a la dreta, al revés
  const caixa = (await visor.boundingBox())!
  const centre = caixa.x + caixa.width / 2
  expect((await centrePunt(page, 'TG1')).x).toBeLessThan(centre)
  expect((await centrePunt(page, 'HX10')).x).toBeGreaterThan(centre)
  const tf4 = await centrePunt(page, 'TF4')
  await page.getByRole('radio', { name: 'Orella dreta' }).click()
  await expect(visor).toHaveAttribute('data-costat', 'D')
  expect((await centrePunt(page, 'TG1')).x).toBeGreaterThan(centre)
  const tf4Dreta = await centrePunt(page, 'TF4')
  expect(Math.abs(tf4Dreta.x - centre - (centre - tf4.x))).toBeLessThan(2)
  expect(Math.abs(tf4Dreta.y - tf4.y)).toBeLessThan(1)

  // Filtre per zona
  await page.getByLabel('Zona').selectOption({ label: 'TF · Fossa triangular' })
  await expect(visor).toHaveAttribute('data-punts', '5')
})

test('la roda amplia cap al cursor i apareixen els codis; «Orella sencera» torna enrere', async ({ page }) => {
  test.skip(test.info().project.name === 'tauleta', 'A la tauleta no hi ha roda')
  await entrar(page)
  await obrirOrella(page)
  const visor = page.getByTestId('visor-orella')
  await expect(page.locator('.etiqueta-punt')).toHaveCount(0)
  const abans = await centrePunt(page, 'CO15')
  await page.mouse.move(abans.x, abans.y)
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -200)
  await expect.poll(async () => Number(await visor.getAttribute('data-escala'))).toBeGreaterThan(2)
  // El punt de sota el cursor no es mou
  const despres = await centrePunt(page, 'CO15')
  expect(Math.hypot(despres.x - abans.x, despres.y - abans.y)).toBeLessThan(3)
  await expect(page.locator('.etiqueta-punt', { hasText: 'CO15' })).toBeVisible()
  await page.getByRole('button', { name: 'Orella sencera' }).click()
  await expect(visor).toHaveAttribute('data-escala', '1.00')
})

test('marcar a l\'orella amb les seves tècniques; cos i orella a la mateixa llista', async ({ page }) => {
  await entrar(page)
  await obrirOrella(page)
  await cercar(page, 'shenmen')
  const fitxa = page.getByRole('region', { name: 'TF4' })
  await expect(fitxa.getByRole('heading')).toContainText('TF4 · Shenmen 神门')
  await expect(fitxa).toContainText('Fossa triangular')
  // Les tècniques de l'orella (sense moxa ni ventosa)
  const tecniques = fitxa.getByRole('radiogroup', { name: 'Tècnica' }).getByRole('radio')
  await expect(tecniques).toHaveText(['Agulla', 'Llavor', 'Xinxeta (press tack)', 'Electroestimulació'])
  await fitxa.getByRole('radio', { name: 'Bilateral' }).click()
  await fitxa.getByRole('radio', { name: 'Xinxeta (press tack)' }).click()
  await fitxa.getByRole('button', { name: 'Marcar' }).click()

  await page.getByRole('tab', { name: 'Marcats (1)' }).click()
  const marcats = page.getByRole('region', { name: 'Punts marcats' })
  await expect(marcats.getByRole('listitem')).toHaveCount(1)
  await expect(marcats.locator('.fila-marcat')).toHaveAttribute('title', 'TF4 · Shenmen · Orella · Bilateral · Xinxeta (press tack)')
  // Es pinta amb el color de la xinxeta a totes dues orelles
  const color = page.locator('[data-punt="TF4"] circle').last()
  await expect(color).toHaveAttribute('fill', '#a3366f')
  await page.getByRole('radio', { name: 'Orella dreta' }).click()
  await expect(color).toHaveAttribute('fill', '#a3366f')

  // Un punt del cos a la mateixa llista
  await page.getByRole('tab', { name: 'Cos' }).click()
  await expect(page.getByTestId('visor3d')).toHaveAttribute('data-moviment', 'no', { timeout: 15_000 })
  await page.getByRole('searchbox', { name: /Cerca un punt \(ST36/ }).fill('zusanli')
  await page.getByRole('searchbox', { name: /Cerca un punt \(ST36/ }).press('Enter')
  await page.getByRole('region', { name: 'ST36' }).getByRole('button', { name: 'Marcar' }).click()
  await page.getByRole('tabpanel', { name: 'Cos' }).getByRole('tab', { name: 'Marcats (2)' }).click()
  const marcatsCos = page.getByRole('tabpanel', { name: 'Cos' }).getByRole('region', { name: 'Punts marcats' })
  await expect(marcatsCos.getByRole('listitem')).toHaveCount(2)
  await expect(marcatsCos).toContainText('TF4')
  await expect(marcatsCos).toContainText('ST36')

  await expect(marcatsCos.getByRole('heading')).toHaveText('Punts marcats (2)')
  await expect(marcatsCos.getByRole('button', { name: 'Cos (1)' })).toBeVisible()
  await expect(marcatsCos.getByRole('button', { name: 'Orella (1)' })).toBeVisible()
  // Tocar la fila d'un punt de l'orella torna a la pestanya de l'orella, amb la fitxa oberta
  await marcatsCos.locator('.fila-marcat', { hasText: 'TF4' }).click()
  await expect(page.getByRole('tab', { name: 'Orella' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'TF4' }).getByRole('button', { name: 'Actualitzar' })).toBeVisible()
})

test('la doctora corregeix la posició d\'un punt de l\'orella i la pot tornar a l\'estàndard', async ({ page }) => {
  await entrar(page)
  await obrirOrella(page)
  await cercar(page, 'CO15')
  const abans = await centrePunt(page, 'CO15')
  await page.getByRole('region', { name: 'CO15' }).getByRole('button', { name: 'Corregir la posició' }).click()
  const correccio = page.getByRole('region', { name: 'Corregint CO15' })
  await expect(correccio.getByRole('status')).toHaveText('Posició del dibuix de l\'estàndard')
  // Tocar l'orella una mica més amunt hi porta el punt
  await page.mouse.click(abans.x, abans.y - 30)
  await expect(correccio.getByRole('status')).toHaveText('Corregit per la doctora')
  await expect.poll(async () => (await centrePunt(page, 'CO15')).y).toBeLessThan(abans.y - 20)

  // Es desa: després de sortir i tornar a entrar a la pestanya, continua corregit
  await correccio.getByRole('button', { name: 'Fet' }).click()
  await page.getByRole('tab', { name: 'Cos' }).click()
  await page.getByRole('tab', { name: 'Orella' }).click()
  await cercar(page, 'CO15')
  await expect(page.getByRole('region', { name: 'CO15' })).toContainText('Corregit per la doctora')
  await page.getByRole('region', { name: 'CO15' }).getByRole('button', { name: 'Corregir la posició' }).click()
  await page.getByRole('region', { name: 'Corregint CO15' }).getByRole('button', { name: 'Tornar a la posició de l\'estàndard' }).click()
  await expect(page.getByRole('region', { name: 'Corregint CO15' }).getByRole('status')).toHaveText(
    'Posició del dibuix de l\'estàndard',
  )
})

test('els textos dels botons de tècnica de l\'orella no es tallen a cap amplada', async ({ page }) => {
  await entrar(page)
  await obrirOrella(page)
  await cercar(page, 'TF4')
  const grup = page.getByRole('region', { name: 'TF4' }).getByRole('radiogroup', { name: 'Tècnica' })
  const alcada = page.viewportSize()!.height
  for (const amplada of [360, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width: amplada, height: alcada })
    expect(await textosTallats(grup), `amplada ${amplada}px`).toEqual([])
  }
})

async function textosTallats(grup: Locator): Promise<(string | null)[]> {
  return grup.evaluate((g) =>
    [...g.querySelectorAll('button')].flatMap((b) => {
      const caixa = b.getBoundingClientRect()
      const text = document.createRange()
      text.selectNodeContents(b)
      const t = text.getBoundingClientRect()
      const dins = t.left >= caixa.left + 4 && t.right <= caixa.right - 4 && t.top >= caixa.top && t.bottom <= caixa.bottom
      return dins && b.scrollWidth <= b.clientWidth ? [] : [b.textContent]
    }),
  )
}

test('el nom «Lòbul» es veu sencer a totes dues orelles', async ({ page }) => {
  await entrar(page)
  await obrirOrella(page)
  const visor = page.getByTestId('visor-orella')
  await page.getByRole('button', { name: 'Mostrar zones' }).click()
  for (const orella of ['Orella esquerra', 'Orella dreta']) {
    await page.getByRole('radio', { name: orella }).click()
    const caixa = (await visor.boundingBox())!
    const lobul = (await visor.getByText('Lòbul', { exact: true }).boundingBox())!
    expect(lobul.y + lobul.height, orella).toBeLessThanOrEqual(caixa.y + caixa.height - 2)
    expect(lobul.y, orella).toBeGreaterThanOrEqual(caixa.y)
  }
  await expect(page.getByRole('searchbox', { name: /Cerca un punt de l'orella/ })).toHaveAttribute(
    'placeholder',
    'Cerca (TF4, shenmen)',
  )
})

test('llista de marcats: una línia per punt, grups plegables, ordre, «Treure tots» i desplaçament dins la columna', async ({ page }) => {
  await entrar(page)
  await obrirOrella(page)
  // 12 punts de l'orella (en un ordre que no és el del catàleg)
  const codis = ['TF4', 'CO15', 'AH6a', 'HX1', 'LO6', 'AT2', 'TG2l', 'SF1', 'CO4', 'CO10', 'AH9', 'LO1']
  for (const codi of codis) {
    await cercar(page, codi)
    await page.getByRole('region', { name: codi }).getByRole('button', { name: 'Marcar' }).click()
  }
  await page.getByRole('tab', { name: `Marcats (${codis.length})` }).click()
  const llista = page.getByRole('tabpanel', { name: 'Orella' }).getByRole('region', { name: 'Punts marcats' })
  await expect(llista.getByRole('heading')).toHaveText(`Punts marcats (${codis.length})`)
  const files = llista.getByRole('listitem')
  await expect(files).toHaveCount(codis.length)
  // Una sola línia d'uns 36 px per punt
  for (const caixa of await files.evaluateAll((li) => li.map((x) => x.getBoundingClientRect().height)))
    expect(Math.abs(caixa - 36)).toBeLessThanOrEqual(1)
  // Per meridià (ordre del catàleg): HX abans que TF; per ordre de marcatge, TF4 primer
  const ordre = async () => files.locator('.codi').allTextContents()
  expect((await ordre()).indexOf('HX1')).toBeLessThan((await ordre()).indexOf('TF4'))
  await llista.getByLabel('Ordre').selectOption({ label: 'Per ordre de marcatge' })
  expect(await ordre()).toEqual(codis)
  // Tooltip amb tot el text
  await expect(files.first().locator('.fila-marcat')).toHaveAttribute('title', 'TF4 · Shenmen · Orella · Esquerre · Agulla')

  // Només la llista es desplaça, dins la columna: la pàgina no
  const desplacament = llista.locator('.llista-marcats-desplacament')
  await desplacament.evaluate((e) => e.scrollTo(0, e.scrollHeight))
  expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0)
  await expect(page.getByRole('tab', { name: /^Marcats/ })).toBeInViewport()

  // Grup plegable
  await llista.getByRole('button', { name: `Orella (${codis.length})` }).click()
  await expect(files).toHaveCount(0)
  await llista.getByRole('button', { name: `Orella (${codis.length})` }).click()

  // «×» treu un punt; «Treure tots», amb confirmació
  await llista.getByRole('button', { name: 'Treure CO15' }).click()
  await expect(files).toHaveCount(codis.length - 1)
  await llista.getByRole('button', { name: 'Treure tots' }).click()
  await llista.getByRole('alertdialog').getByRole('button', { name: 'No' }).click()
  await expect(files).toHaveCount(codis.length - 1)
  await llista.getByRole('button', { name: 'Treure tots' }).click()
  await expect(llista.getByRole('alertdialog')).toContainText(`Treure els ${codis.length - 1} punts marcats?`)
  await llista.getByRole('button', { name: 'Sí, treure\'ls' }).click()
  await expect(files).toHaveCount(0)
  await expect(llista.getByRole('heading')).toHaveText('Punts marcats (0)')
})

test('columna dreta: pestanyes «Punt» i «Marcats»; amb 25 punts se\'n veuen almenys 12 sense desplaçar-se', async ({ page }) => {
  await entrar(page)
  await obrirOrella(page)
  const codis = ['TF4', 'CO15', 'AH6a', 'HX1', 'LO6', 'AT2', 'TG2l', 'SF1', 'CO4', 'CO10', 'AH9', 'LO1', 'HX2', 'HX3', 'SF2',
    'AH1', 'AH2', 'TF1', 'TF2', 'TG1', 'AT1', 'CO1', 'CO2', 'CO3', 'LO2']
  const pestanyaMarcats = page.getByRole('tab', { name: /^Marcats/ })
  for (const codi of codis) {
    await cercar(page, codi)
    await page.getByRole('region', { name: codi }).getByRole('button', { name: 'Marcar' }).click()
  }
  // En marcar no es canvia de pestanya; el comptador s'actualitza
  await expect(page.getByRole('tab', { name: 'Punt', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(pestanyaMarcats).toHaveText(`Marcats (${codis.length})`)

  await pestanyaMarcats.click()
  const desplacament = page.locator('#mapa-orella .panell-lateral-marcats .llista-marcats-desplacament')
  const caixa = (await desplacament.boundingBox())!
  const sencers = await page.locator('#mapa-orella .panell-lateral-marcats .llista-marcats li').evaluateAll(
    (li, limit) => li.filter((x) => x.getBoundingClientRect().bottom <= limit + 0.5).length,
    caixa.y + caixa.height,
  )
  expect(sencers, `files visibles a ${page.viewportSize()!.width}×${page.viewportSize()!.height} (${JSON.stringify(caixa)})`).toBeGreaterThanOrEqual(12)
  expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0)

  // Tocar una fila porta al punt i torna a «Punt»
  await page.locator('#mapa-orella .panell-lateral-marcats .fila-marcat', { hasText: 'CO15' }).click()
  await expect(page.getByRole('tab', { name: 'Punt', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: 'CO15' }).getByRole('button', { name: 'Actualitzar' })).toBeVisible()
})
