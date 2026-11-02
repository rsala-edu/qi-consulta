/** Busca la versió nova de l'app (service worker) i torna a carregar */
export async function actualitzarApp(): Promise<void> {
  try {
    const registre = await navigator.serviceWorker?.getRegistration()
    await registre?.update()
  } catch {
    // Sense service worker (o sense connexió): es torna a carregar igualment
  }
  window.location.reload()
}
