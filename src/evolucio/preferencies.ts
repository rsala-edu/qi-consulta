// La vista dels punts més usats (barres, llista o al mapa): es recorda a cada
// dispositiu (una comoditat, no dades del pacient). Si el navegador no deixa
// guardar-ho, es torna a les barres.

export const VISTES_PUNTS = ['barres', 'llista', 'mapa'] as const
export type VistaPunts = (typeof VISTES_PUNTS)[number]

const CLAU = 'qi-evolucio-vista'

export function vistaPuntsInicial(): VistaPunts {
  try {
    const v = localStorage.getItem(CLAU)
    return (VISTES_PUNTS as readonly string[]).includes(v ?? '') ? (v as VistaPunts) : 'barres'
  } catch {
    return 'barres'
  }
}

export function desarVistaPunts(v: VistaPunts): void {
  try {
    localStorage.setItem(CLAU, v)
  } catch {
    // No passa res: la propera vegada, barres
  }
}
