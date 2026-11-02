import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { LimitError, resumError, textResum } from './components/LimitError'
import { QiDB } from './db/esquema'
import './estils/tipografia.css'
import './estils/global.css'

const db = new QiDB()

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
