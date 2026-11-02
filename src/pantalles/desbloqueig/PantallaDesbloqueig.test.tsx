import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErrorContrasenya } from '../../crypto'
import { FRASES_ENTRADA } from '../../i18n/frases'
import { PantallaDesbloqueig } from './PantallaDesbloqueig'

function promesaPendent() {
  let resoldre!: () => void
  let rebutjar!: (e: unknown) => void
  const promesa = new Promise<void>((res, rej) => {
    resoldre = res
    rebutjar = rej
  })
  return { promesa, resoldre, rebutjar }
}

describe('desbloquejar', () => {
  it('mostra «Desbloquejant…» mentre es deriva la clau', async () => {
    const usuari = userEvent.setup()
    const pendent = promesaPendent()
    const onDesbloquejar = vi.fn(() => pendent.promesa)
    render(<PantallaDesbloqueig mode="desbloquejar" onCrear={vi.fn()} onDesbloquejar={onDesbloquejar} />)

    await usuari.type(screen.getByLabelText('Contrasenya'), 'secret-de-prova')
    await usuari.click(screen.getByRole('button', { name: 'Desbloquejar' }))

    expect(onDesbloquejar).toHaveBeenCalledWith('secret-de-prova')
    expect(await screen.findByRole('status')).toHaveTextContent('Desbloquejant…')
    expect(screen.queryByRole('button', { name: 'Desbloquejar' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Contrasenya')).toBeDisabled()

    pendent.resoldre()
  })

  it('amb una contrasenya incorrecta mostra l\'error i buida el camp', async () => {
    const usuari = userEvent.setup()
    const onDesbloquejar = vi.fn(() => Promise.reject(new ErrorContrasenya()))
    render(<PantallaDesbloqueig mode="desbloquejar" onCrear={vi.fn()} onDesbloquejar={onDesbloquejar} />)

    await usuari.type(screen.getByLabelText('Contrasenya'), 'dolenta')
    await usuari.click(screen.getByRole('button', { name: 'Desbloquejar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La contrasenya no és correcta.')
    expect(screen.getByLabelText('Contrasenya')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Desbloquejar' })).toBeEnabled()
  })
})

describe('crear contrasenya', () => {
  it('exigeix com a mínim 8 caràcters', async () => {
    const usuari = userEvent.setup()
    const onCrear = vi.fn(() => Promise.resolve())
    render(<PantallaDesbloqueig mode="crear" onCrear={onCrear} onDesbloquejar={vi.fn()} />)

    await usuari.type(screen.getByLabelText('Contrasenya'), 'curta')
    await usuari.type(screen.getByLabelText('Repeteix la contrasenya'), 'curta')
    await usuari.click(screen.getByRole('button', { name: 'Crear i entrar' }))

    expect(await screen.findByText('Ha de tenir com a mínim 8 caràcters.')).toBeInTheDocument()
    expect(onCrear).not.toHaveBeenCalled()
  })

  it('exigeix que les dues contrasenyes coincideixin', async () => {
    const usuari = userEvent.setup()
    const onCrear = vi.fn(() => Promise.resolve())
    render(<PantallaDesbloqueig mode="crear" onCrear={onCrear} onDesbloquejar={vi.fn()} />)

    await usuari.type(screen.getByLabelText('Contrasenya'), 'contrasenya-llarga')
    await usuari.type(screen.getByLabelText('Repeteix la contrasenya'), 'una-altra-cosa')
    await usuari.click(screen.getByRole('button', { name: 'Crear i entrar' }))

    expect(await screen.findByText('Les contrasenyes no coincideixen.')).toBeInTheDocument()
    expect(onCrear).not.toHaveBeenCalled()
  })

  it('mostra l\'indicador mentre prepara l\'app', async () => {
    const usuari = userEvent.setup()
    const pendent = promesaPendent()
    const onCrear = vi.fn(() => pendent.promesa)
    render(<PantallaDesbloqueig mode="crear" onCrear={onCrear} onDesbloquejar={vi.fn()} />)

    await usuari.type(screen.getByLabelText('Contrasenya'), 'contrasenya-llarga')
    await usuari.type(screen.getByLabelText('Repeteix la contrasenya'), 'contrasenya-llarga')
    await usuari.click(screen.getByRole('button', { name: 'Crear i entrar' }))

    expect(onCrear).toHaveBeenCalledWith('contrasenya-llarga')
    expect(await screen.findByRole('status')).toHaveTextContent('Preparant l\'app…')
    pendent.resoldre()
  })
})

describe('pantalla d\'entrada', () => {
  it('amb l\'empremta: un sol botó gran i la contrasenya com a enllaç; cap altra opció', async () => {
    const usuari = userEvent.setup()
    const onEmpremta = vi.fn(() => Promise.resolve())
    render(
      <PantallaDesbloqueig
        mode="desbloquejar"
        onCrear={vi.fn()}
        onDesbloquejar={vi.fn()}
        empremta
        onEmpremta={onEmpremta}
        onRecuperar={vi.fn()}
      />,
    )
    // Només el botó de l'empremta i l'enllaç de la contrasenya
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Entrar amb l\'empremta',
      'Entrar amb la contrasenya',
    ])
    expect(screen.getByRole('button', { name: 'Entrar amb l\'empremta' })).toHaveClass('boto-gran')
    expect(screen.queryByLabelText('Contrasenya')).not.toBeInTheDocument()
    expect(screen.queryByText(/xifr/i)).not.toBeInTheDocument()

    await usuari.click(screen.getByRole('button', { name: 'Entrar amb l\'empremta' }))
    expect(onEmpremta).toHaveBeenCalledOnce()
  })

  it('l\'enllaç mostra la contrasenya (amb «He oblidat la contrasenya») i es pot tornar a l\'empremta', async () => {
    const usuari = userEvent.setup()
    render(
      <PantallaDesbloqueig
        mode="desbloquejar"
        onCrear={vi.fn()}
        onDesbloquejar={vi.fn()}
        empremta
        onEmpremta={vi.fn()}
        onRecuperar={vi.fn()}
      />,
    )
    await usuari.click(screen.getByRole('button', { name: 'Entrar amb la contrasenya' }))
    expect(screen.getByLabelText('Contrasenya')).toHaveFocus()
    expect(screen.getByRole('button', { name: 'He oblidat la contrasenya' })).toBeInTheDocument()
    await usuari.click(screen.getByRole('button', { name: 'Tornar a l\'empremta' }))
    expect(screen.getByRole('button', { name: 'Entrar amb l\'empremta' })).toBeInTheDocument()
  })

  it('sota el logo, una de les frases', () => {
    render(<PantallaDesbloqueig mode="desbloquejar" onCrear={vi.fn()} onDesbloquejar={vi.fn()} />)
    const frase = document.querySelector('.frase-entrada')
    expect(FRASES_ENTRADA).toContain(frase?.textContent)
  })
})
