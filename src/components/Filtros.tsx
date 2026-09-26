import { SEGMENTOS, type Segmento } from "../services/bacen";
import { DATA_MINIMA, hojeIso } from "../utils/datas";
import { IconeBusca } from "./Icones";

interface Props {
  data: string;
  segmento: Segmento;
  modalidade: string;
  modalidades: string[];
  carregandoModalidades: boolean;
  dicaModalidades: string;
  consultando: boolean;
  onData: (data: string) => void;
  onSegmento: (segmento: Segmento) => void;
  onModalidade: (modalidade: string) => void;
  onConsultar: () => void;
}

const ROTULO_SEGMENTO: Record<Segmento, string> = {
  "PESSOA FÍSICA": "Pessoa Física",
  "PESSOA JURÍDICA": "Pessoa Jurídica",
};

export function Filtros(p: Props) {
  const podeConsultar = !p.carregandoModalidades && !p.consultando && !!p.modalidade;

  return (
    <section className="card filtros">
      <div className="campo">
        <label htmlFor="inpData">Data de referência</label>
        <input
          id="inpData"
          type="date"
          value={p.data}
          min={DATA_MINIMA}
          max={hojeIso()}
          onChange={(e) => e.target.value && p.onData(e.target.value)}
        />
        <small>Histórico disponível desde 02/01/2012</small>
      </div>

      <div className="campo">
        <span className="label">Segmento</span>
        <div className="segmented" role="radiogroup" aria-label="Segmento">
          {SEGMENTOS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={p.segmento === s}
              className={p.segmento === s ? "ativo" : undefined}
              onClick={() => p.onSegmento(s)}
            >
              {ROTULO_SEGMENTO[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="campo campo-largo">
        <label htmlFor="selModalidade">Modalidade de crédito</label>
        <div className="select-wrap">
          <select
            id="selModalidade"
            value={p.modalidade}
            disabled={p.carregandoModalidades || !p.modalidades.length}
            onChange={(e) => p.onModalidade(e.target.value)}
          >
            {p.carregandoModalidades ? (
              <option>Carregando modalidades…</option>
            ) : p.modalidades.length ? (
              p.modalidades.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))
            ) : (
              <option>Nenhuma modalidade encontrada</option>
            )}
          </select>
        </div>
        <small>{p.dicaModalidades || " "}</small>
      </div>

      <div className="campo campo-acao">
        <button className="btn-primario" type="button" disabled={!podeConsultar} onClick={p.onConsultar}>
          <IconeBusca />
          Consultar BACEN
        </button>
      </div>
    </section>
  );
}
