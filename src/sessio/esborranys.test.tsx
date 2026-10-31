import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QiDB } from '../db/esquema'
import type { Magatzem } from '../db/magatzem'
import { INTERVAL_ESBORRANY } from '../domini/esborrany'
import { dadesPacientBuides } from '../domini/pacient'
import { DialegEsborranys } from '../pantalles/desbloqueig/DialegEsborranys'
import { FormulariPacient } from '../pantalles/pacients/FormulariPacient'
import { nouMagatzem, renderAmbEsborranys } from '../test/entorn'
import { pacientInventat } from '../test/dadesInventades'

const CLAU = 'pacient:nou'
const esborrany = { clau: CLAU, descripcio: 'Nou pacient' }

let db: QiDB
let magatzem: Magatzem

beforeEach(async () => {
  ;({ db, magatzem } = await nouMagatzem())
  // Només simulem l'interval: IndexedDB i userEvent necessiten els setTimeout reals
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
})

afterEach(async () => {
  vi.useRealTimers()
  await db.delete()
})

/**
 * Espera fins que es compleixi una condició sobre IndexedDB. No fem servir
 * waitFor perquè consulta amb setInterval, que aquí és simulat.
 */
async function finsQue(comprovar: () => Promise<unknown>, ms = 2000): Promise<void> {
  const limit = Date.now() + ms
  for (;;) {
    try {
      await comprovar()
      return
    } catch (e) {
      if (Date.now() > limit) throw e
      await new Promise((r) => setTimeout(r, 20))
    }
  }
}

/** Avança l'interval i espera que acabi el desat (xifrat + IndexedDB). */
async function passarInterval() {
  await act(async () => {
    vi.advanceTimersByTime(INTERVAL_ESBORRANY)
  })
}

function formulari(onDesar = vi.fn(() => Promise.resolve())) {
  return <FormulariPacient valorsInicials={dadesPacientBuides()} onDesar={onDesar} esborrany={esborrany} />
}

describe('desat automàtic d\'esborranys', () => {
  it('no desa res si el formulari no té canvis', async () => {
    renderAmbEsborranys(formulari(), magatzem, '/pacients/nou')
    await passarInterval()
    await passarInterval()
    expect(await magatzem.llistarEsborranys()).toEqual([])
  })

  it('cada 5 segons desa un esborrany xifrat dels canvis', async () => {
    const usuari = userEvent.setup()
    renderAmbEsborranys(formulari(), magatzem, '/pacients/nou')
    await usuari.type(screen.getByLabelText('Nom'), 'Aina')
    expect(await magatzem.llistarEsborranys()).toEqual([])

    await passarInterval()
    await finsQue(async () => expect(await magatzem.llistarEsborranys()).toHaveLength(1))
    const [desat] = await magatzem.llistarEsborranys()
    expect(desat).toMatchObject({ clau: CLAU, ruta: '/pacients/nou', descripcio: 'Nou pacient' })
    expect(desat?.valors).toMatchObject({ nom: 'Aina' })

    // A IndexedDB només hi ha la clau del formulari en clar
    const brut = JSON.stringify(await db.esborranys.toArray())
    expect(brut).toContain(CLAU)
    expect(brut).not.toContain('Aina')
    expect(brut).not.toContain('Nou pacient')
  })

  it('actualitza l\'esborrany amb els canvis nous', async () => {
    const usuari = userEvent.setup()
    renderAmbEsborranys(formulari(), magatzem, '/pacients/nou')
    await usuari.type(screen.getByLabelText('Nom'), 'Aina')
    await passarInterval()
    await usuari.type(screen.getByLabelText('Telèfon'), '600 111 222')
    await passarInterval()
    await finsQue(async () =>
      expect((await magatzem.llistarEsborranys())[0]?.valors).toMatchObject({ nom: 'Aina', telefon: '600 111 222' }),
    )
    expect(await db.esborranys.count()).toBe(1)
  })

  it('en desar el formulari, l\'esborrany s\'esborra', async () => {
    const usuari = userEvent.setup()
    renderAmbEsborranys(formulari(), magatzem, '/pacients/nou')
    await usuari.type(screen.getByLabelText('Nom'), 'Aina')
    await passarInterval()
    await finsQue(async () => expect(await db.esborranys.count()).toBe(1))

    await usuari.click(screen.getByRole('button', { name: 'Desar' }))
    await finsQue(async () => expect(await db.esborranys.count()).toBe(0))
    await passarInterval()
    expect(await db.esborranys.count()).toBe(0)
  })

  it('si es desfan els canvis, l\'esborrany s\'esborra', async () => {
    const usuari = userEvent.setup()
    renderAmbEsborranys(formulari(), magatzem, '/pacients/nou')
    await usuari.type(screen.getByLabelText('Nom'), 'A')
    await passarInterval()
    await finsQue(async () => expect(await db.esborranys.count()).toBe(1))

    await usuari.clear(screen.getByLabelText('Nom'))
    await passarInterval()
    await finsQue(async () => expect(await db.esborranys.count()).toBe(0))
  })

  it('en bloquejar (el formulari es desmunta) desa al moment, sense esperar els 5 segons', async () => {
    const usuari = userEvent.setup()
    const { unmount } = renderAmbEsborranys(formulari(), magatzem, '/pacients/nou')
    await usuari.type(screen.getByLabelText('Nom'), 'Aina')
    unmount()
    await finsQue(async () => expect(await db.esborranys.count()).toBe(1))
  })

  it('si el desat del formulari falla, l\'esborrany es conserva', async () => {
    const usuari = userEvent.setup()
    renderAmbEsborranys(formulari(vi.fn(() => Promise.reject(new Error('disc ple')))), magatzem, '/pacients/nou')
    await usuari.type(screen.getByLabelText('Nom'), 'Aina')
    await passarInterval()
    await usuari.click(screen.getByRole('button', { name: 'Desar' }))
    await screen.findByRole('alert')
    expect(await db.esborranys.count()).toBe(1)
  })
})

describe('recuperació en desbloquejar', () => {
  async function ambEsborrany() {
    await magatzem.desarEsborrany(CLAU, {
      ruta: '/pacients/nou',
      descripcio: 'Nou pacient',
      valors: pacientInventat({ nom: 'Aina', telefon: '600 111 222' }),
    })
  }

  function app() {
    return (
      <>
        {formulari()}
        <DialegEsborranys />
      </>
    )
  }

  it('no mostra res si no hi ha esborranys', async () => {
    renderAmbEsborranys(app(), magatzem, '/pacients/nou')
    await screen.findByLabelText('Nom')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ofereix recuperar-lo i, en acceptar, omple el formulari', async () => {
    await ambEsborrany()
    const usuari = userEvent.setup()
    renderAmbEsborranys(app(), magatzem, '/pacients/nou')

    const dialeg = await screen.findByRole('dialog', { name: 'Canvis sense desar' })
    expect(dialeg).toHaveTextContent('Nou pacient')
    expect(screen.getByLabelText('Nom')).toHaveValue('')

    await usuari.click(screen.getByRole('button', { name: 'Recuperar: Nou pacient' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Nom')).toHaveValue('Aina')
    expect(screen.getByLabelText('Telèfon')).toHaveValue('600 111 222')
    expect(screen.getByText(/S'ha recuperat un esborrany/)).toBeInTheDocument()
    // Fins que no es desi, l'esborrany es conserva
    expect(await db.esborranys.count()).toBe(1)
  })

  it('en descartar-lo, l\'esborra i no omple res', async () => {
    await ambEsborrany()
    const usuari = userEvent.setup()
    renderAmbEsborranys(app(), magatzem, '/pacients/nou')

    await usuari.click(await screen.findByRole('button', { name: 'Descartar: Nou pacient' }))

    await finsQue(async () => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Nom')).toHaveValue('')
    expect(await db.esborranys.count()).toBe(0)
  })

  it('«Ara no» tanca el diàleg i el conserva per a la pròxima vegada', async () => {
    await ambEsborrany()
    const usuari = userEvent.setup()
    renderAmbEsborranys(app(), magatzem, '/pacients/nou')

    await usuari.click(await screen.findByRole('button', { name: 'Ara no' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await db.esborranys.count()).toBe(1)
  })
})
