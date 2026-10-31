/** Indicador d'espera accessible (es llegeix amb el lector de pantalla). */
export function Indicador({ text }: { text: string }) {
  return (
    <span className="indicador" role="status" aria-live="polite">
      <span className="indicador-roda" aria-hidden="true" />
      {text}
    </span>
  )
}
