// La llista de la pantalla Pacients es veu, sense cerca, amb cerca (sense
// accents ni majúscules) i amb els arxivats. Hi va haver un error: el
// desplegable de Nova cita feia servir la mateixa classe CSS i la llista quedava
// fora de la vista (amb posició absoluta). També el menú d'Ajustos. Només dades
// inventades.
import type { Locator } from '@playwright/test'
import { test } from './google.js'
import { entrar, expect, menu, nouPacient } from './ajudes-visita.js'

test.describe.configure({ timeout: 120_000 })

/** Es veu a la pantalla, al seu lloc (no fora de la vista) */
async function esVeu(element: Locator) {
  await expect(element).toBeVisible()
  await expect(element).toBeInViewport()
}

test('pantalla Pacients: llista, cerca sense accents i arxivats @essencial', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Raül', 'Sala Grau')
  await nouPacient(page, 'Bernat', 'Ferrer Inventat')
  await nouPacient(page, 'Carme', 'Arxiu Inventada')
  await page.getByRole('link', { name: 'Dades' }).click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Arxivar pacient' }).click()
  await expect(page.getByText('Aquest pacient és a l\'arxiu.')).toBeVisible()

  // Sense cerca: els dos que no són a l'arxiu, a sota del cercador
  await menu(page, 'Pacients').click()
  const llista = page.getByRole('list', { name: 'Pacients' })
  const raul = llista.getByRole('link', { name: /Raül Sala Grau/ })
  await esVeu(raul)
  await esVeu(llista.getByRole('link', { name: /Bernat Ferrer Inventat/ }))
  await expect(llista.getByRole('link')).toHaveCount(2)
  const cerca = page.getByRole('searchbox', { name: /Cerca/ })
  const sotaCerca = (await cerca.boundingBox())!
  expect((await llista.boundingBox())!.y).toBeGreaterThanOrEqual(sotaCerca.y + sotaCerca.height)

  // Cerca sense accents ni majúscules, per qualsevol part
  await cerca.fill('ra')
  await esVeu(raul)
  await cerca.fill('RAUL')
  await esVeu(raul)
  await expect(llista.getByRole('link')).toHaveCount(1)
  await cerca.fill('grau')
  await esVeu(raul)
  await cerca.fill('')

  // Arxivats: només amb «Mostrar arxivats»
  await expect(llista.getByRole('link', { name: /Carme/ })).toHaveCount(0)
  await page.getByLabel('Mostrar arxivats').check()
  await esVeu(llista.getByRole('link', { name: /Carme Arxiu Inventada/ }))
  await expect(llista.getByRole('link')).toHaveCount(3)

  // El menú d'Ajustos (la mateixa classe de llista) també es veu
  await menu(page, 'Ajustos').click()
  await esVeu(page.getByRole('main').getByRole('link').first())

  // I el desplegable de Nova cita continua sortint sota el camp
  await menu(page, 'Agenda').click()
  await page.getByRole('main').getByRole('button', { name: 'Nova cita', exact: true }).first().click()
  const dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).click()
  await esVeu(dialeg.getByRole('button', { name: /Raül Sala Grau/ }))
})
