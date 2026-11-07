// Valoració inicial (etapa 3B, part 1): catàlegs amb xips, «Normal / sense
// alteracions», codi CIM-11, avís d'embaràs, versions en revisar, Ajustos >
// Catàlegs i conflicte en dos dispositius. Només dades inventades.
import { test } from './google.js'
import {
  altreNavegador,
  capcalera,
  comencarVisita,
  desarAra,
  entrar,
  estatDesat,
  expect,
  finalitzar,
  menu,
  novaCita,
  nouPacient,
  obrirAltre,
  obrirSeccio,
  pestanya,
  xip,
} from './ajudes-visita.js'

test.describe.configure({ timeout: 240_000 })

test('primera visita: valoració inicial amb xips, normal, codi CIM-11 i avís d\'embaràs; es conserva', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Mia', 'Exemple Inventada')
  await novaCita(page, 'Mia', '2026-11-04', '10:00', 'Acúfens')
  await comencarVisita(page)
  await expect(pestanya(page, 'Valoració')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Primera visita de l\'episodi: valoració inicial.')).toBeVisible()

  // Motiu de consulta i diagnòstic occidental amb codi CIM-11
  const motiu = await obrirSeccio(page, 'Motiu de consulta i malaltia actual')
  await motiu.getByLabel('Motiu de consulta', { exact: true }).fill('Acúfens a l\'orella esquerra des de fa 3 mesos (inventat)')
  await xip(motiu, 'Inici', 'Progressiu')
  await xip(motiu, 'Factors que empitjoren', 'Estrès')
  await xip(motiu, 'Factors que empitjoren', 'Soroll')
  const diag = await obrirSeccio(page, 'Diagnòstic occidental')
  await diag.getByLabel('Diagnòstic', { exact: true }).fill('Acúfens subjectius (inventat)')
  await diag.getByRole('searchbox', { name: 'Codi CIM-11 (opcional)' }).fill('tinnitus')
  await diag.getByRole('button', { name: /MC41 Tinnitus/ }).click()
  await expect(diag.locator('.codi-triat')).toContainText('MC41')

  // Anamnesi: son amb despertars (hora del fetge), sudoració normal d'un toc
  const son = await obrirSeccio(page, 'Son')
  await xip(son, 'Alteracions', /^Despertars/)
  await xip(son, 'Hora dels despertars', '1–3 h (fetge)')
  const suor = await obrirSeccio(page, 'Sudoració')
  await suor.getByRole('button', { name: 'Normal / sense alteracions' }).click()
  await expect(suor.getByRole('button', { name: 'Normal / sense alteracions' })).toHaveAttribute('aria-pressed', 'true')
  await suor.getByLabel('Altres / observacions').fill('Suda poc a l\'estiu (inventat)')
  // Acúfens: agut i fort, a l'esquerra
  const orelles = await obrirSeccio(page, 'Orelles i ulls')
  await xip(orelles, 'Acúfens', 'Agut i fort (com un xiulet)')
  await xip(orelles, 'Acúfens: costat', 'Esquerra')

  // Embaràs: avís a la capçalera de tota la visita
  const gine = await obrirSeccio(page, 'Ginecologia')
  await xip(gine, 'Embaràs', 'Sí')
  await expect(capcalera(page).getByRole('note')).toHaveText('Embaràs')

  // Constitució: principal i secundària
  const cons = await obrirSeccio(page, 'Tipus de constitució')
  await xip(cons, 'Principal', /Deficiència de yin/)
  await xip(cons, 'Secundària', /Estancament de qi/)
  await estatDesat(page)

  // En tornar a la visita, tot hi és (resums a les capçaleres plegades)
  await menu(page, 'Avui').click()
  await comencarVisita(page)
  await expect(capcalera(page).getByRole('note')).toHaveText('Embaràs')
  const capSon = page.locator('.capcalera-seccio button').filter({ hasText: /^Son/ })
  await expect(capSon).toContainText('Despertars · 1–3 h (fetge)')
  await expect(page.locator('.capcalera-seccio button').filter({ hasText: 'Sudoració' })).toContainText('Normal / sense alteracions · Suda poc')
  await expect(page.locator('.capcalera-seccio button').filter({ hasText: 'Diagnòstic occidental' })).toContainText('Acúfens subjectius')
  // Les seccions que no s'han tocat no es desen
  await expect(page.locator('.capcalera-seccio button').filter({ hasText: /^Set/ }).locator('.resum-seccio')).toHaveCount(0)
})

test('seguiment: la valoració es veu i, en revisar-la, se\'n fa una versió nova', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Joana', 'Exemple Inventada')
  await novaCita(page, 'Joana', '2026-11-04', '10:00', 'Vertigen')
  await comencarVisita(page)
  const son = await obrirSeccio(page, 'Son')
  await xip(son, 'Alteracions', 'Insomni')
  await estatDesat(page)
  await finalitzar(page)

  // Segona visita (seguiment): la valoració és de només lectura fins que es revisa
  await novaCita(page, 'Joana', '2026-11-04', '12:00')
  await comencarVisita(page)
  await expect(pestanya(page, 'Com està')).toHaveAttribute('aria-selected', 'true')
  await pestanya(page, 'Valoració').click()
  await expect(page.getByText(/Versió 1 ·/)).toBeVisible()
  const son2 = await obrirSeccio(page, 'Son')
  await expect(son2.getByRole('button', { name: 'Insomni' })).toBeDisabled()
  await page.getByRole('button', { name: 'Revisar la valoració' }).click()
  await expect(page.getByText(/Versió 2 ·/)).toBeVisible()
  const son3 = await obrirSeccio(page, 'Son')
  await xip(son3, 'Alteracions', 'Somnis abundants')
  await estatDesat(page)
  // La versió 1 es conserva tal com era
  await page.getByLabel('Veure').selectOption('1')
  await expect(page.locator('.capcalera-seccio button').filter({ hasText: /^Son/ })).toContainText('Insomni')
  await expect(page.locator('.capcalera-seccio button').filter({ hasText: /^Son/ })).not.toContainText('Somnis abundants')
})

test('Ajustos > Catàlegs: una secció i una opció amagades no surten, però el que ja hi ha desat es veu', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Laia', 'Exemple Inventada')
  await novaCita(page, 'Laia', '2026-11-04', '10:00')
  await comencarVisita(page)
  const set = await obrirSeccio(page, 'Set')
  await xip(set, 'Set', 'Augmentada')
  await estatDesat(page)

  await menu(page, 'Ajustos').click()
  await page.getByRole('link', { name: /^Catàlegs/ }).click()
  await page.getByRole('checkbox', { name: 'Mostrar Set' }).uncheck()
  await page.getByRole('checkbox', { name: 'Mostrar Dolor' }).uncheck()
  await page.getByRole('region', { name: 'Anamnesi (les deu preguntes)' }).getByRole('button', { name: 'Pujar Son' }).click()
  const fonts = page.getByRole('region', { name: 'Fonts i llicències' })
  await expect(fonts).toContainText('CC BY-ND 3.0 IGO')

  await comencarVisita(page)
  await pestanya(page, 'Valoració').click()
  // «Set» té dades: es continua veient; «Dolor» no
  await expect(page.locator('.capcalera-seccio button').filter({ hasText: /^Set/ })).toContainText('Augmentada')
  await expect(page.locator('.capcalera-seccio button').filter({ hasText: /^Dolor/ })).toHaveCount(0)
  // «Son» ha pujat una posició (abans d'«Orelles i ulls»)
  const noms = await page.getByRole('region', { name: 'Anamnesi (les deu preguntes)' }).locator('.nom-seccio').allInnerTexts()
  expect(noms.findIndex((n) => n.startsWith('Son'))).toBeLessThan(noms.findIndex((n) => n.startsWith('Femta i orina')))
})

test('la mateixa valoració editada en dos dispositius alhora: el camp que perd queda per revisar', async ({ page, google, browser }, info) => {
  test.skip(info.project.name !== 'escriptori', 'Amb dos navegadors, una vegada n\'hi ha prou')
  await entrar(page)
  await nouPacient(page, 'Carme', 'Exemple Inventada')
  await novaCita(page, 'Carme', '2026-11-04', '10:00', 'Mareig')
  await comencarVisita(page)
  const motiu = await obrirSeccio(page, 'Motiu de consulta i malaltia actual')
  await motiu.getByLabel('Motiu de consulta', { exact: true }).fill('Mareig (inventat)')
  await estatDesat(page)
  await desarAra(page)

  const b = await altreNavegador(browser, info, google)
  await obrirAltre(b)
  await comencarVisita(b.page)
  await desarAra(page)

  // Tots dos canvien el motiu sense haver vist el de l'altre
  const escriure = async (x: typeof page, text: string) => {
    await x.bringToFront()
    await pestanya(x, 'Valoració').click()
    const m = await obrirSeccio(x, 'Motiu de consulta i malaltia actual')
    await m.getByLabel('Motiu de consulta', { exact: true }).fill(text)
    await estatDesat(x)
  }
  await escriure(page, 'Mareig en girar el cap (inventat)')
  await escriure(b.page, 'Mareig en llevar-se (inventat)')
  for (const x of [page, b.page, page]) await desarAra(x)

  for (const x of [page, b.page]) {
    await x.bringToFront()
    await menu(x, 'Avui').click()
    await comencarVisita(x)
    await pestanya(x, 'Valoració').click()
    await expect(x.locator('.pestanya-valoracio .revisio-conflictes')).toContainText('Motiu de consulta i malaltia actual · Motiu de consulta')
  }
  await b.context.close()
})
