// Ajustos > Quant a: la versió de l'app (la mateixa dels detalls tècnics), si
// n'hi ha una de nova i el format de les dades.

import { useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { useActualitzacio, VERSIO_APP } from '../../actualitzacio/actualitzacio'
import { formatar, t } from '../../i18n/t'
import { useSessio } from '../../sessio/ContextSessio'
import { NIVELL_APP, VERSIO_FORMAT } from '../../sincronia/format2'

export function PantallaQuantA() {
  const { db } = useSessio()
  const { versioNova, versioPublicada, actualitzar, buscar } = useActualitzacio()
  const [buscant, setBuscant] = useState(false)
  const q = t.quantA
  const data = import.meta.env.VITE_DATA_APP
  return (
    <main className="pantalla">
      <Link className="enllac-tornar" to="/ajustos">
        ← {t.ajustos.titol}
      </Link>
      <h1>{q.titol}</h1>
      <section className="panell" aria-label={q.versio}>
        <h2>{q.versio}</h2>
        <p data-testid="versio-app">{formatar(q.versioApp, { versio: VERSIO_APP })}</p>
        {data && <p className="detall">{formatar(q.compilada, { data: new Date(data).toLocaleString('ca') })}</p>}
        <p className="detall">
          {formatar(q.format, { format: String(VERSIO_FORMAT), nivell: String(NIVELL_APP), base: String(db.verno) })}
        </p>
        {versioNova ? (
          <>
            <p role="status">{versioPublicada ? formatar(q.novaAmb, { versio: versioPublicada }) : t.app.versioNova}</p>
            <Boto onClick={actualitzar}>{t.app.actualitzar}</Boto>
          </>
        ) : (
          <Boto
            variant="discret"
            disabled={buscant}
            onClick={() => {
              setBuscant(true)
              void buscar().finally(() => setBuscant(false))
            }}
          >
            {buscant ? q.buscant : q.buscar}
          </Boto>
        )}
      </section>
      <section className="panell" aria-label={q.programari}>
        <h2>{q.programari}</h2>
        <p className="detall">{q.programariDesc}</p>
        <ul className="llista-programari">
          {PROGRAMARI.map((p) => (
            <li key={p.nom}>
              <strong>{p.nom}</strong> · {p.llicencia}
              {p.nota && <span className="detall"> · {p.nota}</span>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

/** Les biblioteques que van dins l'app i la seva llicència */
const PROGRAMARI: readonly { nom: string; llicencia: string; nota?: string }[] = [
  { nom: 'React', llicencia: 'MIT' },
  { nom: 'React Router', llicencia: 'MIT' },
  { nom: 'Dexie.js', llicencia: 'Apache 2.0' },
  { nom: 'Three.js', llicencia: 'MIT' },
  { nom: 'React Three Fiber i drei', llicencia: 'MIT' },
  { nom: 'React Hook Form', llicencia: 'MIT' },
  { nom: 'Zod', llicencia: 'MIT' },
  { nom: 'pdf-lib', llicencia: 'MIT' },
  { nom: 'PDF.js (Mozilla)', llicencia: 'Apache 2.0', nota: 'visor de PDF' },
  { nom: 'heic2any', llicencia: 'MIT', nota: 'inclou libheif (LGPL 3.0), per convertir les fotos HEIC' },
  { nom: 'Workbox', llicencia: 'MIT' },
]
