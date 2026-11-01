// Bloc C: accés amb Google (només el compte de la doctora), còpia xifrada a
// Google Drive i restauració en un altre dispositiu, clau de recuperació,
// empremta (autenticador virtual amb PRF) i pantalla Avui.
// Google és simulat (tests/e2e/google.ts) i totes les dades són inventades.
import type { Browser, Page } from '@playwright/test'
import { continuarAmbGoogle, expect as expectBase, nouGoogle, simularGoogle, test, type GoogleSimulat } from './google.js'

const CONTRASENYA = 'contrasenya-de-prova-e2e'
const expect = expectBase.configure({ timeout: 15_000 })
const menu = (page: Page, nom: string) =>
  page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom })

async function crearContrasenya(page: Page) {
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await page.getByLabel('Repeteix la contrasenya').fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

async function nouPacient(page: Page, nom: string, llinatges: string, telefon = '') {
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill(nom)
  await page.getByLabel('Llinatges').fill(llinatges)
  if (telefon) await page.getByLabel('Telèfon').fill(telefon)
  await page.getByRole('button', { name: 'Desar' }).click()
  await expect(page.getByRole('heading', { name: `${nom} ${llinatges}` })).toBeVisible()
}

/** Espera que la còpia arribi a Drive (es puja uns segons després de desar). */
async function esperarCopia(page: Page) {
  await expect(page.locator('.indicador-copia')).toHaveText('Drive: al dia', { timeout: 20_000 })
}

async function segonDispositiu(browser: Browser, google: GoogleSimulat, projecte: object) {
  const context = await browser.newContext(projecte)
  await simularGoogle(context, google)
  return context.newPage()
}

test('un altre compte de Google no pot entrar', async ({ browser }, info) => {
  const context = await browser.newContext(info.project.use)
  await simularGoogle(context, nouGoogle('una-altra@exemple.invalid'))
  const page = await context.newPage()
  await page.goto('/qi-consulta/')
  await page.getByRole('button', { name: 'Continuar amb Google' }).click()
  await expect(page.getByRole('alert')).toHaveText('Aquest compte de Google no té accés a Qi. Entra amb el compte de la doctora.')
  await expect(page.getByLabel('Contrasenya', { exact: true })).toHaveCount(0)
  await context.close()
})

test('còpia xifrada a Drive, restauració en un altre dispositiu i canvis entre tots dos', async ({
  page,
  google,
  browser,
}, info) => {
  await crearContrasenya(page)
  await nouPacient(page, 'Aina', 'Provencal Inventada', '600 111 222')
  await esperarCopia(page)

  // A Drive hi ha la còpia actual, la diària i la mensual, i cap dada en clar
  const noms = [...google.fitxers.values()].map((f) => f.name).sort()
  expect(noms).toEqual([expect.stringMatching(/^qi-copia-\d{4}-\d{2}-\d{2}\.json$/), 'qi-dades.json', expect.stringMatching(/^qi-mensual-\d{4}-\d{2}\.json$/)])
  for (const f of google.fitxers.values())
    for (const clar of ['Aina', 'Provencal', '600 111 222']) expect(f.contingut).not.toContain(clar)
  expect(google.peticions.every((p) => p.includes('/files'))).toBe(true)

  // Segon dispositiu (l'ordinador): Google → contrasenya → les dades hi són
  const pc = await segonDispositiu(browser, google, info.project.use)
  await pc.goto('/qi-consulta/')
  await continuarAmbGoogle(pc)
  await expect(pc.getByRole('heading', { name: 'Recuperar les dades' })).toBeVisible()
  await pc.getByLabel('Contrasenya', { exact: true }).fill('no-es-aquesta')
  await pc.getByRole('button', { name: 'Obrir' }).click()
  await expect(pc.getByRole('alert')).toHaveText('La contrasenya no és correcta.')
  await pc.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await pc.getByRole('button', { name: 'Obrir' }).click()
  await expect(pc.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
  await menu(pc, 'Pacients').click()
  await expect(pc.getByRole('link', { name: /Aina Provencal Inventada/ })).toBeVisible()

  // Un pacient nou a l'ordinador arriba a la tauleta
  await nouPacient(pc, 'Biel', 'Prova Inventat')
  await esperarCopia(pc)
  await page.locator('.indicador-copia').click()
  await esperarCopia(page)
  await menu(page, 'Pacients').click()
  await expect(page.getByRole('link', { name: /Biel Prova Inventat/ })).toBeVisible()
  await pc.context().close()
})

test('clau de recuperació: imprimir-la i entrar amb ella si s\'oblida la contrasenya', async ({ page }) => {
  await crearContrasenya(page)
  // Avui recorda que falta la clau
  await expect(page.getByRole('region', { name: 'Acaba de configurar Qi' })).toContainText('clau de recuperació')

  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /Seguretat i còpia/ }).click()
  const seccio = page.getByRole('region', { name: 'Clau de recuperació' })
  await expect(seccio.getByRole('status')).toHaveText('Encara no has fet la clau de recuperació.')
  await seccio.getByRole('button', { name: 'Fer la clau de recuperació' }).click()
  await seccio.getByLabel('Escriu la contrasenya per continuar').fill(CONTRASENYA)
  await seccio.getByRole('button', { name: 'Continuar' }).click()

  const clau = (await page.getByTestId('clau-recuperacio').textContent())!
  expect(clau).toMatch(/^([0-9A-Z]{4}-){12}[0-9A-Z]{4}$/)
  await expect(page.getByRole('button', { name: 'Fet' })).toBeDisabled()
  await page.getByLabel('L\'he impresa i guardada en un lloc segur').check()
  await page.getByRole('button', { name: 'Fet' }).click()
  await expect(page.getByRole('region', { name: 'Clau de recuperació' }).getByRole('status')).toContainText('Ja tens una clau')

  // Contrasenya oblidada
  await page.getByRole('button', { name: 'Bloquejar' }).click()
  await page.getByRole('button', { name: 'He oblidat la contrasenya' }).click()
  await page.getByLabel('Clau de recuperació').fill('AAAA-BBBB')
  await page.getByLabel('Contrasenya nova').fill('contrasenya-nova-e2e')
  await page.getByLabel('Repeteix la contrasenya').fill('contrasenya-nova-e2e')
  await page.getByRole('button', { name: 'Posar la contrasenya nova i entrar' }).click()
  await expect(page.getByRole('alert')).toHaveText('La clau de recuperació no és correcta. Revisa-la lletra per lletra.')
  // Escrita en minúscules i amb espais també val
  await page.getByLabel('Clau de recuperació').fill(clau.toLowerCase().replace(/-/g, ' '))
  await page.getByRole('button', { name: 'Posar la contrasenya nova i entrar' }).click()
  await expect(page.getByRole('button', { name: 'Bloquejar' })).toBeVisible()

  // Ara val la contrasenya nova i no l'antiga
  await page.getByRole('button', { name: 'Bloquejar' }).click()
  await page.getByLabel('Contrasenya', { exact: true }).fill(CONTRASENYA)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(page.getByRole('alert')).toHaveText('La contrasenya no és correcta.')
  await page.getByLabel('Contrasenya', { exact: true }).fill('contrasenya-nova-e2e')
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(page.getByRole('button', { name: 'Bloquejar' })).toBeVisible()
})

test('empremta (passkey amb PRF): activar-la i desbloquejar sense contrasenya', async ({ page }) => {
  // Autenticador virtual del dispositiu, amb verificació i PRF
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      ctap2Version: 'ctap2_1',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      hasPrf: true,
      automaticPresenceSimulation: true,
    },
  })

  await crearContrasenya(page)
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /Seguretat i còpia/ }).click()
  const seccio = page.getByRole('region', { name: 'Empremta o cara' })
  await seccio.getByRole('button', { name: 'Activar l\'empremta' }).click()
  await seccio.getByLabel('Escriu la contrasenya per continuar').fill(CONTRASENYA)
  await seccio.getByRole('button', { name: 'Continuar' }).click()
  await expect(seccio.getByRole('status')).toHaveText('L\'empremta està activada.')

  await page.getByRole('button', { name: 'Bloquejar' }).click()
  await page.getByRole('button', { name: 'Desbloquejar amb l\'empremta' }).click()
  await expect(page.getByRole('button', { name: 'Bloquejar' })).toBeVisible()
})

test('Avui: les cites del dia en ordre i «Començar visita» a la següent', async ({ page }) => {
  await crearContrasenya(page)
  await nouPacient(page, 'Aina', 'Provencal Inventada')
  await nouPacient(page, 'Biel', 'Prova Inventat')

  for (const [qui, hora] of [
    ['biel', '23:10'],
    ['aina', '00:05'],
  ]) {
    await menu(page, 'Avui').click()
    await page.getByRole('navigation', { name: 'Accessos ràpids' }).getByRole('link', { name: 'Nova cita' }).click()
    const dialeg = page.getByRole('dialog', { name: 'Nova cita' })
    await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).fill(qui!)
    await dialeg.locator('.resultats-pacient button').first().click()
    await dialeg.getByLabel('Hora').fill(hora!)
    await dialeg.getByRole('button', { name: 'Desar' }).click()
    await expect(dialeg).toBeHidden()
  }

  await menu(page, 'Avui').click()
  const cites = page.getByRole('region', { name: 'Cites d\'avui' }).getByRole('listitem')
  await expect(cites).toHaveCount(2)
  await expect(cites.nth(0)).toContainText('00:05–00:45')
  await expect(cites.nth(0)).toContainText('Aina Provencal Inventada')
  await expect(cites.nth(1)).toContainText('23:10–23:50')
  // La de les 00:05 ja ha passat (si no és just passada la mitjanit): la següent és la del Biel
  await expect(page.getByRole('button', { name: 'Començar visita' })).toHaveCount(1)
  await expect(cites.nth(1).getByRole('button', { name: 'Començar visita' })).toBeVisible()
  await cites.nth(1).getByRole('button', { name: 'Començar visita' }).click()
  await expect(page.getByRole('heading', { name: 'Biel Prova Inventat' })).toBeVisible()
})
