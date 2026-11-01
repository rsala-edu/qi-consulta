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
  await page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: 'Mapa (prova)' }).click()
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

  // Noms de les zones amb l'orella sencera
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

  const marcats = page.getByRole('list', { name: 'Punts marcats' })
  await expect(marcats.getByRole('listitem')).toHaveCount(1)
  await expect(marcats).toContainText('Orella · Bilateral · Xinxeta (press tack)')
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
  const marcatsCos = page.getByRole('tabpanel', { name: 'Cos' }).getByRole('list', { name: 'Punts marcats' })
  await expect(marcatsCos.getByRole('listitem')).toHaveCount(2)
  await expect(marcatsCos).toContainText('TF4')
  await expect(marcatsCos).toContainText('ST36')

  // «Veure» un punt de l'orella torna a la pestanya de l'orella, amb la fitxa oberta
  await marcatsCos.getByRole('listitem').filter({ hasText: 'TF4' }).getByRole('button', { name: 'Veure' }).click()
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
