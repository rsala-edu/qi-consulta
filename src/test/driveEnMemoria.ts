// Google Drive en memòria, per a les proves.
import { ErrorDrive, type Drive, type FitxerDrive } from '../sincronia/drive'

export function driveEnMemoria(): Drive & { fitxers: Map<string, FitxerDrive & { contingut: string }> } {
  const fitxers = new Map<string, FitxerDrive & { contingut: string }>()
  let rellotge = 0
  const ara = () => new Date(Date.UTC(2026, 10, 2, 10, 0, rellotge++)).toISOString()
  const sense = ({ contingut: _c, ...f }: FitxerDrive & { contingut: string }) => f
  return {
    fitxers,
    async llistar() {
      return [...fitxers.values()].map(sense)
    },
    async baixar(id) {
      const f = fitxers.get(id)
      if (!f) throw new ErrorDrive(404)
      return f.contingut
    },
    async crear(nom, contingut) {
      const f = { id: crypto.randomUUID(), name: nom, modifiedTime: ara(), contingut }
      fitxers.set(f.id, f)
      return sense(f)
    },
    async actualitzar(id, contingut) {
      const f = fitxers.get(id)
      if (!f) throw new ErrorDrive(404)
      Object.assign(f, { contingut, modifiedTime: ara() })
      return sense(f)
    },
    async esborrar(id) {
      fitxers.delete(id)
    },
  }
}
