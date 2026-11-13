// Les imatges senceres de les fotos a Google Drive (etapa 4C): un fitxer per
// foto (qi-imatge-<id>.json), amb la imatge xifrada tal com és al dispositiu.
// No van dins el diari: es pugen després de cada sincronia i només es baixen
// quan s'obren. La resta de la sincronia no toca aquests fitxers.

import type { QiDB } from '../db/esquema'
import { nomFitxerImatge, RE_IMATGE } from '../domini/foto'
import type { Drive } from '../sincronia/drive'

/** Puja les imatges que encara no són a Drive. Torna quantes n'ha pujat */
export async function pujarImatgesPendents(db: QiDB, drive: Drive): Promise<number> {
  const pendents = await db.imatges.where('pujada').equals(0).toArray()
  if (pendents.length === 0) return 0
  const existents = new Map((await drive.llistar()).filter((f) => RE_IMATGE.test(f.name)).map((f) => [f.name, f.id]))
  for (const p of pendents) {
    const nom = nomFitxerImatge(p.id)
    const text = JSON.stringify(p.xifrat)
    const id = existents.get(nom)
    if (id) await drive.actualitzar(id, text)
    else await drive.crear(nom, text)
    await db.imatges.update(p.id, { pujada: 1 })
  }
  return pendents.length
}

/** La imatge xifrada d'una foto, de Drive (null si no hi és) */
export async function baixarImatge(drive: Drive, id: string): Promise<string | null> {
  const f = (await drive.llistar()).find((x) => x.name === nomFitxerImatge(id))
  return f ? drive.baixar(f.id) : null
}

/** En esborrar una foto, també el seu fitxer de Drive (si hi és) */
export async function esborrarImatgeDrive(drive: Drive, id: string): Promise<void> {
  const f = (await drive.llistar()).find((x) => x.name === nomFitxerImatge(id))
  if (f) await drive.esborrar(f.id)
}
