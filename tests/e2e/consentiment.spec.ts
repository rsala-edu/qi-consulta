// Etapa 4A: consentiment informat. Aprovar la plantilla, signar-la a la
// tauleta (llegir fins al final, casella, signatura amb el dit i la de la
// doctora), veure el document, revocar-lo, i començar la visita sense
// consentiment («Continuar igualment», queda registrat) i amb. Només dades inventades.
import type { Locator, Page } from '@playwright/test'
import { test } from './google.js'
import { capcalera, entrar, expect, menu, novaCita, nouPacient, pestanya } from './ajudes-visita.js'

test.describe.configure({ timeout: 240_000 })

/** Signa dins un requadre arrossegant el ratolí (o el dit) */
async function signar(page: Page, requadre: Locator) {
  await requadre.scrollIntoViewIfNeeded()
  const b = (await requadre.boundingBox())!
  await page.mouse.move(b.x + 30, b.y + b.height * 0.6)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + 30 + i * 18, b.y + b.height * (0.6 + (i % 2 ? -0.2 : 0.15)), { steps: 2 })
  await page.mouse.up()
}

async function aprovarAcupuntura(page: Page) {
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /^Consentiments/ }).click()
  const acup = page.getByRole('region', { name: 'Acupuntura i tècniques associades' })
  await expect(acup.getByRole('note')).toContainText('Plantilla orientativa')
  await expect(acup).toContainText('v1 · Pendent de revisió')
  const text = acup.getByLabel('Text')
  await text.fill((await text.inputValue()).replace('[NOM I COGNOMS DE LA DOCTORA]', 'Dra. Inventada Prova'))
  await acup.getByRole('button', { name: /^Aprovar/ }).click()
  await expect(acup).toContainText('v2 · Aprovada')
  await expect(acup.getByLabel('Text')).toHaveCount(0)
  await expect(acup.getByRole('button', { name: 'Editar (crea un esborrany nou)' })).toBeVisible()
}

async function signarAcupuntura(page: Page) {
  await expect(page.getByRole('heading', { name: /Consentiment: Acupuntura/ })).toBeVisible()
  const llegit = page.getByRole('checkbox', { name: /He llegit i entès/ })
  // Fins que no es llegeix fins al final, no es pot marcar
  await expect(llegit).toBeDisabled()
  await page.getByRole('document', { name: 'Acupuntura i tècniques associades' }).evaluate((e) => e.scrollTo(0, e.scrollHeight))
  await expect(llegit).toBeEnabled()
  await expect(page.getByRole('document', { name: 'Acupuntura i tècniques associades' })).toContainText('Dra. Inventada Prova')
  await llegit.check()
  const desar = page.getByRole('button', { name: 'Desar el consentiment signat' })
  await expect(desar).toBeDisabled()
  // Signatura del pacient; «Tornar a signar» l'esborra
  const pacient = page.getByRole('img', { name: /^Signatura del pacient/ })
  await signar(page, pacient)
  await expect(pacient).toHaveAttribute('data-signat', 'si')
  await page.getByRole('button', { name: 'Tornar a signar' }).first().click()
  await expect(pacient).toHaveAttribute('data-signat', 'no')
  await signar(page, pacient)
  // Després, la de la doctora
  const doctora = page.getByRole('img', { name: /^Signatura de la doctora/ })
  await signar(page, doctora)
  await expect(desar).toBeEnabled()
  await desar.click()
}

test('consentiment d\'acupuntura: aprovar la plantilla, signar a la tauleta, veure, revocar i començar la visita', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Aina', 'Consentiment Inventada')
  await novaCita(page, 'Aina', '2026-11-04', '10:00', 'Lumbàlgia')
  await novaCita(page, 'Aina', '2026-11-04', '12:00', 'Lumbàlgia')

  // Sense consentiment: avís en començar; «Continuar igualment» queda registrat a la sessió
  await menu(page, 'Avui').click()
  await page.getByRole('button', { name: 'Començar visita' }).first().click()
  const avis = page.getByRole('alertdialog', { name: 'Falta el consentiment d\'acupuntura' })
  await expect(avis).toContainText('Aina Consentiment Inventada')
  await avis.getByRole('button', { name: 'Continuar igualment' }).click()
  await expect(capcalera(page)).toBeVisible()
  await pestanya(page, 'Com està').click()
  await expect(page.locator('.avis-sense-consentiment')).toContainText('sense el consentiment d\'acupuntura vigent')
  await capcalera(page).getByRole('button', { name: 'Finalitzar visita' }).click()
  await page.getByRole('region', { name: 'Finalitzar visita' }).getByRole('button', { name: 'Confirmar i finalitzar' }).click()

  // La plantilla encara no està aprovada: no es pot signar
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Aina Consentiment Inventada/ }).click()
  await page.getByRole('link', { name: 'Consentiments' }).click()
  const acup = page.getByRole('article', { name: 'Acupuntura i tècniques associades' })
  await expect(acup.locator('.etiqueta')).toHaveText('Pendent')
  await expect(acup).toContainText('encara no està aprovada')

  await aprovarAcupuntura(page)
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Aina Consentiment Inventada/ }).click()
  await page.getByRole('link', { name: 'Consentiments' }).click()
  await acup.getByRole('link', { name: 'Signar' }).click()
  await signarAcupuntura(page)

  // Vigent, amb el document a l'historial
  await expect(acup.locator('.etiqueta')).toHaveText('Vigent')
  await expect(acup.getByRole('list', { name: 'Historial' }).getByRole('listitem')).toHaveCount(1)
  await expect(acup).toContainText('Versió 2 · signat el')
  await acup.getByRole('button', { name: 'Veure el document' }).click()
  const visor = page.getByRole('dialog', { name: 'Acupuntura i tècniques associades' })
  await expect(visor.locator('iframe')).toHaveAttribute('src', /^blob:/)
  await visor.getByRole('button', { name: 'Tancar el document' }).click()

  // Amb el consentiment vigent: la visita comença sense cap avís
  await menu(page, 'Avui').click()
  await page.getByRole('button', { name: 'Començar visita' }).first().click()
  await expect(capcalera(page)).toBeVisible()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await pestanya(page, 'Com està').click()
  await expect(page.locator('.avis-sense-consentiment')).toHaveCount(0)

  // Revocar: amb el motiu; queda a l'historial
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Aina Consentiment Inventada/ }).click()
  await page.getByRole('link', { name: 'Consentiments' }).click()
  await acup.getByRole('button', { name: 'Revocar' }).click()
  const revocar = acup.getByRole('button', { name: 'Revocar el consentiment' })
  await expect(revocar).toBeDisabled()
  await acup.getByLabel('Motiu de la revocació').fill('Ho demana la pacient (inventat)')
  await revocar.click()
  await expect(acup.locator('.etiqueta').first()).toHaveText('Revocat')
  await expect(acup).toContainText('Ho demana la pacient (inventat)')
  await expect(acup.getByRole('button', { name: 'Revocar' })).toHaveCount(0)
  await expect(acup.getByRole('link', { name: 'Signar' })).toBeVisible()
})
