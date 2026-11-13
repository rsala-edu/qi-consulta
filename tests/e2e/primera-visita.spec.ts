// Primera visita completa a la tauleta (etapa 3B): valoració, MYMOP,
// exploració, diagnòstic, mòdul ORL (s'activa sol amb «Acúfens»), pla de
// tractament, tractament i finalitzar. Només dades inventades.
import { test } from './google.js'
import { capcalera, comencarVisita, menu, entrar, expect, finalitzar, novaCita, nouPacient, obrirSeccio, pestanya, xip, activarEscales } from './ajudes-visita.js'

test.describe.configure({ timeout: 300_000 })

test('primera visita completa amb el mòdul ORL', async ({ page }, info) => {
  test.skip(info.project.name !== 'tauleta', 'És la prova de la tauleta')
  await entrar(page)
  await activarEscales(page, ['SNOT-22', 'MYMOP'])
  await nouPacient(page, 'Rosa', 'Exemple Inventada')
  await novaCita(page, 'Rosa', '2026-11-04', '10:00', 'Acúfens')
  await comencarVisita(page)

  // Valoració
  const motiu = await obrirSeccio(page, 'Motiu de consulta i malaltia actual')
  await motiu.getByLabel('Motiu de consulta', { exact: true }).fill('Acúfens bilaterals, pitjor a l\'esquerra (inventat)')
  await xip(motiu, 'Evolució', /^Crònic/)
  const son = await obrirSeccio(page, 'Son')
  await xip(son, 'Alteracions', /^Despertars/)
  const cons = await obrirSeccio(page, 'Tipus de constitució')
  await xip(cons, 'Principal', /^Deficiència de yin/)

  // Com està: MYMOP
  await pestanya(page, 'Com està').click()
  await page.getByRole('region', { name: 'MYMOP' }).getByRole('radiogroup', { name: 'Benestar general' }).getByRole('radio', { name: '3' }).click()

  // Exploració
  await pestanya(page, 'Exploració').click()
  const llengua = await obrirSeccio(page, 'Llengua')
  await xip(llengua, 'Cos: color', /^Vermell/)
  await xip(llengua, 'Saburra: naturalesa', /^Pelada/)
  const pols = await obrirSeccio(page, 'Pols')
  await xip(pols, 'Qualitats (general)', /^Filiforme/)
  await xip(pols, 'Qualitats (general)', /^Ràpid/)

  // Diagnòstic i pla
  await pestanya(page, 'Diagnòstic').click()
  const sind = await obrirSeccio(page, 'Síndromes')
  await sind.getByRole('searchbox', { name: 'Síndrome principal' }).fill('ronyo yin')
  await sind.getByRole('button', { name: /^SF93 / }).click()
  const pla = page.getByRole('region', { name: 'Pla de tractament' })
  await pla.getByLabel('Sessions previstes').fill('8')
  await expect(capcalera(page)).toContainText('Sessió 1 de 8')

  // ORL: la pestanya surt sola (el motiu és «Acúfens»)
  await pestanya(page, 'ORL').click()
  const oto = await obrirSeccio(page, 'Otoscòpia')
  await xip(oto, 'Orella dreta: membrana timpànica', 'Normal')
  await xip(oto, 'Orella esquerra: membrana timpànica', 'Normal')
  const acu = await obrirSeccio(page, 'Acumetria')
  await xip(acu, 'Rinne: orella dreta', 'Positiu')
  await xip(acu, 'Rinne: orella esquerra', 'Positiu')
  await xip(acu, 'Weber', 'Lateralitzat a la dreta')
  const audio = await obrirSeccio(page, 'Audiometria tonal')
  for (const [f, db] of [[500, 15], [1000, 20], [2000, 35], [4000, 50]] as const) {
    await audio.getByLabel(`Esquerra · aèria · ${f} Hz (dB HL)`).fill(String(db))
  }
  await expect(audio.getByRole('status')).toContainText('esquerra 30 dB')
  await expect(audio.locator('[data-via="E_aeria"] path')).toHaveCount(4)
  const timp = await obrirSeccio(page, 'Timpanometria')
  await xip(timp, 'Orella dreta (Jerger)', /^A$/)
  await xip(timp, 'Orella esquerra (Jerger)', /^A$/)
  const esc = await obrirSeccio(page, 'Escales')
  const thi = esc.locator('.camp-especial').filter({ hasText: 'THI (acúfens)' })
  await thi.getByLabel('Apuntar les respostes ítem per ítem').check()
  for (let i = 1; i <= 12; i++) await thi.getByRole('radiogroup', { name: `Ítem ${i}`, exact: true }).getByRole('radio', { name: i <= 6 ? '4' : '2' }).click()
  await expect(thi.getByLabel('Puntuació total (0–100)')).toHaveValue('36')
  await expect(thi.getByRole('status')).toHaveText('Grau 2 · lleu')
  await expect(thi.getByText('Falten 13 respostes.')).toBeVisible()
  const snot = esc.locator('.camp-especial').filter({ hasText: 'SNOT-22' })
  await snot.getByLabel('Puntuació total (0–110)').fill('12')
  await expect(snot.getByRole('status')).toHaveText('Lleu')

  // Tractament i finalitzar
  await pestanya(page, 'Tractament').click()
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).fill('KI3')
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).press('Enter')
  const fitxa = page.getByRole('region', { name: 'KI3' })
  await fitxa.getByRole('radio', { name: 'Bilateral' }).click()
  await fitxa.getByRole('button', { name: 'Marcar' }).click()
  await expect(page.locator('.pestanya-valoracio [role="status"]').first()).toHaveText(/Desat/)
  await finalitzar(page)

  // Tot hi és en tornar-hi (ara de només lectura)
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Rosa Exemple Inventada/ }).click()
  await page.getByRole('link', { name: 'Tractaments' }).click()
  await page.getByRole('link', { name: /^Sessió 1/ }).click()
  await expect(capcalera(page)).toContainText('Sessió 1 de 8')
  await pestanya(page, 'ORL').click()
  await expect(page.locator('.capcalera-seccio button').filter({ hasText: /^Escales/ })).toContainText('36')
  await expect(page.locator('.capcalera-seccio button').filter({ hasText: /^Timpanometria/ })).toContainText('A')
})

test('mòdul ORL a mà: amb un motiu que no és ORL no surt; s\'activa i es treu', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Lia', 'Exemple Inventada')
  await novaCita(page, 'Lia', '2026-11-04', '10:00', 'Lumbàlgia')
  await comencarVisita(page)
  await expect(pestanya(page, 'ORL')).toHaveCount(0)
  await page.getByRole('button', { name: 'Activar el mòdul ORL' }).click()
  await pestanya(page, 'ORL').click()
  await expect(page.locator('.nom-seccio').filter({ hasText: 'Otoscòpia' })).toBeVisible()
  await page.getByRole('button', { name: 'Treure el mòdul ORL' }).click()
  await expect(pestanya(page, 'ORL')).toHaveCount(0)
  await expect(pestanya(page, 'Valoració')).toHaveAttribute('aria-selected', 'true')
})
