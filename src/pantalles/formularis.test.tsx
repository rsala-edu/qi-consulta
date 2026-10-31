import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fitxaClinicaBuida } from '../domini/fitxaClinica'
import { dadesPacientBuides } from '../domini/pacient'
import { FormulariFitxaClinica } from './fitxa-pacient/FormulariFitxaClinica'
import { FormulariPacient } from './pacients/FormulariPacient'

describe('formulari de pacient', () => {
  it('no desa sense nom i ho indica al camp', async () => {
    const usuari = userEvent.setup()
    const onDesar = vi.fn(() => Promise.resolve())
    render(<FormulariPacient valorsInicials={dadesPacientBuides()} onDesar={onDesar} />)

    await usuari.click(screen.getByRole('button', { name: 'Desar' }))

    expect(await screen.findByText('El nom és obligatori.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nom')).toHaveAttribute('aria-invalid', 'true')
    expect(onDesar).not.toHaveBeenCalled()
  })

  it('desa les dades netes i mostra «Desat»', async () => {
    const usuari = userEvent.setup()
    const onDesar = vi.fn(() => Promise.resolve())
    render(<FormulariPacient valorsInicials={dadesPacientBuides()} onDesar={onDesar} />)

    await usuari.type(screen.getByLabelText('Nom'), '  Pere ')
    await usuari.type(screen.getByLabelText('Llinatges'), 'Inventat Prova')
    await usuari.type(screen.getByLabelText('Telèfon'), '600 123 456')
    await usuari.selectOptions(screen.getByLabelText('Sexe'), 'home')
    await usuari.click(screen.getByRole('button', { name: 'Desar' }))

    expect(onDesar).toHaveBeenCalledWith(
      expect.objectContaining({ nom: 'Pere', llinatges: 'Inventat Prova', telefon: '600 123 456', sexe: 'home' }),
    )
    expect(await screen.findByText('Desat')).toBeInTheDocument()
  })

  it('rebutja un correu mal escrit', async () => {
    const usuari = userEvent.setup()
    const onDesar = vi.fn(() => Promise.resolve())
    render(<FormulariPacient valorsInicials={{ ...dadesPacientBuides(), nom: 'Pere' }} onDesar={onDesar} />)

    await usuari.type(screen.getByLabelText('Correu electrònic'), 'pere@')
    await usuari.click(screen.getByRole('button', { name: 'Desar' }))

    expect(await screen.findByText('El correu no és vàlid.')).toBeInTheDocument()
    expect(onDesar).not.toHaveBeenCalled()
  })

  it('si falla el desat ho diu', async () => {
    const usuari = userEvent.setup()
    const onDesar = vi.fn(() => Promise.reject(new Error('disc ple')))
    render(<FormulariPacient valorsInicials={{ ...dadesPacientBuides(), nom: 'Pere' }} onDesar={onDesar} />)

    await usuari.click(screen.getByRole('button', { name: 'Desar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Hi ha hagut un error inesperat')
  })
})

describe('formulari de fitxa clínica', () => {
  it('desa contraindicacions, al·lèrgies i hàbits', async () => {
    const usuari = userEvent.setup()
    const onDesar = vi.fn(() => Promise.resolve())
    render(<FormulariFitxaClinica valorsInicials={fitxaClinicaBuida()} onDesar={onDesar} />)

    await usuari.click(screen.getByLabelText('Anticoagulants'))
    await usuari.click(screen.getByLabelText('Marcapassos'))
    await usuari.type(screen.getByLabelText('Al·lèrgies'), 'Làtex')
    await usuari.type(screen.getByLabelText('Son'), 'Insomni de conciliació')
    await usuari.click(screen.getByRole('button', { name: 'Desar' }))

    expect(onDesar).toHaveBeenCalledWith({
      ...fitxaClinicaBuida(),
      alergies: 'Làtex',
      contraindicacions: { anticoagulants: true, embaras: false, marcapassos: true, altres: '' },
      habits: { son: 'Insomni de conciliació', tabac: '', alcohol: '', exercici: '' },
    })
  })
})
