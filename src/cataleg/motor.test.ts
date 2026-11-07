import { describe, expect, it } from 'vitest'
import { FONTS } from './fonts'
import { GRUPS, seccio } from './index'
import {
  AJUSTOS_CATALEGS_PER_DEFECTE,
  ambAltres,
  ambSeccio,
  campsVisibles,
  canviarNormal,
  esBuida,
  opcionsVisibles,
  ordenar,
  resumSeccio,
  seccionsVisibles,
  tocarOpcio,
  type AjustosCatalegs,
} from './motor'
import type { CampOpcions } from './tipus'

const ajustos = (a: Partial<AjustosCatalegs> = {}): AjustosCatalegs => ({ ...AJUSTOS_CATALEGS_PER_DEFECTE, ...a })

describe('càrrega dels catàlegs', () => {
  it('ids únics, sense punts (la sincronia camp a camp separa els camins per punts) i amb font', () => {
    const seccions = new Set<string>()
    for (const g of GRUPS) {
      for (const s of g.seccions) {
        expect(seccions.has(s.id), s.id).toBe(false)
        seccions.add(s.id)
        expect(s.id.startsWith(`${g.id}:`), s.id).toBe(true)
        expect(s.id).not.toMatch(/[./]/)
        // Si es diguessin igual, la regió del grup i la de la secció tindrien el mateix nom accessible
        expect(s.ca, s.id).not.toBe(g.ca)
        expect(FONTS[s.ref], s.id).toBeDefined()
        const camps = new Set<string>()
        for (const c of s.camps) {
          expect(camps.has(c.id), `${s.id}/${c.id}`).toBe(false)
          camps.add(c.id)
          expect(c.id).not.toMatch(/[./]/)
          if ('opcions' in c) {
            const ops = new Set<string>()
            for (const op of c.opcions) {
              expect(ops.has(op.id), `${s.id}/${c.id}/${op.id}`).toBe(false)
              ops.add(op.id)
              expect(op.id).not.toMatch(/[./]/)
              expect(op.ca.trim()).not.toBe('')
            }
          }
        }
      }
    }
    expect(seccions.size).toBeGreaterThan(15)
  })

  it('les deu preguntes, ampliades, i els nou tipus de constitució', () => {
    for (const id of ['fredCalor', 'sudoracio', 'capCos', 'toraxAbdomen', 'ganaGust', 'set', 'femtaOrina', 'son', 'orellesUlls', 'dolor', 'ginecologia', 'emocions']) {
      expect(seccio(`anamnesi:${id}`), id).toBeDefined()
    }
    const principal = seccio('constitucio:tipus')!.camps[0] as CampOpcions
    expect(principal.opcions).toHaveLength(9)
    expect(principal.opcions[0]).toMatchObject({ ca: 'Equilibrada', pinyin: 'píng hé zhì', hanzi: '平和质' })
    const emocions = seccio('anamnesi:emocions')!.camps[0] as CampOpcions
    expect(emocions.opcions).toHaveLength(7)
  })
})

describe('editar una secció', () => {
  const son = seccio('anamnesi:son')!
  const alteracions = son.camps[0] as CampOpcions

  it('tocar un xip el tria i un altre toc el treu; si no queda res, la secció no es desa', () => {
    let d = tocarOpcio(undefined, alteracions, 'despertars')
    expect(d?.valors?.alteracions).toEqual(['despertars'])
    d = tocarOpcio(d, alteracions, 'somnisAbundants')
    expect(d?.valors?.alteracions).toEqual(['despertars', 'somnisAbundants'])
    d = tocarOpcio(tocarOpcio(d, alteracions, 'despertars'), alteracions, 'somnisAbundants')
    expect(d).toBeUndefined()
    expect(ambSeccio({ 'anamnesi:son': { normal: true } }, 'anamnesi:son', d)).toEqual({})
  })

  it('selecció simple: tocar-ne una altra la canvia', () => {
    const gana = seccio('anamnesi:ganaGust')!.camps[0] as CampOpcions
    const d = tocarOpcio(tocarOpcio(undefined, gana, 'normal'), gana, 'disminuida')
    expect(d?.valors?.gana).toBe('disminuida')
  })

  it('«Normal / sense alteracions» d\'un toc; triar alguna cosa el treu; les observacions es mantenen', () => {
    let d = canviarNormal(ambAltres(undefined, 'Dorm 7 hores'))
    expect(d).toEqual({ normal: true, altres: 'Dorm 7 hores' })
    d = tocarOpcio(d, alteracions, 'despertars')
    expect(d?.normal).toBeUndefined()
    expect(d?.altres).toBe('Dorm 7 hores')
    expect(canviarNormal(canviarNormal(undefined))).toBeUndefined()
    expect(esBuida({ valors: { alteracions: [] }, altres: '  ' })).toBe(true)
  })

  it('resum per a la capçalera plegada', () => {
    const d = tocarOpcio(tocarOpcio(undefined, alteracions, 'despertars'), son.camps[1]!, '1-3')
    expect(resumSeccio(son, d, 'Normal')).toBe('Despertars · 1–3 h (fetge)')
    expect(resumSeccio(son, { normal: true }, 'Normal')).toBe('Normal')
    const diag = seccio('motiu:diagnosticOccidental')!
    expect(resumSeccio(diag, { valors: { text: 'Acúfens', cim11: { codi: 'MC41', titol: 'Tinnitus' } } }, 'Normal')).toBe('Acúfens · MC41 Tinnitus')
  })
})

describe('amagar i reordenar (Ajustos > Catàlegs)', () => {
  const g = GRUPS.find((x) => x.id === 'anamnesi')!
  const son = seccio('anamnesi:son')!
  const alteracions = son.camps[0] as CampOpcions

  it('una secció amagada no surt, excepte si ja té dades (no es perd res)', () => {
    const a = ajustos({ amagats: ['anamnesi:son'] })
    expect(seccionsVisibles(g, a).map((s) => s.id)).not.toContain('anamnesi:son')
    expect(seccionsVisibles(g, a, { 'anamnesi:son': { valors: { alteracions: ['insomni'] } } }).map((s) => s.id)).toContain('anamnesi:son')
  })

  it('una opció amagada no surt, excepte si està triada; un camp amagat, igual', () => {
    const a = ajustos({ amagats: ['anamnesi:son/alteracions/insomni', 'anamnesi:son/hores'] })
    expect(opcionsVisibles(son, alteracions, a).map((x) => x.id)).not.toContain('insomni')
    expect(opcionsVisibles(son, alteracions, a, ['insomni']).map((x) => x.id)).toContain('insomni')
    expect(campsVisibles(son, a).map((x) => x.id)).not.toContain('hores')
    expect(campsVisibles(son, a, { valors: { hores: 6 } }).map((x) => x.id)).toContain('hores')
  })

  it('ordre de seccions i d\'opcions; els que no hi són, al final', () => {
    const a = ajustos({ ordreSeccions: { anamnesi: ['anamnesi:son', 'anamnesi:dolor'] }, ordreOpcions: { 'anamnesi:son/alteracions': ['insomni'] } })
    expect(seccionsVisibles(g, a).slice(0, 3).map((s) => s.id)).toEqual(['anamnesi:son', 'anamnesi:dolor', 'anamnesi:fredCalor'])
    expect(opcionsVisibles(son, alteracions, a)[0]!.id).toBe('insomni')
    expect(ordenar([{ id: 'a' }, { id: 'b' }, { id: 'c' }], ['c']).map((x) => x.id)).toEqual(['c', 'a', 'b'])
  })

  it('la ginecologia només si la pacient és dona o no consta el sexe', () => {
    const ids = (sexe?: string) => seccionsVisibles(g, ajustos(), {}, { sexe }).map((s) => s.id)
    expect(ids('home')).not.toContain('anamnesi:ginecologia')
    expect(ids('dona')).toContain('anamnesi:ginecologia')
    expect(ids('')).toContain('anamnesi:ginecologia')
  })
})
