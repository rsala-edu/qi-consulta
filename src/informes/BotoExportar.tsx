// «Exportar totes les dades» (dret d'accés i de portabilitat, RGPD arts. 15 i
// 20): un fitxer JSON amb totes les dades del pacient, desxifrades, i les
// imatges i els documents en base64. Abans d'exportar, avisa que el fitxer surt
// de l'app sense xifrar, i baixa de Drive el que no sigui al dispositiu.

import { useState } from 'react'
import { Boto } from '../components/Boto'
import { nomComplet, type Pacient } from '../domini/pacient'
import { formatar, t } from '../i18n/t'
import { useMagatzem } from '../sessio/ContextSessio'
import { useSincronia } from '../sincronia/ContextSincronia'
import { completarFitxers, exportarDadesPacient, nomFitxerExportacio } from './exportacio'

const x = t.exportacio

export function BotoExportar({ pacient }: { pacient: Pacient }) {
  const magatzem = useMagatzem()
  const { driveImatges } = useSincronia()
  const [estat, setEstat] = useState<'res' | 'preparant' | 'fet' | 'error'>('res')
  const [falten, setFalten] = useState(0)

  async function exportar() {
    if (!window.confirm(x.avis)) return
    setEstat('preparant')
    try {
      setFalten(await completarFitxers(magatzem, driveImatges(), pacient.id))
      const dades = await exportarDadesPacient(magatzem, pacient.id)
      const url = URL.createObjectURL(new Blob([JSON.stringify(dades, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = nomFitxerExportacio(nomComplet(pacient))
      document.body.append(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setEstat('fet')
    } catch {
      setEstat('error')
    }
  }

  return (
    <>
      <Boto variant="discret" onClick={() => void exportar()} disabled={estat === 'preparant'} title={x.ajuda}>
        {estat === 'preparant' ? x.preparant : x.exportar}
      </Boto>
      {estat === 'fet' && (
        <p className="avis-suau" role="status">
          {x.fet}
          {falten > 0 && ` ${formatar(x.falten, { n: String(falten) })}`}
        </p>
      )}
      {estat === 'error' && <p role="alert">{x.error}</p>}
    </>
  )
}
