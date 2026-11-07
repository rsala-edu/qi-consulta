// Ajustos > Catàlegs: seccions i opcions amagades i l'ordre. No són dades de
// pacient: van sense xifrar i se sincronitzen (com l'horari i Ajustos > Visita).

import { AJUSTOS_CATALEGS_PER_DEFECTE, esquemaAjustosCatalegs, type AjustosCatalegs } from '../cataleg/motor'
import { desarSencer } from '../sincronia/escriptura'
import type { QiDB } from './esquema'

export async function llegirAjustosCatalegs(db: QiDB): Promise<AjustosCatalegs> {
  const r = await db.configuracio.get('catalegs')
  const a = esquemaAjustosCatalegs.safeParse(r?.valor)
  return a.success ? a.data : AJUSTOS_CATALEGS_PER_DEFECTE
}

export async function desarAjustosCatalegs(db: QiDB, a: AjustosCatalegs): Promise<void> {
  await desarSencer(
    db,
    'configuracio',
    { clau: 'catalegs', valor: esquemaAjustosCatalegs.parse(a), modificatAt: new Date().toISOString() },
    'catalegs',
  )
}
