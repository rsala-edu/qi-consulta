// Mida i intensitat dels punts a la vista «Al mapa» segons quantes sessions s'han fet servir

/** Quatre graus d'ús: de jade molt suau a jade fosc, i cada cop més grans */
export const GRAUS_US = [
  { color: '#a9cbbd', escala: 1 },
  { color: '#6fa38f', escala: 1.35 },
  { color: '#3f7d66', escala: 1.7 },
  { color: '#1f4a3d', escala: 2.1 },
] as const

export function grauUs(sessions: number, maxim: number): (typeof GRAUS_US)[number] {
  const i = maxim <= 1 ? GRAUS_US.length - 1 : Math.min(GRAUS_US.length - 1, Math.floor(((sessions - 1) / (maxim - 1)) * GRAUS_US.length))
  return GRAUS_US[Math.max(0, i)]!
}
