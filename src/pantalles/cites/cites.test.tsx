// Formulari de cita i agenda amb un magatzem real (IndexedDB simulada).
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Magatzem } from '../../db/magatzem'
import { novaCita, type Cita } from '../../domini/cita'
import type { Pacient } from '../../domini/pacient'
import { pacientInventat } from '../../test/dadesInventades'
import { nouMagatzem, renderAmbEsborranys } from '../../test/entorn'
import { FormulariCita } from './FormulariCita'

let magatzem: Magatzem
let aina: Pacient
let biel: Pacient
let citaBiel: Cita
beforeEach(async () => {
  magatzem = (await nouMagatzem()).magatzem
  aina = await magatzem.crearPacient(pacientInventat())
  biel = await magatzem.crearPacient(pacientInventat({ nom: 'Biel', llinatges: 'Inventat', telefon: '600 333 444' }))
  citaBiel = await magatzem.crearCita(novaCita(biel.id, '2026-11-02T10:00')) // 10:00–10:40
})

function formulari(props: Partial<Parameters<typeof FormulariCita>[0]> = {}) {
  const onDesar = vi.fn(() => Promise.resolve())
  renderAmbEsborranys(
    <FormulariCita
      inicial={novaCita('', '2026-11-02T09:00', 'primera')}
      pacients={[aina, biel]}
      altres={[citaBiel]}
      onDesar={onDesar}
      onCancellar={() => {}}
      // Rellotge fix: el dia abans de les cites de la prova
      ara={new Date(2026, 10, 1, 8, 0)}
      {...props}
    />,
    magatzem,
  )
  return onDesar
}

describe('formulari de cita', () => {
  it('cal triar un pacient; es cerca pel nom', async () => {
    const usuari = userEvent.setup()
    const onDesar = formulari()
    await usuari.click(screen.getByRole('button', { name: 'Desar' }))
    expect(await screen.findByText('Cal triar un pacient.')).toBeInTheDocument()
    expect(onDesar).not.toHaveBeenCalled()

    await usuari.type(screen.getByRole('searchbox', { name: 'Cerca el pacient' }), 'aina')
    await usuari.click(screen.getByRole('button', { name: /Aina Provencal Inventada/ }))
    await usuari.click(screen.getByRole('button', { name: 'Desar' }))
    expect(onDesar).toHaveBeenCalledWith({
      ...novaCita(aina.id, '2026-11-02T09:00', 'primera'),
    })
  })

  it('el tipus es calcula sol i la durada el segueix (60 la primera visita, 40 el seguiment)', async () => {
    const usuari = userEvent.setup()
    // El Biel ja té una cita el 2/11 a les 10:00: una de posterior és seguiment
    formulari({ inicial: novaCita(biel.id, '2026-11-05T09:00', 'primera') })
    expect(screen.getByRole('status', { name: 'Tipus' })).toHaveTextContent('Seguiment')
    expect(screen.getByLabelText('Durada (minuts)')).toHaveValue(40)
    // Abans de la seva primera visita: passa a ser la primera
    await usuari.clear(screen.getByLabelText('Data'))
    await usuari.type(screen.getByLabelText('Data'), '2026-11-02')
    expect(screen.getByRole('status', { name: 'Tipus' })).toHaveTextContent('Primera visita')
    expect(screen.getByLabelText('Durada (minuts)')).toHaveValue(60)
    // No es pot triar a mà
    expect(screen.queryByRole('combobox', { name: 'Tipus' })).not.toBeInTheDocument()
  })

  it('nou episodi: primera visita encara que n\'hi hagi d\'anteriors', async () => {
    const usuari = userEvent.setup()
    const onDesar = formulari({ inicial: novaCita(biel.id, '2026-11-20T09:00') })
    expect(screen.getByRole('status', { name: 'Tipus' })).toHaveTextContent('Seguiment')
    await usuari.click(screen.getByLabelText('Nou episodi (primera visita per un problema nou)'))
    expect(screen.getByRole('status', { name: 'Tipus' })).toHaveTextContent('Primera visita')
    await usuari.click(screen.getByRole('button', { name: 'Desar' }))
    expect(onDesar).toHaveBeenCalledWith(expect.objectContaining({ tipus: 'primera', nouEpisodi: true, durada: 60 }))
  })

  it('una hora que ja ha passat es registra com a visita ja feta (15 minuts de marge)', async () => {
    const usuari = userEvent.setup()
    const ara = new Date(2026, 10, 2, 12, 0)
    const onDesar = formulari({ inicial: novaCita(aina.id, '2026-11-02T11:40'), ara })
    // 11:40 és més de 15 minuts abans de les 12:00
    expect(screen.getByText('Aquesta hora ja ha passat.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desar' })).not.toBeInTheDocument()
    // 11:50 és dins del marge: la visita que comença ara mateix
    await usuari.clear(screen.getByLabelText('Hora'))
    await usuari.type(screen.getByLabelText('Hora'), '11:50')
    expect(screen.queryByText('Aquesta hora ja ha passat.')).not.toBeInTheDocument()
    await usuari.clear(screen.getByLabelText('Hora'))
    await usuari.type(screen.getByLabelText('Hora'), '09:00')
    await usuari.click(screen.getByRole('button', { name: 'Registrar com a visita ja feta' }))
    // La primera cita de l'Aina: primera visita, encara que es registri com a feta
    expect(onDesar).toHaveBeenCalledWith(expect.objectContaining({ estat: 'feta', tipus: 'primera', inici: '2026-11-02T09:00' }))
  })

  it('avisa si se solapa amb una altra cita, i es pot desar igualment', async () => {
    const usuari = userEvent.setup()
    const onDesar = formulari({ inicial: novaCita(aina.id, '2026-11-02T09:00', 'primera') })
    // 9:00–10:00: no se solapa amb la de Biel (10:00–10:40)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await usuari.clear(screen.getByLabelText('Hora'))
    await usuari.type(screen.getByLabelText('Hora'), '09:30')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Coincideix amb la cita de Biel Inventat a les 10:00. Es pot desar igualment.',
    )
    await usuari.click(screen.getByRole('button', { name: 'Desar' }))
    expect(onDesar).toHaveBeenCalledWith(expect.objectContaining({ inici: '2026-11-02T09:30' }))
  })

  it('una cita anul·lada no avisa de solapament', async () => {
    formulari({ inicial: { ...novaCita(aina.id, '2026-11-02T10:00'), estat: 'anullada' }, id: 'x' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('dona d\'alta un pacient nou amb nom i telèfon i el tria', async () => {
    const usuari = userEvent.setup()
    const onCrearPacient = vi.fn((nom: string, telefon: string) =>
      magatzem.crearPacient({ ...pacientInventat(), nom, llinatges: '', telefon }),
    )
    const onDesar = formulari({ onCrearPacient })
    await usuari.click(screen.getByText('Pacient nou'))
    await usuari.type(screen.getByLabelText('Nom del pacient nou'), 'Carme')
    await usuari.type(screen.getByLabelText('Telèfon del pacient nou'), '600 999 888')
    await usuari.click(screen.getByRole('button', { name: 'Donar d\'alta i triar' }))
    expect(onCrearPacient).toHaveBeenCalledWith('Carme', '600 999 888')
    expect(await screen.findByText('Carme')).toBeInTheDocument()
    await usuari.click(screen.getByRole('button', { name: 'Desar' }))
    const nou = (await magatzem.llistarPacients()).find((p) => p.nom === 'Carme')!
    expect(onDesar).toHaveBeenCalledWith(expect.objectContaining({ pacientId: nou.id }))
  })
})
