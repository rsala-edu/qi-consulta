// Cap pestanya de la visita perd el que s'hi ha fet: es marca alguna cosa a
// cadascuna, es canvia de pestanya, es torna i s'hi veu; i també en sortir
// de la visita i tornar-hi. Només dades inventades.
import type { Page } from '@playwright/test'
import { test } from './google.js'
import { comencarVisita, entrar, estatDesat, expect, novaCita, nouPacient, obrirSeccio, pestanya, xip } from './ajudes-visita.js'

test.describe.configure({ timeout: 240_000 })

const premut = (regio: ReturnType<Page['getByRole']>, camp: string, opcio: RegExp) =>
  expect(regio.getByRole('group', { name: camp, exact: true }).getByRole('button', { name: opcio })).toHaveAttribute('aria-pressed', 'true')

/** Comprova cada pestanya tal com ha quedat */
async function comprovar(page: Page) {
  await pestanya(page, 'Valoració').click()
  await expect((await obrirSeccio(page, 'Motiu de consulta i malaltia actual')).getByLabel('Motiu de consulta', { exact: true })).toHaveValue(
    'Xiulet a l\'orella (inventat)',
  )
  await pestanya(page, 'Com està').click()
  await expect(page.getByRole('radiogroup', { name: 'Símptoma principal (0–10)' }).getByRole('radio', { name: '6' })).toHaveAttribute('aria-checked', 'true')
  await pestanya(page, 'Exploració').click()
  await premut(await obrirSeccio(page, 'Vitalitat (shen)'), 'Shen', /^Escàs/)
  await pestanya(page, 'Diagnòstic').click()
  const vuit = await obrirSeccio(page, 'Els vuit principis')
  await premut(vuit, 'Interior o exterior', /^Interior/)
  await premut(vuit, 'Fred o calor', /^Calor/)
  await pestanya(page, 'ORL').click()
  await premut(await obrirSeccio(page, 'Otoscòpia'), 'Orella dreta: conducte auditiu extern', /^Tap de cerumen/)
  await pestanya(page, 'Tractament').click()
  await expect(page.getByRole('status', { name: 'Agulles posades' })).toHaveText('2')
  await pestanya(page, 'Tancar').click()
  await expect(page.getByLabel('Recomanacions')).toHaveValue('Caminar cada dia (inventat)')
}

test('cap pestanya de la visita perd el que s\'hi ha marcat en canviar de pestanya ni en tornar a la visita', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Pau', 'Exemple Inventat', 'Home')
  await novaCita(page, 'Pau', '2026-11-04', '10:00', 'Acúfens')
  await comencarVisita(page)

  // Una cosa a cada pestanya, i de seguida a la següent (sense esperar el desat)
  const motiu = await obrirSeccio(page, 'Motiu de consulta i malaltia actual')
  await motiu.getByLabel('Motiu de consulta', { exact: true }).fill('Xiulet a l\'orella (inventat)')
  await pestanya(page, 'Com està').click()
  await page.getByRole('radiogroup', { name: 'Símptoma principal (0–10)' }).getByRole('radio', { name: '6' }).click()
  await pestanya(page, 'Exploració').click()
  await xip(await obrirSeccio(page, 'Vitalitat (shen)'), 'Shen', /^Escàs/)
  await pestanya(page, 'Diagnòstic').click()
  const vuit = await obrirSeccio(page, 'Els vuit principis')
  await xip(vuit, 'Interior o exterior', /^Interior/)
  await xip(vuit, 'Fred o calor', /^Calor/)
  await pestanya(page, 'ORL').click()
  await xip(await obrirSeccio(page, 'Otoscòpia'), 'Orella dreta: conducte auditiu extern', /^Tap de cerumen/)
  await pestanya(page, 'Tractament').click()
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Agulles posades: +1' }).click()
  await pestanya(page, 'Tancar').click()
  await page.getByLabel('Recomanacions').fill('Caminar cada dia (inventat)')

  // Tornant a cada pestanya, hi és tot (i continua havent-hi en uns segons, quan ja s'ha desat)
  await comprovar(page)
  await estatDesat(page)
  await expect(page.locator('.accions-visita [role="status"]')).toHaveText('Desat')
  await page.waitForTimeout(2000)
  await comprovar(page)

  // Sortir de la visita i tornar-hi: es llegeix de la base de dades
  await comencarVisita(page)
  await comprovar(page)
})
