// Flux complet amb dades INVENTADES: crear contrasenya → crear pacient →
// omplir la fitxa clínica → bloquejar → desbloquejar → cercar → editar.
import { expect, test, type Page } from '@playwright/test'

const CONTRASENYA = 'contrasenya-de-prova-e2e'

/** Llegeix IndexedDB directament, tal com ho veuria algú amb accés al disc. */
async function contingutBrutIndexedDB(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resoldre, rebutjar) => {
        const peticio = indexedDB.open('qi')
        peticio.onerror = () => rebutjar(peticio.error)
        peticio.onsuccess = () => {
          const db = peticio.result
          const taules = Array.from(db.objectStoreNames)
          const tx = db.transaction(taules, 'readonly')
          const resultat: Record<string, unknown> = {}
          for (const taula of taules) {
            const r = tx.objectStore(taula).getAll()
            r.onsuccess = () => (resultat[taula] = r.result)
          }
          tx.oncomplete = () => resoldre(JSON.stringify(resultat))
        }
      }),
  )
}

test('desbloquejar → crear pacient → editar la fitxa clínica', async ({ page }) => {
  await page.goto('/qi-consulta/')

  // 1. Primera vegada: crear la contrasenya
  await expect(page.getByRole('heading', { name: 'Benvinguda a Qi' })).toBeVisible()
  await page.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await page.getByLabel('Repeteix la contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Pacients' })).toBeVisible()
  await expect(page.getByText('Encara no hi ha cap pacient.')).toBeVisible()

  // 2. Alta d'un pacient
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill('Aina')
  await page.getByLabel('Llinatges').fill('Provencal Inventada')
  await page.getByLabel('Telèfon').fill('600 111 222')
  await page.getByRole('button', { name: 'Desar' }).click()

  // Després de l'alta va directament a la fitxa clínica
  await expect(page).toHaveURL(/#\/pacients\/[0-9a-f-]+\/fitxa-clinica$/)
  await expect(page.getByRole('heading', { name: 'Aina Provencal Inventada' })).toBeVisible()

  // 3. Fitxa clínica
  await page.getByLabel('Anticoagulants').check()
  await page.getByLabel('Al·lèrgies').fill('Penicil·lina')
  await page.getByLabel('Medicació actual').fill('Acenocumarol (inventat)')
  await page.getByRole('button', { name: 'Desar' }).click()
  await expect(page.getByText('Desat')).toBeVisible()

  // Res en clar a IndexedDB
  const brut = await contingutBrutIndexedDB(page)
  expect(brut).toContain('xifrat')
  for (const valor of ['Aina', 'Provencal', '600 111 222', 'Penicil', 'Acenocumarol']) {
    expect(brut).not.toContain(valor)
  }

  // 4. Bloquejar i tornar a entrar: torna a la mateixa pantalla
  const urlFitxa = page.url()
  await page.getByRole('button', { name: 'Bloquejar' }).click()
  await expect(page.getByRole('button', { name: 'Desbloquejar' })).toBeVisible()
  await expect(page.getByText('Aina')).toHaveCount(0)

  await page.getByLabel('Contrasenya').fill('no-es-aquesta')
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(page.getByRole('alert')).toHaveText('La contrasenya no és correcta.')

  await page.getByLabel('Contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(page.getByLabel('Al·lèrgies')).toHaveValue('Penicil·lina')
  await expect(page.getByLabel('Anticoagulants')).toBeChecked()
  expect(page.url()).toBe(urlFitxa)

  // 5. Cercar per telèfon i editar les dades
  await page.getByRole('link', { name: 'Pacients' }).click()
  await page.getByRole('searchbox').fill('600111')
  await expect(page.getByRole('list', { name: 'Pacients' }).getByRole('link')).toHaveCount(1)
  await page.getByRole('searchbox').fill('ningu')
  await expect(page.getByText('Cap pacient coincideix amb la cerca.')).toBeVisible()
  await page.getByRole('searchbox').fill('aina provencal')
  await page.getByRole('link', { name: /Aina Provencal Inventada/ }).click()

  await expect(page).toHaveURL(/\/dades$/)
  await page.getByLabel('Telèfon').fill('611 222 333')
  await page.getByRole('button', { name: 'Desar' }).click()
  await expect(page.getByText('Desat')).toBeVisible()

  // 6. Tancar l'app (recarregar) la bloqueja: la clau només vivia en memòria
  await page.reload()
  await expect(page.getByRole('button', { name: 'Desbloquejar' })).toBeVisible()
  await page.getByLabel('Contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(page.getByLabel('Telèfon')).toHaveValue('611 222 333')
})

test('arxivar un pacient l\'amaga de la llista sense esborrar-lo', async ({ page }) => {
  await page.goto('/qi-consulta/')
  await page.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await page.getByLabel('Repeteix la contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()

  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill('Bernat')
  await page.getByLabel('Llinatges').fill('Fictici')
  await page.getByRole('button', { name: 'Desar' }).click()
  await page.getByRole('link', { name: 'Dades' }).click()

  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Arxivar pacient' }).click()
  await expect(page.getByText('Aquest pacient és a l\'arxiu.')).toBeVisible()

  await page.getByRole('link', { name: 'Pacients' }).click()
  await expect(page.getByRole('link', { name: /Bernat/ })).toHaveCount(0)
  await page.getByLabel('Mostrar arxivats').check()
  await expect(page.getByRole('link', { name: /Bernat Fictici/ })).toBeVisible()
})
