// El símbol de Qi (public/logo). Decoratiu: el nom «Qi» sempre va escrit al costat.
// Amb el tema fosc (del sistema o triat), la versió clara del símbol: hi
// són totes dues i el CSS en mostra una, perquè segueixi el tema sense esperar.

export function Simbol({ mida = 36, clar = false }: { mida?: number; clar?: boolean }) {
  const base = `${import.meta.env.BASE_URL}logo/`
  const img = (fitxer: string, classe?: string) => (
    <img className={classe} src={`${base}${fitxer}.svg`} alt="" width={mida} height={mida} draggable={false} />
  )
  if (clar) return img('qi-simbol-clar')
  return (
    <>
      {img('qi-simbol', 'simbol-tema-clar')}
      {img('qi-simbol-clar', 'simbol-tema-fosc')}
    </>
  )
}
