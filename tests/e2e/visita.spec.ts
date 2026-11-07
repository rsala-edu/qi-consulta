// La visita (etapa 3A): començar, com està, tractament (i repetir el de
// l'última sessió), temporitzador de retenció, control d'agulles, finalitzar,
// propera cita, sessió editada en dos dispositius i addendes. Només dades inventades.
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test'
import { continuarAmbGoogle, expect as expectBase, simularGoogle, test, type GoogleSimulat } from './google.js'

const expect = expectBase.configure({ timeout: 20_000 })
const P = 'contrasenya-inventada-visita'
// Dimecres 4 de novembre de 2026, a les 9:00
const ARA = new Date(2026, 10, 4, 9, 0)

test.describe.configure({ timeout: 180_000 })

const menu = (page: Page, nom: string) =>
  page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom })
const pestanya = (page: Page, nom: string) => page.getByRole('tablist', { name: 'Visita' }).getByRole('tab', { name: nom })
const capcalera = (page: Page) => page.locator('.capcalera-visita')

async function entrar(page: Page) {
  await page.clock.install({ time: ARA })
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByLabel('Repeteix la contrasenya').fill(P)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

async function nouPacient(page: Page, nom: string, llinatges: string) {
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill(nom)
  await page.getByLabel('Llinatges').fill(llinatges)
  await page.getByRole('button', { name: 'Desar' }).first().click()
  await expect(page.getByRole('heading', { name: `${nom} ${llinatges}` })).toBeVisible()
}

async function novaCita(page: Page, pacient: string, dia: string, hora: string, motiu = '') {
  await menu(page, 'Agenda').click()
  await page.getByRole('main').getByRole('button', { name: 'Nova cita', exact: true }).first().click()
  const dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  await dialeg.getByLabel('Data').fill(dia)
  await dialeg.getByLabel('Hora').fill(hora)
  await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).fill(pacient)
  await dialeg.getByRole('button', { name: new RegExp(pacient) }).first().click()
  if (motiu) await dialeg.getByLabel('Motiu').fill(motiu)
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(dialeg).toBeHidden()
}

/** Marca un punt des del cercador del mapa de la visita */
async function marcar(page: Page, consulta: string, codi: string, costat: string) {
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).fill(consulta)
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).press('Enter')
  const fitxa = page.getByRole('region', { name: codi })
  await fitxa.getByRole('radio', { name: costat }).click()
  await fitxa.getByRole('radio', { name: 'Agulla' }).click()
  await fitxa.getByRole('button', { name: 'Marcar' }).click()
}

async function comencarVisita(page: Page) {
  await menu(page, 'Avui').click()
  await page.getByRole('button', { name: /^(Començar visita|Continuar la visita)$/ }).click()
  await expect(capcalera(page)).toBeVisible()
}

async function finalitzar(page: Page, retirades?: number, motiu?: string) {
  await capcalera(page).getByRole('button', { name: 'Finalitzar visita' }).click()
  const panell = page.getByRole('region', { name: 'Finalitzar visita' })
  if (retirades !== undefined) await panell.getByLabel('Agulles retirades').fill(String(retirades))
  if (motiu) {
    await expect(panell.getByRole('button', { name: 'Confirmar i finalitzar' })).toBeDisabled()
    await panell.getByLabel(/Motiu/).fill(motiu)
  }
  await panell.getByRole('button', { name: 'Confirmar i finalitzar' }).click()
  await expect(page.getByText(/Visita finalitzada/)).toBeVisible()
}

test('visita completa: començar, com està, tractament, temporitzador, agulles, finalitzar, propera cita i repetir el tractament @essencial', async ({
  page,
}) => {
  // Dues visites amb el mapa 3D: amb totes les proves alhora, pot trigar
  test.setTimeout(300_000)
  await entrar(page)
  await nouPacient(page, 'Aina', 'Provencal Inventada')
  await novaCita(page, 'Aina', '2026-11-04', '10:00', 'Lumbàlgia')

  // 1a visita
  await comencarVisita(page)
  await expect(capcalera(page)).toContainText('Aina Provencal Inventada')
  await expect(capcalera(page)).toContainText('Lumbàlgia · Sessió 1')
  // Com està
  await page.getByLabel('Canvis des de l\'última sessió').fill('Primera visita (inventat)')
  await page.getByRole('radiogroup', { name: 'Símptoma principal (0–10)' }).getByRole('radio', { name: '7' }).click()
  // Exploració
  await pestanya(page, 'Exploració').click()
  await page.getByLabel('Llengua').fill('Pàl·lida (inventat)')
  // Tractament: dos punts amb agulla (un de bilateral): 3 agulles
  await pestanya(page, 'Tractament').click()
  await marcar(page, 'LI4', 'LI4', 'Bilateral')
  await marcar(page, 'zusanli', 'ST36', 'Dret')
  await expect(page.getByRole('status', { name: 'Agulles posades' }).or(page.locator('output[aria-label="Agulles posades"]'))).toHaveText('3')

  // Temporitzador: 28 minuts per defecte (destacat), + i −; després, en marxa
  const minuts = capcalera(page).locator('.minuts-retencio output')
  await expect(minuts).toHaveText('28 min')
  await expect(minuts).toHaveClass(/per-defecte/)
  await capcalera(page).getByRole('button', { name: 'Un minut més' }).click()
  await expect(minuts).toHaveText('29 min')
  await expect(minuts).not.toHaveClass(/per-defecte/)
  await capcalera(page).getByRole('button', { name: 'Un minut menys' }).click()
  await capcalera(page).getByRole('button', { name: 'Agulles posades: començar' }).click()
  await expect(capcalera(page).getByRole('timer')).toContainText(/Queden 2[78]:\d\d/)
  // Es veu encara que es canviï de pestanya
  await pestanya(page, 'Com està').click()
  await expect(capcalera(page).getByRole('timer')).toBeVisible()
  // S'acaba (mentrestant, l'app s'ha bloquejat sola: la pantalla de bloqueig ho
  // mostra); en desbloquejar, la capçalera en cinabri, sense cap finestra
  await page.clock.fastForward('28:30')
  await expect(page.locator('.retencio-bloqueig')).toHaveText('Retenció acabada')
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(capcalera(page).getByRole('timer')).toContainText('Retenció acabada')
  await expect(capcalera(page)).toHaveClass(/retencio-acabada/)

  // Finalitzar: si les agulles retirades no quadren, cal el motiu
  await finalitzar(page, 2, 'Agulla semipermanent (inventat)')
  await expect(page.getByText(/Editable fins demà a les/)).toBeVisible()

  // Proposar la propera cita: el pacient, el tipus i la durada ja hi són
  await pestanya(page, 'Tancar').click()
  await page.getByRole('button', { name: 'Proposar la propera cita' }).click()
  const dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  await expect(dialeg).toContainText('Aina Provencal Inventada')
  await expect(dialeg.getByRole('status', { name: 'Tipus' }).or(dialeg.locator('output[aria-label="Tipus"]'))).toHaveText('Seguiment')
  await expect(dialeg.getByLabel('Durada')).toHaveValue('40')
  await expect(dialeg.getByLabel('Data')).toHaveValue('2026-11-11')
  await dialeg.getByLabel('Hora').fill('10:00')
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(dialeg).toBeHidden()

  // Una setmana després, 2a visita: repetir el tractament i canviar-lo
  await page.clock.fastForward(7 * 24 * 3_600_000)
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await comencarVisita(page)
  await expect(capcalera(page)).toContainText('Lumbàlgia · Sessió 2')
  await expect(page.getByText('Última sessió: 7')).toBeVisible()
  await pestanya(page, 'Tractament').click()
  await page.getByRole('button', { name: 'Repetir el tractament de l\'última sessió' }).click()
  await page.getByRole('tab', { name: 'Marcats (2)' }).click()
  await expect(page.getByTestId('diferencia-punts')).toHaveText('Respecte de l\'última sessió: +0 punts, −0 punts')
  // Es treu un punt i se n'afegeix un altre
  await page.getByRole('region', { name: 'Punts marcats' }).getByRole('button', { name: /Treure ST36/ }).click()
  await page.getByRole('tab', { name: /^Punt/ }).click()
  await marcar(page, 'sanyinjiao', 'SP6', 'Bilateral')
  await expect(page.getByTestId('diferencia-punts')).toHaveText('Respecte de l\'última sessió: +1 punts, −1 punts')
  await finalitzar(page)

  // A la fitxa: l'episodi amb les dues sessions
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Aina Provencal Inventada/ }).click()
  await page.getByRole('link', { name: 'Tractaments' }).click()
  const episodi = page.getByRole('article', { name: 'Lumbàlgia' })
  await expect(episodi.getByRole('listitem')).toHaveCount(2)
  await expect(episodi.getByRole('listitem').first()).toContainText('escala 7 · 2 punts')
})

/** Compta els sons que fa l'app (Web Audio) */
async function comptarSons(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __sons: number; AudioContext: unknown }
    w.__sons = 0
    w.AudioContext = class {
      currentTime = 0
      destination = {}
      createOscillator() {
        return { type: '', frequency: { value: 0 }, connect: (x: unknown) => x, start: () => (w.__sons += 1), stop() {}, onended: null }
      }
      createGain() {
        return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (x: unknown) => x }
      }
      close() {
        return Promise.resolve()
      }
    }
  })
}
const sons = (page: Page) => page.evaluate(() => (window as unknown as { __sons: number }).__sons)

test('retenció amb l\'app bloquejada: el temporitzador es veu sense cap dada, en acabar sona i s\'avisa, i en desbloquejar es veu que ha acabat', async ({
  page,
}) => {
  await comptarSons(page)
  await entrar(page)
  await nouPacient(page, 'Aina', 'Provencal Inventada')
  await novaCita(page, 'Aina', '2026-11-04', '10:00', 'Lumbàlgia')
  await comencarVisita(page)
  await capcalera(page).getByRole('button', { name: 'Agulles posades: començar' }).click()
  await page.getByRole('button', { name: 'Bloquejar' }).click()

  // Pantalla de bloqueig: només el temps
  const temps = page.locator('.retencio-bloqueig')
  await expect(temps).toHaveText(/^Retenció · 2[78]:\d\d$/)
  await expect(page.getByText(/Aina|Provencal|Lumbàlgia/)).toHaveCount(0)
  await page.clock.fastForward('10:00')
  await expect(temps).toHaveText(/^Retenció · 1[78]:\d\d$/)
  // S'acaba amb l'app bloquejada: avís visual i un sol so
  await page.clock.fastForward('18:30')
  await expect(temps).toHaveText('Retenció acabada')
  await expect(temps).toHaveClass(/acabada/)
  await expect.poll(() => sons(page)).toBe(1)
  await page.clock.fastForward('02:00')
  expect(await sons(page)).toBe(1)

  // En desbloquejar es veu clarament que ha acabat, i porta a la visita
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(capcalera(page)).toHaveClass(/retencio-acabada/)
  await expect(temps).toHaveCount(0)
  // Si s'era a una altra pantalla, la franja ho diu i hi porta
  await page.getByRole('button', { name: 'Bloquejar' }).click()
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await menu(page, 'Pacients').click()
  expect(await sons(page)).toBe(1)
})

test('retenció acabada amb l\'app oberta: la capçalera passa a cinabri, sona un cop i no surt cap franja', async ({ page }) => {
  await comptarSons(page)
  await entrar(page)
  // Bloqueig als 30 minuts: la retenció (28) s'acaba amb l'app oberta
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /Seguretat i còpia/ }).click()
  await page.getByLabel('Bloquejar després de').selectOption('30')
  await nouPacient(page, 'Bernat', 'Prova Inventat')
  await novaCita(page, 'Bernat', '2026-11-04', '10:00', 'Acúfens')
  await comencarVisita(page)
  await capcalera(page).getByRole('button', { name: 'Agulles posades: començar' }).click()
  await page.clock.fastForward('28:30')
  await expect(capcalera(page).getByRole('timer')).toContainText('Retenció acabada')
  await expect(capcalera(page)).toHaveClass(/retencio-acabada/)
  await expect.poll(() => sons(page)).toBe(1)
  await expect(page.locator('.franja-retencio')).toHaveCount(0)
})

test('si s\'acaba amb l\'app bloquejada i es desbloqueja en una altra pantalla, la franja ho diu i porta a la visita', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Carla', 'Exemple Inventada')
  await novaCita(page, 'Carla', '2026-11-04', '10:00', 'Insomni')
  await comencarVisita(page)
  await capcalera(page).getByRole('button', { name: 'Agulles posades: començar' }).click()
  // Se'n va a una altra pantalla i l'app es bloqueja
  await menu(page, 'Agenda').click()
  await page.clock.fastForward('29:00')
  await expect(page.locator('.retencio-bloqueig')).toHaveText('Retenció acabada')
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  const franja = page.locator('.franja-retencio')
  await expect(franja).toContainText('La retenció de les agulles ha acabat a les')
  await franja.getByRole('button', { name: 'Tornar a la visita' }).click()
  await expect(capcalera(page)).toHaveClass(/retencio-acabada/)
  await expect(franja).toHaveCount(0)
})

test('24 hores després de finalitzar, la sessió és de només lectura i s\'hi poden afegir addendes', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Bernat', 'Prova Inventat')
  await novaCita(page, 'Bernat', '2026-11-04', '10:00', 'Acúfens')
  await comencarVisita(page)
  await pestanya(page, 'Tancar').click()
  await page.getByLabel('Recomanacions').fill('Caminar cada dia (inventat)')
  await finalitzar(page, 0)
  // Dins les 24 hores, es pot editar
  await expect(page.getByLabel('Recomanacions')).toBeEnabled()

  await page.clock.fastForward('25:00:00')
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Bernat Prova Inventat/ }).click()
  await page.getByRole('link', { name: 'Tractaments' }).click()
  await page.getByRole('link', { name: /Sessió 1/ }).click()
  await expect(page.getByText(/només lectura/)).toBeVisible()
  await pestanya(page, 'Tancar').click()
  await expect(page.getByLabel('Recomanacions')).toBeDisabled()
  await expect(page.getByLabel('Recomanacions')).toHaveValue('Caminar cada dia (inventat)')
  // Addenda: text, data i hora, sota la sessió
  const addendes = page.getByRole('region', { name: 'Addendes' })
  await addendes.getByLabel('Nova addenda').fill('Ha trucat: va millor (inventat)')
  await addendes.getByRole('button', { name: 'Afegir l\'addenda' }).click()
  await expect(addendes.getByRole('listitem')).toHaveText(/Ha trucat: va millor \(inventat\)/)
})

/** Un altre navegador amb el mateix compte (el mateix Drive simulat) */
async function altreNavegador(browser: Browser, info: TestInfo, google: GoogleSimulat): Promise<{ context: BrowserContext; page: Page }> {
  const { viewport, baseURL, locale, isMobile, hasTouch, userAgent, deviceScaleFactor } = info.project.use
  const context = await browser.newContext({ viewport, baseURL, locale, isMobile, hasTouch, userAgent, deviceScaleFactor })
  await simularGoogle(context, google)
  const page = await context.newPage()
  return { context, page }
}

async function desarAra(page: Page) {
  await page.locator('.indicador-copia').click()
  const panell = page.getByRole('dialog', { name: 'Còpia a Google Drive' })
  const boto = panell.getByRole('button', { name: /Desar ara a Drive|Tornar-ho a provar/ })
  if (await boto.isVisible()) await boto.click()
  await expect(page.locator('.indicador-copia')).toHaveText('Drive: al dia')
  await page.keyboard.press('Escape')
}

test('la mateixa sessió editada en dos dispositius alhora: el camp que perd queda per revisar', async ({ page, google, browser }, info) => {
  test.skip(info.project.name !== 'escriptori', 'Amb dos navegadors, una vegada n\'hi ha prou')
  await entrar(page)
  await nouPacient(page, 'Carla', 'Exemple Inventada')
  await novaCita(page, 'Carla', '2026-11-04', '10:00', 'Insomni')
  await comencarVisita(page)
  await desarAra(page)

  // L'altre dispositiu recupera les dades i obre la mateixa sessió
  const b = await altreNavegador(browser, info, google)
  await b.page.clock.install({ time: ARA })
  await b.page.goto('/qi-consulta/')
  await continuarAmbGoogle(b.page)
  await b.page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await b.page.getByRole('button', { name: 'Obrir' }).click()
  await comencarVisita(b.page)

  // Tots dos escriuen les recomanacions sense haver vist les de l'altre (i
  // s'espera que cadascun ho hagi desat: la pàgina del darrere va més lenta)
  const escriure = async (x: Page, text: string) => {
    await x.bringToFront()
    await pestanya(x, 'Tancar').click()
    await x.getByLabel('Recomanacions').fill(text)
    await expect(x.locator('.accions-visita [role="status"]')).toHaveText('')
    await expect(x.locator('.accions-visita [role="status"]')).toHaveText('Desat')
  }
  await escriure(page, 'Infusió de til·la (inventat)')
  await escriure(b.page, 'Caminar al vespre (inventat)')
  for (const x of [page, b.page, page]) {
    await x.bringToFront()
    await desarAra(x)
  }


  for (const x of [page, b.page]) {
    await x.bringToFront()
    await menu(x, 'Avui').click()
    await comencarVisita(x)
    await expect(x.getByText('Aquestes dades s\'han editat en dos dispositius alhora')).toBeVisible()
    await expect(x.locator('.revisio-conflictes')).toContainText(/Recomanacions/)
  }
  await b.context.close()
})
