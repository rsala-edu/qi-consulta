// Tipus de visita automàtic. Per a cada pacient, la cita més antiga que no
// s'ha anul·lat (ni s'ha quedat sense presentar-s'hi) és la «Primera visita» i
// totes les posteriors són «Seguiment». Excepcions:
// - Les cites fetes no es toquen mai (l'historial no canvia), però compten:
//   una visita feta abans fa que les següents siguin seguiments.
// - Una cita marcada com a «Nou episodi» (un problema nou) és primera visita
//   encara que n'hi hagi d'anteriors.
// Només es recalculen les cites programades.

import type { Cita, EstatCita, TipusCita } from './cita'

export type CitaPerTipus = Pick<Cita, 'id' | 'pacientId' | 'inici' | 'tipus' | 'estat' | 'nouEpisodi'>

/** Les cites anul·lades o no presentades no compten per saber quina és la primera */
const compta = (estat: EstatCita) => estat === 'programada' || estat === 'feta'

/** El tipus que li toca a cada cita que compta (les fetes, el que ja tenen) */
export function tipusCalculats(cites: readonly CitaPerTipus[]): Map<string, TipusCita> {
  const perPacient = new Map<string, CitaPerTipus[]>()
  for (const c of cites) {
    if (!compta(c.estat)) continue
    const llista = perPacient.get(c.pacientId) ?? []
    llista.push(c)
    perPacient.set(c.pacientId, llista)
  }
  const resultat = new Map<string, TipusCita>()
  for (const llista of perPacient.values()) {
    llista.sort((a, b) => a.inici.localeCompare(b.inici) || a.id.localeCompare(b.id))
    llista.forEach((c, i) => {
      const tipus: TipusCita = c.estat === 'feta' ? c.tipus : i === 0 || c.nouEpisodi ? 'primera' : 'seguiment'
      resultat.set(c.id, tipus)
    })
  }
  return resultat
}

/** Cites programades que han de canviar de tipus */
export function canvisDeTipus<C extends CitaPerTipus>(cites: readonly C[]): { cita: C; tipus: TipusCita }[] {
  const calculats = tipusCalculats(cites)
  return cites
    .filter((c) => c.estat === 'programada' && calculats.get(c.id) !== undefined && calculats.get(c.id) !== c.tipus)
    .map((c) => ({ cita: c, tipus: calculats.get(c.id)! }))
}
