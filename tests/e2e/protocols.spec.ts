// Etapa 4B: protocols de punts. Crear-ne un (amb un punt cercat), duplicar-lo i
// arxivar-lo; a la visita, el suggerit pel motiu, aplicar-lo, afegir-ne un
// altre (pregunta substituir o afegir), desar els punts com a protocol, i a
// l'evolució es veu de quin protocol s'ha partit. Només dades inventades.
import { test } from './google.js'
import { capcalera, comencarVisita, entrar, expect, finalitzar, menu, novaCita, nouPacient, pestanya } from './ajudes-visita.js'

test.describe.configure({ timeout: 240_000 })

test('protocols: crear, duplicar, arxivar, aplicar a la visita (suggerit), afegir, desar com a protocol', async ({ page }) => {
  await entrar(page)
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /^Protocols/ }).click()
  // Els 5 exemples, marcats
  const llista = page.locator('.llista-protocols > li')
  await expect(llista).toHaveCount(5)
  await expect(page.getByRole('listitem', { name: 'Quatre portes (Si Guan)' })).toContainText('Exemple · revisa-les')

  // Un de nou, amb un punt cercat
  await page.getByRole('button', { name: 'Nou protocol' }).click()
  await page.getByLabel('Nom', { exact: true }).fill('Lumbar inventat')
  await page.getByLabel(/^Etiquetes/).fill('Lumbàlgia, Dolor lumbar')
  await page.getByLabel(/^Afegir un punt/).fill('BL23')
  await page.getByRole('button', { name: /^BL23/ }).click()
  await page.getByLabel(/^Afegir un punt/).fill('BL40')
  await page.getByRole('button', { name: /^BL40/ }).click()
  await page.getByLabel('BL40 · Tècnica').selectOption({ label: 'Moxa' })
  await page.getByRole('button', { name: 'Desar el protocol' }).click()
  await expect(llista).toHaveCount(6)
  const lumbar = page.getByRole('listitem', { name: 'Lumbar inventat' })
  await expect(lumbar).toContainText('BL23 · BL40')
  // Duplicar i arxivar la còpia
  await lumbar.getByRole('button', { name: 'Duplicar' }).click()
  const copia = page.getByRole('listitem', { name: 'Lumbar inventat (còpia)' })
  await copia.getByRole('button', { name: 'Arxivar' }).click()
  await expect(copia).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Mostrar els arxivats' }).check()
  await expect(copia).toContainText('Arxivat')

  // A la visita: suggerit pel motiu de l'episodi
  await nouPacient(page, 'Pere', 'Protocol Inventat', 'Home')
  await novaCita(page, 'Pere', '2026-11-04', '10:00', 'Lumbàlgia')
  await comencarVisita(page)
  await pestanya(page, 'Tractament').click()
  await page.getByRole('button', { name: 'Protocols', exact: true }).click()
  const dialeg = page.getByRole('dialog', { name: 'Protocols' })
  const sug = dialeg.getByRole('region', { name: 'Protocols suggerits' })
  await expect(sug.getByRole('button', { name: /Lumbar inventat/ })).toBeVisible()
  // L'arxivat no surt
  await expect(dialeg.getByRole('button', { name: /\(còpia\)/ })).toHaveCount(0)
  await sug.getByRole('button', { name: /Lumbar inventat/ }).click()
  await page.getByRole('tab', { name: /Marcats/ }).click()
  const marcats = page.getByRole('region', { name: 'Punts marcats' })
  await expect(marcats.locator('.fila-marcat')).toHaveCount(2)

  // Un altre: com que ja hi ha punts, pregunta substituir o afegir
  await page.getByRole('button', { name: 'Protocols', exact: true }).click()
  await dialeg.getByRole('searchbox').fill('lr3')
  await dialeg.getByRole('button', { name: /Quatre portes/ }).click()
  await expect(dialeg.getByRole('group', { name: 'La sessió ja té punts' })).toBeVisible()
  await dialeg.getByRole('button', { name: 'Afegir-los' }).click()
  await expect(marcats.locator('.fila-marcat')).toHaveCount(4)

  // Desar els punts de la sessió com a protocol
  await page.getByRole('button', { name: 'Protocols', exact: true }).click()
  await dialeg.getByRole('button', { name: 'Desar com a protocol' }).click()
  const desar = page.getByRole('dialog', { name: 'Desar com a protocol' })
  await desar.getByLabel('Nom', { exact: true }).fill('Lumbàlgia amb estrès (inventat)')
  await desar.getByRole('button', { name: 'Desar el protocol' }).click()
  await expect(desar.getByRole('status')).toContainText('Lumbàlgia amb estrès (inventat)')
  await desar.getByRole('button', { name: 'Tancar' }).click()
  await finalitzar(page)

  // A l'evolució: de quin protocol s'ha partit
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Pere Protocol Inventat/ }).click()
  await page.getByRole('link', { name: 'Tractaments' }).click()
  await expect(page.locator('.cronologia')).toContainText('Protocol: Quatre portes (Si Guan)')
  // I el protocol nou, a la llista, amb l'etiqueta del motiu
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /^Protocols/ }).click()
  await expect(page.getByRole('listitem', { name: 'Lumbàlgia amb estrès (inventat)' })).toContainText('Lumbàlgia')
  await expect(capcalera(page)).toHaveCount(0)
})
