// Comoditat de la visita (bloc 3): anterior i següent al final de cada
// pestanya (a l'última, «Finalitzar visita»), i totes les escales amb el
// mateix component que la barra 0–10 i la mateixa amplada. Només dades inventades.
import { test } from './google.js'
import { capcalera, comencarVisita, entrar, expect, novaCita, nouPacient, pestanya, activarEscales, menu, obrirSeccio } from './ajudes-visita.js'

test.describe.configure({ timeout: 120_000 })

test('anterior i següent al final de cada pestanya; a l\'última, «Finalitzar visita»', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Nil', 'Navegació Inventat', 'Home')
  await novaCita(page, 'Nil', '2026-11-04', '10:00', 'Lumbàlgia')
  await comencarVisita(page)
  const nav = page.getByRole('navigation', { name: 'Pestanya anterior i següent' })
  // A la primera visita es comença per la valoració: no hi ha anterior
  await expect(pestanya(page, 'Valoració')).toHaveAttribute('aria-selected', 'true')
  await expect(nav.getByRole('button', { name: /Anterior/ })).toHaveCount(0)
  await nav.getByRole('button', { name: 'Següent: Com està →' }).click()
  await expect(pestanya(page, 'Com està')).toHaveAttribute('aria-selected', 'true')
  // Torna a dalt
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await nav.getByRole('button', { name: '← Anterior: Valoració' }).click()
  await expect(pestanya(page, 'Valoració')).toHaveAttribute('aria-selected', 'true')
  // Fins a l'última
  for (const nom of ['Com està', 'Exploració', 'Diagnòstic', 'Tractament', 'Tancar']) {
    await nav.getByRole('button', { name: `Següent: ${nom} →` }).click()
    await expect(pestanya(page, nom)).toHaveAttribute('aria-selected', 'true')
  }
  await expect(nav.getByRole('button', { name: '← Anterior: Tractament' })).toBeVisible()
  await nav.getByRole('button', { name: 'Finalitzar visita' }).click()
  await expect(page.getByRole('region', { name: 'Finalitzar visita' })).toBeVisible()
  await expect(capcalera(page).getByRole('button', { name: 'Finalitzar visita' })).toHaveAttribute('aria-expanded', 'true')
})

test('el MYMOP i els secundaris fan servir la mateixa barra que l\'escala 0–10, amb la mateixa amplada', async ({ page }) => {
  await entrar(page)
  await activarEscales(page, ['MYMOP'])
  await nouPacient(page, 'Nil', 'Escales Inventat', 'Home')
  await novaCita(page, 'Nil', '2026-11-04', '10:00', 'Lumbàlgia')
  await comencarVisita(page)
  await pestanya(page, 'Com està').click()
  await page.getByRole('button', { name: '+ Afegir símptoma secundari' }).click()
  const principal = page.getByRole('radiogroup', { name: 'Símptoma principal (0–10)' })
  const secundari = page.getByRole('radiogroup', { name: 'Símptoma secundari 1 · Escala (0–10)' })
  const mymop = page.getByRole('region', { name: 'MYMOP' }).getByRole('radiogroup', { name: 'Puntuació: Símptoma 1' })
  const benestar = page.getByRole('radiogroup', { name: 'Benestar general' })
  // PGIC (1–7): a la primera sessió toca; la mateixa barra
  const pgic = page.getByRole('region', { name: 'Impressió global de canvi (PGIC)' })
  await expect(pgic.getByRole('note')).toContainText('Avui toca el PGIC')
  const barraPgic = pgic.getByRole('radiogroup', { name: 'PGIC (1–7)' })
  await expect(barraPgic.getByRole('radio')).toHaveCount(7)
  await barraPgic.getByRole('radio', { name: '3' }).click()
  await expect(pgic.getByRole('status')).toHaveText('3 · Una mica millor')
  await expect(mymop.getByRole('radio')).toHaveCount(7)
  for (const r of [secundari, mymop, benestar, barraPgic]) await expect(r).toHaveClass(/caselles-escala/)
  const ample = (await principal.boundingBox())!.width
  for (const r of [secundari, mymop, benestar, barraPgic]) expect(Math.abs((await r.boundingBox())!.width - ample)).toBeLessThan(2)
  // Es tria igual: tocar
  await mymop.getByRole('radio', { name: '4' }).click()
  await expect(mymop.getByRole('radio', { name: '4' })).toHaveAttribute('aria-checked', 'true')
})

test('SNOT-22 i MYMOP: amagats per defecte, amb la nota de llicència; la doctora els activa a Ajustos > Catàlegs', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Nil', 'Llicència Inventat', 'Home')
  await novaCita(page, 'Nil', '2026-11-04', '10:00', 'Rinitis')
  await comencarVisita(page)
  await pestanya(page, 'Com està').click()
  await expect(page.getByRole('region', { name: 'MYMOP' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Afegir el MYMOP en aquesta sessió' })).toHaveCount(0)
  await pestanya(page, 'ORL').click()
  const escales = await obrirSeccio(page, 'Escales')
  await expect(escales.locator('.camp-especial').filter({ hasText: 'THI' })).toBeVisible()
  await expect(escales.locator('.camp-especial').filter({ hasText: 'SNOT-22' })).toHaveCount(0)
  // L'alternativa lliure: símptomes nasals 0–10, amb la mateixa barra
  const nasal = escales.getByRole('radiogroup', { name: 'Símptomes nasals (0–10)' })
  await expect(nasal).toHaveClass(/caselles-escala/)
  await nasal.getByRole('radio', { name: '6' }).click()
  await expect(nasal.getByRole('radio', { name: '6' })).toHaveAttribute('aria-checked', 'true')

  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /^Catàlegs/ }).click()
  const seccio = page.getByRole('region', { name: 'Escales amb llicència' })
  await expect(seccio).toContainText('Requereix llicència d\'ús clínic')
  await expect(seccio.getByRole('checkbox', { name: 'Activar el SNOT-22' })).not.toBeChecked()
  await activarEscales(page, ['SNOT-22', 'MYMOP'])
  await comencarVisita(page)
  await pestanya(page, 'Com està').click()
  await expect(page.getByRole('region', { name: 'MYMOP' })).toBeVisible()
  await pestanya(page, 'ORL').click()
  await expect((await obrirSeccio(page, 'Escales')).locator('.camp-especial').filter({ hasText: 'SNOT-22' })).toBeVisible()
})
