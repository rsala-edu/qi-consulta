// Captures de la 4A (consentiment informat). No són proves. Només dades inventades.
//
//   CAPTURES_SUFIX=4a npx playwright test -c playwright.disseny.config.ts consentiment
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Locator, Page } from '@playwright/test'
import { continuarAmbGoogle, expect, test } from '../e2e/google.js'

const SUFIX = process.env.CAPTURES_SUFIX ?? 'proves'
const P = 'contrasenya-inventada-4a'
test.describe.configure({ timeout: 300_000 })
test.use({ actionTimeout: 20_000 })

const menu = (page: Page, nom: string) => page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom, exact: true })

async function capturar(page: Page, nom: string, projecte: string, a?: Locator) {
  const carpeta = `docs/captures/4a/${projecte}`
  mkdirSync(carpeta, { recursive: true })
  if (a) await a.evaluate((e) => window.scrollTo(0, Math.max(0, e.getBoundingClientRect().top + window.scrollY - 16)))
  else await page.evaluate(() => window.scrollTo(0, 0))
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
  // Una signatura inventada: dues corbes
  await page.mouse.move(b.x + 40, b.y + b.height * 0.65)
  await page.mouse.down()
  for (let i = 0; i <= 30; i++) await page.mouse.move(b.x + 40 + i * 9, b.y + b.height * (0.55 + 0.25 * Math.sin(i / 3)), { steps: 1 })
  await page.mouse.up()
  await page.mouse.move(b.x + 120, b.y + b.height * 0.35)
  await page.mouse.down()
  for (let i = 0; i <= 14; i++) await page.mouse.move(b.x + 120 + i * 12, b.y + b.height * (0.35 + i * 0.03), { steps: 1 })
  await page.mouse.up()
}

test('4A: consentiment informat', async ({ page }, info) => {
  const projecte = info.project.name
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByLabel('Repeteix la contrasenya').fill(P)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()

  // Pacient i una cita d'avui
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill('Aina')
  await page.getByLabel('Llinatges').fill('Consentiment Inventada')
  await page.getByRole('button', { name: 'Desar' }).first().click()
  await menu(page, 'Agenda').click()
  await page.getByRole('main').getByRole('button', { name: 'Nova cita', exact: true }).first().click()
  const dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  const ara = new Date()
  await dialeg.getByLabel('Data').fill(`${ara.getFullYear()}-${String(ara.getMonth() + 1).padStart(2, '0')}-${String(ara.getDate()).padStart(2, '0')}`)
  await dialeg.getByLabel('Hora').fill(`${String(Math.min(22, ara.getHours() + 1)).padStart(2, '0')}:00`)
  await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).fill('Aina')
  await dialeg.getByRole('button', { name: /Aina/ }).first().click()
  await dialeg.getByLabel('Motiu').fill('Lumbàlgia')
  await dialeg.getByRole('button', { name: 'Desar' }).click()

  // 1. Avís en començar la visita sense consentiment
  await menu(page, 'Avui').click()
  await page.getByRole('button', { name: 'Començar visita' }).first().click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await capturar(page, '1-avis-comencar', projecte)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel·lar' }).click()

  // 2. Ajustos > Consentiments: la plantilla pendent de revisió, amb la nota
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /^Consentiments/ }).click()
  const acup = page.getByRole('region', { name: 'Acupuntura i tècniques associades' })
  await expect(acup.getByRole('note')).toBeVisible()
  await capturar(page, '2-ajustos-plantilla', projecte)
  await acup.getByRole('button', { name: /^Aprovar/ }).click()
  await expect(acup).toContainText('v2 · Aprovada')
  await capturar(page, '3-ajustos-aprovada', projecte, acup)

  // 4. Signar a la tauleta
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Aina Consentiment Inventada/ }).click()
  await page.getByRole('link', { name: 'Consentiments' }).click()
  await page.getByRole('article', { name: 'Acupuntura i tècniques associades' }).getByRole('link', { name: 'Signar' }).click()
  await capturar(page, '4-signar-text', projecte)
  await page.getByRole('document', { name: 'Acupuntura i tècniques associades' }).evaluate((e) => e.scrollTo(0, e.scrollHeight))
  await page.getByRole('checkbox', { name: /He llegit i entès/ }).check()
  await signar(page, page.getByRole('img', { name: /^Signatura del pacient/ }))
  await signar(page, page.getByRole('img', { name: /^Signatura de la doctora/ }))
  await capturar(page, '5-signar-signatures', projecte, page.getByRole('checkbox', { name: /He llegit i entès/ }))
  await page.getByRole('button', { name: 'Desar el consentiment signat' }).click()

  // 6. La pestanya Consentiments i el document
  const art = page.getByRole('article', { name: 'Acupuntura i tècniques associades' })
  await expect(art.locator('.etiqueta')).toHaveText('Vigent')
  await capturar(page, '6-fitxa-consentiments', projecte)
  await art.getByRole('button', { name: 'Veure el document' }).click()
  await page.waitForTimeout(800)
  await capturar(page, '7-document', projecte)
  await page.getByRole('button', { name: 'Tancar el document' }).click()
  // El PDF que es desa (xifrat a l'app): una còpia per revisar-lo
  const pdf = await page.evaluate(async () => {
    const m = (window as unknown as { __qiProvesMagatzem: { llistarPacients(): Promise<{ id: string }[]>; consentimentsDe(id: string): Promise<{ pdf: string }[]> } }).__qiProvesMagatzem
    const [p] = await m.llistarPacients()
    return (await m.consentimentsDe(p!.id))[0]!.pdf
  })
  writeFileSync(`docs/captures/4a/${projecte}/document-signat.pdf`, Buffer.from(pdf, 'base64'))

  // 8. Revocat
  await art.getByRole('button', { name: 'Revocar' }).click()
  await art.getByLabel('Motiu de la revocació').fill('Ho demana la pacient (inventat)')
  await art.getByRole('button', { name: 'Revocar el consentiment' }).click()
  await expect(art.locator('.etiqueta').first()).toHaveText('Revocat')
  await capturar(page, '8-revocat', projecte)
})
