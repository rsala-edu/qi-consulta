// Visites en curs: «Continuar la visita» a l'Agenda i a Avui, avís suau en
// sortir de la visita sense finalitzar i franja a Avui amb les d'altres dies.
// Només dades inventades.
import { test } from './google.js'
import { capcalera, comencarVisita, entrar, expect, menu, novaCita, nouPacient, P } from './ajudes-visita.js'

test.describe.configure({ timeout: 240_000 })

test('una visita en curs es pot reprendre des de l\'Agenda i des d\'Avui, i en sortir-ne surt l\'avís', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Aina', 'Provencal Inventada')
  await novaCita(page, 'Aina', '2026-11-04', '10:00', 'Lumbàlgia')
  await comencarVisita(page)
  // Dins la visita no surt l'avís (la pantalla es pot tornar a muntar sense sortir-ne)
  await page.waitForTimeout(500)
  // (sense reintentar: l'avís desapareix sol al cap de 7 s)
  expect(await page.getByRole('status').filter({ hasText: 'La visita continua en curs' }).count()).toBe(0)

  // Sortir sense finalitzar: avís suau
  await menu(page, 'Agenda').click()
  await expect(page.getByRole('status').filter({ hasText: 'La visita continua en curs' })).toHaveText(
    /La visita continua en curs\. La pots reprendre des d'Avui/,
  )

  // A l'Agenda, la cita en curs té «Continuar la visita»
  await page.evaluate(() => {
    location.hash = '#/agenda?dia=2026-11-04&vista=dia'
  })
  await page.getByRole('button', { name: /10:00–11:00 Aina Provencal Inventada/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Continuar la visita' }).click()
  await expect(capcalera(page)).toContainText('Aina Provencal Inventada')

  // L'endemà, a Avui: franja amb la visita sense finalitzar
  await page.clock.fastForward('24:00:00')
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await menu(page, 'Avui').click()
  const franja = page.getByRole('region', { name: 'Tens 1 visita sense finalitzar' })
  await expect(franja).toContainText('Aina Provencal Inventada · dc. 4/11 a les 10:00')
  await franja.getByRole('button', { name: 'Continuar la visita' }).click()
  await expect(capcalera(page)).toContainText('Aina Provencal Inventada')
})
