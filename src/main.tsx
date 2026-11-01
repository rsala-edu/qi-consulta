import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { QiDB } from './db/esquema'
import './estils/tipografia.css'
import './estils/global.css'

const db = new QiDB()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App db={db} />
  </StrictMode>,
)
