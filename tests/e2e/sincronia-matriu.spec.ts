// Matriu d'escenaris de sincronia (docs/sincronia.md, fase 2). Només dades
// inventades. Tres dispositius (tauleta, PC 1 i PC 2) i un mòbil, contra un
// Drive simulat que es comporta com el real (drive-realista.ts: ETag, latència,
// errors 412/429/503, comptes separats).
//
// Cada prova demostra què passa avui. Les que comencen per «FALLA» comproven
// un comportament incorrecte que encara no s'ha arreglat: quan s'arregli, la
// prova fallarà i s'haurà de girar perquè comprovi el comportament correcte.
import { devices, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect as expectBase, CORREU_DOCTORA, CORREU_PROVES } from './google.js'
import { driveDe, nouDispositiu, nouMon, principalDe, simularDispositiu, type Dispositiu, type Mon } from './drive-realista.js'

const expect = expectBase.configure({ timeout: 20_000 })
const P = 'contrasenya-inventada-doctora'
const ARA = new Date(2026, 10, 2, 8, 0)
const CADA = 5 * 60_000

type Perfil = 'tauleta' | 'pc' | 'mobil'
const PERFILS: Record<Perfil, (typeof devices)[string]> = {
  tauleta: devices['Galaxy Tab S9 landscape'],
  pc: devices['Desktop Chrome'],
  mobil: devices['Pixel 7'],
}

interface Disp {
  mon: Mon
  d: Dispositiu
  context: BrowserContext
  page: Page
}

test.describe.configure({ timeout: 180_000 })

// Tots els rellotges comencen a la mateixa hora (ARA), corregida pel temps que
// ha passat des de l'inici de la prova: així no hi ha desfasaments sense voler
let t0 = 0
// Playwright llegeix els paràmetres per saber quines dependències té
// oxlint-disable-next-line no-empty-pattern
test.beforeEach(({}, info) => {
  // Una sola vegada (amb els seus propis dispositius dins cada prova), no un cop per projecte
  test.skip(info.project.name !== 'escriptori', 'La matriu crea els seus propis dispositius')
  t0 = Date.now()
})
const horaComuna = (desfasMs = 0) => new Date(ARA.getTime() + (Date.now() - t0) + desfasMs)
/** Un món (comptes i Drive) amb l'hora de Google igual que la dels dispositius */
const nouMonAlDia = () => ({ ...nouMon(), ara: () => horaComuna().getTime() })

async function dispositiu(
  browser: Browser,
  info: TestInfo,
  mon: Mon,
  nom: string,
  perfil: Perfil,
  { correu = CORREU_DOCTORA, desfasMs = 0 } = {},
): Promise<Disp> {
  const context = await browser.newContext({ ...PERFILS[perfil], baseURL: info.project.use.baseURL, locale: 'ca-ES' })
  const d = nouDispositiu(nom, correu)
  await simularDispositiu(context, mon, d)
  const page = await context.newPage()
  page.on('dialog', (x) => void x.accept())
  await page.clock.install({ time: horaComuna(desfasMs) })
  return { mon, d, context, page }
}

const menu = (page: Page, nom: string) =>
  page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom })
const pindola = (page: Page) => page.locator('.indicador-copia')

async function crear(x: Disp) {
  await x.page.goto('/qi-consulta/')
  await x.page.getByRole('button', { name: 'Continuar amb Google' }).click()
  await x.page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await x.page.getByLabel('Repeteix la contrasenya').fill(P)
  await x.page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(x.page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

async function recuperar(x: Disp) {
  await x.page.goto('/qi-consulta/')
  await x.page.getByRole('button', { name: 'Continuar amb Google' }).click()
  await expect(x.page.getByRole('heading', { name: 'Recuperar les dades' })).toBeVisible()
  await x.page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await x.page.getByRole('button', { name: 'Obrir' }).click()
  await expect(x.page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
  await esperarQuiet(x)
}

/** Espera que acabi la sincronia en curs (cap petició nova a Drive durant 1,5 s) */
async function esperarQuiet(x: Disp) {
  let n = -1
  await expect
    .poll(
      async () => {
        const ara = peticionsDe(x.mon, x.d.nom).length
        const quiet = ara === n
        n = ara
        if (!quiet) await new Promise((r) => setTimeout(r, 1_500))
        return quiet
      },
      { timeout: 30_000, intervals: [0] },
    )
    .toBe(true)
}

async function nouPacient(page: Page, nom: string, llinatges: string) {
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill(nom)
  await page.getByLabel('Llinatges').fill(llinatges)
  await page.getByRole('button', { name: 'Desar' }).first().click()
  await expect(page.getByRole('heading', { name: `${nom} ${llinatges}` })).toBeVisible()
}

async function novaCita(page: Page, pacient: string, dia: string, hora: string) {
  await menu(page, 'Agenda').click()
  await page.getByRole('main').getByRole('button', { name: 'Nova cita', exact: true }).first().click()
  const dialeg = page.getByRole('dialog', { name: 'Nova cita' })
  await dialeg.getByLabel('Data').fill(dia)
  await dialeg.getByLabel('Hora').fill(hora)
  await dialeg.getByRole('searchbox', { name: 'Cerca el pacient' }).fill(pacient)
  await dialeg.getByRole('button', { name: new RegExp(pacient) }).first().click()
  await dialeg.getByRole('button', { name: 'Desar' }).click()
  await expect(dialeg).toBeHidden()
}

/** Esborra la cita de la setmana que comença per aquesta hora («09:15») */
async function esborrarCita(page: Page, hora: string) {
  await obrirSetmana(page)
  await page.locator(`.cita-agenda[aria-label^="${hora}"]`).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('button', { name: 'Esborrar la cita' }).click()
  await expect(page.locator(`.cita-agenda[aria-label^="${hora}"]`)).toHaveCount(0)
}

/** Torna a carregar l'agenda (les pantalles obertes no es refresquen soles) */
async function obrirSetmana(page: Page) {
  await menu(page, 'Avui').click()
  await menu(page, 'Agenda').click()
  await page.getByRole('radio', { name: 'Setmana' }).click()
  await expect(page.getByTestId('graella-agenda')).toBeVisible()
}

async function citesVisibles(page: Page): Promise<string[]> {
  const noms = await page.locator('.cita-agenda').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
  return noms.map((n) => n.replace(/ ·.*$/, '')).sort()
}

async function citesDeLaSetmana(page: Page): Promise<string[]> {
  await obrirSetmana(page)
  return citesVisibles(page)
}

async function obrirPacient(page: Page, nom: RegExp) {
  await menu(page, 'Avui').click()
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: nom }).click()
  await expect(page).toHaveURL(/\/dades$/)
}

async function editarCamp(page: Page, nom: RegExp, camp: string, valor: string) {
  await obrirPacient(page, nom)
  await page.getByLabel(camp, { exact: true }).fill(valor)
  await page.getByRole('button', { name: 'Desar' }).click()
  await expect(page.getByText('Desat')).toBeVisible()
}

const peticionsDe = (mon: Mon, nom: string) => mon.peticions.filter((p) => p.dispositiu === nom)

/** «Desar ara a Drive» (o «Tornar-ho a provar») i espera que la sincronia acabi bé */
async function sincronitzar(mon: Mon, x: Disp) {
  const abans = peticionsDe(mon, x.d.nom).length
  const panell = x.page.getByRole('dialog', { name: 'Còpia a Google Drive' })
  if (!(await panell.isVisible())) await pindola(x.page).click()
  await panell.getByRole('button', { name: /Desar ara a Drive|Tornar-ho a provar/ }).click()
  await expect.poll(() => peticionsDe(mon, x.d.nom).length).toBeGreaterThan(abans)
  await expect(pindola(x.page)).toHaveText('Drive: al dia')
  await x.page.keyboard.press('Escape')
}

/** Espera que la sincronia automàtica (en desar) hagi pujat els canvis */
async function esperarPujada(mon: Mon, x: Disp, abans: number) {
  await expect
    .poll(() => peticionsDe(mon, x.d.nom).filter((p) => p.metode === 'PATCH' && p.estat === 200).length, { timeout: 20_000 })
    .toBeGreaterThan(abans)
  await expect(pindola(x.page)).toHaveText('Drive: al dia')
}
const pujades = (mon: Mon, x: Disp) => peticionsDe(mon, x.d.nom).filter((p) => p.metode === 'PATCH' && p.estat === 200).length

/** El PC 1 amb una pacient i les dades a Drive */
async function primerDispositiu(browser: Browser, info: TestInfo, mon: Mon, nom = 'pc1', perfil: Perfil = 'pc') {
  const x = await dispositiu(browser, info, mon, nom, perfil)
  await crear(x)
  await nouPacient(x.page, 'Aina', 'Provencal Inventada')
  await sincronitzar(mon, x)
  return x
}

/**
 * El permís de la doctora ja no val (401), la renovació silenciosa falla i la
 * persona toca «Tornar a entrar amb Google»: Google hi posa el compte que hi
 * ha obert ara en aquest navegador (d.correu).
 */
async function canviarDeCompte(x: Disp) {
  await pindola(x.page).click()
  await x.page.getByRole('button', { name: /Desar ara a Drive|Tornar-ho a provar/ }).click()
  await expect(pindola(x.page)).toHaveText(/canvis? pendents?/)
  await x.page.keyboard.press('Escape')
  // El toc següent prova la renovació silenciosa, que falla
  await menu(x.page, 'Avui').click()
  await expect(pindola(x.page)).toHaveText('Cal tornar a connectar amb Google')
  await pindola(x.page).click()
  await x.page.getByRole('button', { name: 'Tornar a entrar amb Google' }).click()
}

// ---------------------------------------------------------------------------

test('a) dispositiu nou (navegador del mòbil): Google i contrasenya, i ho recupera tot @essencial', async ({ browser }, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  await novaCita(pc1.page, 'Aina', '2026-11-04', '17:00')
  await obrirPacient(pc1.page, /Aina Provencal Inventada/)
  await pc1.page.getByRole('link', { name: 'Fitxa clínica' }).click()
  await pc1.page.getByLabel('Al·lèrgies').fill('Penicil·lina (inventat)')
  await pc1.page.getByRole('button', { name: 'Desar' }).click()
  await expect(pc1.page.getByText('Desat')).toBeVisible()
  await sincronitzar(mon, pc1)

  const mobil = await dispositiu(browser, info, mon, 'mobil', 'mobil')
  await recuperar(mobil)
  expect(await citesDeLaSetmana(mobil.page)).toEqual(['17:00–18:00 Aina Provencal Inventada'])
  await obrirPacient(mobil.page, /Aina Provencal Inventada/)
  await mobil.page.getByRole('link', { name: 'Fitxa clínica' }).click()
  await expect(mobil.page.getByLabel('Al·lèrgies')).toHaveValue('Penicil·lina (inventat)')
  // Res en clar a Drive
  for (const f of driveDe(mon, CORREU_DOCTORA).values()) expect(f.contingut).not.toMatch(/Aina|Penicil/)
})

test('b) tres dispositius oberts: una cita creada al PC 1 arriba sola a la tauleta i al PC 2 en ≤ 5 minuts, i l\'agenda oberta es refresca sola', async ({
  browser,
}, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  const tauleta = await dispositiu(browser, info, mon, 'tauleta', 'tauleta')
  const pc2 = await dispositiu(browser, info, mon, 'pc2', 'pc')
  await recuperar(tauleta)
  await recuperar(pc2)
  await obrirSetmana(tauleta.page)
  await obrirSetmana(pc2.page)
  // Els rellotges dels tres van junts
  const tots = [pc1, tauleta, pc2]

  const abans = pujades(mon, pc1)
  await novaCita(pc1.page, 'Aina', '2026-11-04', '17:00')
  // Es puja sola uns 5 segons després de desar
  await esperarPujada(mon, pc1, abans)

  // Els altres no ho saben fins a la pròxima sincronia periòdica
  expect(await citesDeLaSetmana(pc2.page)).toEqual([])
  const peticionsTauleta = peticionsDe(mon, 'tauleta').length
  await Promise.all(tots.map((x) => x.page.clock.runFor(CADA)))
  await expect.poll(() => peticionsDe(mon, 'tauleta').length).toBeGreaterThan(peticionsTauleta)
  await expect(pindola(tauleta.page)).toHaveText('Drive: al dia')
  // L'agenda oberta es refresca sola, sense tocar res
  await expect.poll(() => citesVisibles(tauleta.page)).toEqual(['17:00–18:00 Aina Provencal Inventada'])
  await expect.poll(() => citesVisibles(pc2.page)).toEqual(['17:00–18:00 Aina Provencal Inventada'])
})

test('b2) amb un formulari a mig fer no es toca res: surt «Hi ha canvis d\'un altre dispositiu · Veure\'ls»', async ({ browser }, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  const pc2 = await dispositiu(browser, info, mon, 'pc2', 'pc')
  await recuperar(pc2)
  // Al PC 2 la doctora escriu el telèfon i encara no ha desat
  await obrirPacient(pc2.page, /Aina/)
  await pc2.page.getByLabel('Telèfon', { exact: true }).fill('622 222 222')
  // Mentrestant, el PC 1 hi canvia la professió
  await editarCamp(pc1.page, /Aina/, 'Professió', 'Mestra (inventat)')
  await sincronitzar(mon, pc1)
  await sincronitzar(mon, pc2)
  const franja = pc2.page.getByRole('status').filter({ hasText: 'Hi ha canvis d\'un altre dispositiu' })
  await expect(franja).toBeVisible()
  // El que escrivia continua igual
  await expect(pc2.page.getByLabel('Telèfon', { exact: true })).toHaveValue('622 222 222')
  await expect(pc2.page.getByLabel('Professió', { exact: true })).toHaveValue('')
  // En desar, només es desa el que ha canviat ella: la professió del PC 1 no es trepitja
  await pc2.page.getByRole('button', { name: 'Desar' }).click()
  await expect(pc2.page.getByText('Desat')).toBeVisible()
  await expect(franja).toHaveCount(0)
  await expect(pc2.page.getByLabel('Professió', { exact: true })).toHaveValue('Mestra (inventat)')
  await sincronitzar(mon, pc2)
  await sincronitzar(mon, pc1)
  await obrirPacient(pc1.page, /Aina/)
  await expect(pc1.page.getByLabel('Telèfon', { exact: true })).toHaveValue('622 222 222')
  await expect(pc1.page.getByLabel('Professió', { exact: true })).toHaveValue('Mestra (inventat)')
})

test('b3) «Veure\'ls» mostra els canvis que han arribat mentre hi havia un formulari a mig fer', async ({ browser }, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  const pc2 = await dispositiu(browser, info, mon, 'pc2', 'pc')
  await recuperar(pc2)
  await obrirPacient(pc2.page, /Aina/)
  await pc2.page.getByLabel('Telèfon', { exact: true }).fill('622 222 222')
  await editarCamp(pc1.page, /Aina/, 'Professió', 'Mestra (inventat)')
  await sincronitzar(mon, pc1)
  await sincronitzar(mon, pc2)
  await pc2.page.getByRole('button', { name: 'Veure\'ls' }).click()
  await expect(pc2.page.getByLabel('Professió', { exact: true })).toHaveValue('Mestra (inventat)')
})

test('c) dos dispositius editen camps diferents de la mateixa fitxa: es conserven tots dos, sense conflicte', async ({
  browser,
}, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  const pc2 = await dispositiu(browser, info, mon, 'pc2', 'pc')
  await recuperar(pc2)
  // Tots dos editen sense haver vist el canvi de l'altre
  pc1.d.senseXarxa = pc2.d.senseXarxa = true
  await editarCamp(pc1.page, /Aina/, 'Telèfon', '611 111 111')
  await editarCamp(pc2.page, /Aina/, 'Professió', 'Mestra (inventat)')
  pc1.d.senseXarxa = pc2.d.senseXarxa = false
  await sincronitzar(mon, pc1)
  await sincronitzar(mon, pc2)
  await sincronitzar(mon, pc1)
  for (const x of [pc1, pc2]) {
    await obrirPacient(x.page, /Aina/)
    await expect(x.page.getByLabel('Telèfon', { exact: true })).toHaveValue('611 111 111')
    await expect(x.page.getByLabel('Professió', { exact: true })).toHaveValue('Mestra (inventat)')
    await expect(x.page.getByText('Aquestes dades s\'han editat en dos dispositius alhora')).toHaveCount(0)
  }
})

test('d) dos dispositius editen el mateix camp: guanya el més nou i l\'altre queda per revisar als dos @essencial', async ({ browser }, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  const pc2 = await dispositiu(browser, info, mon, 'pc2', 'pc')
  await recuperar(pc2)
  pc1.d.senseXarxa = pc2.d.senseXarxa = true
  await editarCamp(pc1.page, /Aina/, 'Telèfon', '611 111 111')
  await editarCamp(pc2.page, /Aina/, 'Telèfon', '622 222 222')
  pc1.d.senseXarxa = pc2.d.senseXarxa = false
  await sincronitzar(mon, pc1)
  await sincronitzar(mon, pc2)
  await sincronitzar(mon, pc1)
  for (const x of [pc1, pc2]) {
    await obrirPacient(x.page, /Aina/)
    await expect(x.page.getByLabel('Telèfon', { exact: true })).toHaveValue('622 222 222')
    await expect(x.page.getByText('Aquestes dades s\'han editat en dos dispositius alhora')).toBeVisible()
    await expect(x.page.getByText('611 111 111')).toBeVisible()
  }
})

test('e) un dispositiu esborra una cita; l\'altre, que era sense connexió, no la torna a fer aparèixer', async ({ browser }, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  await novaCita(pc1.page, 'Aina', '2026-11-04', '17:00')
  await novaCita(pc1.page, 'Aina', '2026-11-05', '10:00')
  await sincronitzar(mon, pc1)
  const pc2 = await dispositiu(browser, info, mon, 'pc2', 'pc')
  await recuperar(pc2)
  expect(await citesDeLaSetmana(pc2.page)).toHaveLength(2)

  pc2.d.senseXarxa = true
  await esborrarCita(pc1.page, '17:00')
  await sincronitzar(mon, pc1)
  // El PC 2, sense connexió, ho intenta i no pot
  await pindola(pc2.page).click()
  await pc2.page.getByRole('dialog', { name: 'Còpia a Google Drive' }).getByRole('button', { name: 'Desar ara a Drive' }).click()
  await expect(pindola(pc2.page)).toHaveText('Drive: sense connexió')
  await pc2.page.keyboard.press('Escape')
  // Torna la connexió: el navegador avisa i l'app sincronitza sola
  pc2.d.senseXarxa = false
  const n = peticionsDe(mon, 'pc2').length
  await pc2.page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect.poll(() => peticionsDe(mon, 'pc2').length).toBeGreaterThan(n)
  await expect(pindola(pc2.page)).toHaveText('Drive: al dia')
  // (la que queda passa a ser la primera visita: 40 minuts)
  await expect.poll(() => citesDeLaSetmana(pc2.page)).toEqual(['10:00–10:40 Aina Provencal Inventada'])
  await sincronitzar(mon, pc1)
  expect(await citesDeLaSetmana(pc1.page)).toEqual(['10:00–10:40 Aina Provencal Inventada'])
})

test('f) un dispositiu treballa sense connexió tot un dia i després es reconnecta: tot arriba a Drive i a l\'altre', async ({
  browser,
}, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  const tauleta = await dispositiu(browser, info, mon, 'tauleta', 'tauleta')
  await recuperar(tauleta)
  tauleta.d.senseXarxa = true
  await nouPacient(tauleta.page, 'Bernat', 'Prova Inventat')
  await novaCita(tauleta.page, 'Bernat', '2026-11-03', '09:15')
  await novaCita(tauleta.page, 'Aina', '2026-11-03', '12:00')
  // Mentrestant el PC 1 també treballa
  await novaCita(pc1.page, 'Aina', '2026-11-04', '17:00')
  await sincronitzar(mon, pc1)
  // Passa el dia (tots dos rellotges): l'app es bloqueja i el permís de Google caduca
  await Promise.all([pc1, tauleta].map((x) => x.page.clock.fastForward('09:00:00')))
  tauleta.d.senseXarxa = false
  await tauleta.page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await tauleta.page.getByRole('button', { name: 'Desbloquejar' }).click()
  // El primer toc renova el permís sense preguntar i la sincronia surt sola
  await menu(tauleta.page, 'Avui').click()
  await expect.poll(() => tauleta.d.autoritzacions.filter((a) => a.prompt === 'none').length).toBe(1)
  await expect.poll(() => citesDeLaSetmana(tauleta.page)).toHaveLength(3)
  await expect(pindola(tauleta.page)).toHaveText('Drive: al dia')

  await pc1.page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await pc1.page.getByRole('button', { name: 'Desbloquejar' }).click()
  await menu(pc1.page, 'Avui').click()
  await expect.poll(() => pc1.d.autoritzacions.filter((a) => a.prompt === 'none').length).toBe(1)
  await expect.poll(() => citesDeLaSetmana(pc1.page)).toEqual([
    '09:15–10:15 Bernat Prova Inventat',
    '12:00–13:00 Aina Provencal Inventada',
    '17:00–18:00 Aina Provencal Inventada',
  ])
})

test('g1) amb el rellotge 10 minuts endarrerit, una cita esborrada no torna a aparèixer', async ({ browser }, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  await novaCita(pc1.page, 'Aina', '2026-11-04', '17:00')
  await sincronitzar(mon, pc1)
  const pc2 = await dispositiu(browser, info, mon, 'pc2', 'pc', { desfasMs: -10 * 60_000 })
  await recuperar(pc2)
  await esborrarCita(pc2.page, '17:00')
  await sincronitzar(mon, pc2)
  // El rellotge lògic (HLC) de l'esborrat és posterior al de la cita, encara que el rellotge vagi endarrerit
  expect(await citesDeLaSetmana(pc2.page)).toEqual([])
  await sincronitzar(mon, pc1)
  expect(await citesDeLaSetmana(pc1.page)).toEqual([])
  await sincronitzar(mon, pc2)
  expect(await citesDeLaSetmana(pc2.page)).toEqual([])
})

test('g2) amb el rellotge 10 minuts endarrerit, un canvi posterior guanya als dos dispositius', async ({ browser }, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  const pc2 = await dispositiu(browser, info, mon, 'pc2', 'pc', { desfasMs: -10 * 60_000 })
  await recuperar(pc2)
  // PC 1 canvia el telèfon i el puja; el PC 2 el rep
  await editarCamp(pc1.page, /Aina/, 'Telèfon', '611 111 111')
  await sincronitzar(mon, pc1)
  await sincronitzar(mon, pc2)
  await obrirPacient(pc2.page, /Aina/)
  await expect(pc2.page.getByLabel('Telèfon', { exact: true })).toHaveValue('611 111 111')
  // L'app avisa que el rellotge va desfasat (comparant amb l'hora de Google), a la pantalla Avui
  for (const x of [pc1, pc2]) await menu(x.page, 'Avui').click()
  await expect(pc2.page.getByRole('note')).toHaveText(/El rellotge d'aquest dispositiu va 10 minuts endarrerit/)
  await expect(pc1.page.getByRole('note')).toHaveCount(0)
  // Després (de veritat), el PC 2 el corregeix
  await editarCamp(pc2.page, /Aina/, 'Telèfon', '622 222 222')
  await sincronitzar(mon, pc2)
  await sincronitzar(mon, pc1)
  await sincronitzar(mon, pc2)
  for (const x of [pc1, pc2]) {
    await obrirPacient(x.page, /Aina/)
    await expect(x.page.getByLabel('Telèfon', { exact: true })).toHaveValue('622 222 222')
    await expect(x.page.getByText('Aquestes dades s\'han editat en dos dispositius alhora')).toHaveCount(0)
  }
})

test('h) dos dispositius que pugen alhora no es trepitgen: cadascú escriu el seu diari', async ({
  browser,
}, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  const pc2 = await dispositiu(browser, info, mon, 'pc2', 'pc')
  await recuperar(pc2)
  pc1.d.senseXarxa = pc2.d.senseXarxa = true
  await novaCita(pc1.page, 'Aina', '2026-11-04', '17:00')
  await novaCita(pc2.page, 'Aina', '2026-11-05', '10:00')
  pc1.d.senseXarxa = pc2.d.senseXarxa = false
  // Tots dos baixen la mateixa versió i pugen alhora
  mon.retenirPatch = 2
  await Promise.all([sincronitzar(mon, pc1), sincronitzar(mon, pc2)])
  // Es mira Drive tot seguit, abans que cap dels dos torni a sincronitzar
  pc1.d.senseXarxa = pc2.d.senseXarxa = true
  // Cada dispositiu només ha escrit el seu diari
  const escrits = (nom: string) => new Set(peticionsDe(mon, nom).filter((p) => p.metode === 'PATCH').map((p) => p.ruta))
  for (const r of escrits('pc1')) expect(escrits('pc2').has(r)).toBe(false)

  // Un tercer dispositiu, tot just després, les té totes dues
  const tauleta = await dispositiu(browser, info, mon, 'tauleta', 'tauleta')
  await recuperar(tauleta)
  pc1.d.senseXarxa = pc2.d.senseXarxa = false
  expect(await citesDeLaSetmana(tauleta.page)).toEqual([
    '10:00–11:00 Aina Provencal Inventada',
    '17:00–18:00 Aina Provencal Inventada',
  ])
})

test('h2) Drive respon 429 i 503: es torna a provar sol, cada cop esperant més, fins que va bé', async ({ browser }, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  mon.errors.push({ estat: 429, dispositiu: 'pc1' }, { estat: 503, dispositiu: 'pc1' }, { estat: 503, metode: 'PATCH', dispositiu: 'pc1' })
  const n = pujades(mon, pc1)
  await novaCita(pc1.page, 'Aina', '2026-11-04', '17:00')
  await expect(pindola(pc1.page)).toHaveText('Drive: error', { timeout: 20_000 })
  await pindola(pc1.page).click()
  await expect(pc1.page.getByRole('dialog', { name: 'Còpia a Google Drive' })).toContainText('DRV-429')
  await pc1.page.keyboard.press('Escape')
  // Sense tocar res: 5 s, 15 s i 45 s després
  for (const espera of [5_000, 15_000, 45_000]) {
    const abans = peticionsDe(mon, 'pc1').length
    await pc1.page.clock.runFor(espera)
    await expect.poll(() => peticionsDe(mon, 'pc1').length).toBeGreaterThan(abans)
  }
  await expect.poll(() => pujades(mon, pc1)).toBeGreaterThan(n)
  await expect(pindola(pc1.page)).toHaveText('Drive: al dia')
  expect(mon.errors).toEqual([])
})

test('b4) en tornar a la pestanya es miren de seguida els canvis dels altres (sense esperar els 5 minuts)', async ({ browser }, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  const pc2 = await dispositiu(browser, info, mon, 'pc2', 'pc')
  await recuperar(pc2)
  await obrirSetmana(pc2.page)
  await novaCita(pc1.page, 'Aina', '2026-11-04', '17:00')
  await sincronitzar(mon, pc1)
  await pc2.page.clock.runFor(20_000)
  await pc2.page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => citesVisibles(pc2.page)).toEqual(['17:00–18:00 Aina Provencal Inventada'])
})

test('j) es tanca el navegador mentre puja: Drive queda sencer amb la versió d\'abans i, en tornar a obrir, es puja', async ({
  browser,
  playwright,
}, info) => {
  const mon = nouMonAlDia()
  const dir = mkdtempSync(join(tmpdir(), 'qi-perfil-'))
  try {
    const obrirPerfil = async () => {
      const context = await playwright.chromium.launchPersistentContext(dir, {
        ...PERFILS.pc,
        baseURL: info.project.use.baseURL,
        locale: 'ca-ES',
      })
      const d = nouDispositiu('pc1', CORREU_DOCTORA)
      await simularDispositiu(context, mon, d)
      const page = context.pages()[0] ?? (await context.newPage())
      await page.clock.install({ time: horaComuna() })
      return { mon, d, context, page }
    }
    let pc1: Disp = await obrirPerfil()
    await crear(pc1)
    await nouPacient(pc1.page, 'Aina', 'Provencal Inventada')
    await sincronitzar(mon, pc1)
    const versio = principalDe(mon, CORREU_DOCTORA)!.version

    // La pujada queda penjada i es tanca el navegador
    mon.retenirPatch = Number.POSITIVE_INFINITY
    await novaCita(pc1.page, 'Aina', '2026-11-04', '17:00')
    await expect.poll(() => peticionsDe(mon, 'pc1').filter((p) => p.metode === 'GET').length, { timeout: 20_000 }).toBeGreaterThan(3)
    await pc1.page.waitForTimeout(1_000)
    await pc1.context.close()
    mon.retenirPatch = 0
    const principal = principalDe(mon, CORREU_DOCTORA)!
    expect(principal.version).toBe(versio)
    expect(JSON.parse(principal.contingut)).toMatchObject({ format: 'qi-sinc', tipus: 'diari' })

    // Es torna a obrir: la cita és al dispositiu i es puja amb el primer toc
    pc1 = await obrirPerfil()
    await pc1.page.goto('/qi-consulta/')
    await pc1.page.getByLabel('Contrasenya', { exact: true }).fill(P)
    await pc1.page.getByRole('button', { name: 'Desbloquejar' }).click()
    await menu(pc1.page, 'Agenda').click()
    await expect.poll(() => principalDe(mon, CORREU_DOCTORA)!.version, { timeout: 20_000 }).toBeGreaterThan(versio)
    await pc1.context.close()
    const pc2 = await dispositiu(browser, info, mon, 'pc2', 'pc')
    await recuperar(pc2)
    expect(await citesDeLaSetmana(pc2.page)).toEqual(['17:00–18:00 Aina Provencal Inventada'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('k) s\'esborren les dades del navegador: es recupera de Drive tot el que la píndola ja deia «al dia» (uns 3 segons després de desar)', async ({
  browser,
}, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  await novaCita(pc1.page, 'Aina', '2026-11-04', '17:00')
  await sincronitzar(mon, pc1)
  // Una cita nova: la píndola diu que encara no és a Drive…
  const n = pujades(mon, pc1)
  await novaCita(pc1.page, 'Aina', '2026-11-05', '10:00')
  await expect(pindola(pc1.page)).toHaveText(/pendents? de pujar|desant/)
  // …i en uns 3 segons (sense tocar res) ja hi és
  await esperarPujada(mon, pc1, n)
  // S'esborren les dades del lloc (com «Esborrar dades de navegació»)
  const cdp = await pc1.context.newCDPSession(pc1.page)
  await cdp.send('Storage.clearDataForOrigin', { origin: new URL(info.project.use.baseURL!).origin, storageTypes: 'all' })
  await recuperar(pc1)
  expect(await citesDeLaSetmana(pc1.page)).toEqual([
    '10:00–10:40 Aina Provencal Inventada',
    '17:00–18:00 Aina Provencal Inventada',
  ])
})

test('k2) en amagar la pestanya, el que hi ha pendent es puja de seguida (sense esperar)', async ({ browser }, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  // Els temporitzadors de la pàgina, aturats: només pot pujar per haver amagat la pestanya
  const ara = await pc1.page.evaluate(() => Date.now())
  await pc1.page.clock.pauseAt(new Date(ara + 1_000))
  const n = pujades(mon, pc1)
  await nouPacient(pc1.page, 'Bernat', 'Prova Inventat')
  await pc1.page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => pujades(mon, pc1), { timeout: 10_000 }).toBeGreaterThan(n)
  await pc1.page.clock.resume()
})

/** Els noms de les bases de dades d'aquest navegador */
const basesDeDades = (page: Page) => page.evaluate(async () => (await indexedDB.databases()).map((b) => b.name ?? '').sort())

test('l) el permís d\'un altre compte de Google no es fa servir: res no va al seu Drive i les dades no es toquen', async ({
  browser,
}, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)

  // El compte de la doctora ja no és actiu en aquest navegador (n'ha sortit);
  // hi ha el compte de proves (també permès). L'app demana tornar a entrar.
  for (const t of mon.tokens.keys()) mon.revocats.add(t)
  pc1.d.silenciosaFalla = true
  pc1.d.correu = CORREU_PROVES
  await canviarDeCompte(pc1)
  const panell = pc1.page.getByRole('dialog', { name: 'Còpia a Google Drive' })
  if (!(await panell.isVisible())) await pindola(pc1.page).click()
  await expect(panell.getByRole('alert')).toContainText('Has entrat amb un altre compte de Google')
  await expect(pindola(pc1.page)).toHaveText('Cal tornar a connectar amb Google')
  // Res no ha arribat al Drive del compte de proves, i el compte desat continua sent el de la doctora
  expect(driveDe(mon, CORREU_PROVES).size).toBe(0)
  expect(peticionsDe(mon, 'pc1').filter((p) => p.correu === CORREU_PROVES)).toEqual([])
  const sub = await pc1.page.evaluate(async () => {
    const nom = (await indexedDB.databases()).find((d) => /^qi-/.test(d.name ?? ''))!.name!
    return new Promise<string>((ok) => {
      const r = indexedDB.open(nom)
      r.onsuccess = () => {
        const g = r.result.transaction('meta').objectStore('meta').get('google')
        g.onsuccess = () => ok((g.result as { valor: { sub: string } }).valor.sub)
      }
    })
  })
  expect(sub).toBe('sub-doctora')

  // Tornant a entrar amb el compte de la doctora, tot continua
  pc1.d.correu = CORREU_DOCTORA
  await pc1.page.getByRole('button', { name: 'Tornar a entrar amb Google' }).click()
  await expect(pindola(pc1.page)).toHaveText('Drive: al dia')
  expect(driveDe(mon, CORREU_PROVES).size).toBe(0)
})

test('l2) si l\'altre compte té dades seves, no s\'ofereix mai fusionar-les: «Canviar a aquell compte» obre el seu espai', async ({
  browser,
}, info) => {
  const mon = nouMonAlDia()
  // Un altre navegador, amb el compte de proves i dades pròpies
  const altre = await dispositiu(browser, info, mon, 'altre', 'pc', { correu: CORREU_PROVES })
  await crear(altre)
  await nouPacient(altre.page, 'Bernat', 'Prova Inventat')
  await sincronitzar(mon, altre)
  const driveProves = JSON.stringify([...driveDe(mon, CORREU_PROVES).values()])

  const pc1 = await primerDispositiu(browser, info, mon)
  for (const t of mon.tokens.keys()) if (mon.tokens.get(t) === CORREU_DOCTORA) mon.revocats.add(t)
  pc1.d.silenciosaFalla = true
  pc1.d.correu = CORREU_PROVES
  await canviarDeCompte(pc1)
  const panell = pc1.page.getByRole('dialog', { name: 'Còpia a Google Drive' })
  if (!(await panell.isVisible())) await pindola(pc1.page).click()
  await expect(panell).not.toContainText('DRV-K')
  await expect(panell.getByRole('button', { name: 'Veure les opcions' })).toHaveCount(0)
  expect(JSON.stringify([...driveDe(mon, CORREU_PROVES).values()])).toBe(driveProves)

  // Canviar a aquell compte: la seva pròpia contrasenya i només les seves dades
  await panell.getByRole('button', { name: 'Canviar a aquell compte' }).click()
  await expect(pc1.page.getByRole('heading', { name: 'Recuperar les dades' })).toBeVisible()
  await pc1.page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await pc1.page.getByRole('button', { name: 'Obrir' }).click()
  await expect(pc1.page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
  await menu(pc1.page, 'Pacients').click()
  await expect(pc1.page.getByRole('link', { name: /Bernat Prova Inventat/ })).toBeVisible()
  await expect(pc1.page.getByRole('link', { name: /Aina Provencal Inventada/ })).toHaveCount(0)
  // Cada compte, la seva base de dades
  expect((await basesDeDades(pc1.page)).filter((n) => /^qi-[0-9a-f]{16}$/.test(n))).toHaveLength(2)
})

test('l3) dos comptes al mateix navegador, entrant i sortint l\'un rere l\'altre: cadascun amb la seva contrasenya i sense veure mai les dades de l\'altre', async ({
  browser,
}, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  await pc1.page.getByRole('button', { name: 'Bloquejar' }).click()

  // Una altra persona, amb el seu compte, al mateix navegador
  pc1.d.correu = CORREU_PROVES
  await pc1.page.getByRole('button', { name: 'Entrar amb un altre compte de Google' }).click()
  const PROVES = 'contrasenya-inventada-proves'
  await expect(pc1.page.getByLabel('Repeteix la contrasenya')).toBeVisible()
  await pc1.page.getByLabel('Contrasenya', { exact: true }).fill(PROVES)
  await pc1.page.getByLabel('Repeteix la contrasenya').fill(PROVES)
  await pc1.page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(pc1.page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
  await menu(pc1.page, 'Pacients').click()
  await expect(pc1.page.getByText('Encara no hi ha cap pacient.')).toBeVisible()
  await nouPacient(pc1.page, 'Bernat', 'Prova Inventat')
  await sincronitzar(mon, pc1)
  await pc1.page.getByRole('button', { name: 'Bloquejar' }).click()

  // En tornar a obrir, surt l'últim compte: amb la contrasenya de la doctora no s'obre
  await pc1.page.reload()
  await pc1.page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await pc1.page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(pc1.page.getByText('La contrasenya no és correcta.')).toBeVisible()

  // La doctora torna al seu compte
  pc1.d.correu = CORREU_DOCTORA
  await pc1.page.getByRole('button', { name: 'Entrar amb un altre compte de Google' }).click()
  await expect(pc1.page.getByText('La contrasenya no és correcta.')).toHaveCount(0)
  await pc1.page.getByLabel('Contrasenya', { exact: true }).fill(PROVES)
  await pc1.page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(pc1.page.getByText('La contrasenya no és correcta.')).toBeVisible()
  await pc1.page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await pc1.page.getByRole('button', { name: 'Desbloquejar' }).click()
  await menu(pc1.page, 'Pacients').click()
  await expect(pc1.page.getByRole('link', { name: /Aina Provencal Inventada/ })).toBeVisible()
  await expect(pc1.page.getByRole('link', { name: /Bernat Prova Inventat/ })).toHaveCount(0)
  await sincronitzar(mon, pc1)

  // Cada Drive té només les dades del seu compte (cap còpia d'un compte a l'altre)
  const clauDe = (correu: string) => (JSON.parse(principalDe(mon, correu)!.contingut) as { clauId: string }).clauId
  expect(clauDe(CORREU_DOCTORA)).not.toBe(clauDe(CORREU_PROVES))
  expect(peticionsDe(mon, 'pc1').every((p) => p.correu === CORREU_DOCTORA || p.correu === CORREU_PROVES)).toBe(true)
  // Dues bases de dades, una per compte (cap amb el correu ni el nom «qi» d'abans)
  const bases = await basesDeDades(pc1.page)
  expect(bases.filter((n) => /^qi-[0-9a-f]{16}$/.test(n))).toHaveLength(2)
  expect(bases).not.toContain('qi')
  expect(bases.join(' ')).not.toMatch(/doctora|proves|@/)
})

test('m) finestra privada: avís fix; si es tanca amb canvis pendents, el navegador avisa; i en tancar-la no queda res', async ({
  browser,
}, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  await pc1.context.close()

  // La doctora, en una finestra privada (quota d'emmagatzematge petita, com en incògnit)
  const incognit = await dispositiu(browser, info, mon, 'incognit', 'pc')
  await incognit.context.addInitScript(() => {
    navigator.storage.estimate = async () => ({ quota: 100 * 1024 ** 2, usage: 0 })
  })
  await recuperar(incognit)
  await expect(incognit.page.getByRole('status').filter({ hasText: 'Finestra privada' })).toHaveText(
    'Finestra privada: espera que la píndola digui «al dia» abans de tancar.',
  )
  // Desa una cita i intenta tancar de seguida: el navegador demana confirmació
  incognit.page.removeAllListeners('dialog')
  const avis = new Promise<string>((ok) =>
    incognit.page.once('dialog', (d) => {
      ok(d.type())
      void d.dismiss()
    }),
  )
  await novaCita(incognit.page, 'Aina', '2026-11-04', '17:00')
  await incognit.page.close({ runBeforeUnload: true })
  expect(await avis).toBe('beforeunload')
  // S'hi queda; quan la píndola diu «al dia», es pot tancar sense perdre res
  await expect(pindola(incognit.page)).toHaveText('Drive: al dia')
  await incognit.context.close()

  // Una altra finestra privada: no hi ha res (cap dada, cap contrasenya)…
  const altra = await dispositiu(browser, info, mon, 'incognit2', 'pc')
  await altra.page.goto('/qi-consulta/')
  await expect(altra.page.getByRole('button', { name: 'Continuar amb Google' })).toBeVisible()
  // (només la frase d'entrada que aquesta mateixa finestra acaba d'escriure,
  // i la clau de les proves que hi posa la fixture: prepararProves)
  expect(await altra.page.evaluate(() => Object.keys(localStorage).filter((k) => !k.startsWith('qi:proves:')))).toEqual(['qi.fraseAnterior'])
  expect((await basesDeDades(altra.page)).filter((b) => b.startsWith('qi'))).toEqual([])
  // …i la cita és a Drive
  await altra.page.getByRole('button', { name: 'Continuar amb Google' }).click()
  await altra.page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await altra.page.getByRole('button', { name: 'Obrir' }).click()
  expect(await citesDeLaSetmana(altra.page)).toEqual(['17:00–18:00 Aina Provencal Inventada'])
})

test('m2) en tancar la pestanya just després de desar, el diari es puja de seguida amb keepalive', async ({ browser }, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  await pc1.context.close()
  const incognit = await dispositiu(browser, info, mon, 'incognit', 'pc')
  await recuperar(incognit)
  // Ja té el seu diari a Drive (la primera sincronia el crea)
  await expect.poll(() => peticionsDe(mon, 'incognit').some((p) => p.metode === 'POST')).toBe(true)
  await novaCita(incognit.page, 'Aina', '2026-11-04', '17:00')
  // L'app prepara el diari uns 300 ms després de desar; després s'aturen els
  // temporitzadors de la pàgina: la pujada normal (3 s) no pot arribar a temps
  await incognit.page.waitForTimeout(800)
  const ara = await incognit.page.evaluate(() => Date.now())
  await incognit.page.clock.pauseAt(new Date(ara + 1_000))
  const abans = peticionsDe(mon, 'incognit').length
  // La pàgina es tanca (Playwright no deixa sortir les peticions d'una pàgina
  // que es tanca, i per això es llança l'esdeveniment del navegador, pagehide)
  await incognit.page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')))
  // La primera petició és la pujada del diari (keepalive), abans de cap altra
  await expect.poll(() => peticionsDe(mon, 'incognit').slice(abans)[0]?.metode).toBe('PATCH')
  await incognit.context.close()
  const altra = await dispositiu(browser, info, mon, 'altra', 'pc')
  await recuperar(altra)
  expect(await citesDeLaSetmana(altra.page)).toEqual(['17:00–18:00 Aina Provencal Inventada'])
})

test('n) el que es desa mentre una sincronia aplica canvis de Drive no es perd i es puja', async ({
  browser,
}, info) => {
  const mon = nouMonAlDia()
  const pc1 = await primerDispositiu(browser, info, mon)
  const pc2 = await dispositiu(browser, info, mon, 'pc2', 'pc')
  await recuperar(pc2)
  // El PC 1 puja una cita nova: al PC 2 li arribaran canvis
  await novaCita(pc1.page, 'Aina', '2026-11-04', '17:00')
  await sincronitzar(mon, pc1)

  // Drive va lent (1,5 s per petició). El PC 2 comença a sincronitzar i,
  // mentrestant, la doctora hi dona d'alta un pacient
  mon.latenciaMs = 1_500
  const n = peticionsDe(mon, 'pc2').length
  await pindola(pc2.page).click()
  await pc2.page.getByRole('button', { name: 'Desar ara a Drive' }).click()
  await pc2.page.keyboard.press('Escape')
  // Ja ha llistat Drive i llegit les dades locals; ara baixa la còpia (1,5 s)
  await expect.poll(() => peticionsDe(mon, 'pc2').length).toBeGreaterThan(n)
  await nouPacient(pc2.page, 'Bernat', 'Prova Inventat')
  await expect(pindola(pc2.page)).toHaveText('Drive: al dia', { timeout: 30_000 })
  mon.latenciaMs = 150
  await menu(pc2.page, 'Avui').click()
  await menu(pc2.page, 'Pacients').click()
  await expect(pc2.page.getByRole('link', { name: /Aina Provencal Inventada/ })).toBeVisible()
  await expect(pc2.page.getByRole('link', { name: /Bernat Prova Inventat/ })).toBeVisible()
  // I arriba a Drive (sol, uns segons després) i al PC 1
  await expect(pindola(pc2.page)).toHaveText('Drive: al dia', { timeout: 30_000 })
  await sincronitzar(mon, pc2)
  await sincronitzar(mon, pc1)
  await menu(pc1.page, 'Avui').click()
  await menu(pc1.page, 'Pacients').click()
  await expect(pc1.page.getByRole('link', { name: /Bernat Prova Inventat/ })).toBeVisible()
})
