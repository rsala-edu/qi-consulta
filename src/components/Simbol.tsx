// El símbol de Qi (public/logo). Decoratiu: el nom «Qi» sempre va escrit al costat.
// Amb el mode fosc del sistema, la versió clara del símbol.

export function Simbol({ mida = 36, clar = false }: { mida?: number; clar?: boolean }) {
  const base = `${import.meta.env.BASE_URL}logo/`
  return (
    <picture>
      {!clar && <source srcSet={`${base}qi-simbol-clar.svg`} media="(prefers-color-scheme: dark)" />}
      <img
        src={`${base}${clar ? 'qi-simbol-clar' : 'qi-simbol'}.svg`}
        alt=""
        width={mida}
        height={mida}
        draggable={false}
      />
    </picture>
  )
}
