// So del final de la retenció: tres pitits d'uns 0,4 s (sense cap fitxer: es
// genera amb Web Audio). El volum (0–100) és a Ajustos > Visita, amb «Provar el so».

/** Durada de cada pitit i de l'espai entre pitits (segons) */
export const PITIT = { durada: 0.4, espai: 0.22, vegades: 3, hz: 880 } as const

/** Guany màxim per a un volum de 0 a 100 (corba quadràtica: l'oïda no és lineal) */
export function guanyDeVolum(volum: number): number {
  const v = Math.min(100, Math.max(0, volum)) / 100
  return 0.6 * v * v
}

/** Tres pitits; no fa res amb volum 0 o sense Web Audio (l'avís visual ja hi és) */
export function soAvis(volum: number): void {
  const guanyMax = guanyDeVolum(volum)
  if (guanyMax <= 0) return
  try {
    const ctx = new AudioContext()
    const t0 = ctx.currentTime + 0.05
    let final = t0
    for (let i = 0; i < PITIT.vegades; i++) {
      const inici = t0 + i * (PITIT.durada + PITIT.espai)
      const osc = ctx.createOscillator()
      const guany = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = PITIT.hz
      // Entrada i sortida suaus (sense espetecs)
      guany.gain.setValueAtTime(0.0001, inici)
      guany.gain.exponentialRampToValueAtTime(guanyMax, inici + 0.03)
      guany.gain.setValueAtTime(guanyMax, inici + PITIT.durada - 0.06)
      guany.gain.exponentialRampToValueAtTime(0.0001, inici + PITIT.durada)
      osc.connect(guany).connect(ctx.destination)
      osc.start(inici)
      osc.stop(inici + PITIT.durada + 0.02)
      final = inici + PITIT.durada + 0.05
    }
    window.setTimeout(() => void ctx.close(), (final - ctx.currentTime) * 1000 + 200)
  } catch {
    // Sense so: l'avís visual ja hi és
  }
}
