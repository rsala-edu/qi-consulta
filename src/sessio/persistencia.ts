// Emmagatzematge persistent: sense, el navegador pot esborrar les dades
// d'aquest lloc si li falta espai (i el Safari, després de 7 dies sense fer
// servir l'app si no és a la pantalla d'inici). Es demana en configurar el
// dispositiu; a Ajustos > Seguretat es veu si el navegador ho ha concedit.

import type { QiDB } from '../db/esquema'

export type EstatPersistencia = 'concedida' | 'no-concedida' | 'no-disponible'

export async function estatPersistencia(): Promise<EstatPersistencia> {
  try {
    if (!navigator.storage?.persisted) return 'no-disponible'
    return (await navigator.storage.persisted()) ? 'concedida' : 'no-concedida'
  } catch {
    return 'no-disponible'
  }
}

/** Demana al navegador que no esborri mai les dades (no pregunta res a la doctora en la majoria de navegadors) */
export async function demanarPersistencia(db: QiDB): Promise<EstatPersistencia> {
  let estat: EstatPersistencia = 'no-disponible'
  try {
    if (navigator.storage?.persist) estat = (await navigator.storage.persist()) ? 'concedida' : 'no-concedida'
  } catch {
    // Res: es veurà a Seguretat
  }
  await db.meta.put({ clau: 'persistencia', valor: { estat, at: new Date().toISOString() } })
  return estat
}

/**
 * Sembla una finestra privada (d'incògnit)? Cap navegador ho diu: es dedueix
 * de la quota d'emmagatzematge, que en privat és molt més petita. Pot
 * equivocar-se en un disc gairebé ple.
 */
export async function semblaFinestraPrivada(): Promise<boolean> {
  try {
    const { quota } = await navigator.storage.estimate()
    return quota !== undefined && quota < 1.2 * 1024 ** 3
  } catch {
    return false
  }
}
