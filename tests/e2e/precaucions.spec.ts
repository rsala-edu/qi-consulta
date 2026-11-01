// La doctora revisa les precaucions proposades: «D'acord» o «Canviar».
import { expect as expectBase, test, type Page } from '@playwright/test'

const CONTRASENYA = 'contrasenya-de-prova-e2e'
const expect = expectBase.configure({ timeout: 15_000 })
const menu = (page: Page, nom: string) =>
  page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom })

test('confirmar i canviar precaucions; es veuen a la fitxa del punt', async ({ page }) => {
  await page.goto('/qi-consulta/')
  await page.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await page.getByLabel('Repeteix la contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()

  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /Precaucions per revisar/ }).click()
  await expect(page.getByRole('status')).toHaveText(/^0 de \d+ confirmades$/)
  const total = Number((await page.getByRole('status').textContent())!.match(/de (\d+)/)![1])
  expect(total).toBeGreaterThanOrEqual(28)

  // D'acord: es queda el text i passa a confirmada
  const li4 = page.getByRole('listitem', { name: 'LI4' })
  await expect(li4).toContainText('Pendent')
  await li4.getByRole('button', { name: 'D\'acord' }).click()
  await expect(li4).toContainText('Confirmada per la doctora')
  await expect(page.getByRole('status')).toHaveText(`1 de ${total} confirmades`)

  // Canviar: un text nou
  const st9 = page.getByRole('listitem', { name: 'ST9' })
  await st9.getByRole('button', { name: 'Canviar' }).click()
  await st9.getByLabel('Precaució', { exact: true }).fill('Palpar la caròtida i apartar-la amb el dit.')
  await st9.getByRole('button', { name: 'Desar i confirmar' }).click()
  await expect(st9).toContainText('Palpar la caròtida i apartar-la amb el dit.')
  await expect(st9).toContainText('Confirmada per la doctora')
  await expect(page.getByRole('status')).toHaveText(`2 de ${total} confirmades`)

  // Es conserva i es veu a la fitxa del punt al mapa
  await page.reload()
  await page.getByLabel('Contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(page.getByRole('status')).toHaveText(`2 de ${total} confirmades`)
  await menu(page, 'Mapa (prova)').click()
  await expect(page.getByTestId('visor3d')).toHaveAttribute('data-moviment', 'no')
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).fill('ST9')
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).press('Enter')
  const nota = page.getByRole('region', { name: 'ST9' }).getByRole('note')
  await expect(nota).toContainText('Palpar la caròtida')
  await expect(nota).toContainText('Confirmada per la doctora')
})
