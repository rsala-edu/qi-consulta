// Etapa 4D: informes en PDF. Ajustos > Consulta (capçalera), l'informe de la
// sessió des de la visita (amb els punts d'un protocol), el de l'episodi i
// l'historial complet des de Tractaments. Abans de descarregar o obrir el PDF
// avisa que ja no està xifrat; si es cancel·la, no es descarrega res.
// Només dades inventades.
import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib'
import { test } from './google.js'
import { comencarVisita, entrar, expect, finalitzar, menu, novaCita, nouPacient, pestanya } from './ajudes-visita.js'

test.describe.configure({ timeout: 240_000 })

/** Genera l'informe del botó, accepta l'avis i torna el PDF descarregat */
async function descarregar(page: Page, boto: string): Promise<{ nom: string; doc: PDFDocument }> {
  await page.getByRole('button', { name: boto }).click()
  const dialeg = page.getByRole('dialog', { name: boto })
  await expect(dialeg.getByRole('status')).toHaveText('L\'informe és a punt.')
  page.once('dialog', (d) => {
    expect(d.message()).toContain('ja no està xifrat')
    void d.accept()
  })
  const [baixada] = await Promise.all([page.waitForEvent('download'), dialeg.getByRole('button', { name: 'Descarregar el PDF' }).click()])
  const bytes = await readFile((await baixada.path())!)
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  await dialeg.getByRole('button', { name: 'Tancar' }).click()
  await expect(dialeg).toBeHidden()
  return { nom: baixada.suggestedFilename(), doc: await PDFDocument.load(bytes) }
}

test('informes: dades de la consulta, informe de la sessió, de l\'episodi i historial complet', async ({ page }) => {
  await entrar(page)
  // Ajustos > Consulta
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /^Consulta/ }).click()
  await page.getByLabel('Nom de la consulta').fill('Consulta Inventada')
  await page.getByLabel('Nom de la doctora').fill('Dra. Inventada')
  await page.getByLabel('Número de col·legiada').fill('00000')
  await page.getByRole('button', { name: 'Desar' }).click()
  await expect(page.getByRole('status')).toHaveText('Desat')
  // En tornar-hi, les dades hi són (desades a la base de dades)
  await menu(page, 'Avui').click()
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /^Consulta/ }).click()
  await expect(page.getByLabel('Nom de la consulta')).toHaveValue('Consulta Inventada')

  // Una visita amb els punts d'un protocol
  await nouPacient(page, 'Laia', 'Informe Inventat')
  await novaCita(page, 'Laia', '2026-11-04', '10:00', 'Cefalea')
  await comencarVisita(page)
  await pestanya(page, 'Tractament').click()
  await page.getByRole('button', { name: 'Protocols', exact: true }).click()
  const protocols = page.getByRole('dialog', { name: 'Protocols' })
  await protocols.getByRole('searchbox').fill('lr3')
  await protocols.getByRole('button', { name: /Quatre portes/ }).click()
  await pestanya(page, 'Tancar').click()

  // Cancel·lar l'avís: no es descarrega res
  await page.getByRole('button', { name: 'Informe de la sessió' }).click()
  const dialeg = page.getByRole('dialog', { name: 'Informe de la sessió' })
  await expect(dialeg.getByRole('status')).toHaveText('L\'informe és a punt.')
  let baixades = 0
  page.on('download', () => baixades++)
  page.once('dialog', (d) => void d.dismiss())
  await dialeg.getByRole('button', { name: 'Descarregar el PDF' }).click()
  await page.waitForTimeout(500)
  expect(baixades).toBe(0)
  await dialeg.getByRole('button', { name: 'Tancar' }).click()

  const sessio = (await descarregar(page, 'Informe de la sessió'))
  expect(sessio.nom).toBe('informe-sessio-1-2026-11-04.pdf')
  expect(sessio.doc.getTitle()).toBe('Informe de la sessió · Sessió 1')
  // Amb les imatges del cos (davant i darrere) amb els punts marcats
  const imatges = sessio.doc
    .getPages()
    .map((p) => p.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict)?.keys().length ?? 0)
    .reduce((a, n) => a + n, 0)
  expect(imatges).toBe(2)
  await finalitzar(page)

  // Fitxa > Tractaments: episodi i historial
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Laia Informe Inventat/ }).click()
  await page.getByRole('link', { name: 'Tractaments' }).click()
  const episodi = (await descarregar(page, 'Informe de l\'episodi'))
  expect(episodi.nom).toBe('informe-episodi-cefalea-2026-11-04.pdf')
  const historial = (await descarregar(page, 'Historial complet'))
  expect(historial.nom).toMatch(/^historial-informe-inventat-\d{4}-\d{2}-\d{2}\.pdf$/)
  expect(historial.doc.getTitle()).toBe('Historial complet')
})
