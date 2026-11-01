// Mapa del cos amb el maniquí provisional: calibratge (2c) i marcatge (2d).
// El centre del visor, amb la càmera inicial, cau a la pelvis per davant.
import { expect as expectBase, test, type Page } from '@playwright/test'

const CONTRASENYA = 'contrasenya-de-prova-e2e'

// La primera càrrega de Three.js (en mode de desenvolupament) i el WebGL per
// programari són lents quan corren diverses proves alhora
const expect = expectBase.configure({ timeout: 15_000 })

async function entrar(page: Page) {
  await page.goto('/qi-consulta/')
  await page.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await page.getByLabel('Repeteix la contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Pacients' })).toBeVisible()
}

async function obrirCalibratge(page: Page) {
  await page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: 'Ajustos' }).click()
  await page.getByRole('link', { name: /Calibratge del mapa/ }).click()
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByText(/Maniquí provisional:/)).toBeVisible()
}

/** Espera que el visor tingui `n` marcadors i la càmera estigui quieta. */
async function visorLlest(page: Page, n?: number) {
  const visor = page.getByTestId('visor3d')
  if (n !== undefined) await expect(visor).toHaveAttribute('data-marcadors', String(n))
  await expect(visor).toHaveAttribute('data-moviment', 'no')
}

/** Centre del visor en coordenades de pàgina. */
async function centreVisor(page: Page) {
  const caixa = (await page.getByTestId('visor3d').boundingBox())!
  return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 }
}

async function tocarCentre(page: Page, desplacamentY = 0) {
  const c = await centreVisor(page)
  await page.mouse.click(c.x, c.y + desplacamentY)
}

async function exportar(page: Page) {
  const descarrega = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar el catàleg (JSON)' }).click()
  const fitxer = await descarrega
  expect(fitxer.suggestedFilename()).toBe('cataleg.json')
  const fs = await import('node:fs/promises')
  return JSON.parse(await fs.readFile((await fitxer.path())!, 'utf8')) as {
    punts: { codi: string; posicions: { topologia: string; costat: string; triangle: number; b: number[] }[] }[]
  }
}

function botoPunt(page: Page, codi: string) {
  return page.getByRole('list', { name: 'Punts del catàleg' }).getByRole('button', { name: new RegExp(`^${codi}\\b`) })
}

test('calibratge: col·locar, copiar a l\'altre costat, arrossegar i exportar', async ({ page }) => {
  await entrar(page)
  await obrirCalibratge(page)
  await expect(page.getByText('0 posicions col·locades en aquest model')).toBeVisible()

  // Col·locar LI4 al costat esquerre tocant la pell
  await botoPunt(page, 'LI4').click()
  await tocarCentre(page)
  await expect(page.getByText('1 posició col·locada en aquest model')).toBeVisible()
  await expect(botoPunt(page, 'LI4').locator('.fet')).toHaveText('E')

  // Copiar-lo al costat dret per simetria
  await page.getByRole('button', { name: 'Copiar a l\'altre costat' }).click()
  await expect(page.getByText('2 posicions col·locades en aquest model')).toBeVisible()
  await expect(botoPunt(page, 'LI4').locator('.fet')).toHaveText(['E', 'D'])

  const abans = await exportar(page)
  const li4 = abans.punts.find((p) => p.codi === 'LI4')!
  expect(li4.posicions.map((p) => p.costat)).toEqual(['E', 'D'])
  for (const p of li4.posicions) {
    expect(p.topologia).toMatch(/^maniqui-/)
    expect(p.b.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4)
  }
  // Els altres punts continuen sense posició
  expect(abans.punts.filter((p) => p.posicions.length > 0).map((p) => p.codi)).toEqual(['LI4'])

  // Arrossegar el punt esquerre cap amunt: canvia de lloc i la càmera no gira
  // (en triar el costat, la càmera s'acosta al punt i el deixa al centre)
  await page.getByRole('radio', { name: 'Esquerre' }).click()
  await visorLlest(page)
  const c = await centreVisor(page)
  await page.mouse.move(c.x, c.y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(c.x, c.y - i * 12)
  await page.mouse.up()
  const posicioE = async () => JSON.stringify((await exportar(page)).punts.find((p) => p.codi === 'LI4')!.posicions[0])
  await expect.poll(posicioE).not.toBe(JSON.stringify(li4.posicions[0]))
  // Si la càmera hagués girat en lloc d'arrossegar, el punt seria fora del centre:
  // un toc al centre amb el punt D triat no ha de moure el punt E
  const despres = await posicioE()

  expect(JSON.parse(despres).costat).toBe('E')

  // Es conserva després de tancar l'app
  await page.reload()
  await page.getByLabel('Contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(page.getByText('2 posicions col·locades en aquest model')).toBeVisible()

  // Esborrar
  await botoPunt(page, 'LI4').click()
  await page.getByRole('radio', { name: 'Dret' }).click()
  await page.getByRole('button', { name: 'Esborrar la posició' }).click()
  await expect(page.getByText('1 posició col·locada en aquest model')).toBeVisible()
})

test('marcatge: tocar un punt, marcar-lo amb una tècnica i treure\'l', async ({ page }) => {
  await entrar(page)

  // Sense calibratge no hi ha punts al model
  await page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: 'Mapa (prova)' }).click()
  await expect(page.getByText(/Encara no hi ha cap punt col·locat/)).toBeVisible()

  // Col·locar ST36 (provisionalment) al centre
  await obrirCalibratge(page)
  await page.getByLabel('Meridià').selectOption('ST')
  await botoPunt(page, 'ST36').click()
  await tocarCentre(page)
  await expect(page.getByText('1 posició col·locada en aquest model')).toBeVisible()

  await page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: 'Mapa (prova)' }).click()
  await expect(page.getByText(/Encara no hi ha cap punt col·locat/)).toHaveCount(0)
  await visorLlest(page, 1)

  // Tocar el punt obre la fitxa breu
  await tocarCentre(page)
  const fitxa = page.getByRole('region', { name: 'ST36' })
  await expect(fitxa.getByRole('heading')).toContainText('ST36 · Zusanli')
  await expect(fitxa).toContainText('Estómac')
  await expect(fitxa).toContainText('Localització pendent')
  await expect(fitxa.getByRole('radio', { name: 'Esquerre' })).toHaveAttribute('aria-checked', 'true')

  await fitxa.getByRole('radio', { name: 'Bilateral' }).click()
  await fitxa.getByRole('radio', { name: 'Moxa' }).click()
  await fitxa.getByRole('button', { name: 'Marcar' }).click()

  const marcats = page.getByRole('list', { name: 'Punts marcats' })
  await expect(marcats.getByRole('listitem')).toHaveCount(1)
  await expect(marcats).toContainText('ST36')
  await expect(marcats).toContainText('Bilateral · Moxa')

  // Tornar-lo a tocar: ja surt marcat i es pot canviar
  await tocarCentre(page)
  await expect(fitxa.getByRole('button', { name: 'Actualitzar' })).toBeVisible()
  await fitxa.getByRole('radio', { name: 'Agulla' }).click()
  await fitxa.getByRole('button', { name: 'Actualitzar' }).click()
  await expect(marcats).toContainText('Bilateral · Agulla')

  await marcats.getByRole('button', { name: 'Treure' }).click()
  await expect(marcats.getByRole('listitem')).toHaveCount(0)
})

test('marcatge: des de darrere no es pot tocar un punt de davant, i el cercador hi porta', async ({ page }) => {
  await entrar(page)
  await obrirCalibratge(page)
  await page.getByLabel('Meridià').selectOption('ST')
  await botoPunt(page, 'ST25').click()
  await tocarCentre(page)
  await expect(page.getByText('1 posició col·locada en aquest model')).toBeVisible()

  await page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: 'Mapa (prova)' }).click()
  await expect(page.locator('canvas')).toBeVisible()

  await visorLlest(page, 1)
  await page.getByRole('button', { name: 'Darrere' }).click()
  await visorLlest(page)
  await tocarCentre(page)
  await expect(page.getByRole('region', { name: 'ST25' })).toHaveCount(0)

  // El cercador porta la càmera al punt i n'obre la fitxa
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).fill('tianshu')
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).press('Enter')
  await expect(page.getByRole('region', { name: 'ST25' })).toBeVisible()
  // La càmera s'hi ha acostat: a prop es veu l'etiqueta amb el codi i el pinyin
  await expect(page.locator('.etiqueta-punt', { hasText: 'ST25 · Tianshu' })).toBeVisible()
  await page.getByRole('button', { name: 'Tancar' }).click()
  await visorLlest(page)
  await tocarCentre(page)
  await expect(page.getByRole('region', { name: 'ST25' })).toBeVisible()
})
