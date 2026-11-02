/** Fa que el navegador descarregui un text com a fitxer (al dispositiu; no surt enlloc) */
export function descarregarText(text: string, nom: string, tipus = 'application/octet-stream'): void {
  const url = URL.createObjectURL(new Blob([text], { type: tipus }))
  const a = document.createElement('a')
  a.href = url
  a.download = nom
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
  // Es deixa un moment perquè la descàrrega comenci
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
