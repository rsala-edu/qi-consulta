// Dret d'accés i de portabilitat: «Exportar totes les dades» (fitxa > Dades)
// descarrega un JSON amb les dades del pacient, desxifrades, i els documents.
// Abans avisa que surt sense xifrar. I «Quant a» llista el programari de
// tercers amb la seva llicència. Només dades inventades.
import { readFileSync } from 'node:fs'
import { test } from './google.js'
import { entrar, expect, menu, nouPacient } from './ajudes-visita.js'

test('exportar totes les dades: avís, i un JSON amb el pacient i els seus documents', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Àngela', 'Exportació Inventada')
  await page.getByRole('link', { name: 'Documents' }).click()
  await page.locator('.afegir-documents input[type=file][multiple]').setInputFiles({ name: 'informe.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%inventat\n') })
  await page.getByRole('dialog', { name: 'Nou document' }).getByRole('button', { name: 'Desar' }).click()
  await expect(page.getByRole('button', { name: 'Obrir Informe' })).toBeVisible()

  await page.getByRole('link', { name: 'Dades' }).click()
  // Primer, l'avís (si no s'accepta, no es descarrega res)
  let avis = ''
  page.once('dialog', (d) => ((avis = d.message()), void d.dismiss()))
  await page.getByRole('button', { name: 'Exportar totes les dades' }).click()
  await expect.poll(() => avis).toContain('sense xifrar')
  await expect(page.getByRole('status').filter({ hasText: 'Fitxer descarregat' })).toHaveCount(0)

  page.once('dialog', (d) => void d.accept())
  const baixada = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar totes les dades' }).click()
  const fitxer = await baixada
  expect(fitxer.suggestedFilename()).toMatch(/^qi-dades-angela-exportacio-inventada-\d{4}-\d{2}-\d{2}\.json$/)
  const dades = JSON.parse(readFileSync((await fitxer.path())!, 'utf8'))
  expect(dades.format).toBe('qi-exportacio-pacient')
  expect(dades.pacient).toMatchObject({ nom: 'Àngela', llinatges: 'Exportació Inventada' })
  expect(dades.documents).toHaveLength(1)
  expect(Buffer.from(dades.fitxersDocuments[0].base64, 'base64').toString()).toContain('%PDF-1.4')
  await expect(page.getByRole('status').filter({ hasText: 'Fitxer descarregat' })).toBeVisible()
})

test('Quant a: el programari de tercers i la seva llicència', async ({ page }) => {
  await entrar(page)
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /^Quant a/ }).click()
  const programari = page.getByRole('region', { name: 'Programari de tercers' })
  await expect(programari).toContainText('PDF.js (Mozilla) · Apache 2.0')
  await expect(programari).toContainText('heic2any · MIT')
})
