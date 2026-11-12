// Publicació: conserva els trossos (assets/) de la versió que hi ha publicada
// ara, perquè una pestanya oberta amb aquella versió encara els pugui carregar
// després del desplegament. Només una generació: es copien els fitxers que
// llista el trossos.json publicat (els de la versió anterior, no els que
// aquella ja conservava).
//
//   node scripts/conservar-anteriors.mjs dist https://<usuari>.github.io/qi-consulta/
//
// Si no es pot (primera publicació, sense connexió), es publica igualment.
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [dist, url] = process.argv.slice(2)
if (!dist || !url) {
  console.error('Ús: node scripts/conservar-anteriors.mjs <dist> <url publicada>')
  process.exit(1)
}
const base = url.endsWith('/') ? url : `${url}/`

// Els trossos d'aquesta versió (abans d'afegir-hi els de l'anterior)
const propis = readdirSync(join(dist, 'assets')).map((f) => `assets/${f}`)

let anteriors = []
try {
  const r = await fetch(`${base}trossos.json`, { cache: 'no-store' })
  if (r.ok) anteriors = (await r.json()).fitxers ?? []
  else console.log(`Sense trossos.json publicat (${r.status}): no es conserva res`)
} catch (e) {
  console.log(`No s'ha pogut llegir el trossos.json publicat: ${e}`)
}

let copiats = 0
for (const f of anteriors) {
  if (!/^assets\/[\w.-]+$/.test(f) || existsSync(join(dist, f))) continue
  try {
    const r = await fetch(base + f)
    if (!r.ok) continue
    writeFileSync(join(dist, f), Buffer.from(await r.arrayBuffer()))
    copiats++
  } catch {
    // Un fitxer que no es pot baixar: es continua amb els altres
  }
}

writeFileSync(join(dist, 'trossos.json'), JSON.stringify({ fitxers: propis }))
console.log(`Trossos propis: ${propis.length}; conservats de la versió anterior: ${copiats}`)
