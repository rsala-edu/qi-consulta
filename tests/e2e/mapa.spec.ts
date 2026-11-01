// Mapa del cos amb el cos definitiu (MakeHuman) i els punts de LI i ST
// calculats amb les regles de l'OMS: marcatge, correcció de la doctora i
// eina de calibratge.
import { type Page } from '@playwright/test'
import { continuarAmbGoogle, expect as expectBase, test } from './google.js'

const CONTRASENYA = 'contrasenya-de-prova-e2e'

// La primera càrrega de Three.js (en mode de desenvolupament) i el WebGL per
// programari són lents quan corren diverses proves alhora
const expect = expectBase.configure({ timeout: 15_000 })

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

/** 14 meridians: 309 punts × 2 costats + 52 de la línia mitja (CV i GV) */
const PUNTS_AL_MODEL = 670

async function visorLlest(page: Page, n?: number) {
  const visor = page.getByTestId('visor3d')
  if (n !== undefined) await expect(visor).toHaveAttribute('data-marcadors', String(n))
  await expect(visor).toHaveAttribute('data-moviment', 'no')
}

async function centreVisor(page: Page) {
  const caixa = (await page.getByTestId('visor3d').boundingBox())!
  return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 }
}

async function tocarCentre(page: Page, dy = 0) {
  const c = await centreVisor(page)
  await page.mouse.click(c.x, c.y + dy)
}

/** Cerca un punt: la càmera s'hi acosta i el deixa al centre del visor. */
async function anarAlPunt(page: Page, consulta: string) {
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).fill(consulta)
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).press('Enter')
  await visorLlest(page)
}

async function obrirMapa(page: Page) {
  await menu(page, 'Mapa (prova)').click()
  await visorLlest(page, PUNTS_AL_MODEL)
}

test('el cos definitiu porta els punts dels 14 meridians calculats', async ({ page }) => {
  await entrar(page)
  await obrirMapa(page)
  await expect(page.getByText(/Maniquí provisional/)).toHaveCount(0)
  await expect(page.getByText(/Encara no hi ha cap punt/)).toHaveCount(0)

  // Filtrar per meridià
  await page.getByLabel('Meridià').selectOption('LI')
  await visorLlest(page, 40)
  await page.getByLabel('Meridià').selectOption('ST')
  await visorLlest(page, 90)
  await page.getByLabel('Meridià').selectOption('GV')
  await visorLlest(page, 28)
})

test('marcatge: anar a un punt, marcar-lo amb una tècnica i treure\'l', async ({ page }) => {
  await entrar(page)
  await obrirMapa(page)

  await anarAlPunt(page, 'zusanli')
  const fitxa = page.getByRole('region', { name: 'ST36' })
  await expect(fitxa.getByRole('heading')).toContainText('ST36 · Zusanli')
  await expect(fitxa).toContainText('Estómac')
  await expect(fitxa).toContainText('3 cun per sota de ST35')
  // La càmera s'hi ha acostat: es veu l'etiqueta amb el codi i el pinyin
  await expect(page.locator('.etiqueta-punt', { hasText: 'ST36 · Zusanli' }).first()).toBeVisible()

  await fitxa.getByRole('radio', { name: 'Bilateral' }).click()
  await fitxa.getByRole('radio', { name: 'Moxa' }).click()
  await fitxa.getByRole('button', { name: 'Marcar' }).click()

  const marcats = page.getByRole('list', { name: 'Punts marcats' })
  await expect(marcats.getByRole('listitem')).toHaveCount(1)
  await expect(marcats).toContainText('Bilateral · Moxa')

  // Tocar-lo al mapa torna a obrir la fitxa
  await tocarCentre(page)
  await expect(fitxa.getByRole('button', { name: 'Actualitzar' })).toBeVisible()
  await fitxa.getByRole('radio', { name: 'Agulla' }).click()
  await fitxa.getByRole('button', { name: 'Actualitzar' }).click()
  await expect(marcats).toContainText('Bilateral · Agulla')

  await marcats.getByRole('button', { name: 'Treure' }).click()
  await expect(marcats.getByRole('listitem')).toHaveCount(0)
})

test('la fitxa mostra les precaucions del punt', async ({ page }) => {
  await entrar(page)
  await obrirMapa(page)
  await anarAlPunt(page, 'LI4')
  const fitxa = page.getByRole('region', { name: 'LI4' })
  await expect(fitxa.getByRole('note')).toContainText('Precaució · Embaràs')
})

test('des de darrere no es pot tocar un punt de davant', async ({ page }) => {
  await entrar(page)
  await obrirMapa(page)
  await anarAlPunt(page, 'tianshu')
  await page.getByRole('button', { name: 'Tancar' }).click()
  await tocarCentre(page)
  await expect(page.getByRole('region', { name: 'ST25' })).toBeVisible()
  await page.getByRole('button', { name: 'Tancar' }).click()

  await page.getByRole('button', { name: 'Darrere' }).click()
  await visorLlest(page)
  await tocarCentre(page)
  await expect(page.getByRole('region', { name: 'ST25' })).toHaveCount(0)
})

test('la doctora corregeix un punt des del mapa, i el pot tornar a la posició calculada', async ({ page }) => {
  await entrar(page)
  await obrirMapa(page)
  await anarAlPunt(page, 'ST36')
  const fitxa = page.getByRole('region', { name: 'ST36' })
  await fitxa.getByRole('radio', { name: 'Esquerre' }).click()
  await fitxa.getByRole('button', { name: 'Corregir la posició' }).click()

  const correccio = page.getByRole('region', { name: 'Corregint ST36' })
  await expect(correccio).toContainText('Calculat amb la regla de l\'OMS')
  await visorLlest(page)

  // Tocar la pell una mica més avall: el punt hi va i queda com a corregit
  await tocarCentre(page, 40)
  await expect(correccio.getByRole('status')).toHaveText('Corregit per la doctora')
  await correccio.getByRole('button', { name: 'Fet' }).click()

  // El punt ja no és al centre: ara es troba més avall
  await tocarCentre(page, 40)
  await expect(fitxa).toBeVisible()
  await expect(fitxa.getByText('Corregit per la doctora')).toBeVisible()

  // Es conserva després de tancar l'app
  await page.reload()
  await page.getByLabel('Contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await visorLlest(page, PUNTS_AL_MODEL)
  await anarAlPunt(page, 'ST36')
  await expect(fitxa.getByText('Corregit per la doctora')).toBeVisible()

  // Tornar a la posició calculada
  await fitxa.getByRole('radio', { name: 'Esquerre' }).click()
  await fitxa.getByRole('button', { name: 'Corregir la posició' }).click()
  await correccio.getByRole('button', { name: 'Tornar a la posició calculada' }).click()
  await expect(correccio.getByRole('status')).toHaveText('Calculat amb la regla de l\'OMS')
  await correccio.getByRole('button', { name: 'Fet' }).click()
  await expect(fitxa.getByText('Corregit per la doctora')).toHaveCount(0)
})

test('calibratge (Ajustos): moure un punt, copiar-lo a l\'altre costat i exportar el catàleg', async ({ page }) => {
  await entrar(page)
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /Calibratge del mapa/ }).click()
  await visorLlest(page, PUNTS_AL_MODEL)
  await expect(page.getByText(`${PUNTS_AL_MODEL} posicions col·locades en aquest model`)).toBeVisible()

  await page.getByLabel('Meridià').selectOption('LI')
  const llista = page.getByRole('list', { name: 'Punts del catàleg' })
  await expect(llista.getByRole('button', { name: /^LI4\b/ }).locator('.fet')).toHaveText(['E', 'D'])

  // Triar LI4 esquerre: la càmera hi va; un toc a la pell el mou
  await llista.getByRole('button', { name: /^LI4\b/ }).click()
  await visorLlest(page)
  await tocarCentre(page, 30)
  await page.getByRole('button', { name: 'Copiar a l\'altre costat' }).click()

  const descarrega = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar el catàleg (JSON)' }).click()
  const fitxer = await descarrega
  const fs = await import('node:fs/promises')
  const json = JSON.parse(await fs.readFile((await fitxer.path())!, 'utf8')) as {
    punts: { codi: string; posicions: { topologia: string; costat: string; origen: string; b: number[] }[] }[]
  }
  const li4 = json.punts.find((p) => p.codi === 'LI4')!.posicions.filter((q) => q.topologia.startsWith('mh-'))
  expect(li4.map((q) => [q.costat, q.origen]).sort()).toEqual([
    ['D', 'manual'],
    ['E', 'manual'],
  ])
  // Els altres punts mantenen la posició calculada
  const st36 = json.punts.find((p) => p.codi === 'ST36')!.posicions.filter((q) => q.topologia.startsWith('mh-'))
  expect(st36.every((q) => q.origen === 'oms')).toBe(true)

  // Descartar els canvis torna als valors del catàleg
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Descartar els canvis' }).click()
  await expect(page.getByRole('button', { name: 'Descartar els canvis' })).toBeDisabled()
})

test('navegació de torn: horitzontal gira, vertical puja i baixa, la roda amplia', async ({ page }) => {
  await entrar(page)
  await obrirMapa(page)
  const visor = page.getByTestId('visor3d')
  // Primer moviment per tenir l'estat de la càmera
  await page.getByRole('button', { name: 'Davant' }).click()
  await visorLlest(page)
  const estat = async () => ({
    azimut: Number(await visor.getAttribute('data-azimut')),
    alcada: Number(await visor.getAttribute('data-alcada')),
    distancia: Number(await visor.getAttribute('data-distancia')),
  })
  const arrossegar = async (dx: number, dy: number) => {
    const c = await centreVisor(page)
    await page.mouse.move(c.x, c.y)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) await page.mouse.move(c.x + (dx * i) / 10, c.y + (dy * i) / 10)
    await page.mouse.up()
    await expect(visor).toHaveAttribute('data-moviment', 'no')
    await page.waitForTimeout(300)
    await expect(visor).toHaveAttribute('data-moviment', 'no')
  }

  const inici = await estat()
  // Horitzontal: gira el cos, sense canviar l'alçada ni el zoom
  await arrossegar(160, 0)
  const girat = await estat()
  expect(Math.abs(girat.azimut - inici.azimut)).toBeGreaterThan(0.3)
  expect(girat.alcada).toBeCloseTo(inici.alcada, 2)
  expect(girat.distancia).toBeCloseTo(inici.distancia, 2)

  // Primer s'amplia amb la roda (cap al cursor)
  const c = await centreVisor(page)
  await page.mouse.move(c.x, c.y - 120)
  await page.mouse.wheel(0, -600)
  await visorLlest(page)
  await page.waitForTimeout(300)
  const ampliat = await estat()
  expect(ampliat.distancia).toBeLessThan(girat.distancia * 0.8)
  // cap al cursor, que era per sobre del centre: el punt de mira puja
  expect(ampliat.alcada).toBeGreaterThan(girat.alcada)

  // Vertical: arrossegar cap amunt fa pujar el cos (es veu més avall), sense desfer el zoom ni girar
  await arrossegar(0, -150)
  const baixat = await estat()
  expect(baixat.alcada).toBeLessThan(ampliat.alcada - 0.05)
  expect(baixat.azimut).toBeCloseTo(ampliat.azimut, 2)
  expect(baixat.distancia).toBeCloseTo(ampliat.distancia, 2)
})

test('les vistes ràpides i la llegenda són fora del dibuix', async ({ page }) => {
  await entrar(page)
  await obrirMapa(page)
  const dibuix = (await page.getByTestId('visor3d').boundingBox())!
  for (const el of [page.getByRole('toolbar', { name: 'Vistes ràpides' }), page.getByRole('list', { name: 'Tècnica' })]) {
    const caixa = await el.boundingBox()
    if (!caixa) continue // la llegenda pot no caber a les pantalles estretes
    const solapa = caixa.y < dibuix.y + dibuix.height && dibuix.y < caixa.y + caixa.height && caixa.x < dibuix.x + dibuix.width && dibuix.x < caixa.x + caixa.width
    expect(solapa).toBe(false)
  }
})

test('amb tot el cos i sense meridià filtrat no hi ha etiquetes; amb un meridià, sí', async ({ page }) => {
  await entrar(page)
  await obrirMapa(page)
  await page.waitForTimeout(500)
  await expect(page.locator('.etiqueta-punt')).toHaveCount(0)
  await page.getByLabel('Meridià').selectOption('ST')
  await visorLlest(page, 90)
  await expect(page.locator('.etiqueta-punt').first()).toBeVisible()
})
