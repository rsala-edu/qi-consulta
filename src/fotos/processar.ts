// Preparar una foto abans de desar-la (etapa 4C): es redibuixa en un canvas a
// 1.600 px pel costat llarg (girada bé segons l'orientació de la càmera) i es
// torna a codificar en JPEG al 80 %. Redibuixar-la ja deixa enrere les
// metadades del fitxer original; a més, treureExif ho comprova al JPEG final.

import { COSTAT_MAXIM, COSTAT_MINIATURA, midaReduida, QUALITAT_JPEG, treureExif } from '../domini/foto'

export interface ImatgePreparada {
  jpeg: Uint8Array
  amplada: number
  alcada: number
  miniatura: string
}

type Origen = Blob | HTMLVideoElement

async function dibuixable(origen: Origen): Promise<{ font: CanvasImageSource; amplada: number; alcada: number }> {
  if (origen instanceof Blob) {
    // L'orientació EXIF s'aplica en dibuixar-la (la foto no surt girada)
    const b = await createImageBitmap(origen, { imageOrientation: 'from-image' })
    return { font: b, amplada: b.width, alcada: b.height }
  }
  return { font: origen, amplada: origen.videoWidth, alcada: origen.videoHeight }
}

function canvas(font: CanvasImageSource, amplada: number, alcada: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = amplada
  c.height = alcada
  c.getContext('2d')!.drawImage(font, 0, 0, amplada, alcada)
  return c
}

const aBlob = (c: HTMLCanvasElement, qualitat: number) =>
  new Promise<Blob>((resol, falla) => c.toBlob((b) => (b ? resol(b) : falla(new Error('No s\'ha pogut codificar la imatge'))), 'image/jpeg', qualitat))

export async function prepararImatge(origen: Origen): Promise<ImatgePreparada> {
  const { font, amplada, alcada } = await dibuixable(origen)
  const mida = midaReduida(amplada, alcada, COSTAT_MAXIM)
  const gran = canvas(font, mida.amplada, mida.alcada)
  const jpeg = treureExif(new Uint8Array(await (await aBlob(gran, QUALITAT_JPEG)).arrayBuffer()))
  const petita = midaReduida(mida.amplada, mida.alcada, COSTAT_MINIATURA)
  const miniatura = canvas(gran, petita.amplada, petita.alcada).toDataURL('image/jpeg', 0.7)
  return { jpeg, amplada: mida.amplada, alcada: mida.alcada, miniatura }
}

/** URL temporal d'una imatge JPEG (cal revocar-la) */
export function urlJpeg(jpeg: Uint8Array): string {
  return URL.createObjectURL(new Blob([jpeg.buffer as ArrayBuffer], { type: 'image/jpeg' }))
}
