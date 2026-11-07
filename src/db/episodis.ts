// Una sola vegada per dispositiu (etapa 3A): les cites d'abans reben un
// episodi. Per a cada pacient amb cites, un episodi amb el motiu de la seva
// primera visita; a partir de cada cita amb «Nou episodi», un altre
// (domini/episodi.ts, migracioEpisodis). Els ids depenen de la cita: si dos
// dispositius migren alhora, creen els mateixos episodis.

import { migracioEpisodis } from '../domini/episodi'
import type { QiDB } from './esquema'
import type { Magatzem } from './magatzem'

export async function migrarEpisodis(db: QiDB, magatzem: Magatzem): Promise<number> {
  if (await db.meta.get('episodisMigrats')) return 0
  const cites = await magatzem.llistarCites('0000', '9999')
  const { episodis, assignacions } = migracioEpisodis(cites)
  for (const { id, pacientId, ...dades } of episodis) {
    if (!(await magatzem.obtenirEpisodi(id))) await magatzem.crearEpisodi(pacientId, dades, id)
  }
  for (const { citaId, episodiId } of assignacions) {
    const c = cites.find((x) => x.id === citaId)!
    const { id: _i, creatAt: _c, modificatAt: _m, ...dades } = c
    await magatzem.actualitzarCita(citaId, { ...dades, episodiId }, { ...dades })
  }
  await db.meta.put({ clau: 'episodisMigrats', valor: new Date().toISOString() })
  return episodis.length
}
