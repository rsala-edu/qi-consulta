import { actualitzarAra, buscarVersioNova } from '../actualitzacio/actualitzacio'

/** Busca la versió nova de l'app (service worker), hi passa i torna a carregar */
export async function actualitzarApp(): Promise<void> {
  await buscarVersioNova()
  // Una mica de temps perquè s'instal·li, si n'hi ha una de nova
  await new Promise((r) => setTimeout(r, 2_000))
  actualitzarAra()
}
