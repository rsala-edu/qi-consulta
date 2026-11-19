// Dret d'accés i de portabilitat (RGPD, articles 15 i 20) (etapa 4D): totes
// les dades d'un pacient en un format estructurat i llegible per màquina
// (JSON), desxifrades. Botó a la fitxa del pacient > Dades: «Exportar totes
// les dades». Abans, es baixen de Drive les imatges i els fitxers que no són al
// dispositiu (completarFitxers).
// Les imatges de les fotos i els fitxers dels documents (també els anul·lats,
// que formen part de la història) s'hi inclouen en base64 si són al dispositiu.

import type { Magatzem } from '../db/magatzem'
import { bytesABase64 } from '../consentiment/pdf'
import { baixarImatge } from '../fotos/driveImatges'
import type { Drive } from '../sincronia/drive'

/**
 * Baixa de Drive les imatges de les fotos i els fitxers dels documents d'un
 * pacient que no són al dispositiu. Torna quants no s'han pogut baixar.
 */
export async function completarFitxers(magatzem: Magatzem, drive: Drive | null, pacientId: string): Promise<number> {
  const [fotos, documents] = await Promise.all([magatzem.fotosDe(pacientId), magatzem.documentsDe(pacientId)])
  let falten = 0
  const baixar = async (id: string, desar: (text: string) => Promise<void>) => {
    const text = drive ? await baixarImatge(drive, id).catch(() => null) : null
    if (text) await desar(text)
    else falten++
  }
  for (const f of fotos.filter((x) => !x.esborrada)) if (!(await magatzem.imatgeDe(f.id))) await baixar(f.id, (t) => magatzem.desarImatgeBaixada(f.id, t))
  for (const d of documents) if (!(await magatzem.fitxerDocument(d.id))) await baixar(d.id, (t) => magatzem.desarFitxerDocumentBaixat(d.id, t))
  return falten
}

/** Nom del fitxer: «qi-dades-aina-provencal-2026-11-19.json» (sense accents ni espais) */
export function nomFitxerExportacio(nom: string, ara = new Date()): string {
  const net = nom
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `qi-dades-${net || 'pacient'}-${ara.toISOString().slice(0, 10)}.json`
}

export const FORMAT_EXPORTACIO = 'qi-exportacio-pacient'

export async function exportarDadesPacient(magatzem: Magatzem, pacientId: string, ara = new Date()) {
  const pacient = await magatzem.obtenirPacient(pacientId)
  if (!pacient) throw new Error(`No existeix el pacient ${pacientId}`)
  const [fitxaClinica, cites, episodis, sessions, consentiments, fotos, documents] = await Promise.all([
    magatzem.obtenirFitxaClinica(pacientId),
    magatzem.citesDelPacient(pacientId),
    magatzem.llistarEpisodis(pacientId),
    magatzem.sessionsDelPacient(pacientId),
    magatzem.consentimentsDe(pacientId),
    magatzem.fotosDe(pacientId),
    magatzem.documentsDe(pacientId),
  ])
  const valoracions = (await Promise.all(episodis.map((e) => magatzem.valoracionsDe(e.id)))).flat()
  const addendes = (await Promise.all(sessions.map((s) => magatzem.addendesDe(s.id)))).flat()
  const imatges = await Promise.all(
    fotos.filter((f) => !f.esborrada).map(async (f) => {
      const jpeg = await magatzem.imatgeDe(f.id)
      return { fotoId: f.id, jpegBase64: jpeg ? bytesABase64(jpeg) : null }
    }),
  )
  const fitxersDocuments = await Promise.all(
    documents.map(async (d) => {
      const bytes = await magatzem.fitxerDocument(d.id)
      return { documentId: d.id, format: d.format, base64: bytes ? bytesABase64(bytes) : null }
    }),
  )
  return {
    format: FORMAT_EXPORTACIO,
    versio: 1,
    generatAt: ara.toISOString(),
    pacient,
    fitxaClinica,
    cites,
    episodis,
    valoracions,
    sessions,
    addendes,
    consentiments,
    fotos,
    imatges,
    documents,
    fitxersDocuments,
  }
}
