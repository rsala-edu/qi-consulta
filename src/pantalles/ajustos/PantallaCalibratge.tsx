// Eina interna de calibratge: col·locar els punts del catàleg sobre la pell
// del model (raycast), arrossegar-los i exportar el catàleg amb les posicions.
// Les posicions es guarden al dispositiu fins que s'exporten.

import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Boto } from "../../components/Boto";
import { Indicador } from "../../components/Indicador";
import { formatar, t } from "../../i18n/t";
import { BarraVistes } from "../../mapa/components/BarraVistes";
import {
  Visor3D,
  type ControlVisor,
  type MarcadorVisor,
  type TocPell,
} from "../../mapa/components/Visor3D";
import {
  COSTAT_OPOSAT,
  posicio3D,
  posicioDesDePunt,
  posicioMirall,
} from "../../mapa/geometria/baricentriques";
import { idMarcador, puntsSobreModel } from "../../mapa/marcadors";
import type { ModelCos } from "../../mapa/model";
import { useCalibracions } from "../../mapa/useCalibracions";
import { useModelCos } from "../../mapa/useModelCos";
import { usePrecaucions } from "../../mapa/usePrecaucions";
import {
  REVISIO_BUIDA,
  ambPrecaucions,
  cataleg,
  costatsDe,
  exportarCataleg,
  posicioDe,
} from "../../punts/cataleg";
import type { CostatPosicio } from "../../punts/esquema";

export function PantallaCalibratge() {
  const carrega = useModelCos();
  return (
    <main className="pantalla-mapa">
      <div className="capcalera-mapa">
        <Link className="enllac-tornar" to="/ajustos">
          ← {t.ajustos.titol}
        </Link>
        <h1>{t.calibratge.titol}</h1>
      </div>
      {carrega.estat === "carregant" && (
        <Indicador text={t.mapa.carregantModel} />
      )}
      {carrega.estat === "error" && <p role="alert">{t.app.errorInesperat}</p>}
      {carrega.estat === "llest" && <Calibratge model={carrega.dades} />}
    </main>
  );
}

function Calibratge({ model }: { model: ModelCos }) {
  const visor = useRef<ControlVisor>(null);
  const { calibracions, efectiu, desar, descartarTot } = useCalibracions(
    model.topologia,
  );
  const { revisio } = usePrecaucions();
  const [meridia, setMeridia] = useState(cataleg.meridians[0]!.codi);
  const [seleccionat, setSeleccionat] = useState<string | null>(null);
  const [costat, setCostat] = useState<CostatPosicio>("E");
  /** Subpunt, per als codis que en tenen (Jiaji, Baxie…) */
  const [subpunt, setSubpunt] = useState(0);
  const [missatge, setMissatge] = useState("");

  const puntsMeridia = efectiu.punts.filter((p) => p.meridia === meridia);
  const punt = efectiu.punts.find((p) => p.codi === seleccionat);
  const costats: CostatPosicio[] = punt ? costatsDe(cataleg, punt) : ["E", "D"];
  const bilateral = costats.length > 1;
  const sobreModel = useMemo(
    () => puntsSobreModel(efectiu, model),
    [efectiu, model],
  );
  const idSeleccionat = seleccionat
    ? idMarcador(seleccionat, costat, subpunt)
    : null;

  const marcadors: MarcadorVisor[] = useMemo(
    () =>
      sobreModel.map((p) => {
        const curta = `${p.punt.codi} ${p.costat}`;
        const llarga = `${curta} · ${p.punt.pinyin}`;
        return {
          id: p.id,
          punt: p.posicio,
          normal: p.normal,
          color: p.punt.codi === seleccionat ? "#2f5d50" : undefined,
          destacat: p.id === idSeleccionat,
          etiquetes: {
            cos: curta,
            codi: curta,
            pinyin: llarga,
            detall: llarga,
          },
        };
      }),
    [sobreModel, seleccionat, idSeleccionat],
  );

  const colocar = (toc: TocPell, immediat: boolean) => {
    if (!seleccionat) return;
    const pos = posicioDesDePunt(model.geometria, toc.triangle, toc.punt);
    desar(
      seleccionat,
      costat,
      posicio3D(model.topologia, costat, pos, "manual", subpunt),
      immediat,
      subpunt,
    );
  };

  const triar = (codi: string, c: CostatPosicio = costat, i = 0) => {
    const p = efectiu.punts.find((x) => x.codi === codi);
    const possibles: CostatPosicio[] = p ? costatsDe(cataleg, p) : ["E", "D"];
    const k = possibles.includes(c) ? c : possibles[0]!;
    setSeleccionat(codi);
    setCostat(k);
    setSubpunt(i);
    setMissatge("");
    const actual = sobreModel.find((x) => x.id === idMarcador(codi, k, i));
    if (actual) visor.current?.anarA(actual.posicio, actual.normal);
  };

  const index = puntsMeridia.findIndex((p) => p.codi === seleccionat);
  const posActual = punt
    ? posicioDe(punt, model.topologia, costat, subpunt)
    : undefined;
  const n = sobreModel.length;

  function exportar() {
    const blob = new Blob(
      [exportarCataleg(ambPrecaucions(efectiu, revisio ?? REVISIO_BUIDA))],
      {
        type: "application/json",
      },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cataleg.json";
    a.click();
    URL.revokeObjectURL(url);
    setMissatge(t.calibratge.exportat);
  }

  async function descartar() {
    if (!window.confirm(t.calibratge.confirmarDescartar)) return;
    await descartarTot();
  }

  return (
    <div className="disseny-mapa">
      <div className="columna-visor">
        <div className="zona-visor">
          {!model.definitiu && (
            <p className="avis avis-flotant">{t.mapa.maniquiProvisional}</p>
          )}
          <Visor3D
            ref={visor}
            geometria={model.geometria}
            marcadors={marcadors}
            modeToc="pell"
            etiquetesSempre
            onTocarPell={(toc) => colocar(toc, true)}
            arrossegable={posActual ? idSeleccionat : null}
            onArrossegar={(toc) => colocar(toc, false)}
          />
        </div>
        <div className="barra-visor">
          <BarraVistes visor={visor} />
        </div>
      </div>

      <aside className="panell-mapa">
        <p className="detall">
          {t.calibratge.model}:{" "}
          {model.definitiu ? t.calibratge.definitiu : t.calibratge.provisional}{" "}
          ·{" "}
          {n === 1
            ? t.calibratge.progres.u
            : formatar(t.calibratge.progres.altres, { n: String(n) })}
        </p>
        <p>{t.calibratge.instruccions}</p>

        <label className="camp">
          <span>{t.mapa.meridia}</span>
          <select value={meridia} onChange={(e) => setMeridia(e.target.value)}>
            {cataleg.meridians.map((m) => (
              <option key={m.codi} value={m.codi}>
                {m.codi} · {m.nom}
              </option>
            ))}
          </select>
        </label>

        <ul className="llista-punts" aria-label={t.calibratge.llistaPunts}>
          {puntsMeridia.map((p) => (
            <li key={p.codi}>
              <button
                type="button"
                className={p.codi === seleccionat ? "actiu" : ""}
                aria-pressed={p.codi === seleccionat}
                onClick={() => triar(p.codi)}
              >
                <span className="codi">{p.codi}</span>
                <span className="pinyin">{p.pinyin}</span>
                <span className="estat-costats">
                  {costatsDe(cataleg, p).map((c) => (
                    <span
                      key={c}
                      className={posicioDe(p, model.topologia, c) ? "fet" : ""}
                    >
                      {c}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {punt ? (
          <div className="punt-seleccionat">
            <h2>
              {punt.codi} · {punt.pinyin} <span lang="zh">{punt.hanzi}</span>
            </h2>
            <div
              className="segmentat"
              role="radiogroup"
              aria-label={t.mapa.costatTitol}
            >
              {costats.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={costat === c}
                  onClick={() => triar(punt.codi, c, subpunt)}
                >
                  {t.mapa.costat[c]}
                </button>
              ))}
            </div>
            {punt.subpunts && (
              <label className="camp">
                <span>{t.mapa.subpunt}</span>
                <select
                  value={subpunt}
                  onChange={(e) =>
                    triar(punt.codi, costat, Number(e.target.value))
                  }
                >
                  {punt.subpunts.map((nom, i) => (
                    <option key={nom} value={i}>
                      {nom}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="accions accions-esquerra">
              {bilateral && (
                <Boto
                  variant="secundari"
                  disabled={!posActual}
                  onClick={() => {
                    if (!posActual) return;
                    const oposat = COSTAT_OPOSAT[costat];
                    const mirall = posicioMirall(model.geometria, posActual);
                    desar(
                      punt.codi,
                      oposat,
                      posicio3D(
                        model.topologia,
                        oposat,
                        mirall,
                        "manual",
                        subpunt,
                      ),
                      true,
                      subpunt,
                    );
                  }}
                >
                  {t.calibratge.copiarOposat}
                </Boto>
              )}
              <Boto
                variant="discret"
                disabled={!posActual}
                onClick={() => desar(punt.codi, costat, null, true, subpunt)}
              >
                {t.calibratge.esborrar}
              </Boto>
            </div>
            <div className="accions accions-esquerra">
              <Boto
                variant="discret"
                disabled={index <= 0}
                onClick={() => triar(puntsMeridia[index - 1]!.codi)}
              >
                ← {t.calibratge.anterior}
              </Boto>
              <Boto
                variant="discret"
                disabled={index >= puntsMeridia.length - 1}
                onClick={() => triar(puntsMeridia[index + 1]!.codi)}
              >
                {t.calibratge.seguent} →
              </Boto>
            </div>
          </div>
        ) : (
          <p className="buit">{t.calibratge.capSeleccionat}</p>
        )}

        <div className="accions accions-esquerra">
          <Boto onClick={exportar}>{t.calibratge.exportar}</Boto>
          <Boto
            variant="discret"
            onClick={() => void descartar()}
            disabled={calibracions.length === 0}
          >
            {t.calibratge.descartar}
          </Boto>
        </div>
        <p className="avis-desat" role="status">
          {missatge}
        </p>
      </aside>
    </div>
  );
}
