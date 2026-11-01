// Calcula la posició de tots els punts amb regla (estàndard de l'OMS) sobre
// el cos definitiu i les escriu a src/punts/cataleg.json.
//
//   npm run punts:calcular
//
// Conserva les posicions d'altres topologies i les corregides per la doctora.

import { readFileSync, writeFileSync } from 'node:fs'
import { modelDesDeGlb } from '../src/mapa/model'
import { exportarCataleg } from '../src/punts/cataleg'
import { esquemaCataleg } from '../src/punts/esquema'
import { calcularPunts } from '../src/punts/oms/calcular'

const arrel = new URL('..', import.meta.url).pathname
const glb = readFileSync(`${arrel}public/models/cos.glb`)
const model = await modelDesDeGlb(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength))
const dades = JSON.parse(readFileSync(`${arrel}src/punts/articulacions.json`, 'utf8'))
const cataleg = esquemaCataleg.parse(JSON.parse(readFileSync(`${arrel}src/punts/cataleg.json`, 'utf8')))

const { punts } = calcularPunts(model, dades)
const perCodi = new Map<string, typeof punts>()
for (const p of punts) perCodi.set(p.codi, [...(perCodi.get(p.codi) ?? []), p])

let calculats = 0
const nou = {
  ...cataleg,
  punts: cataleg.punts.map((p) => {
    const calculs = perCodi.get(p.codi)
    if (!calculs) return p
    // Les correccions de la doctora sobre aquest model es mantenen
    const clau = (costat: string, index = 0) => `${costat}|${index}`
    const corregits = new Set(
      p.posicions
        .filter((q) => q.topologia === model.topologia && q.origen === 'doctora')
        .map((q) => clau(q.costat, q.index)),
    )
    const altres = p.posicions.filter((q) => q.topologia !== model.topologia || q.origen === 'doctora')
    const noves = calculs.filter((k) => !corregits.has(clau(k.costat, k.index))).map((k) => k.posicio)
    calculats += noves.length
    return { ...p, posicions: [...altres, ...noves] }
  }),
}

writeFileSync(`${arrel}src/punts/cataleg.json`, exportarCataleg(nou))
console.log(`${calculats} posicions calculades sobre ${model.topologia}`)
