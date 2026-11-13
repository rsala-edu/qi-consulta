// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { base64ABytes, generarPdfConsentiment, textPerPdf } from './pdf'
import { PLANTILLES_INICIALS } from '../domini/plantillesInicials'

// PNG d'1×1 píxel (inventat)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const TEXTOS = {
  pacient: 'Pacient',
  versio: 'Versió',
  data: 'Data',
  signaturaPacient: 'Signatura del pacient',
  signaturaRepresentant: 'Signatura del representant legal',
  representant: 'Representant',
  signaturaDoctora: 'Signatura de la doctora',
  pagina: 'Pàgina',
}

describe('PDF del consentiment signat', () => {
  it('es genera amb el text complet, les signatures i el títol', async () => {
    const b64 = await generarPdfConsentiment({
      tipus: 'acupuntura',
      plantillaId: 'plantilla-acupuntura-v2',
      versio: 2,
      titol: PLANTILLES_INICIALS.acupuntura.titol,
      text: PLANTILLES_INICIALS.acupuntura.text,
      signatAt: '2026-11-13T10:00:00.000Z',
      signaturaPacient: PNG,
      representant: { nom: 'Pare Inventat', dni: '', relacio: 'pare', signatura: PNG },
      signaturaDoctora: PNG,
      pacient: 'Aina Provencal Inventada',
      textos: TEXTOS,
    })
    const bytes = base64ABytes(b64)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    // El text sencer no hi cap en una pàgina
    expect(doc.getPageCount()).toBeGreaterThan(1)
    expect(doc.getTitle()).toBe('Acupuntura i tècniques associades')
  })

  it('els caràcters que les fonts estàndard no poden escriure es canvien', () => {
    expect(textPerPdf('l’Agència «ús» · –5 € ✓')).toBe("l'Agència «ús» · –5 € ?")
  })
})
