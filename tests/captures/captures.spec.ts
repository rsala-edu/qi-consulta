// Captures de pantalla per revisar el disseny (no són proves: no s'executen
// amb les altres). Les desa a docs/captures/<carpeta>/ amb dades inventades.
//
//   CAPTURES=3a npx playwright test -c playwright.captures.config.ts
//
// CAPTURES_SUFIX (p. ex. «abans») s'afegeix al nom dels fitxers.
import { mkdirSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { continuarAmbGoogle, expect, test } from '../e2e/google.js'

const CARPETA = `docs/captures/${process.env.CAPTURES ?? 'proves'}`
const SUFIX = process.env.CAPTURES_SUFIX ? `-${process.env.CAPTURES_SUFIX}` : ''
const P = 'contrasenya-inventada-captures'
// Dates relatives a avui (el Google simulat fa servir l'hora real: amb un
// rellotge fix sortiria l'avís de rellotge desfasat)
const dia = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
test.describe.configure({ timeout: 180_000 })

const menu = (page: Page, nom: string) => page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom })

/** `sencera`: tota la pàgina; si no, la pantalla tal com es veu, des de dalt (amb la capçalera fixa) */
async function capturar(page: Page, nom: string, sencera = true) {
  mkdirSync(CARPETA, { recursive: true })
  if (!sencera) await page.evaluate(() => window.scrollTo(0, 0))
  for (const esquema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: esquema })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${CARPETA}/${nom}${SUFIX}-${esquema === 'light' ? 'clar' : 'fosc'}.png`, fullPage: sencera })
  }
  await page.emulateMedia({ colorScheme: 'light' })
}

async function entrar(page: Page) {
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByLabel('Repeteix la contrasenya').fill(P)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

async function pacient(page: Page, nom: string, llinatges: string, altres: Record<string, string> = {}) {
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill(nom)
  await page.getByLabel('Llinatges').fill(llinatges)
  for (const [camp, valor] of Object.entries(altres)) {
    if (camp === 'Sexe') await page.getByLabel(camp).selectOption({ label: valor })
    else await page.getByLabel(camp).fill(valor)
  }
  await page.getByRole('button', { name: 'Desar' }).first().click()
  await expect(page.getByRole('heading', { name: `${nom} ${llinatges}` })).toBeVisible()
}

async function cita(page: Page, qui: string, dia: string, hora: string, motiu: string) {
  await menu(page, 'Agenda').click()
  await page.getByRole('main').getByRole('button', { name: 'Nova cita', exact: true }).first().click()
  const d = page.getByRole('dialog', { name: 'Nova cita' })
  await d.getByLabel('Data').fill(dia)
  await d.getByLabel('Hora').fill(hora)
  await d.getByRole('searchbox', { name: 'Cerca el pacient' }).fill(qui)
  await d.getByRole('button', { name: new RegExp(qui) }).first().click()
  await d.getByLabel('Motiu').fill(motiu)
  await d.getByRole('button', { name: /^(Desar|Registrar)/ }).click()
  await expect(d).toBeHidden()
}

test('Avui', async ({ page }) => {
  await entrar(page)
  await pacient(page, 'Aina', 'Provencal Inventada')
  await pacient(page, 'Bernat', 'Prova Inventat')
  await pacient(page, 'Carla', 'Exemple Inventada')
  // Cites anteriors (Bernat i Carla ja en tenen: avui són seguiments)
  await cita(page, 'Bernat', dia(-7), '11:00', 'Lumbàlgia')
  await cita(page, 'Carla', dia(-14), '12:00', 'Acúfens')
  await cita(page, 'Aina', dia(0), '21:00', 'Insomni i ansietat')
  await cita(page, 'Bernat', dia(0), '22:15', 'Lumbàlgia')
  await cita(page, 'Carla', dia(0), '23:00', 'Acúfens')
  await menu(page, 'Avui').click()
  await expect(page.getByRole('heading', { name: 'Cites d\'avui' })).toBeVisible()
  await capturar(page, 'avui')
})

test('Visita', async ({ page }) => {
  test.setTimeout(240_000)
  // Rellotge controlat (comença a l'hora real: el Google simulat també la fa servir)
  await page.clock.install({ time: new Date() })
  await entrar(page)
  await pacient(page, 'Aina', 'Provencal Inventada')
  const ara = new Date()
  const hora = `${String(ara.getHours()).padStart(2, '0')}:${String(Math.floor(ara.getMinutes() / 5) * 5).padStart(2, '0')}`
  await cita(page, 'Aina', dia(0), hora, 'Lumbàlgia')
  await menu(page, 'Avui').click()
  await page.getByRole('button', { name: /^(Començar visita|Continuar la visita)$/ }).click()
  const capcalera = page.locator('.capcalera-visita')
  await expect(capcalera).toBeVisible()
  const pestanya = (nom: string) => page.getByRole('tablist', { name: 'Visita' }).getByRole('tab', { name: nom })

  await pestanya('Com està').click()
  await page.getByLabel('Canvis des de l\'última sessió').fill('Dorm millor, però el dolor lumbar continua al matí (inventat).')
  await page.getByRole('radiogroup', { name: 'Símptoma principal (0–10)' }).getByRole('radio', { name: '6' }).click()
  await page.getByLabel('Símptoma secundari 1 · Quin').fill('Insomni')
  await page.getByRole('radiogroup', { name: 'Símptoma secundari 1 · Escala (0–10)' }).getByRole('radio', { name: '4' }).click()
  await capturar(page, 'visita-com-esta', false)
  await pestanya('Exploració').click()
  await page.getByLabel('Llengua').fill('Pàl·lida, saburra blanca fina (inventat)')
  await page.getByLabel('Pols').fill('Profund i feble (inventat)')
  await capturar(page, 'visita-exploracio', false)
  await pestanya('Tractament').click()
  for (const [q, codi, costat] of [['LI4', 'LI4', 'Bilateral'], ['zusanli', 'ST36', 'Bilateral'], ['sanyinjiao', 'SP6', 'Esquerre']] as const) {
    await page.getByRole('searchbox', { name: /Cerca un punt/ }).fill(q)
    await page.getByRole('searchbox', { name: /Cerca un punt/ }).press('Enter')
    const fitxa = page.getByRole('region', { name: codi })
    await fitxa.getByRole('radio', { name: costat }).click()
    await fitxa.getByRole('radio', { name: 'Agulla' }).click()
    await fitxa.getByRole('button', { name: 'Marcar' }).click()
  }
  await page.waitForTimeout(1_500)
  await capturar(page, 'visita-tractament', false)
  await pestanya('Tancar').click()
  await page.getByLabel('Recomanacions').fill('Caminar 20 minuts cada dia i evitar estar molta estona assegut (inventat).')
  await page.getByLabel('Cap incidència').check()
  await capturar(page, 'visita-tancar', false)

  // Temporitzador en marxa (a la capçalera) i a la pantalla de bloqueig
  await capcalera.getByRole('button', { name: 'Agulles posades: començar' }).click()
  await page.clock.fastForward('03:20')
  await capturar(page, 'temporitzador-en-marxa', false)
  await page.getByRole('button', { name: 'Bloquejar' }).click()
  await expect(page.locator('.retencio-bloqueig')).toBeVisible()
  await capturar(page, 'bloqueig-retencio')
  await page.clock.fastForward('25:00')
  await expect(page.locator('.retencio-bloqueig')).toHaveText('Retenció acabada')
  await capturar(page, 'bloqueig-retencio-acabada')
  await page.getByLabel('Contrasenya', { exact: true }).fill(P)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(capcalera).toHaveClass(/retencio-acabada/)
  await capturar(page, 'temporitzador-acabat', false)

  // Control d'agulles: no quadra, cal el motiu
  await capcalera.getByRole('button', { name: 'Finalitzar visita' }).click()
  const panell = page.getByRole('region', { name: 'Finalitzar visita' })
  await panell.getByLabel('Agulles retirades').fill('9')
  await expect(panell.getByRole('alert')).toBeVisible()
  await capturar(page, 'control-agulles', false)
  await panell.getByLabel(/Motiu/).fill('Agulla semipermanent a l\'orella (inventat)')
  await panell.getByRole('button', { name: 'Confirmar i finalitzar' }).click()
  await expect(page.getByText(/Visita finalitzada/)).toBeVisible()

  // Tractaments a la fitxa
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Aina Provencal Inventada/ }).click()
  await page.getByRole('link', { name: 'Tractaments' }).click()
  await expect(page.getByRole('article', { name: 'Lumbàlgia' })).toBeVisible()
  await capturar(page, 'tractaments')
})

test('Ajuntar fitxes', async ({ page }) => {
  await entrar(page)
  await pacient(page, 'Carla', 'Exemple Inventada', { Telèfon: '600 111 222' })
  await pacient(page, 'Karla', 'Exemple Inventada', { Telèfon: '600 999 888', Professió: 'Mestra' })
  await cita(page, 'Carla Exemple', dia(1), '10:00', 'Lumbàlgia')
  await cita(page, 'Karla Exemple', dia(1), '10:00', 'Lumbàlgia')
  await cita(page, 'Karla Exemple', dia(8), '10:00', 'Lumbàlgia')
  await menu(page, 'Pacients').click()
  await page.getByRole('list', { name: 'Pacients' }).getByRole('link', { name: /Carla/ }).click()
  await page.getByRole('link', { name: 'Ajuntar amb una altra fitxa…' }).click()
  await capturar(page, 'ajuntar-triar')
  await page.getByRole('list', { name: 'Ajuntar fitxes' }).getByRole('link', { name: /Karla/ }).click()
  await expect(page.getByRole('button', { name: 'Confirmar: ajuntar les fitxes' })).toBeVisible()
  await capturar(page, 'ajuntar-comparacio')
  await page.getByRole('group', { name: 'Nom' }).getByRole('radio', { name: /Carla/ }).check()
  await page.getByRole('button', { name: 'Confirmar: ajuntar les fitxes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Fitxes ajuntades' })).toBeVisible()
  await capturar(page, 'ajuntar-fet', false)
  await menu(page, 'Pacients').click()
  await page.getByLabel('Mostrar arxivats').check()
  await page.getByRole('list', { name: 'Pacients' }).getByRole('link', { name: /Karla/ }).click()
  await expect(page.getByRole('button', { name: /^Desfer/ })).toBeVisible()
  await capturar(page, 'ajuntada-desfer', false)
})

test('Mapa 2D', async ({ page }) => {
  await entrar(page)
  await menu(page, 'Mapa').click()
  await expect(page.getByTestId('visor3d')).toHaveAttribute('data-llest', 'si')
  // El cos 3D recuperant-se després de perdre el context WebGL
  await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('.visor3d canvas')!
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl'))!
    const ext = gl.getExtension('WEBGL_lose_context')!
    ;(window as unknown as { ext: WEBGL_lose_context }).ext = ext
    ext.loseContext()
  })
  await expect(page.getByText('Recuperant el cos 3D…')).toBeVisible()
  await capturar(page, 'recuperant-3d', false)
  await page.evaluate(() => (window as unknown as { ext: WEBGL_lose_context }).ext.restoreContext())

  await page.getByRole('radiogroup', { name: 'Tipus de mapa' }).getByRole('radio', { name: '2D' }).click()
  await expect(page.getByTestId('visor2d')).toBeVisible()
  await capturar(page, 'mapa-2d-davant', false)
  await page.getByRole('button', { name: 'Esquerra' }).click()
  await capturar(page, 'mapa-2d-esquerra', false)
  await page.getByRole('button', { name: 'Darrere' }).click()
  await capturar(page, 'mapa-2d-darrere', false)
  for (const [consulta, codi] of [['LI4', 'LI4'], ['zusanli', 'ST36']] as const) {
    await page.getByRole('searchbox', { name: /Cerca un punt/ }).fill(consulta)
    await page.getByRole('searchbox', { name: /Cerca un punt/ }).press('Enter')
    const fitxa = page.getByRole('region', { name: codi })
    await fitxa.getByRole('radio', { name: 'Bilateral' }).click()
    await fitxa.getByRole('button', { name: 'Marcar' }).click()
  }
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).fill('zusanli')
  await page.getByRole('searchbox', { name: /Cerca un punt/ }).press('Enter')
  await capturar(page, 'mapa-2d-ampliat', false)
  await page.getByLabel('Meridià').selectOption('ST')
  await page.getByRole('button', { name: 'Tot el cos' }).click()
  await capturar(page, 'mapa-2d-meridia', false)
})

// --- Etapa 3B -------------------------------------------------------------

async function obrir(page: Page, nom: string | RegExp) {
  const boto = page.locator('.capcalera-seccio button').filter({ hasText: nom }).first()
  if ((await boto.getAttribute('aria-expanded')) !== 'true') await boto.click()
  return page.getByRole('region', { name: nom, exact: typeof nom === 'string' })
}
async function tocar(regio: ReturnType<Page['getByRole']>, camp: string, opcio: string | RegExp) {
  await regio.getByRole('group', { name: camp, exact: true }).getByRole('button', { name: opcio }).click()
}
/** Captura la secció (amb la capçalera fixa de la visita a dalt) */
async function capturarSeccio(page: Page, regio: ReturnType<Page['getByRole']>, nom: string) {
  await regio.evaluate((e) => e.parentElement?.scrollIntoView({ block: 'start' }))
  await page.evaluate(() => window.scrollBy(0, -170))
  mkdirSync(CARPETA, { recursive: true })
  for (const esquema of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: esquema })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${CARPETA}/${nom}${SUFIX}-${esquema === 'light' ? 'clar' : 'fosc'}.png` })
  }
  await page.emulateMedia({ colorScheme: 'light' })
}

test('3B Valoració', async ({ page }) => {
  test.setTimeout(240_000)
  await entrar(page)
  await pacient(page, 'Mia', 'Exemple Inventada', { Sexe: 'Dona' })
  const ara = new Date()
  const hora = `${String(ara.getHours()).padStart(2, '0')}:${String(Math.floor(ara.getMinutes() / 5) * 5).padStart(2, '0')}`
  await cita(page, 'Mia', dia(0), hora, 'Acúfens')
  await menu(page, 'Avui').click()
  await page.getByRole('button', { name: /^(Començar visita|Continuar la visita)$/ }).click()
  await expect(page.locator('.capcalera-visita')).toBeVisible()

  const motiu = await obrir(page, 'Motiu de consulta i malaltia actual')
  await motiu.getByLabel('Motiu de consulta', { exact: true }).fill('Acúfens a l\'orella esquerra des de fa tres mesos, pitjor amb l\'estrès (inventat)')
  await tocar(motiu, 'Inici', 'Progressiu')
  await tocar(motiu, 'Evolució', 'Subagut')
  await tocar(motiu, 'Tendència', 'Fluctuant')
  await tocar(motiu, 'Factors que milloren', 'Relaxació')
  await tocar(motiu, 'Factors que empitjoren', 'Estrès')
  await tocar(motiu, 'Factors que empitjoren', 'Soroll')
  await capturarSeccio(page, motiu, 'valoracio-motiu')
  const diag = await obrir(page, 'Diagnòstic occidental')
  await diag.getByLabel('Diagnòstic', { exact: true }).fill('Acúfens subjectius (inventat)')
  await diag.getByRole('searchbox', { name: 'Codi CIM-11 (opcional)' }).fill('tinnitus')
  await capturarSeccio(page, diag, 'valoracio-cim11-cerca')
  await diag.getByRole('button', { name: /MC41 Tinnitus/ }).click()

  const fred = await obrir(page, 'Fred i calor')
  await tocar(fred, 'Signes', /Calor als cinc cors/)
  await tocar(fred, 'Signes', /Febre de tarda/)
  const suor = await obrir(page, 'Sudoració')
  await tocar(suor, 'Sudoració', /Nocturna/)
  const son = await obrir(page, 'Son')
  await tocar(son, 'Alteracions', /^Despertars/)
  await tocar(son, 'Alteracions', /Somnis abundants/)
  await tocar(son, 'Hora dels despertars', '1–3 h (fetge)')
  await capturarSeccio(page, fred, 'valoracio-anamnesi')
  const orelles = await obrir(page, 'Orelles i ulls')
  await tocar(orelles, 'Acúfens', 'Agut i fort (com un xiulet)')
  await tocar(orelles, 'Acúfens', 'Continu')
  await tocar(orelles, 'Acúfens: costat', 'Esquerra')
  await tocar(orelles, 'Ulls', /Sequedat ocular/)
  await capturarSeccio(page, orelles, 'valoracio-orelles')
  const dolor = await obrir(page, 'Dolor')
  await dolor.getByRole('button', { name: 'Normal / sense alteracions' }).click()
  const gine = await obrir(page, 'Ginecologia')
  await tocar(gine, 'Embaràs', 'No')
  await tocar(gine, 'Cicle', /Regular/)
  await tocar(gine, 'Altres', /Síndrome premenstrual/)
  await capturarSeccio(page, gine, 'valoracio-ginecologia')
  const emo = await obrir(page, 'Emocions i estrès')
  await tocar(emo, 'Les set emocions', /Preocupació/)
  await tocar(emo, 'Estrès', 'Alt')
  await capturarSeccio(page, emo, 'valoracio-emocions')
  const cons = await obrir(page, 'Tipus de constitució')
  await tocar(cons, 'Principal', /Deficiència de yin/)
  await tocar(cons, 'Secundària', /Estancament de qi/)
  await capturarSeccio(page, cons, 'valoracio-constitucio')
  // Totes plegades: el resum de cada secció
  const obertes = page.locator('.capcalera-seccio button[aria-expanded="true"]')
  while ((await obertes.count()) > 0) await obertes.first().click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await capturar(page, 'valoracio-resum', false)
  // Embaràs: avís a la capçalera
  const gine2 = await obrir(page, 'Ginecologia')
  await tocar(gine2, 'Embaràs', 'Sí')
  await page.evaluate(() => window.scrollTo(0, 0))
  await capturar(page, 'valoracio-embaras', false)

  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /^Catàlegs/ }).click()
  await page.getByRole('checkbox', { name: 'Mostrar Dolor' }).uncheck()
  await page.getByRole('listitem').filter({ hasText: /^Son/ }).getByRole('button', { name: 'Camps i opcions' }).click()
  await capturar(page, 'ajustos-catalegs', false)
  await page.getByRole('region', { name: 'Fonts i llicències' }).scrollIntoViewIfNeeded()
  await capturar(page, 'ajustos-catalegs-fonts', false)
})
