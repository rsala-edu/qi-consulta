// @vitest-environment node
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { ambCalibratge, cataleg } from '../punts/cataleg'
import { posicio3D, posicioMesPropera } from './geometria/baricentriques'
import { idMarcador, llegirIdMarcador, puntsSobreModel, recorregutsMeridia } from './marcadors'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll } from 'vitest'
import { modelDesDeGlb, modelManiqui, type ModelCos } from './model'

let modelGlb: ModelCos
beforeAll(async () => {
  const glb = readFileSync(resolve('public/models/cos.glb'))
  modelGlb = await modelDesDeGlb(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength))
})

const model = modelManiqui()
const a = (x: number, y: number, z: number) => posicioMesPropera(model.geometria, new Vector3(x, y, z))

const calibrat = ambCalibratge(cataleg, [
  { codi: 'ST36', topologia: model.topologia, costat: 'E', posicio: posicio3D(model.topologia, 'E', a(0.12, 0.42, 0.08)) },
  { codi: 'ST36', topologia: model.topologia, costat: 'D', posicio: posicio3D(model.topologia, 'D', a(-0.12, 0.42, 0.08)) },
  { codi: 'ST35', topologia: model.topologia, costat: 'E', posicio: posicio3D(model.topologia, 'E', a(0.11, 0.5, 0.08)) },
  { codi: 'LI4', topologia: 'una-altra-malla', costat: 'E', posicio: posicio3D('una-altra-malla', 'E', a(0.3, 0.78, 0.05)) },
])

describe('punts sobre el model', () => {
  it('només agafa les posicions de la topologia del model', () => {
    const punts = puntsSobreModel(calibrat, model)
    expect(punts.map((p) => p.id).sort()).toEqual(['ST35|E', 'ST36|D', 'ST36|E'])
  })

  it('calcula la posició i la normal sobre la pell', () => {
    const st36 = puntsSobreModel(calibrat, model).find((p) => p.id === 'ST36|E')!
    expect(st36.posicio.y).toBeCloseTo(0.42, 1)
    expect(st36.normal.length()).toBeCloseTo(1)
    expect(st36.normal.z).toBeGreaterThan(0)
  })

  it('filtra per meridià', () => {
    expect(puntsSobreModel(calibrat, model, 'LI')).toEqual([])
  })

  it('el recorregut del meridià va en ordre i per costats', () => {
    const r = recorregutsMeridia(puntsSobreModel(calibrat, model), 'ST')
    expect(r.map((l) => l.length).sort()).toEqual([1, 2])
    const esquerre = r.find((l) => l.length === 2)!
    expect(esquerre[0]!.y).toBeGreaterThan(esquerre[1]!.y) // ST35 (genoll) abans que ST36
  })

  it('ST40 és una branca de ST38: la línia principal no hi passa', () => {
    const tots = puntsSobreModel(cataleg, modelGlb)
    const linies = recorregutsMeridia(tots, 'ST')
    const st = (codi: string) => tots.find((p) => p.id === `${codi}|E`)!.posicio
    const principal = linies.find((l) => l.length > 2 && l.some((v) => v.equals(st('ST38'))))!
    expect(principal.some((v) => v.equals(st('ST40')))).toBe(false)
    const i38 = principal.findIndex((v) => v.equals(st('ST38')))
    expect(principal[i38 + 1]!.equals(st('ST39'))).toBe(true)
    // i hi ha un segment ST38 → ST40
    expect(linies.some((l) => l.length === 2 && l[0]!.equals(st('ST38')) && l[1]!.equals(st('ST40')))).toBe(true)
  })

  it('BL segueix el recorregut del catàleg: dues línies a l\'esquena que s\'uneixen a BL40', () => {
    const tots = puntsSobreModel(cataleg, modelGlb)
    const bl = cataleg.meridians.find((m) => m.codi === 'BL')!
    const linies = recorregutsMeridia(tots, 'BL', bl.recorregut)
    expect(linies).toHaveLength(4) // dues línies × dos costats
    const st = (codi: string) => tots.find((p) => p.id === `${codi}|E`)!.posicio
    const externa = linies.find((l) => l.some((v) => v.equals(st('BL41'))))!
    expect(externa[externa.length - 1]!.equals(st('BL40'))).toBe(true)
    const principal = linies.find((l) => l.some((v) => v.equals(st('BL11'))))!
    expect(principal.some((v) => v.equals(st('BL41')))).toBe(false)
  })

  it('l\'id del marcador fa anada i tornada', () => {
    expect(llegirIdMarcador(idMarcador('ST36', 'D'))).toEqual({ codi: 'ST36', costat: 'D', index: 0 })
    // Els subpunts (EX-B2 a L3) porten l'índex; el primer, no, per no canviar els ids que ja hi havia
    expect(idMarcador('EX-B2', 'E', 0)).toBe('EX-B2|E')
    expect(llegirIdMarcador(idMarcador('EX-B2', 'E', 14))).toEqual({ codi: 'EX-B2', costat: 'E', index: 14 })
  })
})
