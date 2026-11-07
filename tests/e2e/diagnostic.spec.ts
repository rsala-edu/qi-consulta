// Diagnòstic de MTC, pla de tractament i MYMOP (etapa 3B, part 3). Només dades inventades.
import { test } from './google.js'
import { capcalera, comencarVisita, entrar, expect, finalitzar, novaCita, nouPacient, obrirSeccio, pestanya, xip } from './ajudes-visita.js'

test.describe.configure({ timeout: 240_000 })

test('diagnòstic amb síndromes de la CIM-11, pla de tractament («Sessió 1 de 10») i MYMOP', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Pau', 'Exemple Inventat', 'Home')
  await novaCita(page, 'Pau', '2026-11-04', '10:00', 'Acúfens')
  await comencarVisita(page)

  // MYMOP: a la primera sessió toca (avís discret)
  await pestanya(page, 'Com està').click()
  const mymop = page.getByRole('region', { name: 'MYMOP' })
  await expect(mymop.getByRole('note')).toContainText('Avui toca el MYMOP')
  await mymop.getByLabel('Símptoma 1', { exact: true }).fill('Xiulet a l\'orella (inventat)')
  await mymop.getByRole('radiogroup', { name: 'Puntuació: Símptoma 1' }).getByRole('radio', { name: '5' }).click()
  await mymop.getByLabel('Activitat que li costa', { exact: true }).fill('Llegir (inventat)')
  await mymop.getByRole('radiogroup', { name: 'Puntuació: Activitat que li costa' }).getByRole('radio', { name: '4' }).click()
  await mymop.getByRole('radiogroup', { name: 'Benestar general' }).getByRole('radio', { name: '3' }).click()
  await expect(mymop.getByRole('status')).toHaveText('Perfil: 4')

  // Diagnòstic
  await pestanya(page, 'Diagnòstic').click()
  const vuit = await obrirSeccio(page, 'Els vuit principis')
  await xip(vuit, 'Interior o exterior', /^Interior/)
  await xip(vuit, 'Deficiència o excés', /^Deficiència amb excés/)
  const organs = await obrirSeccio(page, 'Òrgans i substàncies')
  await xip(organs, 'Zang', /^Fetge/)
  await xip(organs, 'Zang', /^Ronyó/)
  await xip(organs, 'Substàncies', /^Yin/)
  const sind = await obrirSeccio(page, 'Síndromes')
  await sind.getByRole('searchbox', { name: 'Síndrome principal' }).fill('ronyo yin')
  await sind.getByRole('button', { name: /Kidney yin deficiency pattern/ }).first().click()
  await expect(sind.locator('.llista-sindromes').first()).toContainText('Kidney yin deficiency pattern')
  await sind.getByRole('searchbox', { name: 'Síndromes secundàries' }).fill('liver yang')
  await sind.getByRole('button', { name: /Liver yang/ }).first().click()
  const princ = await obrirSeccio(page, 'Principis de tractament')
  await xip(princ, 'Suggeriments', /^Nodrir el yin/)
  await xip(princ, 'Suggeriments', /^Calmar el fetge/)
  await princ.getByLabel('Altres / observacions').fill('Tonificar el ronyó per aclarir l\'oïda (inventat)')

  // Pla de tractament: 10 sessions → «Sessió 1 de 10» a la capçalera
  const pla = page.getByRole('region', { name: 'Pla de tractament' })
  await pla.getByLabel('Sessions previstes').fill('10')
  await pla.getByRole('group', { name: 'Freqüència' }).getByRole('button', { name: 'Setmanal' }).click()
  await pla.getByRole('group', { name: 'Tècniques previstes' }).getByRole('button', { name: 'Acupuntura', exact: true }).click()
  await pla.getByLabel('Objectius').fill('Reduir l\'acúfen a la meitat (inventat)')
  await pla.getByLabel('Data de revisió del pla').fill('2026-12-15')
  await expect(capcalera(page)).toContainText('Sessió 1 de 10')
  await expect(pla.getByRole('status')).toHaveText('Desat')
  await expect(page.locator('.pestanya-valoracio [role="status"]').first()).toHaveText(/Desat/)
  // Les pestanyes no perden el que s'hi ha fet
  await pestanya(page, 'Valoració').click()
  await pestanya(page, 'Diagnòstic').click()
  await expect(page.locator('.capcalera-seccio button').filter({ hasText: /^Síndromes/ })).toContainText('Kidney yin deficiency pattern')
  await finalitzar(page)

  // Segona sessió: «Sessió 2 de 10», el MYMOP no toca, el diagnòstic és de només lectura fins que es revisa
  await novaCita(page, 'Pau', '2026-11-04', '12:00')
  await comencarVisita(page)
  await expect(capcalera(page)).toContainText('Sessió 2 de 10')
  await expect(page.getByRole('region', { name: 'MYMOP' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Afegir el MYMOP en aquesta sessió' })).toBeVisible()
  await pestanya(page, 'Diagnòstic').click()
  await expect(page.locator('.capcalera-seccio button').filter({ hasText: /^Síndromes/ })).toContainText('Kidney yin deficiency pattern')
  await expect(page.getByRole('region', { name: 'Pla de tractament' }).getByLabel('Sessions previstes')).toHaveValue('10')
})
