// Etapa 4E: fotografiar un document amb la càmera de l'app (una càmera falsa
// de Chromium), diverses pàgines → un sol PDF (reordenar, girar i treure abans
// de desar); i, si la càmera de l'app falla, l'alternativa de la càmera del
// sistema (input amb capture) i del fitxer. Només dades inventades.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from './google.js'
import { entrar, expect, nouPacient } from './ajudes-visita.js'

test.describe.configure({ timeout: 240_000 })
// Càmera falsa (un vídeo de prova generat pel navegador) i permís concedit
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['camera'],
})
const JPEG = readFileSync(fileURLToPath(new URL('./dades/foto-amb-gps.jpg', import.meta.url)))

test('fotografiar document: 3 pàgines, se\'n treu una, es reordena i es gira; es desa com un PDF de 2 pàgines', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Irene', 'Escaneig Inventada')
  await page.getByRole('link', { name: 'Documents' }).click()
  await page.getByRole('button', { name: 'Fotografiar document' }).click()
  const dialeg = page.getByRole('dialog', { name: 'Escanejar document' })
  const video = dialeg.locator('video')
  await expect(video).toBeVisible()
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0)
  // Les alternatives, sempre visibles
  await expect(dialeg.getByText('Obrir la càmera del sistema')).toBeVisible()
  await expect(dialeg.getByText('Afegir una pàgina des d\'un fitxer')).toBeVisible()

  const capturar = dialeg.getByRole('button', { name: 'Fotografiar la pàgina' })
  const pagines = dialeg.getByRole('list', { name: 'Pàgines' }).getByRole('listitem')
  for (let i = 1; i <= 3; i++) {
    await capturar.click()
    await expect(pagines).toHaveCount(i)
  }
  // Treure la segona; moure la tercera (ara segona) amunt; girar-la
  await pagines.nth(1).getByRole('button', { name: 'Treure la pàgina' }).click()
  await expect(pagines).toHaveCount(2)
  const abans = await pagines.nth(1).locator('img').getAttribute('src')
  await pagines.nth(1).getByRole('button', { name: 'Moure amunt' }).click()
  await expect(pagines.nth(0).locator('img')).toHaveAttribute('src', abans!)
  const [w, h] = await Promise.all([pagines.nth(0).locator('img').getAttribute('data-amplada'), pagines.nth(0).locator('img').getAttribute('data-alcada')])
  await pagines.nth(0).getByRole('button', { name: 'Girar 90°' }).click()
  await expect(pagines.nth(0).locator('img')).toHaveAttribute('data-amplada', h!)
  await expect(pagines.nth(0).locator('img')).toHaveAttribute('data-alcada', w!)
  // En sortir de la càmera, s'atura
  await dialeg.getByRole('button', { name: 'Continuar' }).click()
  await expect(video).toHaveCount(0)
  await dialeg.getByLabel('Tipus').selectOption({ label: 'Informe mèdic' })
  await dialeg.getByLabel('Títol').fill('Informe escanejat (inventat)')
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(dialeg).toHaveCount(0)
  // Fet amb la càmera de l'app: no passa per la galeria (cap avís)
  await expect(page.getByRole('status')).toHaveText('Document desat.')
  await expect(page.getByRole('button', { name: 'Obrir Informe escanejat (inventat)' })).toContainText('PDF · 2 pàg.')
})

test('si la càmera de l\'app falla, «Obrir la càmera del sistema» (o un fitxer): mai un error sense sortida', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permís denegat (simulat)', 'NotAllowedError'))
  })
  await entrar(page)
  await nouPacient(page, 'Joan', 'Sense Camera Inventat')
  await page.getByRole('link', { name: 'Documents' }).click()
  await page.getByRole('button', { name: 'Fotografiar document' }).click()
  const dialeg = page.getByRole('dialog', { name: 'Escanejar document' })
  await expect(dialeg.getByRole('note')).toContainText('No es pot fer servir la càmera de l\'app')
  await expect(dialeg.locator('video')).toHaveCount(0)
  const sistema = dialeg.locator('label', { hasText: 'Obrir la càmera del sistema' })
  await expect(sistema).toHaveClass(/boto-principal/)
  const entrada = sistema.locator('input[type=file]')
  await expect(entrada).toHaveAttribute('capture', 'environment')
  await expect(entrada).toHaveAttribute('accept', /image\/\*/)
  await entrada.setInputFiles({ name: 'foto-camera.jpg', mimeType: 'image/jpeg', buffer: JPEG })
  await expect(dialeg.getByRole('list', { name: 'Pàgines' }).getByRole('listitem')).toHaveCount(1)
  await dialeg.locator('label', { hasText: 'Afegir una pàgina des d\'un fitxer' }).locator('input').setInputFiles({ name: 'p2.jpg', mimeType: 'image/jpeg', buffer: JPEG })
  await expect(dialeg.getByRole('list', { name: 'Pàgines' }).getByRole('listitem')).toHaveCount(2)
  await dialeg.getByRole('button', { name: 'Continuar' }).click()
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  // Fotos de la càmera del sistema o de fitxers: poden quedar a la galeria
  await expect(page.getByRole('status')).toContainText('Recorda esborrar la foto de la galeria del mòbil')
  await expect(page.getByRole('button', { name: /^Obrir Informe mèdic/ })).toContainText('PDF · 2 pàg.')
})
