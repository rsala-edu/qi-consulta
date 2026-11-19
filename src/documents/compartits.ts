// Els fitxers rebuts amb «Compartir → Qi» (etapa 4E), que el service worker
// (public/compartir-sw.js) guarda a la base de dades «qi-compartits» fins que
// l'app, desbloquejada, els xifra. No estan xifrats: s'esborren en desar-los o
// descartar-los, i sols els que fa més de 24 hores que hi són.

export const BD_COMPARTITS = 'qi-compartits'
const MAGATZEM = 'fitxers'
export const CADUCITAT_COMPARTITS_MS = 24 * 3_600_000

export interface Compartit {
  id: number
  nom: string
  tipus: string
  blob: Blob
  rebutAt: string
}

function obrir(): Promise<IDBDatabase> {
  return new Promise((resol, falla) => {
    const r = indexedDB.open(BD_COMPARTITS, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(MAGATZEM, { keyPath: 'id', autoIncrement: true })
    r.onsuccess = () => resol(r.result)
    r.onerror = () => falla(r.error)
  })
}

function peticio<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resol, falla) => {
    r.onsuccess = () => resol(r.result)
    r.onerror = () => falla(r.error)
  })
}

/** Els fitxers compartits que esperen (els caducats, fora) */
export async function llegirCompartits(ara = Date.now()): Promise<Compartit[]> {
  const bd = await obrir()
  try {
    const tots = await peticio(bd.transaction(MAGATZEM).objectStore(MAGATZEM).getAll() as IDBRequest<Compartit[]>)
    const caducats = tots.filter((c) => ara - Date.parse(c.rebutAt) > CADUCITAT_COMPARTITS_MS)
    if (caducats.length) await esborrarDe(bd, caducats.map((c) => c.id))
    return tots.filter((c) => !caducats.includes(c))
  } finally {
    bd.close()
  }
}

async function esborrarDe(bd: IDBDatabase, ids: readonly number[]): Promise<void> {
  const tx = bd.transaction(MAGATZEM, 'readwrite')
  for (const id of ids) tx.objectStore(MAGATZEM).delete(id)
  await new Promise<void>((resol, falla) => {
    tx.oncomplete = () => resol()
    tx.onerror = () => falla(tx.error)
  })
}

/** Esborra els compartits (desats a Qi, ja xifrats, o descartats) */
export async function esborrarCompartits(ids: readonly number[]): Promise<void> {
  const bd = await obrir()
  try {
    await esborrarDe(bd, ids)
  } finally {
    bd.close()
  }
}

/** Com a fitxers, per desar-los com els que es trien a mà */
export const comAFitxer = (c: Compartit): File => new File([c.blob], c.nom, { type: c.tipus || c.blob.type })
