// Res de la barra ni de la capçalera de la visita s'ha de moure en desar ni
// en sincronitzar (bloc 2): el menú, els botons del temporitzador i
// «Finalitzar visita» no canvien de lloc quan «Desat» apareix i desapareix ni
// quan la píndola de Drive canvia d'estat. Només dades inventades.
import { test } from './google.js'
import { capcalera, comencarVisita, entrar, expect, novaCita, nouPacient, pestanya } from './ajudes-visita.js'

test.describe.configure({ timeout: 120_000 })

test('en desar i en sincronitzar, el menú i els botons del temporitzador no es mouen', async ({ page }) => {
  await entrar(page)
  await nouPacient(page, 'Ona', 'Estable Inventada')
  await novaCita(page, 'Ona', '2026-11-04', '10:00', 'Cervicàlgia')
  await comencarVisita(page)
  await capcalera(page).getByRole('button', { name: 'Agulles posades: començar' }).click()
  await expect(capcalera(page).getByRole('group', { name: 'Controls del temporitzador' })).toBeVisible()
  await expect(page.locator('.indicador-copia')).toHaveAttribute('aria-label', 'Drive: al dia', { timeout: 20_000 })
  await pestanya(page, 'Com està').click()

  // Mostreig des del navegador (cada fotograma, 6 s): posicions i estats
  const mostres = page.evaluate(
    () =>
      new Promise<{ posicions: string[]; desat: string[]; drive: string[] }>((resol) => {
        const posicions = new Set<string>()
        const desat = new Set<string>()
        const drive = new Set<string>()
        const fi = performance.now() + 6000
        const pas = () => {
          const caixa = (el: Element | null) => {
            const r = el?.getBoundingClientRect()
            return r ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}` : '-'
          }
          const botons = [...document.querySelectorAll('.capcalera-visita .controls-retencio button')].map(caixa)
          posicions.add(
            [
              caixa(document.querySelector('nav[aria-label="Navegació principal"]')),
              ...botons,
              caixa(document.querySelector('.capcalera-visita .accions-visita .boto')),
            ].join(' | '),
          )
          desat.add(document.querySelector('.capcalera-visita .accions-visita [role="status"]')?.textContent ?? '')
          drive.add(document.querySelector('.indicador-copia')?.getAttribute('aria-label') ?? '')
          if (performance.now() < fi) requestAnimationFrame(pas)
          else resol({ posicions: [...posicions], desat: [...desat], drive: [...drive] })
        }
        requestAnimationFrame(pas)
      }),
  )
  // Mentrestant: un canvi que es desa i es puja a Drive
  await page.getByLabel('Canvis des de l\'última sessió').fill('Dorm millor (inventat)')
  const r = await mostres
  // Hi ha hagut canvis d'estat («Desat» ↔ res, i la píndola), però cap posició ha canviat
  expect(r.desat.length).toBeGreaterThan(1)
  expect(r.drive.length).toBeGreaterThan(1)
  expect(r.posicions).toHaveLength(1)
})
