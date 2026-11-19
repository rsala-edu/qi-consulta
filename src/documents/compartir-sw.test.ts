// @vitest-environment node
// L'script del service worker que rep «Compartir → Qi» (public/compartir-sw.js):
// desa els fitxers del formulari a «qi-compartits» i redirigeix a #/compartir.
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CADUCITAT_COMPARTITS_MS, esborrarCompartits, llegirCompartits } from './compartits'

type Gestor = (e: { request: Request; respondWith(r: Promise<Response>): void }) => void

function carregarScript(): Gestor {
  const gestors: Gestor[] = []
  const self = { addEventListener: (tipus: string, g: Gestor) => tipus === 'fetch' && gestors.push(g) }
  const codi = readFileSync(new URL('../../public/compartir-sw.js', import.meta.url), 'utf8')
  new Function('self', 'indexedDB', codi)(self, indexedDB)
  return gestors[0]!
}

async function enviar(gestor: Gestor, request: Request): Promise<Response | null> {
  let resposta: Promise<Response> | null = null
  gestor({ request, respondWith: (r) => (resposta = r) })
  return resposta ? await resposta : null
}

describe('«Compartir → Qi» (service worker)', () => {
  it('desa els fitxers compartits i obre l\'app a #/compartir; la resta de peticions no les toca', async () => {
    const gestor = carregarScript()
    const form = new FormData()
    form.append('titol', 'Informe')
    form.append('fitxers', new File([new Uint8Array([1, 2, 3])], 'IMG-0001.jpg', { type: 'image/jpeg' }))
    form.append('fitxers', new File(['%PDF-1.7 inventat'], 'analitica.pdf', { type: 'application/pdf' }))
    const r = await enviar(gestor, new Request('https://exemple.invalid/qi-consulta/compartir', { method: 'POST', body: form }))
    expect(r?.status).toBe(303)
    expect(r?.headers.get('location')).toBe('https://exemple.invalid/qi-consulta/#/compartir')

    const rebuts = await llegirCompartits()
    expect(rebuts.map((c) => [c.nom, c.tipus])).toEqual([
      ['IMG-0001.jpg', 'image/jpeg'],
      ['analitica.pdf', 'application/pdf'],
    ])
    expect(new Uint8Array(await rebuts[0]!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))

    // Un GET (o una altra ruta) passa de llarg
    expect(await enviar(gestor, new Request('https://exemple.invalid/qi-consulta/compartir'))).toBeNull()
    expect(await enviar(gestor, new Request('https://exemple.invalid/qi-consulta/altre', { method: 'POST' }))).toBeNull()

    // Desats o descartats: fora; i els de fa més de 24 hores, també
    await esborrarCompartits([rebuts[0]!.id])
    expect(await llegirCompartits()).toHaveLength(1)
    expect(await llegirCompartits(Date.now() + CADUCITAT_COMPARTITS_MS + 60_000)).toEqual([])
    expect(await llegirCompartits()).toEqual([])
  })
})
