import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Magatzem } from '../db/magatzem'
import { nouMagatzem, renderAmbEsborranys } from '../test/entorn'
import { fitxaClinicaBuida } from '../domini/fitxaClinica'
import { dadesPacientBuides } from '../domini/pacient'
import { FormulariFitxaClinica } from './fitxa-pacient/FormulariFitxaClinica'
import { FormulariPacient } from './pacients/FormulariPacient'

let magatzem: Magatzem
beforeEach(async () => {
  magatzem = (await nouMagatzem()).magatzem
})

const esborrany = { clau: 'prova', descripcio: 'Prova' }

describe('formulari de pacient', () => {
  it('no desa sense nom i ho indica al camp', async () => {
    const usuari = userEvent.setup()
    const onDesar = vi.fn(() => Promise.resolve())
    renderAmbEsborranys(<FormulariPacient valorsInicials={dadesPacientBuides()} onDesar={onDesar} esborrany={esborrany} />, magatzem)

    await usuari.click(screen.getByRole('button', { name: 'Desar' }))

    expect(await screen.findByText('El nom és obligatori.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nom')).toHaveAttribute('aria-invalid', 'true')
    expect(onDesar).not.toHaveBeenCalled()
  })

  it('desa les dades netes i mostra «Desat»', async () => {
    const usuari = userEvent.setup()
    const onDesar = vi.fn(() => Promise.resolve())
    renderAmbEsborranys(<FormulariPacient valorsInicials={dadesPacientBuides()} onDesar={onDesar} esborrany={esborrany} />, magatzem)

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
    renderAmbEsborranys(<FormulariPacient valorsInicials={{ ...dadesPacientBuides(), nom: 'Pere' }} onDesar={onDesar} esborrany={esborrany} />, magatzem)

    await usuari.type(screen.getByLabelText('Correu electrònic'), 'pere@')
    await usuari.click(screen.getByRole('button', { name: 'Desar' }))

    expect(await screen.findByText('El correu no és vàlid.')).toBeInTheDocument()
    expect(onDesar).not.toHaveBeenCalled()
  })

  it('si falla el desat ho diu', async () => {
    const usuari = userEvent.setup()
    const onDesar = vi.fn(() => Promise.reject(new Error('disc ple')))
    renderAmbEsborranys(<FormulariPacient valorsInicials={{ ...dadesPacientBuides(), nom: 'Pere' }} onDesar={onDesar} esborrany={esborrany} />, magatzem)

    await usuari.click(screen.getByRole('button', { name: 'Desar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Hi ha hagut un error inesperat')
  })
})

describe('formulari de fitxa clínica', () => {
  it('desa contraindicacions, al·lèrgies i hàbits', async () => {
    const usuari = userEvent.setup()
    const onDesar = vi.fn(() => Promise.resolve())
    renderAmbEsborranys(<FormulariFitxaClinica valorsInicials={fitxaClinicaBuida()} onDesar={onDesar} esborrany={esborrany} />, magatzem)

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
