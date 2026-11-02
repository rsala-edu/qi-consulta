// «Detalls tècnics» de la còpia, per copiar i enviar: la versió de l'app,
// els formats, l'empremta curta de les claus (4 caràcters d'un hash, mai la
// clau) i l'última còpia correcta. Cap dada clínica.

import { useEffect, useState } from 'react'
import { empremtaCurta, idClau } from '../crypto'
import { t } from '../i18n/t'
import { useClauMestra, useSessio } from '../sessio/ContextSessio'
import { useSincronia } from '../sincronia/ContextSincronia'
import type { InfoDrive } from '../sincronia/sincronitzar'

/** Versió del format de la còpia que fa aquesta app (copia.ts) */
const FORMAT_COPIA = 1

export function textDetalls(d: {
  versioApp: string
  baseDades: number
  infoDrive: InfoDrive | null
  clauLocal: string | null
  darreraCorrecta: string | null
}): string {
  const drive = d.infoDrive
    ? `Drive: format ${d.infoDrive.versio ?? '—'}, clau ${empremtaCurta(d.infoDrive.clauId)}`
    : 'Drive: —'
  return [
    `Qi ${d.versioApp}`,
    `format ${FORMAT_COPIA} (base de dades v${d.baseDades})`,
    drive,
    `dispositiu: clau ${empremtaCurta(d.clauLocal)}`,
    `última còpia correcta: ${d.darreraCorrecta ?? 'cap'}`,
  ].join(' · ')
}

export function DetallsTecnics() {
  const { db } = useSessio()
  const clau = useClauMestra()
  const { infoDrive, darreraCorrecta } = useSincronia()
  const [clauLocal, setClauLocal] = useState<string | null>(null)
  const [copiat, setCopiat] = useState(false)
  useEffect(() => {
    let actiu = true
    void idClau(clau).then((id) => actiu && setClauLocal(id))
    return () => {
      actiu = false
    }
  }, [clau])
  const text = textDetalls({
    versioApp: import.meta.env.VITE_VERSIO_APP ?? 'dev',
    baseDades: db.verno,
    infoDrive,
    clauLocal,
    darreraCorrecta,
  })
  return (
    <p className="detalls-tecnics detall">
      <span>{t.sincronia.detalls}: </span>
      <code data-testid="detalls-tecnics">{text}</code>
      <button
        type="button"
        className="enllac-secundari"
        onClick={() =>
          void navigator.clipboard?.writeText(text).then(
            () => setCopiat(true),
            () => setCopiat(false),
          )
        }
      >
        {copiat ? t.sincronia.detallsCopiats : t.sincronia.copiarDetalls}
      </button>
    </p>
  )
}
