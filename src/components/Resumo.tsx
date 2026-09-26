import type { ResultadoTop5 } from "../services/bacen";
import { formatarDataBr, formatarPct } from "../utils/formatos";

interface Props {
  resultado: ResultadoTop5;
  onCopiar: (texto: string) => void;
}

export function Resumo({ resultado: r, onCopiar }: Props) {
  const mediaMes = formatarPct(r.mediaAoMes);

  return (
    <div className="kpis">
      <div className="kpi kpi-destaque">
        <div className="kpi-label">Taxa média a.m. (top 5)</div>
        <div className="kpi-valor">
          {mediaMes}
          <small>%</small>
        </div>
        <button className="btn-mini" type="button" title="Copiar taxa média" onClick={() => onCopiar(mediaMes)}>
          Copiar
        </button>
      </div>
      <div className="kpi">
        <div className="kpi-label">Taxa média a.a. (top 5)</div>
        <div className="kpi-valor">
          {formatarPct(r.mediaAoAno)}
          <small>%</small>
        </div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Período BACEN</div>
        <div className="kpi-valor kpi-texto">
          {formatarDataBr(r.periodoInicio)} a {formatarDataBr(r.periodoFim)}
        </div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Instituições ranqueadas</div>
        <div className="kpi-valor">{r.totalInstituicoes}</div>
      </div>
    </div>
  );
}
