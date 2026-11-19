// Etapa 4E: documents adjunts. Pujar diverses imatges com un sol document
// (PDF), pujar un PDF (miniatura i visor), el límit de 25 MB, anul·lar amb
// motiu, afegir sense xarxa i pujar-lo en tornar-hi, ajuntar fitxes amb
// documents, «Compartir → Qi», els documents de l'episodi a la visita i el
// mòbil. Només dades inventades.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import type { Page } from '@playwright/test'
import { test } from './google.js'
import { comencarVisita, entrar, expect, menu, novaCita, nouPacient, pestanya } from './ajudes-visita.js'

test.describe.configure({ timeout: 240_000 })
const JPEG = readFileSync(fileURLToPath(new URL('./dades/foto-amb-gps.jpg', import.meta.url)))
const imatge = (nom: string) => ({ name: nom, mimeType: 'image/jpeg', buffer: JPEG })

/** Un PDF inventat de n pàgines */
async function pdfInventat(pagines: number): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= pagines; i++) doc.addPage([595, 842]).drawText(`Analitica inventada - pagina ${i}`, { x: 60, y: 760, size: 18, font })
  return Buffer.from(await doc.save())
}

const pujar = (page: Page) => page.locator('.afegir-documents input[type=file][multiple]')

test('pujar 3 imatges com un sol document (PDF de 3 pàgines), l\'avís de la galeria i el visor', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Abril', 'Documents Inventada')
  await page.getByRole('link', { name: 'Documents' }).click()
  await expect(page.getByText('Encara no hi ha cap document.')).toBeVisible()

  await pujar(page).setInputFiles([imatge('analitica-1.jpg'), imatge('analitica-2.jpg'), imatge('analitica-3.jpg')])
  const dialeg = page.getByRole('dialog', { name: 'Nou document' })
  await expect(dialeg.getByRole('list', { name: 'Fitxers triats' }).getByRole('listitem')).toHaveCount(3)
  await expect(dialeg.getByRole('radio', { name: 'Un sol document (pàgines)' })).toBeChecked()
  await dialeg.getByLabel('Tipus').selectOption({ label: 'Analítica' })
  await dialeg.getByLabel('Títol').fill('Analítica de novembre (inventada)')
  await dialeg.getByLabel('Data del document').fill('2026-11-02')
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(dialeg).toHaveCount(0)
  // Les imatges venen de fitxers (la galeria): es recorda esborrar-les
  await expect(page.getByRole('status').filter({ hasText: 'Recorda esborrar la foto de la galeria' })).toBeVisible()

  const targeta = page.getByRole('button', { name: 'Obrir Analítica de novembre (inventada)' })
  await expect(targeta).toContainText('PDF · 3 pàg.')
  await expect(targeta).toContainText('Analítica · 2/11/2026')
  await expect(targeta.locator('img')).toHaveAttribute('src', /^data:image\/jpeg/)
  await targeta.click()
  const visor = page.getByRole('dialog', { name: 'Analítica de novembre (inventada)' })
  await expect(visor.getByTestId('pagines-pdf')).toHaveAttribute('data-llest', 'si', { timeout: 30_000 })
  await expect(visor.getByRole('img', { name: /^Pàgina \d$/ })).toHaveCount(3)
  await visor.getByRole('button', { name: 'Tancar' }).click()
  await expect(visor).toHaveCount(0)
})

test('pujar un PDF (miniatura de la primera pàgina, visor) i el límit de 25 MB', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Biel', 'Pdf Inventat')
  await page.getByRole('link', { name: 'Documents' }).click()

  // Massa gran: un missatge clar, i res més
  await pujar(page).setInputFiles({ name: 'tac-enorme.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(26 * 1024 * 1024, 32) })
  await expect(page.getByRole('alert')).toContainText('«tac-enorme.pdf» fa 26 MB: el màxim és 25 MB per fitxer.')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await pujar(page).setInputFiles({ name: 'audiometria_tonal.pdf', mimeType: 'application/pdf', buffer: await pdfInventat(2) })
  const dialeg = page.getByRole('dialog', { name: 'Nou document' })
  await expect(dialeg.getByLabel('Títol')).toHaveValue('Audiometria tonal')
  await dialeg.getByLabel('Tipus').selectOption({ label: 'Audiometria' })
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(page.getByRole('status')).toContainText('Document desat.')
  await expect(page.getByRole('status')).not.toContainText('galeria')
  const targeta = page.getByRole('button', { name: 'Obrir Audiometria tonal' })
  await expect(targeta).toContainText('PDF · 2 pàg.')
  // Miniatura de la primera pàgina (feta amb pdf.js, sense res d'internet)
  await expect(targeta.locator('img')).toHaveAttribute('src', /^data:image\/jpeg/)
  await targeta.click()
  const visor = page.getByRole('dialog', { name: 'Audiometria tonal' })
  await expect(visor.getByTestId('pagines-pdf')).toHaveAttribute('data-llest', 'si', { timeout: 30_000 })
  await expect(visor.getByRole('img', { name: /^Pàgina \d$/ })).toHaveCount(2)
  // Cap URL ni cap iframe: el PDF només és a la memòria (canvas)
  await expect(visor.locator('iframe, embed, object')).toHaveCount(0)
  await visor.getByRole('button', { name: 'Tancar' }).click()
})

test('anul·lar amb motiu: deixa de mostrar-se i en queda el registre', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Cesc', 'Anullat Inventat')
  await page.getByRole('link', { name: 'Documents' }).click()
  await pujar(page).setInputFiles({ name: 'informe-equivocat.pdf', mimeType: 'application/pdf', buffer: await pdfInventat(1) })
  await page.getByRole('dialog', { name: 'Nou document' }).getByRole('button', { name: 'Desar' }).click()
  await page.getByRole('button', { name: 'Obrir Informe equivocat' }).click()
  const visor = page.getByRole('dialog', { name: 'Informe equivocat' })
  await visor.getByRole('button', { name: 'Anul·lar' }).click()
  const confirmar = visor.getByRole('button', { name: 'Anul·lar el document' })
  await expect(confirmar).toBeDisabled()
  await visor.getByLabel('Motiu de l\'anul·lació (queda registrat)').fill('Era d\'un altre pacient (inventat)')
  await confirmar.click()
  await expect(visor).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Obrir Informe equivocat' })).toHaveCount(0)
  await page.getByText('Documents anul·lats (1)').click()
  await expect(page.locator('.documents-anullats')).toContainText('Informe equivocat · anul·lat el')
  await expect(page.locator('.documents-anullats')).toContainText('Era d\'un altre pacient (inventat)')
})

test('sense xarxa: el document queda «Pendent de pujar» i es puja a Drive en tornar-hi', async ({ page, context, google }) => {
  await entrar(page)
  await nouPacient(page, 'Dana', 'Sense Xarxa Inventada')
  await page.getByRole('link', { name: 'Documents' }).click()
  // Un primer document amb xarxa (a l'app instal·lada, el service worker ja té
  // pdf.js a la memòria cau; aquí no n'hi ha, i el carrega aquest)
  await pujar(page).setInputFiles({ name: 'informe-previ.pdf', mimeType: 'application/pdf', buffer: await pdfInventat(1) })
  await page.getByRole('dialog', { name: 'Nou document' }).getByRole('button', { name: 'Desar' }).click()
  await expect(page.getByRole('button', { name: 'Obrir Informe previ' }).locator('.etiqueta-pendent-pujar')).toHaveCount(0, { timeout: 60_000 })
  await expect(page.locator('.indicador-copia')).toHaveAttribute('aria-label', 'Drive: al dia', { timeout: 20_000 })
  await context.setOffline(true)
  await pujar(page).setInputFiles({ name: 'informe-orl.pdf', mimeType: 'application/pdf', buffer: await pdfInventat(1) })
  await page.getByRole('dialog', { name: 'Nou document' }).getByRole('button', { name: 'Desar' }).click()
  const targeta = page.getByRole('button', { name: 'Obrir Informe orl' })
  await expect(targeta.locator('.etiqueta-pendent-pujar')).toHaveText('Pendent de pujar')
  // Es pot obrir igualment (és al dispositiu)
  await targeta.click()
  await expect(page.getByTestId('pagines-pdf')).toHaveAttribute('data-llest', 'si', { timeout: 30_000 })
  await page.getByRole('button', { name: 'Tancar' }).click()
  const aDrive = () => [...google.fitxers.values()].filter((f) => f.name.startsWith('qi-imatge-'))
  expect(aDrive()).toHaveLength(1)

  await context.setOffline(false)
  await expect(targeta.locator('.etiqueta-pendent-pujar')).toHaveCount(0, { timeout: 60_000 })
  expect(aDrive()).toHaveLength(2)
  // A Drive, xifrats
  for (const f of aDrive()) expect(f.contingut).not.toContain('%PDF')
})

test('ajuntar dues fitxes: els documents passen a la que queda', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Elna', 'Fusio Inventada')
  await nouPacient(page, 'Elna', 'Fusió Inventada')
  await page.getByRole('link', { name: 'Documents' }).click()
  await pujar(page).setInputFiles({ name: 'analitica-antiga.pdf', mimeType: 'application/pdf', buffer: await pdfInventat(1) })
  await page.getByRole('dialog', { name: 'Nou document' }).getByRole('button', { name: 'Desar' }).click()
  await expect(page.getByRole('button', { name: 'Obrir Analitica antiga' })).toBeVisible()

  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Elna Fusio Inventada/ }).click()
  await page.getByRole('link', { name: 'Ajuntar amb una altra fitxa…' }).click()
  await page.getByRole('searchbox', { name: 'Cerca per nom o telèfon' }).fill('Fusió')
  await page.getByRole('list', { name: 'Ajuntar fitxes' }).getByRole('link', { name: /Elna Fusió Inventada/ }).click()
  await page.getByRole('button', { name: 'Confirmar: ajuntar les fitxes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Fitxes ajuntades' })).toBeVisible()
  await page.getByRole('link', { name: 'Documents' }).click()
  await expect(page.getByRole('button', { name: 'Obrir Analitica antiga' })).toBeVisible()
})

test('«Compartir → Qi»: els fitxers rebuts es desen al pacient triat (amb cerca) i s\'esborren de l\'espera', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Fèlix', 'Compartit Inventat')
  // El que hi deixaria el service worker en compartir des de la galeria (simulat)
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    await new Promise<void>((resol, falla) => {
      const r = indexedDB.open('qi-compartits', 1)
      r.onupgradeneeded = () => r.result.createObjectStore('fitxers', { keyPath: 'id', autoIncrement: true })
      r.onsuccess = () => {
        const tx = r.result.transaction('fitxers', 'readwrite')
        tx.objectStore('fitxers').add({ nom: 'IMG-20261102-WA0003.jpg', tipus: 'image/jpeg', blob: new Blob([bytes], { type: 'image/jpeg' }), rebutAt: new Date().toISOString() })
        tx.oncomplete = () => (r.result.close(), resol())
        tx.onerror = () => falla(tx.error)
      }
    })
  }, JPEG.toString('base64'))
  await page.goto('/qi-consulta/#/compartir')
  await expect(page.getByRole('heading', { name: 'Afegir a Qi' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Fitxers triats' }).first()).toContainText('IMG-20261102-WA0003.jpg')
  await page.getByLabel('Cerca el pacient (nom o llinatges)').fill('felix compartit')
  await page.getByRole('button', { name: 'Fèlix Compartit Inventat' }).click()
  const dialeg = page.getByRole('dialog', { name: 'Nou document' })
  await dialeg.getByLabel('Tipus').selectOption({ label: 'Informe mèdic' })
  await dialeg.getByLabel('Títol').fill('Informe de l\'otorino (inventat)')
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(page.getByRole('status')).toContainText('Recorda esborrar la foto de la galeria del mòbil')
  // Ja no espera (s'ha esborrat la còpia sense xifrar)
  const queden = await page.evaluate(
    () =>
      new Promise<number>((resol) => {
        const r = indexedDB.open('qi-compartits', 1)
        r.onsuccess = () => {
          const c = r.result.transaction('fitxers').objectStore('fitxers').count()
          c.onsuccess = () => (r.result.close(), resol(c.result))
        }
      }),
  )
  expect(queden).toBe(0)
  await page.getByRole('link', { name: 'Documents' }).click()
  await expect(page.getByRole('button', { name: 'Obrir Informe de l\'otorino (inventat)' })).toContainText('JPEG')
})

test('a la visita: els documents de l\'episodi, i un de nou vinculat a la sessió', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Gina', 'Visita Inventada')
  await novaCita(page, 'Gina', '2026-11-04', '10:00', 'Hipoacúsia')
  await comencarVisita(page)
  await pestanya(page, 'Valoració').click()
  await page.getByText('Documents de l\'episodi').click()
  const panell = page.locator('.documents-visita')
  await panell.locator('input[type=file][multiple]').setInputFiles({ name: 'audiometria.pdf', mimeType: 'application/pdf', buffer: await pdfInventat(1) })
  const dialeg = page.getByRole('dialog', { name: 'Nou document' })
  await expect(dialeg.getByLabel('Vincular a')).toHaveValue(/^sessio:/)
  await dialeg.getByLabel('Tipus').selectOption({ label: 'Audiometria' })
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(panell.getByRole('button', { name: 'Obrir Audiometria' })).toContainText('Sessió 1')
})

test('al mòbil, la pestanya Documents i els diàlegs caben a la pantalla', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await entrar(page)
  await nouPacient(page, 'Hug', 'Mobil Inventat')
  await page.getByRole('link', { name: 'Documents' }).click()
  await pujar(page).setInputFiles([imatge('pagina-1.jpg'), imatge('pagina-2.jpg')])
  const dialeg = page.locator('.dialeg-escanejar')
  await expect(dialeg).toBeVisible()
  const amplada = await page.evaluate(() => document.documentElement.scrollWidth)
  if (amplada > 390)
    console.log(
      await page.evaluate(() =>
        [...document.querySelectorAll('body *')]
          .filter((e) => e.getBoundingClientRect().right > 391)
          .slice(0, 8)
          .map((e) => `${e.tagName}.${e.className} ${Math.round(e.getBoundingClientRect().right)}`)
          .join('\n'),
      ),
    )
  expect(amplada).toBeLessThanOrEqual(390)
  const caixa = (await dialeg.boundingBox())!
  expect(caixa.x).toBeGreaterThanOrEqual(0)
  expect(caixa.x + caixa.width).toBeLessThanOrEqual(390)
  await dialeg.getByRole('radio', { name: 'Documents separats' }).check()
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(page.getByRole('status')).toContainText('2 documents desats.')
  await expect(page.getByRole('button', { name: /^Obrir Pagina \d$/ })).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
