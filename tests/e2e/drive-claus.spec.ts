// Dos dispositius amb el mateix compte de Google. Només dades inventades.
//
// - Prevenció: si a Drive ja hi ha dades, un dispositiu nou només les pot
//   recuperar; no pot començar de zero amb una contrasenya pròpia.
// - DRV-K: un dispositiu que ja té dades pròpies (d'abans d'aquesta
//   protecció) i una còpia de Drive d'una altra clau. «Fusionar»: els dos
//   dispositius acaben amb les mateixes dades i no es perd res.
// - Les altres causes: format més nou (DRV-V) i fitxer danyat (DRV-C).
// - Fitxer .qi: descarregar i importar.
import { readFileSync } from 'node:fs'
import { type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import { continuarAmbGoogle, expect as expectBase, nouGoogle, simularGoogle, test, type GoogleSimulat } from './google.js'

const PA = 'contrasenya-del-firefox'
const PB = 'contrasenya-del-chrome'
const expect = expectBase.configure({ timeout: 15_000 })
const ARA = new Date(2026, 10, 2, 8, 0)

const menu = (page: Page, nom: string) =>
  page.getByRole('navigation', { name: 'Navegació principal' }).getByRole('link', { name: nom })
const pindola = (page: Page) => page.locator('.indicador-copia')

/** Un altre navegador (perfil buit) amb el Google que es vulgui */
async function altreNavegador(browser: Browser, info: TestInfo, google: GoogleSimulat): Promise<{ context: BrowserContext; page: Page }> {
  const { viewport, baseURL, locale, isMobile, hasTouch, userAgent, deviceScaleFactor } = info.project.use
  const context = await browser.newContext({ viewport, baseURL, locale, isMobile, hasTouch, userAgent, deviceScaleFactor })
  await simularGoogle(context, google)
  const page = await context.newPage()
  await page.clock.install({ time: ARA })
  return { context, page }
}

async function crear(page: Page, contrasenya: string) {
  await page.goto('/qi-consulta/')
  await continuarAmbGoogle(page)
  await page.getByLabel('Contrasenya', { exact: true }).fill(contrasenya)
  await page.getByLabel('Repeteix la contrasenya').fill(contrasenya)
  await page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
}

async function nouPacient(page: Page, nom: string, llinatges: string, naixement: string) {
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: 'Nou pacient' }).click()
  await page.getByLabel('Nom', { exact: true }).fill(nom)
  await page.getByLabel('Llinatges').fill(llinatges)
  await page.getByLabel('Data de naixement').fill(naixement)
  await page.getByRole('button', { name: /Crear|Desar/ }).first().click()
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

/** Desa ara a Drive (des del panell de la píndola) i en torna el panell obert */
async function desarAra(page: Page) {
  const panell = page.getByRole('dialog', { name: 'Còpia a Google Drive' })
  if (!(await panell.isVisible())) await pindola(page).click()
  const boto = panell.getByRole('button', { name: /Desar ara a Drive|Tornar-ho a provar/ })
  if (await boto.isVisible()) await boto.click()
  return panell
}

async function alDia(page: Page) {
  await expect(pindola(page)).toHaveText('Drive: al dia')
}

/** Les cites de la setmana del 2 de novembre, en ordre */
async function citesDeLaSetmana(page: Page): Promise<string[]> {
  // Les pantalles obertes no es tornen a carregar soles en arribar canvis de Drive
  await menu(page, 'Avui').click()
  await menu(page, 'Agenda').click()
  await page.getByRole('radio', { name: 'Setmana' }).click()
  await expect(page.getByTestId('graella-agenda')).toBeVisible()
  const noms = await page.locator('.cita-agenda').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
  return noms.map((n) => n.replace(/ ·.*$/, '')).sort()
}

test('dos navegadors: quan el segon entra amb el mateix compte, només se li ofereix recuperar les dades', async ({
  page,
  google,
  browser,
}, info) => {
  await page.clock.install({ time: ARA })
  // El segon navegador arriba primer a Google, quan Drive encara és buit…
  const b = await altreNavegador(browser, info, google)
  await b.page.goto('/qi-consulta/')
  await continuarAmbGoogle(b.page)
  await expect(b.page.getByLabel('Repeteix la contrasenya')).toBeVisible()

  // …i mentrestant el primer crea les dades i les puja
  await crear(page, PA)
  await nouPacient(page, 'Aina', 'Provencal Inventada', '1980-05-17')
  await desarAra(page)
  await alDia(page)

  // En crear la contrasenya, el segon torna a mirar Drive: només pot recuperar
  await b.page.getByLabel('Contrasenya', { exact: true }).fill(PB)
  await b.page.getByLabel('Repeteix la contrasenya').fill(PB)
  await b.page.getByRole('button', { name: 'Crear i entrar' }).click()
  await expect(b.page.getByRole('heading', { name: 'Recuperar les dades' })).toBeVisible()
  await expect(b.page.getByLabel('Repeteix la contrasenya')).toHaveCount(0)
  await expect(b.page.getByRole('button', { name: 'Crear i entrar' })).toHaveCount(0)

  // Si torna a obrir l'app, també: primer Google, i després només recuperar
  await b.page.reload()
  await expect(b.page.getByRole('button', { name: 'Continuar amb Google' })).toBeVisible()
  await b.page.getByRole('button', { name: 'Continuar amb Google' }).click()
  await expect(b.page.getByRole('heading', { name: 'Recuperar les dades' })).toBeVisible()
  await b.page.getByLabel('Contrasenya', { exact: true }).fill(PA)
  await b.page.getByRole('button', { name: 'Obrir' }).click()
  await expect(b.page.getByRole('heading', { name: 'Avui', exact: true })).toBeVisible()
  await menu(b.page, 'Pacients').click()
  await expect(b.page.getByRole('link', { name: /Aina Provencal Inventada/ })).toBeVisible()
  await b.context.close()
})

test('clau diferent (DRV-K): fusionar les dades del Chrome amb les de Drive; els dos acaben iguals i no es perd res', async ({
  page,
  google,
  browser,
}, info) => {
  await page.clock.install({ time: ARA })
  // El Firefox: les seves dades, a Drive
  await crear(page, PA)
  await nouPacient(page, 'Aina', 'Provencal Inventada', '1980-05-17')
  await novaCita(page, 'Aina', '2026-11-04', '17:00')
  await desarAra(page)
  await alDia(page)

  // El Chrome va començar de zero, amb un altre Drive (com abans d'aquesta protecció)
  const googleB = nouGoogle()
  const b = await altreNavegador(browser, info, googleB)
  await crear(b.page, PB)
  await nouPacient(b.page, 'Bernat', 'Prova Inventat', '1975-01-02')
  await nouPacient(b.page, 'Aina', 'Provencal Inventada', '1980-05-17')
  await novaCita(b.page, 'Bernat', '2026-11-02', '09:15')
  await novaCita(b.page, 'Bernat', '2026-11-02', '20:00')
  await novaCita(b.page, 'Bernat', '2026-11-07', '13:15')
  await desarAra(b.page)
  await alDia(b.page)

  // Ara el Chrome veu el Drive del Firefox (el mateix compte de Google)
  googleB.fitxers = google.fitxers
  const abans = JSON.stringify([...google.fitxers.values()])
  let panell = await desarAra(b.page)
  await expect(pindola(b.page)).toHaveText('Drive: error')
  await expect(panell.getByRole('status').first()).toHaveText('Aquest dispositiu i Google Drive tenen dades diferents.')
  await expect(panell).toContainText('Codi: DRV-K')
  // Detalls tècnics: versions i empremtes curtes de les claus (diferents), sense cap dada
  const detalls = await panell.getByTestId('detalls-tecnics').textContent()
  expect(detalls).toMatch(/^Qi \S+ · format 2 \(base de dades v\d+\) · Drive: format 2, clau [0-9A-F]{4} · dispositiu: clau [0-9A-F]{4} · última còpia correcta: \S+$/)
  const [, clauDrive, clauDispositiu] = /Drive: format 2, clau (\w{4}) · dispositiu: clau (\w{4})/.exec(detalls!)!
  expect(clauDrive).not.toBe(clauDispositiu)
  expect(detalls).not.toMatch(/Aina|Bernat/)
  // No s'ha escrit res a Drive
  expect(JSON.stringify([...google.fitxers.values()])).toBe(abans)

  // Les opcions
  await panell.getByRole('button', { name: 'Veure les opcions' }).click()
  await expect(b.page.getByRole('heading', { name: 'Aquest dispositiu i Google Drive tenen dades diferents' })).toBeVisible()
  await expect(b.page.getByRole('region', { name: 'Recuperar les dades de Drive en aquest dispositiu' })).toBeVisible()
  const fusio = b.page.getByRole('region', { name: 'Fusionar les dades d\'aquest dispositiu amb les de Drive' })
  await fusio.getByRole('button', { name: 'Fusionar les dades d\'aquest dispositiu amb les de Drive' }).click()
  // La contrasenya del Chrome no obre la còpia de Drive: no es toca res
  await fusio.getByLabel('Contrasenya de la còpia de Drive').fill(PB)
  await fusio.getByRole('button', { name: 'Fusionar amb Drive' }).click()
  await expect(fusio.getByRole('alert')).toHaveText('La contrasenya no és correcta.')
  expect(JSON.stringify([...google.fitxers.values()])).toBe(abans)

  // Amb la de Drive: abans de res, es descarrega un .qi de les dades del Chrome
  await fusio.getByLabel('Contrasenya de la còpia de Drive').fill(PA)
  const [descarrega] = await Promise.all([
    b.page.waitForEvent('download'),
    fusio.getByRole('button', { name: 'Fusionar amb Drive' }).click(),
  ])
  expect(descarrega.suggestedFilename()).toMatch(/^qi-dispositiu-2026-11-02-\d{4}\.qi$/)
  const qi = readFileSync((await descarrega.path())!, 'utf8')
  expect(JSON.parse(qi)).toMatchObject({ format: 'qi-copia', versio: 1 })
  expect(qi).not.toContain('Bernat')
  await expect(b.page.getByText('Fet: les dades d\'aquest dispositiu ja són amb les de Drive.')).toBeVisible()
  await expect(b.page.getByText(/Hi ha 1 pacients que poden estar repetits/)).toBeVisible()
  await alDia(b.page)

  // El Chrome: les seves cites i la del Firefox, i les dues Aina per revisar (no ajuntades)
  const totes = [
    '09:15–10:15 Bernat Prova Inventat',
    '13:15–13:55 Bernat Prova Inventat',
    '17:00–18:00 Aina Provencal Inventada',
    '20:00–20:40 Bernat Prova Inventat',
  ]
  expect(await citesDeLaSetmana(b.page)).toEqual(totes)
  await menu(b.page, 'Pacients').click()
  await expect(b.page.getByRole('link', { name: /Aina Provencal Inventada/ })).toHaveCount(2)
  await expect(b.page.getByText('Per revisar: possible duplicat')).toHaveCount(2)

  // El Firefox rep el mateix
  await desarAra(page)
  await alDia(page)
  expect(await citesDeLaSetmana(page)).toEqual(totes)
  await menu(page, 'Pacients').click()
  await expect(page.getByRole('link', { name: /Bernat Prova Inventat/ })).toBeVisible()
  await expect(page.getByText('Per revisar: possible duplicat')).toHaveCount(2)

  // A la fitxa: l'avís i «No és la mateixa persona»
  await page.getByRole('link', { name: /Aina Provencal Inventada/ }).first().click()
  await expect(page.getByRole('note').filter({ hasText: 'pot ser la mateixa persona' })).toBeVisible()
  await page.getByRole('button', { name: 'No és la mateixa persona' }).click()
  await expect(page.getByRole('note').filter({ hasText: 'pot ser la mateixa persona' })).toHaveCount(0)

  // El Chrome ja s'obre amb la contrasenya de Drive
  await b.page.getByRole('button', { name: 'Bloquejar' }).click()
  await b.page.getByLabel('Contrasenya', { exact: true }).fill(PA)
  await b.page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(b.page.getByRole('navigation', { name: 'Navegació principal' })).toBeVisible()
  await expect(b.page.getByRole('link', { name: /Bernat Prova Inventat/ })).toBeVisible()
  await b.context.close()
})

test('més de 24 hores sense poder fer cap còpia: la píndola ho diu i Avui en mostra l\'avís', async ({ page, google }) => {
  await page.clock.install({ time: ARA })
  await crear(page, PA)
  await nouPacient(page, 'Aina', 'Provencal Inventada', '1980-05-17')
  await desarAra(page)
  await alDia(page)
  // Drive deixa de respondre bé
  google.fallaDrive = 500
  await desarAra(page)
  await expect(pindola(page)).toHaveText('Drive: error')
  await page.keyboard.press('Escape')

  await page.clock.fastForward('49:00:00')
  // En 49 hores, l'app s'ha bloquejat per inactivitat: es torna a obrir
  const contrasenya = page.getByLabel('Contrasenya', { exact: true })
  await expect(contrasenya).toBeVisible()
  await contrasenya.fill(PA)
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(pindola(page)).toHaveText('Fa 2 dies que no es fa cap còpia')
  await menu(page, 'Pacients').click()
  await menu(page, 'Avui').click()
  const avis = page.getByRole('alert').filter({ hasText: 'Fa 2 dies que no es fa cap còpia' })
  await expect(avis).toContainText('Les dades són desades en aquest dispositiu, però no a Google Drive.')

  // Quan torna a funcionar, l'avís desapareix
  google.fallaDrive = null
  await desarAra(page)
  await alDia(page)
  await expect(avis).toHaveCount(0)
})

test('format més nou a Drive (DRV-V): «Actualitzar l\'app»; no s\'hi escriu res', async ({ page, google }) => {
  await crear(page, PA)
  await nouPacient(page, 'Aina', 'Provencal Inventada', '1980-05-17')
  await desarAra(page)
  await alDia(page)
  // La foto la torna a escriure una versió de l'app amb un format més nou
  const principal = [...google.fitxers.values()].find((f) => f.name.startsWith('qi-foto-'))!
  principal.contingut = JSON.stringify({ ...JSON.parse(principal.contingut), versio: 3 })
  principal.modifiedTime = new Date(Date.parse(principal.modifiedTime) + 60_000).toISOString()
  const abans = JSON.stringify([...google.fitxers.values()])
  const panell = await desarAra(page)
  await expect(panell).toContainText('Codi: DRV-V')
  await expect(panell.getByRole('status').first()).toContainText('l\'ha feta una versió més nova de Qi')
  await expect(panell.getByRole('button', { name: 'Actualitzar l\'app' })).toBeVisible()
  await expect(panell.getByTestId('detalls-tecnics')).toContainText('Drive: format 3')
  expect(JSON.stringify([...google.fitxers.values()])).toBe(abans)
})

test('fitxer de Drive danyat (DRV-C): «Provar les còpies diària i mensual»; la danyada es guarda a part', async ({ page, google }) => {
  await crear(page, PA)
  await nouPacient(page, 'Aina', 'Provencal Inventada', '1980-05-17')
  await desarAra(page)
  await alDia(page)
  const principal = [...google.fitxers.values()].find((f) => f.name.startsWith('qi-foto-'))!
  // A mig escriure
  principal.contingut = principal.contingut.slice(0, 300)
  principal.modifiedTime = new Date(Date.parse(principal.modifiedTime) + 60_000).toISOString()
  const panell = await desarAra(page)
  await expect(panell).toContainText('Codi: DRV-C')
  await expect(panell.getByRole('status').first()).toContainText('a mig escriure o danyada')
  await panell.getByRole('button', { name: 'Provar les còpies diària i mensual' }).click()
  await expect(panell.getByText(/Fet: s'ha fet servir l'última còpia/)).toBeVisible()
  await alDia(page)
  expect([...google.fitxers.values()].some((f) => f.name.startsWith('qi-danyada-') && f.contingut.length === 300)).toBe(true)
  // La danyada ja no hi és, i a la sincronia següent hi ha una foto nova
  await desarAra(page)
  await alDia(page)
  expect([...google.fitxers.values()].filter((f) => f.name.startsWith('qi-foto-')).every((f) => JSON.parse(f.contingut).format === 'qi-sinc')).toBe(true)
})

test('fitxer .qi: es descarrega xifrat i s\'importa en un altre dispositiu amb la seva contrasenya', async ({
  page,
  browser,
}, info) => {
  await crear(page, PA)
  await nouPacient(page, 'Aina', 'Provencal Inventada', '1980-05-17')
  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /Seguretat i còpia/ }).click()
  const [descarrega] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descarregar una còpia xifrada d\'aquest dispositiu' }).click(),
  ])
  expect(descarrega.suggestedFilename()).toMatch(/\.qi$/)
  const cami = (await descarrega.path())!
  const text = readFileSync(cami, 'utf8')
  expect(text).not.toContain('Aina')
  expect(JSON.parse(text)).toMatchObject({ format: 'qi-copia', versio: 1 })

  // Un altre dispositiu, amb dades pròpies i un altre compte (un altre Drive)
  const b = await altreNavegador(browser, info, nouGoogle())
  await crear(b.page, PB)
  await nouPacient(b.page, 'Bernat', 'Prova Inventat', '1975-01-02')
  await menu(b.page, 'Ajustos').click()
  await b.page.getByRole('link', { name: /Seguretat i còpia/ }).click()
  await b.page.getByLabel('Fitxer .qi').setInputFiles(cami)
  // Amb la contrasenya d'aquest dispositiu no s'obre
  await b.page.getByLabel('Contrasenya d\'aquella còpia').fill(PB)
  await b.page.getByRole('button', { name: 'Importar una còpia' }).click()
  await expect(b.page.getByRole('alert')).toHaveText('La contrasenya no és correcta.')
  await b.page.getByLabel('Contrasenya d\'aquella còpia').fill(PA)
  await b.page.getByRole('button', { name: 'Importar una còpia' }).click()
  await expect(b.page.getByRole('status').filter({ hasText: 'Fet: les dades del fitxer ja són en aquest dispositiu.' })).toBeVisible()
  await menu(b.page, 'Pacients').click()
  await expect(b.page.getByRole('link', { name: /Aina Provencal Inventada/ })).toBeVisible()
  await expect(b.page.getByRole('link', { name: /Bernat Prova Inventat/ })).toBeVisible()
  await b.context.close()
})
