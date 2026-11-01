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

  it('la primera visita dura 60 minuts i el seguiment 40, si no es toca la durada', async () => {
    const usuari = userEvent.setup()
    formulari({ inicial: novaCita(aina.id, '2026-11-02T09:00') })
    expect(screen.getByLabelText('Durada (minuts)')).toHaveValue(40)
    await usuari.selectOptions(screen.getByLabelText('Tipus'), 'primera')
    expect(screen.getByLabelText('Durada (minuts)')).toHaveValue(60)
  })

  it('avisa si se solapa amb una altra cita, i es pot desar igualment', async () => {
    const usuari = userEvent.setup()
    const onDesar = formulari({ inicial: novaCita(aina.id, '2026-11-02T09:00', 'primera') })
    // 9:00–10:00: no se solapa amb la de Biel (10:00–10:40)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await usuari.clear(screen.getByLabelText('Hora'))
    await usuari.type(screen.getByLabelText('Hora'), '09:30')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Atenció: se solapa amb Biel Inventat (10:00–10:40).',
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

  it('no deixa desar un seguiment si el pacient encara no té cap primera visita, i proposa canviar-la', async () => {
    const usuari = userEvent.setup()
    const onDesar = formulari({ inicial: novaCita(aina.id, '2026-11-02T09:00') })
    const avis = screen.getByRole('alert')
    expect(avis).toHaveTextContent('Aquest pacient encara no té cap primera visita')
    await usuari.click(screen.getByRole('button', { name: 'Desar' }))
    expect(onDesar).not.toHaveBeenCalled()

    await usuari.click(screen.getByRole('button', { name: 'Canviar a «Primera visita»' }))
    expect(screen.getByLabelText('Tipus')).toHaveValue('primera')
    expect(screen.getByLabelText('Durada (minuts)')).toHaveValue(60)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await usuari.click(screen.getByRole('button', { name: 'Desar' }))
    expect(onDesar).toHaveBeenCalledWith(expect.objectContaining({ tipus: 'primera', durada: 60 }))
  })

  it('un seguiment anterior a la primera visita tampoc es pot desar; posterior, sí', async () => {
    const usuari = userEvent.setup()
    const primera = await magatzem.crearCita(novaCita(aina.id, '2026-11-05T09:00', 'primera'))
    const onDesar = formulari({ inicial: novaCita(aina.id, '2026-11-02T09:00'), altres: [citaBiel, primera] })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Aquesta cita és anterior a la primera visita del pacient (dijous, 5 de novembre de 2026, 09:00)',
    )
    await usuari.click(screen.getByRole('button', { name: 'Desar' }))
    expect(onDesar).not.toHaveBeenCalled()

    await usuari.clear(screen.getByLabelText('Data'))
    await usuari.type(screen.getByLabelText('Data'), '2026-11-12')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await usuari.click(screen.getByRole('button', { name: 'Desar' }))
    expect(onDesar).toHaveBeenCalledWith(expect.objectContaining({ tipus: 'seguiment', inici: '2026-11-12T09:00' }))
  })
})
