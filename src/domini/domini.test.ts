import { describe, expect, it } from 'vitest'
import { pacientInventat } from '../test/dadesInventades'
import { cercarPacients, normalitzar, pacientsRecents } from './cercaPacients'
import { esquemaDadesPacient, nomComplet, type Pacient } from './pacient'

function pacient(id: string, canvis: Partial<Pacient>): Pacient {
  return { id, creatAt: '', modificatAt: '', arxivat: false, ...pacientInventat(), ...canvis }
}

const pacients = [
  pacient('1', { nom: 'Martí', llinatges: 'Ferrer Inventat', telefon: '600 111 222' }),
  pacient('2', { nom: 'Aina', llinatges: 'Àlvarez Prova', telefon: '+34 699-000-111' }),
  pacient('3', { nom: 'Joan', llinatges: 'Bosch Fictici', telefon: '', arxivat: true }),
]

describe('cerca de pacients', () => {
  const ids = (llista: Pacient[]) => llista.map((p) => p.id)

  it('sense consulta mostra els actius ordenats per llinatges', () => {
    expect(ids(cercarPacients(pacients, ''))).toEqual(['2', '1'])
  })

  it('troba per nom sense tenir en compte accents ni majúscules', () => {
    expect(ids(cercarPacients(pacients, 'MARTI'))).toEqual(['1'])
    expect(ids(cercarPacients(pacients, 'alvarez'))).toEqual(['2'])
    expect(normalitzar('Àlvarez')).toBe('alvarez')
  })

  it('totes les paraules han de coincidir', () => {
    expect(ids(cercarPacients(pacients, 'aina prova'))).toEqual(['2'])
    expect(ids(cercarPacients(pacients, 'aina ferrer'))).toEqual([])
  })

  it('troba per telèfon ignorant espais, guions i prefix', () => {
    expect(ids(cercarPacients(pacients, '600111'))).toEqual(['1'])
    expect(ids(cercarPacients(pacients, '699 000'))).toEqual(['2'])
    expect(ids(cercarPacients(pacients, '34699'))).toEqual(['2'])
  })

  it('troba qualsevol part del nom, dels llinatges o del telèfon', () => {
    const raul = [pacient('9', { nom: 'Raül', llinatges: 'Sala Grau', telefon: '611 22 33 44' })]
    expect(ids(cercarPacients(raul, 'sala'))).toEqual(['9'])
    expect(ids(cercarPacients(raul, 'SÀLA gra'))).toEqual(['9'])
    expect(ids(cercarPacients(raul, 'aul'))).toEqual(['9'])
    expect(ids(cercarPacients(raul, 'raul 2233'))).toEqual(['9'])
    expect(ids(cercarPacients(raul, 'raul ferrer'))).toEqual([])
  })

  it('els recents: cites passades o fetes, de la més nova a la més antiga, sense repetir', () => {
    const ara = new Date(2026, 10, 12, 12, 0)
    const cites = [
      { pacientId: 'a', inici: '2026-11-01T10:00', estat: 'feta' },
      { pacientId: 'b', inici: '2026-11-10T10:00', estat: 'feta' },
      { pacientId: 'a', inici: '2026-11-11T10:00', estat: 'feta' },
      { pacientId: 'c', inici: '2026-11-20T10:00', estat: 'programada' },
      { pacientId: 'd', inici: '2026-11-12T09:00', estat: 'anullada' },
    ]
    expect(pacientsRecents(cites, ara)).toEqual(['a', 'b'])
  })

  it('els arxivats només surten si es demana', () => {
    expect(ids(cercarPacients(pacients, 'joan'))).toEqual([])
    expect(ids(cercarPacients(pacients, 'joan', { incloureArxivats: true }))).toEqual(['3'])
  })
})

describe('validació del pacient', () => {
  const errorDe = (canvis: Parameters<typeof pacientInventat>[0]) =>
    esquemaDadesPacient.safeParse(pacientInventat(canvis)).error?.issues[0]?.message

  it('accepta un pacient complet i un amb només el nom', () => {
    expect(errorDe({})).toBeUndefined()
    expect(errorDe({ llinatges: '', dataNaixement: '', sexe: '', telefon: '', correu: '' })).toBeUndefined()
  })

  it('exigeix el nom', () => {
    expect(errorDe({ nom: '   ' })).toBe('El nom és obligatori.')
  })

  it('valida correu, telèfon i data', () => {
    expect(errorDe({ correu: 'no-es-correu' })).toBe('El correu no és vàlid.')
    expect(errorDe({ telefon: 'abc' })).toBe('El telèfon no és vàlid.')
    expect(errorDe({ dataNaixement: '2999-01-01' })).toBe('La data no pot ser futura.')
  })

  it('treu els espais sobrers', () => {
    expect(esquemaDadesPacient.parse(pacientInventat({ nom: '  Aina ' })).nom).toBe('Aina')
  })

  it('compon el nom complet', () => {
    expect(nomComplet({ nom: 'Aina', llinatges: '' })).toBe('Aina')
    expect(nomComplet({ nom: 'Aina', llinatges: 'Prova' })).toBe('Aina Prova')
  })
})
