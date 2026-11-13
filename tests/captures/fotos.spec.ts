// Captures de la 4C (fotos clíniques). No són proves. La càmera és la falsa de
// Chromium (vídeo de prova). Només dades inventades.
//
//   CAPTURES_SUFIX=4c npx playwright test -c playwright.disseny.config.ts fotos
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Locator, Page } from '@playwright/test'
import { continuarAmbGoogle, expect, test } from '../e2e/google.js'
import { continuarSenseConsentiment } from '../e2e/ajudes-visita.js'

const SUFIX = process.env.CAPTURES_SUFIX ?? 'proves'
const P = 'contrasenya-inventada-4c'
const FOTO = fileURLToPath(new URL('../e2e/dades/foto-amb-gps.jpg', import.meta.url))
test.describe.configure({ timeout: 300_000 })
test.use({
  actionTimeout: 20_000,
  permissions: ['camera'],
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
})

const menu = (page: Page, nom: string) => page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom, exact: true })

async function capturar(page: Page, nom: string, projecte: string, a?: Locator) {
  const carpeta = `docs/captures/4c/${projecte}`
  mkdirSync(carpeta, { recursive: true })
  if (a) await a.evaluate((e) => window.scrollTo(0, Math.max(0, e.getBoundingClientRect().top + window.scrollY - 16)))
  for (const esquema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: esquema })
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${carpeta}/${nom}-${SUFIX}-${esquema === 'light' ? 'clar' : 'fosc'}.jpg`, type: 'jpeg', quality: 82 })
  }
  await page.emulateMedia({ colorScheme: 'light' })
}

async function signar(page: Page, requadre: Locator) {
  await requadre.scrollIntoViewIfNeeded()
  const b = (await requadre.boundingBox())!
  await page.mouse.move(b.x + 40, b.y + b.height * 0.6)
  await page.mouse.down()
  for (let i = 0; i <= 24; i++) await page.mouse.move(b.x + 40 + i * 10, b.y + b.height * (0.55 + 0.22 * Math.sin(i / 3)), { steps: 1 })
  await page.mouse.up()
}

const avui = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test('4C: fotos clíniques', async ({ page }, info) => {
  const projecte = info.project.name
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByLabel('Repeteix la contrasenya').fill(P)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /^Consentiments/ }).click()
  await page.getByRole('region', { name: 'Imatges clíniques' }).getByRole('button', { name: /^Aprovar/ }).click()

  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill('Laia')
  await page.getByLabel('Llinatges').fill('Fotos Inventada')
  await page.getByRole('button', { name: 'Desar' }).first().click()
  await menu(page, 'Agenda').click()
  await page.getByRole('main').getByRole('button', { name: 'Nova cita', exact: true }).first().click()
  const dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  await dialeg.getByLabel('Data').fill(avui())
  await dialeg.getByLabel('Hora').fill(`${String(Math.min(22, new Date().getHours() + 1)).padStart(2, '0')}:00`)
  await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).fill('Laia')
  await dialeg.getByRole('button', { name: /Laia/ }).first().click()
  await dialeg.getByLabel('Motiu').fill('Dermatitis')
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await menu(page, 'Avui').click()
  await page.getByRole('button', { name: 'Començar visita' }).first().click()
  await continuarSenseConsentiment(page)
  await page.getByRole('tablist', { name: 'Visita' }).getByRole('tab', { name: 'Exploració' }).click()

  // 1. Sense consentiment d'imatges
  await page.getByRole('button', { name: 'Fer una foto' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await capturar(page, '1-sense-consentiment', projecte, page.getByRole('region', { name: 'Fotos' }))
  await page.getByRole('link', { name: 'Signar-lo ara' }).click()
  await page.getByRole('document', { name: 'Imatges clíniques' }).evaluate((e) => e.scrollTo(0, e.scrollHeight))
  await page.getByRole('checkbox', { name: /He llegit i entès/ }).check()
  await signar(page, page.getByRole('img', { name: /^Signatura del pacient/ }))
  await signar(page, page.getByRole('img', { name: /^Signatura de la doctora/ }))
  await page.getByRole('button', { name: 'Desar el consentiment signat' }).click()
  await page.getByRole('tablist', { name: 'Visita' }).getByRole('tab', { name: 'Exploració' }).click()

  // 2. La càmera de l'app
  await page.getByRole('button', { name: 'Fer una foto' }).click()
  const camera = page.getByRole('dialog', { name: 'Càmera' })
  await page.waitForTimeout(1500)
  await capturar(page, '2-camera', projecte)
  // 3. Una foto (de fitxer, per veure-hi alguna cosa) amb la zona i la nota
  for (const nota of ['Placa a l\'avantbraç (inventat)', 'Més petita (inventat)']) {
    if (!(await camera.isVisible())) await page.getByRole('button', { name: 'Fer una foto' }).click()
    await camera.locator('input[type=file]').setInputFiles(FOTO)
    await camera.getByLabel('Zona del cos').selectOption({ label: 'Braç' })
    await camera.getByLabel('Nota').fill(nota)
    if (nota.startsWith('Placa')) await capturar(page, '3-abans-de-desar', projecte)
    await camera.getByRole('button', { name: 'Desar la foto' }).click()
    await expect(camera).toHaveCount(0)
  }

  // 4. Galeria i comparar
  const galeria = page.getByRole('region', { name: 'Fotos' })
  await galeria.getByRole('button', { name: 'Comparar' }).click()
  await galeria.locator('.miniatura-foto').nth(0).click()
  await galeria.locator('.miniatura-foto').nth(1).click()
  await page.waitForTimeout(800)
  await capturar(page, '4-comparar', projecte, galeria)
  await galeria.getByRole('button', { name: 'Deixar de comparar' }).click()

  // 5. A la fitxa del pacient
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Laia Fotos Inventada/ }).click()
  await page.getByRole('link', { name: 'Fotos' }).click()
  await capturar(page, '5-fitxa-fotos', projecte, page.locator('.pestanya-fotos'))
})
