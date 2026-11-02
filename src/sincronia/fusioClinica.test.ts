import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { crearClauMestra, xifrarJson } from '../crypto'
import { QiDB } from '../db/esquema'
import { context, crearMagatzem, guardarClauEmbolcallada } from '../db/magatzem'
import { fitxaClinicaBuida } from '../domini/fitxaClinica'
import { fitxaInventada, pacientInventat } from '../test/dadesInventades'
import { driveEnMemoria } from '../test/driveEnMemoria'
import { restaurarCopia } from './recuperacio'
import { copiaDeDrive, sincronitzar } from './sincronitzar'

const DIA = new Date('2026-11-02T10:00:00Z')
const obertes: QiDB[] = []
afterEach(async () => {
  for (const db of obertes.splice(0)) await db.delete()
})
const espera = () => new Promise((r) => setTimeout(r, 5))

async function dispositiuA() {
  const db = new QiDB(`prova-${crypto.randomUUID()}`)
  obertes.push(db)
  const { embolcall, clau } = await crearClauMestra('contrasenya-de-prova', 1000)
  await guardarClauEmbolcallada(db, embolcall)
  return { db, clau, m: crearMagatzem(db, clau) }
}

async function dispositiuNou(drive: ReturnType<typeof driveEnMemoria>, clau: CryptoKey) {
  const db = new QiDB(`prova-${crypto.randomUUID()}`)
  obertes.push(db)
  await restaurarCopia(db, clau, (await copiaDeDrive(drive))!)
  return { db, clau, m: crearMagatzem(db, clau) }
}

/** Una fitxa clínica amb un id aleatori, com les feien les versions anteriors */
async function fitxaAmbIdAntic(db: QiDB, clau: CryptoKey, pacientId: string, dades: object, at: string) {
  const id = crypto.randomUUID()
  await db.fitxesCliniques.put({
    id,
    pacientId,
    creatAt: at,
    modificatAt: at,
    xifrat: await xifrarJson(clau, { ...fitxaClinicaBuida(), ...dades }, context('fitxesCliniques', id)),
  })
  return id
}

describe('les dades clíniques mai es descarten en silenci', () => {
  it('la mateixa fitxa editada als dos dispositius: camps diferents es combinen; el mateix camp, guanya el més nou i l\'altre queda per revisar', async () => {
    const drive = driveEnMemoria()
    const a = await dispositiuA()
    const p = await a.m.crearPacient(pacientInventat())
    await a.m.desarFitxaClinica(p.id, fitxaInventada())
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await dispositiuNou(drive, a.clau)
    await espera()

    await a.m.desarFitxaClinica(p.id, { ...fitxaInventada(), alergies: 'Pols', medicacioActual: 'Paracetamol' })
    await espera()
    await b.m.desarFitxaClinica(p.id, { ...fitxaInventada(), habits: { ...fitxaInventada().habits, tabac: 'No' }, medicacioActual: 'Ibuprofèn' })

    await sincronitzar(a.db, a.clau, drive, DIA)
    await sincronitzar(b.db, b.clau, drive, DIA)
    await sincronitzar(a.db, a.clau, drive, DIA)
    for (const d of [a, b]) {
      const f = await d.m.obtenirFitxaClinica(p.id)
      expect(f.alergies).toBe('Pols')
      expect(f.habits.tabac).toBe('No')
      expect(f.medicacioActual).toBe('Ibuprofèn')
      const conflictes = await d.m.conflictesDe(f.id)
      expect(conflictes.map((c) => [c.camp, c.valor])).toEqual([['medicacioActual', 'Paracetamol']])
    }

    // Revisat: desapareix als dos dispositius
    const [c] = await b.m.conflictesDe((await b.m.obtenirFitxaClinica(p.id)).id)
    await b.m.resoldreConflicte(c!.conflicteId, c!.camp)
    await sincronitzar(b.db, b.clau, drive, DIA)
    await sincronitzar(a.db, a.clau, drive, DIA)
    expect(await a.m.conflictesDe((await a.m.obtenirFitxaClinica(p.id)).id)).toEqual([])
  })

  it('editada només en un dispositiu: cap conflicte', async () => {
    const drive = driveEnMemoria()
    const a = await dispositiuA()
    const p = await a.m.crearPacient(pacientInventat())
    await a.m.desarFitxaClinica(p.id, fitxaInventada())
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await dispositiuNou(drive, a.clau)
    await espera()
    await b.m.desarFitxaClinica(p.id, { ...fitxaInventada(), alergies: 'Pols' })
    await sincronitzar(b.db, b.clau, drive, DIA)
    await sincronitzar(a.db, a.clau, drive, DIA)
    const f = await a.m.obtenirFitxaClinica(p.id)
    expect(f.alergies).toBe('Pols')
    expect(await a.m.conflictesDe(f.id)).toEqual([])
  })

  it('dues fitxes del mateix pacient amb ids diferents (versions anteriors): es fusionen en una, sense perdre res', async () => {
    const drive = driveEnMemoria()
    const a = await dispositiuA()
    const p = await a.m.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await dispositiuNou(drive, a.clau)
    await fitxaAmbIdAntic(a.db, a.clau, p.id, { alergies: 'Pols', medicacioActual: 'Paracetamol' }, '2026-11-02T09:00:00.000Z')
    await fitxaAmbIdAntic(b.db, b.clau, p.id, { antecedentsFamiliars: 'Mare amb migranya', medicacioActual: 'Ibuprofèn' }, '2026-11-02T09:30:00.000Z')

    await sincronitzar(a.db, a.clau, drive, DIA)
    await sincronitzar(b.db, b.clau, drive, DIA)
    await sincronitzar(a.db, a.clau, drive, DIA)
    for (const d of [a, b]) {
      expect(await d.db.fitxesCliniques.count()).toBe(1)
      const f = await d.m.obtenirFitxaClinica(p.id)
      expect(f).toMatchObject({ alergies: 'Pols', antecedentsFamiliars: 'Mare amb migranya', medicacioActual: 'Ibuprofèn' })
      expect((await d.m.conflictesDe(f.id)).map((c) => [c.camp, c.valor])).toEqual([['medicacioActual', 'Paracetamol']])
    }
  })

  it('recupera de les còpies de Drive una fitxa que una versió anterior havia descartat', async () => {
    const drive = driveEnMemoria()
    const a = await dispositiuA()
    const p = await a.m.crearPacient(pacientInventat())
    const perduda = await fitxaAmbIdAntic(a.db, a.clau, p.id, { alergies: 'Penicil·lina', medicacioActual: 'Omeprazol' }, '2026-11-01T09:00:00.000Z')
    // La còpia diària d'ahir la té
    await sincronitzar(a.db, a.clau, drive, new Date('2026-11-01T10:00:00Z'))
    // La versió anterior la va descartar (sense deixar rastre) i se'n va quedar una altra
    await a.db.fitxesCliniques.delete(perduda)
    await a.db.meta.delete('fitxesRecuperades')
    await fitxaAmbIdAntic(a.db, a.clau, p.id, { medicacioActual: 'Ibuprofèn' }, '2026-11-01T11:00:00.000Z')
    const principal = [...drive.fitxers.values()].find((f) => f.name === 'qi-dades.json')!
    drive.fitxers.delete(principal.id)

    await sincronitzar(a.db, a.clau, drive, DIA)
    expect(await a.db.fitxesCliniques.count()).toBe(1)
    const f = await a.m.obtenirFitxaClinica(p.id)
    expect(f).toMatchObject({ alergies: 'Penicil·lina', medicacioActual: 'Ibuprofèn' })
    expect((await a.m.conflictesDe(f.id)).map((c) => [c.camp, c.valor])).toEqual([['medicacioActual', 'Omeprazol']])
    expect(await a.db.meta.get('fitxesRecuperades')).toMatchObject({ valor: { recuperades: 1 } })
  })
})
