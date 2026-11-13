// Etapa 3C: evolució del pacient. Un episodi inventat de 8 sessions (l'escala
// baixa de 8 a 3 amb un rebrot): gràfic, punts més usats en les tres vistes,
// comparar la primera i l'última, cronologia, minigràfic a «Com està» i
// tancar l'episodi amb el resum. Només dades inventades.
import type { Locator } from '@playwright/test'
import { test } from './google.js'
import { capcalera, entrar, expect, menu, nouPacient, pestanya } from './ajudes-visita.js'
import { cervicalgiaInventada, crearEpisodiInventat, idPacient } from './evolucio-dades.js'

test.describe.configure({ timeout: 240_000 })

test('evolució: gràfic, punts més usats, comparar, cronologia, minigràfic i resum en tancar l\'episodi', async ({ page }, info) => {
  const tactil = !!info.project.use.hasTouch
  await entrar(page)
  await nouPacient(page, 'Carme', 'Evolució Inventada')
  const pacientId = await idPacient(page, 'Carme Evolució Inventada')
  await crearEpisodiInventat(page, cervicalgiaInventada(pacientId))

  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Carme Evolució Inventada/ }).click()
  await page.getByRole('link', { name: 'Tractaments' }).click()
  const episodi = page.getByRole('article', { name: 'Cervicàlgia' })

  // Cronologia: 8 targetes amb la fletxa respecte de l'anterior, punts i icones
  const targetes = episodi.locator('.cronologia > li')
  await expect(targetes).toHaveCount(8)
  await expect(episodi.getByRole('link', { name: /^Sessió 2 · .*escala 7 \(baixa respecte de l'anterior\), 8 punts, Retenció: 25 min/ })).toBeVisible()
  await expect(episodi.getByRole('link', { name: /^Sessió 5 · .*escala 7 \(puja respecte de l'anterior\).*Amb incidències, Amb addendes/ })).toBeVisible()

  // L'apartat «Evolució», obert (episodi actiu): resum i gràfic
  await expect(episodi.locator('details.apartat-evolucio')).toHaveAttribute('open', '')
  await expect(episodi.getByTestId('resum-evolucio')).toHaveText('De 8 a 3 en 8 sessions (−63 %)')
  const grafic = episodi.getByRole('group', { name: 'Escala del símptoma principal (0–10)' })
  await expect(grafic.locator('.serie-principal .punt-serie')).toHaveCount(8)
  // Canvis de tractament: sessions 2, 4, 5, 6 i 7
  await expect(grafic.locator('.marca-canvi')).toHaveCount(5)
  // Secundaris: amb l'interruptor
  await expect(grafic.locator('.serie-2')).toHaveCount(0)
  await episodi.getByRole('switch', { name: 'Mostrar els símptomes secundaris' }).check()
  await expect(grafic.locator('.serie-2 .punt-serie')).toHaveCount(8)
  await expect(grafic.locator('.serie-3 .punt-serie')).toHaveCount(8)
  // Zones de toc d'almenys 44 px
  const zona = (await grafic.locator('.zona-toc').first().boundingBox())!
  expect(zona.width).toBeGreaterThanOrEqual(44)
  // Primer toc (o passar-hi el ratolí): les dades; segon toc (o clic): obre la sessió
  await primerToc(grafic.getByRole('button', { name: /^Sessió 5,/ }), tactil)
  const globus = episodi.locator('.globus-grafic')
  await expect(globus).toContainText('Sessió 5')
  await expect(globus).toContainText('Símptoma principal: 7')
  await expect(globus).toContainText('10 punts')
  await expect(globus).toContainText('Retenció: 28 min')

  // Altres escales: plegades
  const altres = episodi.getByRole('region', { name: 'Altres escales' })
  const dhi = altres.locator('details', { hasText: 'DHI' })
  await expect(dhi).not.toHaveAttribute('open', '')
  await expect(dhi.locator('summary')).toContainText('De 46 a 22 en 8 sessions (−52 %)')
  await dhi.locator('summary').click()
  await expect(dhi.getByRole('group', { name: /DHI/ }).locator('.punt-serie')).toHaveCount(3)
  await expect(altres.locator('details', { hasText: 'MYMOP' })).toBeVisible()
  // PGIC: tres punts (sessions 1, 5 i 8) i, al resum, l'últim nivell
  const pgic = altres.locator('details', { hasText: 'PGIC' })
  await expect(pgic.locator('summary')).toContainText('2 · Bastant millor')
  await pgic.locator('summary').click()
  await expect(pgic.getByRole('group', { name: /PGIC/ }).locator('.punt-serie')).toHaveCount(3)

  // Punts més usats: barres (per defecte)
  const usats = episodi.getByRole('region', { name: 'Punts més usats' })
  await expect(usats.getByRole('radio', { name: 'Barres' })).toHaveAttribute('aria-checked', 'true')
  const barres = usats.locator('.barres-us > li')
  await expect(barres).toHaveCount(10)
  await expect(barres.first()).toContainText('en 8 de 8 sessions')
  await usats.getByRole('button', { name: /Veure'ls tots/ }).click()
  await expect(barres).toHaveCount(11)
  // Només l'orella
  await usats.getByRole('radio', { name: 'Orella' }).click()
  await expect(barres).toHaveCount(2)
  await expect(barres.first()).toContainText('AH13')
  await usats.getByRole('radio', { name: 'Tots', exact: true }).click()
  // Llista
  await usats.getByRole('radio', { name: 'Llista' }).click()
  const files = usats.locator('tbody tr')
  await expect(files).toHaveCount(11)
  await expect(usats.getByRole('row', { name: /GB21/ })).toContainText('en 3 de 8 sessions')
  await expect(usats.getByRole('row', { name: /GB34/ })).toContainText('Moxa')
  // Al mapa: el cos 2D i l'orella; tocar un punt en mostra les dades
  await usats.getByRole('radio', { name: 'Al mapa' }).click()
  await expect(usats.getByTestId('visor2d')).toBeVisible({ timeout: 60_000 })
  await expect(usats.getByTestId('visor-orella')).toBeVisible()
  await usats.getByTestId('visor2d').locator('.marcador-2d[data-id^="ST36|"]').first().click({ timeout: 10_000 })
  await expect(usats.locator('.fitxa-us')).toContainText('ST36')
  await expect(usats.locator('.fitxa-us')).toContainText('7 de 8 sessions')

  // La vista es recorda en aquest dispositiu
  await page.reload()
  await entrarDeNou(page)
  await page.getByRole('link', { name: 'Tractaments' }).click()
  await expect(page.getByRole('region', { name: 'Punts més usats' }).getByRole('radio', { name: 'Al mapa' })).toHaveAttribute('aria-checked', 'true')
  const ep = page.getByRole('article', { name: 'Cervicàlgia' })

  // Comparar: per defecte, la primera i l'última
  await ep.getByRole('button', { name: 'Comparar' }).click()
  const comparar = ep.getByRole('region', { name: 'Comparar dues sessions' })
  await expect(comparar.getByLabel('Primera sessió')).toHaveValue(/.+/)
  await expect(comparar.locator('.capcalera-comparar')).toContainText('Sessió 1')
  await expect(comparar.locator('.capcalera-comparar')).toContainText('Sessió 8')
  await expect(comparar.locator('.afegit')).toHaveText([/ST36.*afegit/, /TE5.*afegit/])
  await expect(comparar.locator('.tret')).toHaveText([/GB21.*tret/])
  await expect(comparar.locator('.fila-comparar', { hasText: 'Símptoma principal' })).toContainText('(−5)')
  await expect(comparar.locator('.fila-comparar', { hasText: 'Insomni' })).toContainText('(−4)')
  // La retenció, en color neutre (verd i cinabri, només a les escales)
  const retencio = comparar.locator('.fila-comparar', { hasText: 'Retenció' })
  await expect(retencio).toContainText('(+5 min)')
  await expect(retencio.locator('.dif')).toHaveClass(/neutre/)
  await expect(comparar.locator('.fila-comparar', { hasText: 'Símptoma principal' }).locator('.dif')).toHaveClass(/baixa/)
  await expect(comparar).toContainText('Cap canvi a la llengua ni al pols.')
  // Una altra parella: la 4 i la 5 (rebrot: puja)
  await comparar.getByLabel('Primera sessió').selectOption({ index: 3 })
  await comparar.getByLabel('Segona sessió').selectOption({ index: 4 })
  await expect(comparar.locator('.fila-comparar', { hasText: 'Símptoma principal' })).toContainText('(+2)')
  await expect(comparar.locator('.afegit')).toHaveText([/GB34.*afegit/, /LR3.*afegit/])
  await expect(comparar.locator('.fila-comparar', { hasText: 'Incidències' })).toContainText('Petit hematoma')

  // Segon toc a un punt del gràfic: obre la sessió
  const g = ep.getByRole('group', { name: 'Escala del símptoma principal (0–10)' })
  await primerToc(g.getByRole('button', { name: /^Sessió 3,/ }), tactil)
  await expect(ep.locator('.globus-grafic')).toContainText('Sessió 3')
  await segonToc(g.getByRole('button', { name: /^Sessió 3,/ }), tactil)
  await expect(capcalera(page)).toContainText('Sessió 3')
  await page.goBack()

  // Tancar l'episodi: el resum proposat (editable)
  const ep2 = page.getByRole('article', { name: 'Cervicàlgia' })
  await ep2.getByRole('button', { name: 'Tancar l\'episodi' }).click()
  const nota = ep2.getByLabel('Nota final')
  await expect(nota).toHaveValue(
    '8 sessions en 7 setmanes (9 de setembre – 28 d\'octubre). Escala del símptoma principal: de 8 a 3 (−63 %). Punts més usats: AH13 (8), BL10 (8), GB20 (8).',
  )
  await nota.fill(`${await nota.inputValue()} Alta per millora (inventat).`)
  await ep2.getByRole('button', { name: 'Tancar l\'episodi' }).click()
  await expect(ep2.getByText(/Alta per millora \(inventat\)/)).toBeVisible()
  // Tancat: l'apartat «Evolució» queda plegat
  await expect(ep2.locator('details.apartat-evolucio')).not.toHaveAttribute('open', '')
})

test('evolució amb una sola sessió: un missatge suau, cap gràfic; minigràfic a «Com està»', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Dolors', 'Una Sessió Inventada')
  const pacientId = await idPacient(page, 'Dolors Una Sessió Inventada')
  await crearEpisodiInventat(page, {
    pacientId,
    motiu: 'Lumbàlgia',
    sessions: [{ dia: '2026-10-28', escala: 6, punts: [{ codi: 'BL23' }, { codi: 'BL40' }], retencio: 25 }],
  })
  await menu(page, 'Pacients').click()
  await page.getByRole('link', { name: /Dolors Una Sessió Inventada/ }).click()
  await page.getByRole('link', { name: 'Tractaments' }).click()
  const episodi = page.getByRole('article', { name: 'Lumbàlgia' })
  await expect(episodi.getByText('L\'evolució es veurà a partir de la segona sessió.')).toBeVisible()
  await expect(episodi.locator('.grafic-escala')).toHaveCount(0)
  await expect(episodi.getByRole('button', { name: 'Comparar' })).toHaveCount(0)

  // Minigràfic: a la segona sessió, amb l'escala de la primera i la d'avui
  await crearEpisodiSegona(page, pacientId)
  await page.reload()
  await entrarDeNou(page)
  await page.getByRole('link', { name: /Sessió 2/ }).click()
  await pestanya(page, 'Com està').click()
  await expect(page.getByRole('img', { name: /Evolució de l'escala a l'episodi: 6, 4/ })).toBeVisible()
})

/** A la tauleta, un toc; amb el ratolí, passar-hi per sobre */
async function primerToc(l: Locator, tactil: boolean) {
  if (tactil) await l.tap()
  else await l.hover()
}

/** A la tauleta, el segon toc; amb el ratolí, el clic */
async function segonToc(l: Locator, tactil: boolean) {
  if (tactil) await l.tap()
  else await l.click()
}

/** Una segona sessió del mateix episodi, en curs */
async function crearEpisodiSegona(page: import('@playwright/test').Page, pacientId: string) {
  await page.evaluate(async (pacientId) => {
    type M = Record<string, (...a: unknown[]) => Promise<Record<string, unknown>>>
    const m = (window as unknown as { __qiProvesMagatzem: M }).__qiProvesMagatzem
    const cita = await m.crearCita!({
      pacientId,
      inici: '2026-11-04T10:00',
      durada: 45,
      tipus: 'seguiment',
      estat: 'programada',
      motiu: 'Lumbàlgia',
      notes: '',
      sessioId: null,
      nouEpisodi: false,
      episodiId: null,
    })
    const s = await m.comencarVisita!(cita.id)
    const { id: _i, creatAt: _c, modificatAt: _m, pacientId: _p, ...d } = s
    await m.actualitzarSessio!(s.id, { ...d, comEsta: { ...(d.comEsta as object), escala: 4 } }, d)
  }, pacientId)
}

/** Després de recarregar: desbloquejar i tornar a la fitxa */
async function entrarDeNou(page: import('@playwright/test').Page) {
  await page.getByLabel('Contrasenya', { exact: true }).fill('contrasenya-inventada-3b')
  await page.getByRole('button', { name: 'Desbloquejar' }).click()
  await expect(page.getByRole('navigation', { name: 'Navegació principal' })).toBeVisible()
}
