// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { base64ABytes } from '../consentiment/pdf'
import { nouEpisodi, type Episodi } from '../domini/episodi'
import { nouPuntMarcat } from '../domini/puntMarcat'
import { mapaPunts, novaSessio, type Sessio } from '../domini/sessio'
import { dadesPacientBuides, type Pacient } from '../domini/pacient'
import { historialPacient, informeEpisodi, informeSessio } from './contingut'
import { generarInforme } from './pdf'

// Només dades inventades
const CONSULTA = { nom: 'Consulta Inventada', doctora: 'Dra. Prova Inventada', collegiada: '00000', adreca: 'Carrer Inventat, 1', telefon: '600 000 000' }
const pacient: Pacient = { ...dadesPacientBuides(), nom: 'Aina', llinatges: 'Informe Inventada', id: 'p1', creatAt: '2026-09-01T00:00:00Z', modificatAt: '2026-09-01T00:00:00Z' } as Pacient
const episodi: Episodi = { ...nouEpisodi('Lumbàlgia', '2026-09-03'), id: 'e1', pacientId: 'p1', creatAt: '', modificatAt: '' }
const sessio = (n: number, escala: number): Sessio => {
  const d = novaSessio({ citaId: `c${n}`, episodiId: 'e1', numero: n, iniciAt: `2026-09-${String(n * 7).padStart(2, '0')}T10:00:00.000Z` })
  return {
    ...d,
    id: `s${n}`,
    pacientId: 'p1',
    creatAt: '',
    modificatAt: '',
    estat: 'tancada',
    comEsta: { ...d.comEsta, escala, canvis: 'Millor (inventat)' },
    punts: mapaPunts([nouPuntMarcat('BL23', 'bilateral', 'agulla'), nouPuntMarcat('LI4', 'bilateral', 'agulla')]),
    retencio: { iniciAt: `2026-09-0${n}T10:10:00.000Z`, minuts: 25 },
  }
}
const sessions = [sessio(1, 8), sessio(2, 6), sessio(3, 4)]

async function obrir(b64: string) {
  const bytes = base64ABytes(b64)
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  return PDFDocument.load(bytes)
}

describe('informes en PDF', () => {
  it('informe de sessió', async () => {
    const inf = informeSessio({ consulta: CONSULTA, pacient, episodi, sessio: sessions[1]! })
    expect(inf.titol).toContain('Sessió 2')
    expect(JSON.stringify(inf.blocs)).toContain('BL23')
    const doc = await obrir(await generarInforme(inf))
    expect(doc.getTitle()).toBe(inf.titol)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('informe d\'episodi: el resum de l\'evolució, el gràfic i els punts més usats', async () => {
    const inf = informeEpisodi({ consulta: CONSULTA, pacient, episodi, sessions, valoracions: [] })
    const text = JSON.stringify(inf.blocs)
    expect(text).toContain('De 8 a 4 en 3 sessions (−50 %)')
    expect(inf.blocs.some((b) => b.tipus === 'grafic')).toBe(true)
    expect(text).toContain('en 3 de 3 sessions')
    await obrir(await generarInforme(inf))
  })

  it('historial complet: tots els episodis, les sessions i els consentiments', async () => {
    const inf = historialPacient({ consulta: CONSULTA, pacient, episodis: [episodi], sessions, valoracions: new Map(), consentiments: [] })
    const text = JSON.stringify(inf.blocs)
    expect(text).toContain('Episodi: Lumbàlgia')
    expect(text).toContain('Sessió 3')
    expect(text).toContain('Cap consentiment signat.')
    const doc = await obrir(await generarInforme(inf))
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })
})
