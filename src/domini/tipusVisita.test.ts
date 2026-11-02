import { describe, expect, it } from 'vitest'
import type { EstatCita, TipusCita } from './cita'
import { canvisDeTipus, tipusCalculats, type CitaPerTipus } from './tipusVisita'

function cita(id: string, inici: string, estat: EstatCita = 'programada', tipus: TipusCita = 'seguiment', extra: Partial<CitaPerTipus> = {}): CitaPerTipus {
  return { id, pacientId: 'p1', inici, tipus, estat, nouEpisodi: false, ...extra }
}

const tipus = (cites: CitaPerTipus[]) => Object.fromEntries(tipusCalculats(cites))

describe('tipus de visita automàtic', () => {
  it('la més antiga és la primera visita; les altres, seguiment', () => {
    expect(tipus([cita('b', '2026-11-10T10:00'), cita('a', '2026-11-03T10:00')])).toEqual({ a: 'primera', b: 'seguiment' })
  })

  it('una cita nova abans de la primera visita passa a ser la primera, i l\'antiga, seguiment', () => {
    const cites = [cita('a', '2026-11-10T10:00', 'programada', 'primera'), cita('nova', '2026-11-05T09:00')]
    expect(canvisDeTipus(cites).map((c) => [c.cita.id, c.tipus])).toEqual([
      ['a', 'seguiment'],
      ['nova', 'primera'],
    ])
  })

  it('si s\'anul·la la primera visita (o no s\'hi presenta), la següent passa a ser la primera', () => {
    for (const estat of ['anullada', 'noPresentat'] as const)
      expect(tipus([cita('a', '2026-11-03T10:00', estat, 'primera'), cita('b', '2026-11-10T10:00')])).toEqual({ b: 'primera' })
  })

  it('moure la primera visita després d\'una altra intercanvia els tipus', () => {
    const cites = [cita('a', '2026-11-20T10:00', 'programada', 'primera'), cita('b', '2026-11-10T10:00', 'programada', 'seguiment')]
    expect(tipus(cites)).toEqual({ a: 'seguiment', b: 'primera' })
  })

  it('les cites fetes no es toquen mai, però compten', () => {
    // Una visita feta antiga marcada com a seguiment (historial) es queda així; la següent és seguiment
    const cites = [cita('feta', '2026-10-01T10:00', 'feta', 'seguiment'), cita('b', '2026-11-10T10:00', 'programada', 'primera')]
    expect(tipus(cites)).toEqual({ feta: 'seguiment', b: 'seguiment' })
    expect(canvisDeTipus(cites).map((c) => c.cita.id)).toEqual(['b'])
    // Una feta posterior a una de nova anterior no canvia
    const ambNova = [cita('nova', '2026-09-01T10:00'), cita('feta', '2026-10-01T10:00', 'feta', 'primera')]
    expect(canvisDeTipus(ambNova).map((c) => [c.cita.id, c.tipus])).toEqual([['nova', 'primera']])
  })

  it('nou episodi: primera visita encara que n\'hi hagi d\'anteriors, i el recàlcul la respecta', () => {
    const cites = [
      cita('a', '2026-11-03T10:00', 'programada', 'primera'),
      cita('b', '2026-11-10T10:00', 'programada', 'seguiment'),
      cita('c', '2026-12-01T10:00', 'programada', 'seguiment', { nouEpisodi: true }),
      cita('d', '2026-12-15T10:00', 'programada', 'seguiment'),
    ]
    expect(tipus(cites)).toEqual({ a: 'primera', b: 'seguiment', c: 'primera', d: 'seguiment' })
  })

  it('cada pacient per separat; les anul·lades no canvien', () => {
    const cites = [
      cita('a', '2026-11-03T10:00'),
      cita('x', '2026-11-01T10:00', 'programada', 'seguiment', { pacientId: 'p2' }),
      cita('anul', '2026-10-01T10:00', 'anullada', 'seguiment'),
    ]
    expect(canvisDeTipus(cites).map((c) => c.cita.id).sort()).toEqual(['a', 'x'])
  })
})
