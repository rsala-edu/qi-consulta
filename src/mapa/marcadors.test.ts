// @vitest-environment node
import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { ambCalibratge, cataleg } from '../punts/cataleg'
import { posicio3D, posicioMesPropera } from './geometria/baricentriques'
import { idMarcador, llegirIdMarcador, puntsSobreModel, recorregutsMeridia } from './marcadors'
import { modelManiqui } from './model'

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

  it('l\'id del marcador fa anada i tornada', () => {
    expect(llegirIdMarcador(idMarcador('ST36', 'D'))).toEqual({ codi: 'ST36', costat: 'D' })
  })
})
