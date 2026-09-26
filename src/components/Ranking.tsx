import type { ResultadoTop5 } from "../services/bacen";
import { formatarCnpj8, formatarDataBr, formatarPct } from "../utils/formatos";

interface Props {
  resultado: ResultadoTop5;
}

export function Ranking({ resultado: r }: Props) {
  const maior = Math.max(...r.instituicoes.map((i) => i.TaxaJurosAoMes)) || 1;

  return (
    <div className="card">
      <div className="card-head">
        <h2>{r.modalidade}</h2>
        <p className="muted">
          {r.segmento} · {r.instituicoes.length} instituições com as menores taxas · referência{" "}
          {formatarDataBr(r.dataReferencia)}
        </p>
      </div>
      <ol className="ranking">
        {r.instituicoes.map((i, idx) => (
          <li key={`${i.cnpj8}-${i.Posicao}`} style={{ animationDelay: `${idx * 60}ms` }}>
            <div className="pos">{i.Posicao}º</div>
            <div>
              <div className="inst-nome">{i.InstituicaoFinanceira}</div>
              <div className="inst-cnpj">CNPJ {formatarCnpj8(i.cnpj8)}</div>
            </div>
            <div className="barra-wrap">
              <div className="barra-topo">
                <span>Taxa a.m.</span>
                <strong>{formatarPct(i.TaxaJurosAoMes)}%</strong>
              </div>
              <div className="barra">
                <span style={{ width: `${(i.TaxaJurosAoMes / maior) * 100}%` }} />
              </div>
            </div>
            <div className="taxa-ano">
              <div className="v">{formatarPct(i.TaxaJurosAoAno)}%</div>
              <div className="l">ao ano</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
