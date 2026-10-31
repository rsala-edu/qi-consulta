// Entorn per a proves de pantalles: router en memòria i esborranys amb
// un magatzem real (IndexedDB simulada i una clau de prova).
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { QiDB } from '../db/esquema'
import { crearMagatzem, type Magatzem } from '../db/magatzem'
import { ProveidorEsborranys } from '../sessio/ContextEsborranys'
import { clauDeProva } from './dadesInventades'

export async function nouMagatzem(): Promise<{ db: QiDB; magatzem: Magatzem }> {
  const db = new QiDB(`prova-${crypto.randomUUID()}`)
  return { db, magatzem: crearMagatzem(db, await clauDeProva()) }
}

export function renderAmbEsborranys(ui: ReactElement, magatzem: Magatzem, ruta = '/') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveidorEsborranys magatzem={magatzem}>{ui}</ProveidorEsborranys>
    </MemoryRouter>,
  )
}
