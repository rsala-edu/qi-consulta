import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErrorContrasenya } from '../../crypto'
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

  it('mostra l\'indicador mentre prepara el xifratge', async () => {
    const usuari = userEvent.setup()
    const pendent = promesaPendent()
    const onCrear = vi.fn(() => pendent.promesa)
    render(<PantallaDesbloqueig mode="crear" onCrear={onCrear} onDesbloquejar={vi.fn()} />)

    await usuari.type(screen.getByLabelText('Contrasenya'), 'contrasenya-llarga')
    await usuari.type(screen.getByLabelText('Repeteix la contrasenya'), 'contrasenya-llarga')
    await usuari.click(screen.getByRole('button', { name: 'Crear i entrar' }))

    expect(onCrear).toHaveBeenCalledWith('contrasenya-llarga')
    expect(await screen.findByRole('status')).toHaveTextContent('Preparant el xifratge…')
    pendent.resoldre()
  })
})
