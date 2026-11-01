import { describe, expect, it } from 'vitest'
import {
  columnesDelDia,
  dillunsDe,
  esquemaDadesCita,
  fiDe,
  novaCita,
  properaCita,
  recompteCites,
  setmanaDe,
  solapaments,
  sumarDies,
  type EstatCita,
} from './cita'

const cita = (id: string, inici: string, durada = 40, estat: EstatCita = 'programada') => ({
  ...novaCita('p1', inici),
  id,
  durada,
  estat,
})

describe('cita', () => {
  it('la durada per defecte és 60 minuts la primera visita i 40 el seguiment', () => {
    expect(novaCita('p1', '2026-11-02T10:00', 'primera').durada).toBe(60)
    expect(novaCita('p1', '2026-11-02T10:00').durada).toBe(40)
    expect(novaCita('p1', '2026-11-02T10:00').estat).toBe('programada')
  })

  it('valida el pacient, l\'hora i la durada', () => {
    expect(esquemaDadesCita.safeParse(novaCita('p1', '2026-11-02T10:00')).success).toBe(true)
    expect(esquemaDadesCita.safeParse(novaCita('', '2026-11-02T10:00')).success).toBe(false)
    expect(esquemaDadesCita.safeParse(novaCita('p1', '2026-11-02 10:00')).success).toBe(false)
    expect(esquemaDadesCita.safeParse({ ...novaCita('p1', '2026-11-02T10:00'), durada: 0 }).success).toBe(false)
  })

  it('calcula el final, també si passa de mitjanit', () => {
    expect(fiDe({ inici: '2026-11-02T10:30', durada: 40 })).toBe('2026-11-02T11:10')
    expect(fiDe({ inici: '2026-11-02T23:40', durada: 40 })).toBe('2026-11-03T00:20')
  })

  it('setmanes de dilluns a diumenge, també en canviar de mes i d\'hora', () => {
    expect(dillunsDe('2026-11-01')).toBe('2026-10-26') // diumenge
    expect(dillunsDe('2026-11-02')).toBe('2026-11-02')
    expect(setmanaDe('2026-10-28')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ])
    // el canvi d'hora (25 d'octubre de 2026) no fa saltar cap dia
    expect(sumarDies('2026-10-24', 1)).toBe('2026-10-25')
    expect(sumarDies('2026-10-25', 1)).toBe('2026-10-26')
  })
})

describe('solapaments', () => {
  const a = cita('a', '2026-11-02T10:00', 40) // 10:00–10:40
  it('detecta les cites que s\'encavalquen', () => {
    expect(solapaments(cita('b', '2026-11-02T10:30'), [a]).map((c) => c.id)).toEqual(['a'])
    expect(solapaments(cita('b', '2026-11-02T09:30', 45), [a]).map((c) => c.id)).toEqual(['a'])
    expect(solapaments(cita('b', '2026-11-02T09:00', 180), [a]).map((c) => c.id)).toEqual(['a'])
  })

  it('una cita just a continuació no se solapa', () => {
    expect(solapaments(cita('b', '2026-11-02T10:40'), [a])).toEqual([])
    expect(solapaments(cita('b', '2026-11-02T09:20', 40), [a])).toEqual([])
  })

  it('no compta la mateixa cita ni les anul·lades o no presentades', () => {
    expect(solapaments(a, [a])).toEqual([])
    expect(solapaments({ ...a, inici: '2026-11-02T10:10' }, [a])).toEqual([])
    const anullada = cita('c', '2026-11-02T10:00', 40, 'anullada')
    const noPresentat = cita('d', '2026-11-02T10:00', 40, 'noPresentat')
    expect(solapaments(cita('b', '2026-11-02T10:10'), [anullada, noPresentat])).toEqual([])
    // una cita nova (sense id) també es comprova
    const { id: _id, ...sense } = cita('x', '2026-11-02T10:20')
    expect(solapaments(sense, [a]).map((c) => c.id)).toEqual(['a'])
  })

  it('les cites que s\'encavalquen es dibuixen en columnes', () => {
    const col = columnesDelDia([
      cita('a', '2026-11-02T10:00', 40),
      cita('b', '2026-11-02T10:20', 40),
      cita('c', '2026-11-02T10:45', 30), // cap a la columna d'«a», que ja ha acabat
      cita('d', '2026-11-02T12:00', 40), // sola
    ])
    expect(col.get('a')).toEqual({ columna: 0, columnes: 2 })
    expect(col.get('b')).toEqual({ columna: 1, columnes: 2 })
    expect(col.get('c')).toEqual({ columna: 0, columnes: 2 })
    expect(col.get('d')).toEqual({ columna: 0, columnes: 1 })
  })
})

describe('historial del pacient', () => {
  const cites = [
    cita('1', '2026-10-01T10:00', 60, 'feta'),
    cita('2', '2026-10-08T10:00', 40, 'anullada'),
    cita('3', '2026-10-15T10:00', 40, 'noPresentat'),
    cita('4', '2026-10-22T10:00', 40, 'feta'),
    cita('5', '2026-11-12T10:00', 40),
    cita('6', '2026-11-05T10:00', 40),
  ]
  it('compta visites fetes, anul·lacions i no presentats', () => {
    expect(recompteCites(cites)).toEqual({ fetes: 2, anullades: 1, noPresentat: 1, programades: 2 })
  })
  it('la pròxima cita és la primera programada a partir d\'ara', () => {
    expect(properaCita(cites, '2026-11-01T09:00')?.id).toBe('6')
    expect(properaCita(cites, '2026-11-20T09:00')).toBeUndefined()
  })
})

describe('dates de l\'agenda en català', async () => {
  const { diaLlarg, diaCurt, mesAny } = await import('../i18n/t')
  it('formen el dia amb la preposició del mes', () => {
    expect(diaLlarg('2026-11-02')).toBe('dilluns, 2 de novembre de 2026')
    expect(diaLlarg('2026-10-01T10:00')).toBe('dijous, 1 d\'octubre de 2026')
    expect(diaLlarg('2026-08-30')).toBe('diumenge, 30 d\'agost de 2026')
    expect(diaCurt('2026-11-07')).toBe('ds. 7')
    expect(mesAny('2026-04-15')).toBe('abril de 2026')
  })
})
