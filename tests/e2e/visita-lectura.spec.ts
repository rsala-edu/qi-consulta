// Errors trobats fent servir una visita de veritat (bloc 1): el diagnòstic de
// només lectura s'ha de veure clar i el pla s'ha de poder canviar a qualsevol
// sessió; la capçalera diu l'episodi i el tipus real de la cita; una sessió
// tancada es pot consultar tota però no editar. Només dades inventades.
import { test } from './google.js'
import { capcalera, comencarVisita, entrar, expect, finalitzar, menu, novaCita, nouPacient, obrirSeccio, P, pestanya, xip } from './ajudes-visita.js'

test.describe.configure({ timeout: 240_000 })

test('diagnòstic de la valoració: franja de només lectura fins que es revisa; el pla es canvia a qualsevol sessió i es manté', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Pau', 'Diagnòstic Inventat', 'Home')
  await novaCita(page, 'Pau', '2026-11-04', '10:00', 'Lumbàlgia')
  await comencarVisita(page)
  await pestanya(page, 'Diagnòstic').click()
  const vuit = await obrirSeccio(page, 'Els vuit principis')
  await xip(vuit, 'Interior o exterior', /^Interior/)
  const pla = page.getByRole('region', { name: 'Pla de tractament' })
  await pla.getByLabel('Sessions previstes').fill('10')
  await pla.getByRole('group', { name: 'Freqüència' }).getByRole('button', { name: 'Setmanal' }).click()
  await expect(pla.getByRole('status')).toHaveText('Desat')
  // A la primera sessió no hi ha franja: es pot editar
  await expect(page.locator('.franja-lectura')).toHaveCount(0)
  // Es manté en canviar de pestanya i tornar (i després de desar)
  await pestanya(page, 'Com està').click()
  await pestanya(page, 'Diagnòstic').click()
  await expect(pla.getByLabel('Sessions previstes')).toHaveValue('10')
  await expect(pla.getByRole('group', { name: 'Freqüència' }).getByRole('button', { name: 'Setmanal' })).toHaveAttribute('aria-pressed', 'true')
  await finalitzar(page)

  // Segona sessió: el diagnòstic és de la valoració de la primera (només lectura, i es diu)
  await novaCita(page, 'Pau', '2026-11-04', '12:00', 'Lumbàlgia')
  await comencarVisita(page)
  await pestanya(page, 'Diagnòstic').click()
  const franja = page.locator('.franja-lectura')
  await expect(franja).toContainText('Diagnòstic de la valoració del 4/11 · Revisa la valoració per canviar-lo')
  const vuit2 = await obrirSeccio(page, 'Els vuit principis')
  await expect(vuit2.getByRole('group', { name: 'Interior o exterior', exact: true }).getByRole('button', { name: /^Interior/ })).toBeDisabled()
  // Atenuats
  const opacitat = await vuit2.getByRole('group', { name: 'Interior o exterior', exact: true }).getByRole('button', { name: /^Exterior/ }).evaluate((e) => Number(getComputedStyle(e).opacity))
  expect(opacitat).toBeLessThan(0.6)

  // El pla, en canvi, es pot canviar directament (i no torna als valors d'abans en desar)
  const pla2 = page.getByRole('region', { name: 'Pla de tractament' })
  await pla2.getByLabel('Sessions previstes').fill('12')
  await pla2.getByRole('group', { name: 'Freqüència' }).getByRole('button', { name: 'Cada 15 dies' }).click()
  await expect(pla2.getByRole('status')).toHaveText('Desat')
  await page.waitForTimeout(1000)
  await expect(pla2.getByLabel('Sessions previstes')).toHaveValue('12')
  await expect(capcalera(page)).toContainText('Sessió 2 de 12')
  await pestanya(page, 'Com està').click()
  await pestanya(page, 'Diagnòstic').click()
  await expect(pla2.getByLabel('Sessions previstes')).toHaveValue('12')
  await expect(pla2.getByRole('group', { name: 'Freqüència' }).getByRole('button', { name: 'Cada 15 dies' })).toHaveAttribute('aria-pressed', 'true')

  // «Revisar la valoració»: ja es pot marcar, i es manté en tornar a la pestanya
  await franja.getByRole('button', { name: 'Revisar la valoració' }).click()
  await expect(page.locator('.franja-lectura')).toHaveCount(0)
  const vuit3 = await obrirSeccio(page, 'Els vuit principis')
  await xip(vuit3, 'Fred o calor', /^Fred hán/)
  await pestanya(page, 'Com està').click()
  await pestanya(page, 'Diagnòstic').click()
  const vuit4 = await obrirSeccio(page, 'Els vuit principis')
  await expect(vuit4.getByRole('group', { name: 'Fred o calor', exact: true }).getByRole('button', { name: /^Fred hán/ })).toHaveAttribute('aria-pressed', 'true')
})

test('capçalera: l\'episodi i el tipus real de la cita, encara que la primera cita no tingués motiu', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Laia', 'Capçalera Inventada')
  // La primera cita, sense motiu
  await novaCita(page, 'Laia', '2026-11-04', '10:00')
  await comencarVisita(page)
  await expect(capcalera(page).locator('.qui-visita p')).toHaveText('Sessió 1 · Primera visita')
  await finalitzar(page)
  await novaCita(page, 'Laia', '2026-11-04', '12:00', 'Lumbàlgia')
  await comencarVisita(page)
  await expect(capcalera(page).locator('.qui-visita p')).toHaveText('Sessió 2 · Lumbàlgia · Seguiment')
  // L'episodi també agafa el motiu (fitxa del pacient)
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Laia Capçalera Inventada/ }).click()
  await page.getByRole('link', { name: 'Tractaments' }).click()
  await expect(page.getByRole('article', { name: 'Lumbàlgia' })).toBeVisible()
})

test('sessió tancada: es consulta tot (marcats, vistes, ampliar, fitxa del punt) però no es pot marcar ni canviar res; addenda al costat de l\'avís', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Bernat', 'Tancada Inventat')
  await novaCita(page, 'Bernat', '2026-11-04', '10:00', 'Cervicàlgia')
  await comencarVisita(page)
  await pestanya(page, 'Tractament').click()
  const cerca = page.getByRole('searchbox', { name: /Cerca un punt/ })
  await cerca.fill('LI4')
  await cerca.press('Enter')
  const fitxa = page.getByRole('region', { name: 'LI4' })
  await fitxa.getByRole('radio', { name: 'Bilateral' }).click()
  await fitxa.getByRole('button', { name: 'Marcar' }).click()
  await finalitzar(page)

  await page.clock.fastForward('25:00:00')
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Bernat Tancada Inventat/ }).click()
  await page.getByRole('link', { name: 'Tractaments' }).click()
  await page.getByRole('link', { name: /Sessió 1/ }).click()
  await expect(page.getByText(/només lectura/)).toBeVisible()
  // «Desat» no surt
  await expect(capcalera(page).getByRole('status')).toHaveCount(0)

  await pestanya(page, 'Tractament').click()
  // Permès: la pestanya «Marcats», les vistes i «Ampliar»
  await page.getByRole('tab', { name: /Marcats/ }).click()
  const llista = page.getByRole('region', { name: 'Punts marcats' })
  await expect(llista.getByRole('button', { name: /LI4/ })).toBeEnabled()
  await expect(llista.getByRole('button', { name: /Treure/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Davant' })).toBeEnabled()
  await page.getByRole('button', { name: 'Esquerra' }).click()
  await expect(page.getByRole('button', { name: '⤢ Ampliar' })).toBeEnabled()
  // Seleccionar un punt: la fitxa es veu, però no es pot marcar ni canviar la tècnica
  await llista.getByRole('button', { name: /LI4/ }).click()
  const fitxa2 = page.getByRole('region', { name: 'LI4' })
  await expect(fitxa2).toBeVisible()
  await expect(fitxa2.getByRole('button', { name: /Actualitzar|Marcar/ })).toBeDisabled()
  await expect(fitxa2.getByRole('button', { name: 'Desmarcar' })).toBeDisabled()
  await expect(fitxa2.getByRole('radio', { name: 'Moxa' })).toBeDisabled()
  await expect(fitxa2.getByRole('button', { name: 'Tancar' })).toBeEnabled()
  // Bloquejat: «Repetir» i les agulles
  await expect(page.getByRole('button', { name: /Repetir/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Agulles posades: +1' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Agulles posades: −1' })).toBeDisabled()
  // L'orella també es pot mirar
  await page.getByRole('tab', { name: 'Orella' }).click()
  await expect(page.getByRole('button', { name: 'Ampliar', exact: true })).toBeEnabled()

  // «Afegir una addenda», al costat de l'avís
  await page.locator('.avis-sessio-tancada').getByRole('button', { name: 'Afegir una addenda' }).click()
  const addendes = page.getByRole('region', { name: 'Addendes' })
  await expect(addendes.getByLabel('Nova addenda')).toBeFocused()
  await addendes.getByLabel('Nova addenda').fill('Ha trucat: millor (inventat)')
  await addendes.getByRole('button', { name: 'Afegir l\'addenda' }).click()
  await expect(addendes.getByRole('listitem')).toHaveText(/Ha trucat: millor \(inventat\)/)
})
