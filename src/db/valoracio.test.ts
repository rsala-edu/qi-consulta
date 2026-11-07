// Valoració inicial al magatzem (etapa 3B). Només dades inventades.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { crearClauMestra } from '../crypto'
import { novaCita } from '../domini/cita'
import { hiHaEmbaras, idValoracio, novaValoracio } from '../domini/valoracio'
import { pacientInventat } from '../test/dadesInventades'
import { driveEnMemoria } from '../test/driveEnMemoria'
import { compararFitxes, dadesAjuntades } from '../domini/ajuntar'
import { copiaPerRecuperar, obrirClauMestra, restaurarCopia } from '../sincronia/recuperacio'
import { sincronitzar } from '../sincronia/sincronitzar'
import { QiDB } from './esquema'
import { crearMagatzem, guardarClauEmbolcallada } from './magatzem'

const obertes: QiDB[] = []
afterEach(async () => {
  for (const db of obertes.splice(0)) await db.delete()
})
const P = 'contrasenya-de-prova'
function novaDb() {
  const db = new QiDB(`prova-${crypto.randomUUID()}`)
  obertes.push(db)
  return db
}
async function primer() {
  const db = novaDb()
  const { embolcall, clau } = await crearClauMestra(P, 1_000)
  await guardarClauEmbolcallada(db, embolcall)
  return { db, clau, m: crearMagatzem(db, clau) }
}

async function ambEpisodi() {
  const x = await primer()
  const p = await x.m.crearPacient(pacientInventat())
  const c = await x.m.crearCita({ ...novaCita(p.id, '2026-11-04T10:00', 'primera'), motiu: 'Acúfens' })
  const s = await x.m.comencarVisita(c.id)
  return { ...x, p, c, s }
}

describe('valoració inicial', () => {
  it('es desa xifrada, amb id per episodi i versió; revisar en fa una de nova i conserva l\'anterior', async () => {
    const { db, m, s } = await ambEpisodi()
    const v1 = novaValoracio(s.episodiId, 1, s.id)
    await m.desarValoracio({ ...v1, seccions: { 'anamnesi:son': { valors: { alteracions: ['insomni'] } } } })
    const r = await db.valoracions.get(idValoracio(s.episodiId, 1))
    expect(JSON.stringify(r)).not.toContain('insomni')
    expect(r?.episodiId).toBe(s.episodiId)

    const v2 = await m.revisarValoracio(s.episodiId, 'una-altra-sessio')
    expect(v2.versio).toBe(2)
    expect(v2.seccions['anamnesi:son']?.valors?.alteracions).toEqual(['insomni'])
    await m.desarValoracio({ ...v2, seccions: { 'anamnesi:son': { normal: true } } }, v2)
    const totes = await m.valoracionsDe(s.episodiId)
    expect(totes.map((x) => x.versio)).toEqual([1, 2])
    expect(totes[0]!.seccions['anamnesi:son']).toEqual({ valors: { alteracions: ['insomni'] } })
    expect(totes[1]!.seccions['anamnesi:son']).toEqual({ normal: true })
  })

  it('només es desa el que ha canviat respecte d\'«inicial»: dues seccions editades alhora no es trepitgen', async () => {
    const { m, s } = await ambEpisodi()
    const base = await m.desarValoracio(novaValoracio(s.episodiId, 1, s.id))
    const { id: _i, creatAt: _c, modificatAt: _m, pacientId: _p, ...inicial } = base
    // Un formulari obert canvia el son; mentrestant, un altre canvia la set
    await m.desarValoracio({ ...inicial, seccions: { 'anamnesi:set': { valors: { set: 'augmentada' } } } }, inicial)
    await m.desarValoracio({ ...inicial, seccions: { 'anamnesi:son': { normal: true } } }, inicial)
    const [v] = await m.valoracionsDe(s.episodiId)
    expect(v!.seccions).toEqual({ 'anamnesi:set': { valors: { set: 'augmentada' } }, 'anamnesi:son': { normal: true } })
  })

  it('avís d\'embaràs', () => {
    expect(hiHaEmbaras({ seccions: { 'anamnesi:ginecologia': { valors: { embaras: 'si' } } } })).toBe(true)
    expect(hiHaEmbaras({ seccions: { 'anamnesi:ginecologia': { valors: { embaras: 'possible' } } } })).toBe(true)
    expect(hiHaEmbaras({ seccions: { 'anamnesi:ginecologia': { valors: { embaras: 'no' } } } })).toBe(false)
    expect(hiHaEmbaras(null)).toBe(false)
  })

  it('dos dispositius omplen seccions diferents de la mateixa valoració: es fusionen sense conflicte', async () => {
    const drive = driveEnMemoria()
    const a = await ambEpisodi()
    const base = await a.m.desarValoracio(novaValoracio(a.s.episodiId, 1, a.s.id))
    await sincronitzar(a.db, a.clau, drive)
    const db = novaDb()
    const copia = (await copiaPerRecuperar(drive))!
    const clau = await obrirClauMestra(copia, P)
    await restaurarCopia(db, clau, copia, drive)
    const b = { db, clau, m: crearMagatzem(db, clau) }

    const { id: _i, creatAt: _c, modificatAt: _m, pacientId: _p, ...inicial } = base
    await a.m.desarValoracio({ ...inicial, seccions: { 'anamnesi:son': { valors: { alteracions: ['despertars'] } } } }, inicial)
    await b.m.desarValoracio({ ...inicial, seccions: { 'constitucio:tipus': { valors: { principal: 'deficienciaYin' } } } }, inicial)
    await sincronitzar(a.db, a.clau, drive)
    await sincronitzar(b.db, b.clau, drive)
    await sincronitzar(a.db, a.clau, drive)
    for (const x of [a, b]) {
      const [v] = await x.m.valoracionsDe(a.s.episodiId)
      expect(v!.seccions).toEqual({
        'anamnesi:son': { valors: { alteracions: ['despertars'] } },
        'constitucio:tipus': { valors: { principal: 'deficienciaYin' } },
      })
      expect(await x.db.conflictes.count()).toBe(0)
    }
  })

  it('en ajuntar dues fitxes, la valoració segueix el seu episodi (i torna si es desfà)', async () => {
    const { m, p, s } = await ambEpisodi()
    await m.desarValoracio(novaValoracio(s.episodiId, 1, s.id))
    const altra = await m.crearPacient(pacientInventat())
    const camps = compararFitxes(await m.dadesPerAjuntar(altra.id), await m.dadesPerAjuntar(p.id))
    await m.ajuntarPacients(altra.id, p.id, dadesAjuntades(camps, {}))
    const [v] = await m.valoracionsDe(s.episodiId)
    expect(v!.pacientId).toBe(altra.id)
    await m.desferAjuntament(p.id)
    expect((await m.valoracionsDe(s.episodiId))[0]!.pacientId).toBe(p.id)
  })
})
