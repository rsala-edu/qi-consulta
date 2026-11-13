// Etapa 4C: fotos clíniques. Sense el consentiment d'imatges no es pot fer cap
// foto (es signa allà mateix); amb, es tria un fitxer (aquí no hi ha càmera),
// se'n treu l'EXIF amb la ubicació i es redueix a 1.600 px; galeria,
// «Comparar» i esborrar (queda registrat). Només dades inventades.
import { fileURLToPath } from 'node:url'
import type { Locator, Page } from '@playwright/test'
import { test } from './google.js'
import { comencarVisita, entrar, expect, menu, novaCita, nouPacient, pestanya } from './ajudes-visita.js'

test.describe.configure({ timeout: 240_000 })
const FOTO = fileURLToPath(new URL('./dades/foto-amb-gps.jpg', import.meta.url))

async function signar(page: Page, requadre: Locator) {
  await requadre.scrollIntoViewIfNeeded()
  const b = (await requadre.boundingBox())!
  await page.mouse.move(b.x + 30, b.y + b.height * 0.6)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + 30 + i * 18, b.y + b.height * (0.6 + (i % 2 ? -0.2 : 0.15)), { steps: 2 })
  await page.mouse.up()
}

async function ferFoto(page: Page, zona: string, nota: string) {
  await page.getByRole('button', { name: 'Fer una foto' }).click()
  const camera = page.getByRole('dialog', { name: 'Càmera' })
  await camera.locator('input[type=file]').setInputFiles(FOTO)
  const previ = camera.locator('.previsualitzacio-foto')
  await expect(previ).toBeVisible()
  // Reduïda a 1.600 px pel costat llarg (l'original fa 2.400 × 1.800)
  await expect(previ).toHaveAttribute('data-amplada', '1600')
  await expect(previ).toHaveAttribute('data-alcada', '1200')
  await camera.getByLabel('Zona del cos').selectOption({ label: zona })
  await camera.getByLabel('Nota').fill(nota)
  await camera.getByRole('button', { name: 'Desar la foto' }).click()
  await expect(camera).toHaveCount(0)
}

test('fotos: consentiment d\'imatges, fer-ne (sense EXIF, 1.600 px), galeria, comparar i esborrar', async ({ page }) => {
  await entrar(page)
  // La plantilla d'imatges, aprovada
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /^Consentiments/ }).click()
  await page.getByRole('region', { name: 'Imatges clíniques' }).getByRole('button', { name: /^Aprovar/ }).click()

  await nouPacient(page, 'Laia', 'Fotos Inventada')
  await novaCita(page, 'Laia', '2026-11-04', '10:00', 'Dermatitis')
  await comencarVisita(page)
  await pestanya(page, 'Exploració').click()

  // Sense consentiment d'imatges: no es pot fer cap foto; es signa allà mateix
  await page.getByRole('button', { name: 'Fer una foto' }).click()
  await expect(page.getByRole('alert')).toContainText('no té vigent el consentiment d\'imatges')
  await page.getByRole('link', { name: 'Signar-lo ara' }).click()
  await page.getByRole('document', { name: 'Imatges clíniques' }).evaluate((e) => e.scrollTo(0, e.scrollHeight))
  await page.getByRole('checkbox', { name: /He llegit i entès/ }).check()
  await signar(page, page.getByRole('img', { name: /^Signatura del pacient/ }))
  await signar(page, page.getByRole('img', { name: /^Signatura de la doctora/ }))
  await page.getByRole('button', { name: 'Desar el consentiment signat' }).click()

  // Torna a la visita: ara sí
  await pestanya(page, 'Exploració').click()
  await ferFoto(page, 'Llengua', 'Saburra blanca (inventat)')
  await ferFoto(page, 'Llengua', 'Saburra més fina (inventat)')
  const galeria = page.getByRole('region', { name: 'Fotos' })
  await expect(galeria.locator('.miniatura-foto')).toHaveCount(2)

  // L'EXIF (amb la ubicació) no hi és: ni a la imatge desada
  const exif = await page.evaluate(async () => {
    type M = { llistarPacients(): Promise<{ id: string }[]>; fotosDe(id: string): Promise<{ id: string }[]>; imatgeDe(id: string): Promise<Uint8Array | null> }
    const m = (window as unknown as { __qiProvesMagatzem: M }).__qiProvesMagatzem
    const [p] = await m.llistarPacients()
    const [f] = await m.fotosDe(p!.id)
    const bytes = (await m.imatgeDe(f!.id))!
    const text = String.fromCharCode(...bytes.subarray(0, 4000))
    return { jpeg: bytes[0] === 0xff && bytes[1] === 0xd8, exif: text.includes('Exif'), fabricant: text.includes('Fabricant') }
  })
  expect(exif).toEqual({ jpeg: true, exif: false, fabricant: false })

  // Comparar: dues al costat
  await galeria.getByRole('button', { name: 'Comparar' }).click()
  await galeria.locator('.miniatura-foto').nth(0).click()
  await galeria.locator('.miniatura-foto').nth(1).click()
  const comparar = galeria.getByRole('group', { name: 'Comparar' })
  await expect(comparar.locator('figure')).toHaveCount(2)
  await expect(comparar.locator('figcaption').first()).toContainText('Abans')
  await expect(comparar.locator('img').first()).toHaveAttribute('src', /^blob:/)
  await galeria.getByRole('button', { name: 'Deixar de comparar' }).click()

  // Esborrar: demana el motiu i queda registrat
  await galeria.locator('.miniatura-foto').first().click()
  const visor = page.getByRole('dialog', { name: 'Fotos' })
  await visor.getByRole('button', { name: 'Esborrar la foto' }).click()
  await visor.getByLabel('Motiu (queda registrat)').fill('Desenfocada (inventat)')
  await visor.getByRole('button', { name: 'Esborrar-la definitivament' }).click()
  await expect(galeria.locator('.miniatura-foto')).toHaveCount(1)
  await expect(galeria.locator('.fotos-esborrades')).toContainText('Fotos esborrades (1)')

  // A la fitxa (pestanya Fotos) i a l'evolució de l'episodi
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Laia Fotos Inventada/ }).click()
  await page.getByRole('link', { name: 'Fotos' }).click()
  await expect(page.locator('.pestanya-fotos .miniatura-foto')).toHaveCount(1)
  await page.getByRole('link', { name: 'Tractaments' }).click()
  await expect(page.getByRole('region', { name: 'Fotos de l\'episodi' }).locator('.miniatura-foto')).toHaveCount(1)
})
