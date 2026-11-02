import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LimitError, resumError } from './LimitError'

// Un missatge d'error amb dades inventades d'una pacient: no ha d'arribar mai a la consola
const MISSATGE = 'Aina Provencal Inventada: acúfens'

function Peta(): never {
  throw new TypeError(MISSATGE)
}

afterEach(() => vi.restoreAllMocks())

describe('LimitError', () => {
  it('si una pantalla peta, la resta es manté i surt el missatge amb el codi', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <>
        <nav aria-label="Navegació principal">Barra</nav>
        <LimitError codi="UI-MAPA">
          <Peta />
        </LimitError>
      </>,
    )
    expect(screen.getByRole('navigation', { name: 'Navegació principal' })).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Aquesta pantalla ha tingut un problema. Les dades estan bé.')
    expect(screen.getByText('UI-MAPA')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Tornar a carregar' })).toBeVisible()

    const escriure = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escriure }, configurable: true })
    await userEvent.click(screen.getByRole('button', { name: 'Copiar el codi' }))
    expect(escriure).toHaveBeenCalledWith('UI-MAPA')
    expect(await screen.findByRole('button', { name: 'Codi copiat' })).toBeVisible()
  })

  it('a la consola només hi va el nom, el component i la pila, mai el missatge', () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <LimitError codi="UI-PROVA">
        <Peta />
      </LimitError>,
    )
    const nostre = consola.mock.calls.map((c) => String(c[0])).find((x) => x.startsWith('[UI-PROVA]'))
    expect(nostre).toMatch(/^\[UI-PROVA\] TypeError a Peta/)
    expect(nostre).toContain('at ')
    expect(nostre).not.toContain('Aina')
  })

  it('el resum treu la línia del missatge de la pila', () => {
    const e = new Error('dades@exemple.invalid')
    const r = resumError('UI-X', e, { componentStack: '\n    at Fitxa (fitxa.tsx:1:1)\n    at main' })
    expect(r.nom).toBe('Error')
    expect(r.component).toBe('Fitxa')
    expect(r.pila).not.toContain('dades@')
  })

  it('una alternativa pròpia (el cos 3D) no amaga els germans', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <>
        <LimitError codi="UI-COS3D" alternativa={<p>Sense cos</p>}>
          <Peta />
        </LimitError>
        <input aria-label="Cerca un punt" />
      </>,
    )
    expect(screen.getByText('Sense cos')).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Cerca un punt' })).toBeVisible()
  })

  it('en canviar la clau (la ruta) es torna a provar', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <LimitError codi="UI-X" clau="/mapa">
        <Peta />
      </LimitError>,
    )
    expect(screen.getByRole('alert')).toBeVisible()
    rerender(
      <LimitError codi="UI-X" clau="/avui">
        <p>Avui</p>
      </LimitError>,
    )
    expect(screen.getByText('Avui')).toBeVisible()
  })
})
