// «Desvincular aquest dispositiu»: esborra les dades locals d'aquest compte
// (base de dades, clau, empremta, ajustos del dispositiu) quan tot ja és a
// Google Drive. Drive no es toca mai: les dades es poden tornar a recuperar
// en qualsevol dispositiu amb la contrasenya.

import { base64ABytes, desbloquejarClauMestra } from '../crypto'
import { QiDB } from '../db/esquema'
import { llegirClauEmbolcallada, llegirSecrets } from '../db/magatzem'
import { pendentsDePujar } from '../sincronia/escriptura'
import { oblidarPermis } from '../sincronia/google'
import { oblidarEspai } from './espais'

/** La paraula que cal escriure per confirmar-ho */
export const PARAULA_CONFIRMACIO = 'DESVINCULAR'

export class ErrorPendents extends Error {
  readonly pendents: number
  constructor(pendents: number) {
    super(`Hi ha ${pendents} canvis pendents de pujar`)
    this.name = 'ErrorPendents'
    this.pendents = pendents
  }
}

const base64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/**
 * Comprova la contrasenya i que no queda res pendent, demana al navegador que
 * retiri les empremtes (passkeys) d'aquest espai i esborra la base de dades.
 * `sincronitzar`: es fa una sincronia just abans, perquè tot sigui a Drive.
 */
export async function desvincular(db: QiDB, contrasenya: string, sincronitzar: () => Promise<boolean>): Promise<void> {
  const embolcall = await llegirClauEmbolcallada(db)
  if (!embolcall) throw new Error('No hi ha contrasenya')
  // Llança ErrorContrasenya si no és la bona: no es toca res
  await desbloquejarClauMestra(embolcall, contrasenya)
  if (!(await sincronitzar())) throw new ErrorPendents(await pendentsDePujar(db))
  const pendents = await pendentsDePujar(db)
  if (pendents > 0) throw new ErrorPendents(pendents)

  // L'empremta: sense la seva part desada aquí ja no obre res; a més, si el
  // navegador ho permet, se li demana que la retiri del gestor de claus
  const senyal = (globalThis.PublicKeyCredential as unknown as { signalUnknownCredential?: (o: { rpId: string; credentialId: string }) => Promise<void> } | undefined)
    ?.signalUnknownCredential
  for (const s of await llegirSecrets(db)) {
    if (s.tipus !== 'passkey' || !s.credencial || !senyal) continue
    await senyal({ rpId: location.hostname, credentialId: base64url(base64ABytes(s.credencial)) }).catch(() => {})
  }

  const nom = db.name
  db.close()
  await QiDB.delete(nom)
  oblidarEspai(nom)
  try {
    for (const k of Object.keys(localStorage)) if (k.endsWith(`:${nom}`)) localStorage.removeItem(k)
  } catch {
    // Sense emmagatzematge: no hi ha res a treure
  }
  oblidarPermis()
}
