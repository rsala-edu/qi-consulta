// El símbol de Qi (public/logo). Decoratiu: el nom «Qi» sempre va escrit al costat.

export function Simbol({ mida = 36, clar = false }: { mida?: number; clar?: boolean }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo/${clar ? 'qi-simbol-clar' : 'qi-simbol'}.svg`}
      alt=""
      width={mida}
      height={mida}
      draggable={false}
    />
  )
}
