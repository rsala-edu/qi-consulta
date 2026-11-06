// Un espai per compte de Google: cada compte té la seva base de dades local
// (amb la seva clau mestra, la seva empremta i els seus ajustos). El nom de la
// base de dades depèn de l'identificador estable del compte (`sub`), passat
// per SHA-256: ni el correu ni el `sub` no hi surten mai en clar.
//
// La llista d'espais d'aquest navegador (només els noms) és a localStorage,
// per saber quin s'ha d'obrir en arrencar sense haver d'entrar amb Google.
//
// Les versions anteriors tenien una sola base de dades, «qi»: es copia a
// l'espai del compte que la va crear i després s'esborra.

import { QiDB } from '../db/esquema'

/** Base de dades de les versions anteriors (una per a tot el navegador) */
export const BASE_ANTIGA = 'qi'
const CLAU_ESPAIS = 'qi.espais'
const CLAU_ACTUAL = 'qi.espaiActual'
const PREFIX = 'qi-'

export async function nomEspai(sub: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`qi:compte:${sub}`))
  const hex = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${PREFIX}${hex.slice(0, 16)}`
}

export const esNomEspai = (nom: string) => /^qi-[0-9a-f]{16}$/.test(nom)

function llegir<T>(clau: string, perDefecte: T): T {
  try {
    const v = window.localStorage.getItem(clau)
    return v === null ? perDefecte : (JSON.parse(v) as T)
  } catch {
    return perDefecte
  }
}

function escriure(clau: string, valor: unknown): void {
  try {
    window.localStorage.setItem(clau, JSON.stringify(valor))
  } catch {
    // Sense emmagatzematge: en tornar a obrir caldrà entrar amb Google
  }
}

/** Els espais d'aquest navegador, del més recent al més antic */
export function espaisConeguts(): string[] {
  const llista = llegir<unknown>(CLAU_ESPAIS, [])
  return Array.isArray(llista) ? llista.filter((x): x is string => typeof x === 'string' && esNomEspai(x)) : []
}

/** Aquest espai és el que es farà servir ara (i el primer en tornar a obrir) */
export function marcarEspaiActual(nom: string): void {
  escriure(CLAU_ESPAIS, [nom, ...espaisConeguts().filter((x) => x !== nom)])
  escriure(CLAU_ACTUAL, nom)
}

/** Treu l'espai de la llista (desvincular el dispositiu) */
export function oblidarEspai(nom: string): void {
  const resta = espaisConeguts().filter((x) => x !== nom)
  escriure(CLAU_ESPAIS, resta)
  if (llegir<string | null>(CLAU_ACTUAL, null) === nom) escriure(CLAU_ACTUAL, resta[0] ?? null)
}

async function existeix(nom: string): Promise<boolean> {
  if (typeof indexedDB.databases === 'function') return (await indexedDB.databases()).some((d) => d.name === nom)
  // Sense la llista de bases de dades: s'obre (sense crear-la, si es pot) per mirar-ho
  return new Promise((resoldre) => {
    const r = indexedDB.open(nom)
    let nova = false
    r.onupgradeneeded = () => {
      nova = true
      r.transaction?.abort()
    }
    r.onsuccess = () => {
      r.result.close()
      resoldre(!nova)
    }
    r.onerror = () => resoldre(false)
  })
}

/** Copia totes les taules d'una base de dades a una altra (els registres xifrats, tal qual) */
export async function copiarBase(origen: QiDB, desti: QiDB): Promise<void> {
  await origen.open()
  await desti.open()
  const taules = origen.tables.map((t) => t.name)
  const contingut = new Map<string, unknown[]>()
  for (const t of taules) contingut.set(t, await origen.table(t).toArray())
  await desti.transaction('rw', taules, async () => {
    for (const t of taules) await desti.table(t).bulkPut(contingut.get(t)!)
  })
  for (const t of taules) {
    if ((await desti.table(t).count()) < contingut.get(t)!.length) throw new Error(`Còpia incompleta: ${t}`)
  }
}

async function subDe(db: QiDB): Promise<string | null> {
  const g = await db.meta.get('google')
  return g?.clau === 'google' && g.valor.sub ? g.valor.sub : null
}

async function teClau(db: QiDB): Promise<boolean> {
  return (await db.meta.get('clauMestra')) !== undefined
}

/**
 * Copia la base de dades antiga a l'espai del compte i l'esborra. Si l'espai
 * ja té dades (una migració anterior que no va poder esborrar l'antiga), no
 * se sobreescriu res: només s'esborra l'antiga.
 */
export async function migrarBaseAntiga(antiga: QiDB, sub: string): Promise<QiDB> {
  const nom = await nomEspai(sub)
  const nova = new QiDB(nom)
  if (!(await teClau(nova))) await copiarBase(antiga, nova)
  antiga.close()
  await QiDB.delete(BASE_ANTIGA).catch(() => {})
  marcarEspaiActual(nom)
  return nova
}

/**
 * L'espai que s'obre en arrencar: el de l'últim compte que s'ha fet servir. Si
 * hi ha la base de dades d'abans, es migra (si se sap de quin compte és) o
 * s'obre tal qual fins que es connecti amb Google. null: cap espai.
 */
export async function espaiInicial(): Promise<QiDB | null> {
  if (await existeix(BASE_ANTIGA)) {
    const antiga = new QiDB(BASE_ANTIGA)
    const sub = await subDe(antiga)
    if (sub) return migrarBaseAntiga(antiga, sub)
    if (await teClau(antiga)) return antiga
    antiga.close()
    await QiDB.delete(BASE_ANTIGA).catch(() => {})
  }
  for (const nom of espaisConeguts()) {
    if (await existeix(nom)) return new QiDB(nom)
    oblidarEspai(nom)
  }
  return null
}

/** Obre (o crea) l'espai del compte i el marca com a actual */
export async function obrirEspai(sub: string): Promise<QiDB> {
  const nom = await nomEspai(sub)
  marcarEspaiActual(nom)
  return new QiDB(nom)
}
