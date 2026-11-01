// La doctora revisa les precaucions per categories: confirma cada categoria
// i, dins d'una categoria, pot fer una excepció per a un punt concret.
import { type Page } from '@playwright/test'
import { continuarAmbGoogle, expect as expectBase, test } from './google.js'

const CONTRASENYA = 'contrasenya-de-prova-e2e'
const expect = expectBase.configure({ timeout: 15_000 })
const menu = (page: Page, nom: string) =>
  page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom })

async function anarAlPunt(page: Page, codi: string) {
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).fill(codi)
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).press('Enter')
  return page.getByRole('region', { name: codi }).getByRole('note')
}

test('confirmar categories, fer una excepció i veure-ho a la fitxa del punt', async ({ page }) => {
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await page.getByLabel('Repeteix la contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()

  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /Precaucions per revisar/ }).click()
  await expect(page.getByRole('status')).toHaveText('0 de 7 categories confirmades')

  const llista = page.getByRole('list', { name: 'Precaucions per revisar' })
  const categoria = (nom: string) => llista.getByRole('listitem', { name: nom, exact: true })

  // D'acord a una categoria sencera
  await expect(categoria('Pulmó')).toContainText('Pendent')
  await categoria('Pulmó').getByRole('button', { name: 'D\'acord' }).click()
  await expect(categoria('Pulmó')).toContainText('Confirmada per la doctora')
  await expect(page.getByRole('status')).toHaveText('1 de 7 categories confirmades')

  // Dins de «Grans vasos»: desplegar els punts i fer una excepció a ST9
  await categoria('Grans vasos').getByRole('button', { name: /Veure els punts/ }).click()
  const punts = page.getByRole('list', { name: 'Punts: Grans vasos' })
  const st9 = punts.getByRole('listitem', { name: 'ST9' })
  await st9.getByRole('button', { name: 'Fer una excepció' }).click()
  await st9.getByLabel('Precaució', { exact: true }).fill('Palpar la caròtida i apartar-la amb el dit.')
  await st9.getByRole('checkbox', { name: 'Profunditat (només informativa)' }).check()
  await st9.getByRole('button', { name: 'Desar l\'excepció' }).click()
  await expect(st9).toContainText('Excepció de la doctora')
  await expect(st9).toContainText('Palpar la caròtida i apartar-la amb el dit.')
  await expect(st9).toContainText('També: Profunditat (només informativa)')
  // La categoria encara és pendent: l'excepció només és d'aquest punt
  await expect(categoria('Grans vasos')).toContainText('Pendent')

  // Es conserva i es veu a la fitxa del punt al mapa, amb la categoria
  await page.reload()
  await page.getByLabel('Contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(page.getByRole('status')).toHaveText('1 de 7 categories confirmades')
  await menu(page, 'Mapa (prova)').click()
  await expect(page.getByTestId('visor3d')).toHaveAttribute('data-moviment', 'no')

  const st9Nota = await anarAlPunt(page, 'ST9')
  await expect(st9Nota).toContainText('Precaució: Grans vasos · Profunditat (només informativa).')
  await expect(st9Nota).toContainText('Palpar la caròtida')
  await expect(st9Nota).toContainText('Confirmada per la doctora')

  // ST13 és de la categoria «Pulmó», confirmada sencera
  const st13Nota = await anarAlPunt(page, 'ST13')
  await expect(st13Nota).toContainText('Precaució: Pulmó.')
  await expect(st13Nota).toContainText('Confirmada per la doctora')

  // LI4 (embaràs) encara és pendent
  const li4Nota = await anarAlPunt(page, 'LI4')
  await expect(li4Nota).toContainText('Precaució: Embaràs.')
  await expect(li4Nota).not.toContainText('Confirmada per la doctora')
})
