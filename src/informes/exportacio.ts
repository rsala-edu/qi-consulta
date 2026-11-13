// Dret d'accés i de portabilitat (RGPD, articles 15 i 20) (etapa 4D): totes
// les dades d'un pacient en un format estructurat i llegible per màquina
// (JSON), desxifrades. Queda preparat, encara sense botó a la interfície.
// Les imatges de les fotos s'hi inclouen (en base64) si són al dispositiu.

import type { Magatzem } from '../db/magatzem'
import { bytesABase64 } from '../consentiment/pdf'

export const FORMAT_EXPORTACIO = 'qi-exportacio-pacient'

export async function exportarDadesPacient(magatzem: Magatzem, pacientId: string, ara = new Date()) {
  const pacient = await magatzem.obtenirPacient(pacientId)
  if (!pacient) throw new Error(`No existeix el pacient ${pacientId}`)
  const [fitxaClinica, cites, episodis, sessions, consentiments, fotos] = await Promise.all([
    magatzem.obtenirFitxaClinica(pacientId),
    magatzem.citesDelPacient(pacientId),
    magatzem.llistarEpisodis(pacientId),
    magatzem.sessionsDelPacient(pacientId),
    magatzem.consentimentsDe(pacientId),
    magatzem.fotosDe(pacientId),
  ])
  const valoracions = (await Promise.all(episodis.map((e) => magatzem.valoracionsDe(e.id)))).flat()
  const addendes = (await Promise.all(sessions.map((s) => magatzem.addendesDe(s.id)))).flat()
  const imatges = await Promise.all(
    fotos.filter((f) => !f.esborrada).map(async (f) => {
      const jpeg = await magatzem.imatgeDe(f.id)
      return { fotoId: f.id, jpegBase64: jpeg ? bytesABase64(jpeg) : null }
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
  }
}
