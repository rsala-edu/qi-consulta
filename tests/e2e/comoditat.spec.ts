// Comoditat de la visita (bloc 3): anterior i següent al final de cada
// pestanya (a l'última, «Finalitzar visita»), i totes les escales amb el
// mateix component que la barra 0–10 i la mateixa amplada. Només dades inventades.
import { test } from './google.js'
import { capcalera, comencarVisita, entrar, expect, novaCita, nouPacient, pestanya } from './ajudes-visita.js'

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
  await nouPacient(page, 'Nil', 'Escales Inventat', 'Home')
  await novaCita(page, 'Nil', '2026-11-04', '10:00', 'Lumbàlgia')
  await comencarVisita(page)
  await pestanya(page, 'Com està').click()
  await page.getByRole('button', { name: '+ Afegir símptoma secundari' }).click()
  const principal = page.getByRole('radiogroup', { name: 'Símptoma principal (0–10)' })
  const secundari = page.getByRole('radiogroup', { name: 'Símptoma secundari 1 · Escala (0–10)' })
  const mymop = page.getByRole('region', { name: 'MYMOP' }).getByRole('radiogroup', { name: 'Puntuació: Símptoma 1' })
  const benestar = page.getByRole('radiogroup', { name: 'Benestar general' })
  await expect(mymop.getByRole('radio')).toHaveCount(7)
  for (const r of [secundari, mymop, benestar]) await expect(r).toHaveClass(/caselles-escala/)
  const ample = (await principal.boundingBox())!.width
  for (const r of [secundari, mymop, benestar]) expect(Math.abs((await r.boundingBox())!.width - ample)).toBeLessThan(2)
  // Es tria igual: tocar
  await mymop.getByRole('radio', { name: '4' }).click()
  await expect(mymop.getByRole('radio', { name: '4' })).toHaveAttribute('aria-checked', 'true')
})
