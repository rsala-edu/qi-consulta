import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { vigilarTrossos } from './actualitzacio/trossos'
import { LimitError, resumError, textResum } from './components/LimitError'
import { QiDB } from './db/esquema'
import { espaiInicial } from './sessio/espais'
import { googleConfigurat } from './sincronia/google'
import './estils/tipografia.css'
import './estils/global.css'

vigilarTrossos()

// Amb Google: l'espai de l'últim compte que s'ha fet servir (o cap encara).
// Sense Google (proves locals): una sola base de dades.
const db = googleConfigurat() ? await espaiInicial() : new QiDB()

// React escriu per defecte el missatge sencer de l'error, que podria portar
// dades d'un pacient: els límits (LimitError) ja n'escriuen el resum, i aquí
// només queda el que no ha atrapat cap límit
createRoot(document.getElementById('root')!, {
  onCaughtError: () => {},
  onUncaughtError: (error, info) => console.error(textResum(resumError('UI-ARREL', error, info))),
  onRecoverableError: (error, info) => console.warn(textResum(resumError('UI-RECUPERAT', error, info))),
}).render(
  <StrictMode>
    <LimitError codi="UI-APP">
      <App db={db} />
    </LimitError>
  </StrictMode>,
)
