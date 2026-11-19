// «Compartir → Qi» (etapa 4E, Web Share Target). El service worker hi importa
// aquest fitxer (workbox.importScripts). Quan una altra app (la galeria,
// WhatsApp…) comparteix fitxers amb Qi, el navegador els envia per POST a
// /qi-consulta/compartir: es guarden en una base de dades a part
// (qi-compartits) i s'obre l'app a #/compartir, on, un cop desbloquejada, es
// tria el pacient, es xifren i s'esborren d'aquí. Mentre esperen no estan
// xifrats (l'app encara no té la clau): l'app els esborra en desar-los o
// descartar-los, i els que fa més de 24 hores que hi són.
/* global self, indexedDB */

const QI_COMPARTITS = { bd: 'qi-compartits', magatzem: 'fitxers' }

function qiObrirCompartits() {
  return new Promise((resol, falla) => {
    const r = indexedDB.open(QI_COMPARTITS.bd, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(QI_COMPARTITS.magatzem, { keyPath: 'id', autoIncrement: true })
    r.onsuccess = () => resol(r.result)
    r.onerror = () => falla(r.error)
  })
}

async function qiDesarCompartits(fitxers) {
  const bd = await qiObrirCompartits()
  await new Promise((resol, falla) => {
    const tx = bd.transaction(QI_COMPARTITS.magatzem, 'readwrite')
    const m = tx.objectStore(QI_COMPARTITS.magatzem)
    const ara = new Date().toISOString()
    for (const f of fitxers) m.add({ nom: f.name || 'fitxer', tipus: f.type || '', blob: f, rebutAt: ara })
    tx.oncomplete = resol
    tx.onerror = () => falla(tx.error)
  })
  bd.close()
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || !/\/compartir\/?$/.test(url.pathname)) return
  event.respondWith(
    (async () => {
      const base = url.pathname.replace(/compartir\/?$/, '')
      try {
        const dades = await event.request.formData()
        const fitxers = dades.getAll('fitxers').filter((f) => typeof f === 'object' && f !== null && 'arrayBuffer' in f)
        await qiDesarCompartits(fitxers)
        return Response.redirect(new URL(`${base}#/compartir`, url.origin).href, 303)
      } catch (e) {
        console.error('Qi: no s\'han pogut desar els fitxers compartits', e)
        return Response.redirect(new URL(`${base}#/compartir?error=1`, url.origin).href, 303)
      }
    })(),
  )
})
