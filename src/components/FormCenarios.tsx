import { useCenarios } from "../hooks/useCenarios";
import { CENARIOS, camposPreenchidos, totalCampos, type IdCenario } from "../types/cenarios";
import { CampoData, CampoInteiro, CampoMoeda, CampoTaxa, CampoTexto } from "./Campos";
import { GerarMinuta } from "./GerarMinuta";
import { IconeBusca } from "./Icones";

interface Props {
  /** Leva a data do cenario para a consulta do BACEN. */
  onConsultarBacen: (data: string) => void;
}

export function FormCenarios({ onConsultarBacen }: Props) {
  const { cenarios, identificacao, atualizar, atualizarIdentificacao, copiar, limpar, limparTodos } = useCenarios();

  return (
    <section className="cenarios">
      <div className="cenarios-topo">
        <p className="muted">
          Preencha os dados de cada cenário. Tudo fica salvo neste navegador enquanto você digita.
        </p>
        <button className="btn-secundario" type="button" onClick={limparTodos}>
          Limpar tudo
        </button>
      </div>

      <div className="cenarios-grid">
        {CENARIOS.map((def, idx) => {
          const c = cenarios[def.id];
          const preenchidos = camposPreenchidos(def.id, c);
          const TOTAL_CAMPOS = totalCampos(def.id);
          const campo = (nome: string) => `${def.id}-${nome}`;
          const origemCopia: IdCenario | null = idx > 0 ? CENARIOS[idx - 1].id : null;

          return (
            <article key={def.id} className="card cenario">
              <header className="cenario-head">
                <div className="cenario-num">{idx + 1}</div>
                <div className="cenario-titulo">
                  <h2>{def.titulo}</h2>
                  <p className="muted">{def.descricao}</p>
                </div>
              </header>

              <div className="progresso" title={`${preenchidos} de ${TOTAL_CAMPOS} campos preenchidos`}>
                <div className="barra">
                  <span style={{ width: `${(preenchidos / TOTAL_CAMPOS) * 100}%` }} />
                </div>
                <small>
                  {preenchidos}/{TOTAL_CAMPOS}
                </small>
              </div>

              <div className="form-campos">
                <CampoData
                  id={campo("data")}
                  rotulo={def.rotuloData}
                  valor={c.data}
                  onChange={(v) => atualizar(def.id, "data", v)}
                />
                <CampoTexto
                  id={campo("banco")}
                  rotulo="Nome do banco"
                  placeholder="Ex.: Banco Safra S.A."
                  valor={c.banco}
                  onChange={(v) => atualizar(def.id, "banco", v)}
                />
                <CampoMoeda
                  id={campo("valor")}
                  rotulo="Valor contratado"
                  valor={c.valorContratadoCentavos}
                  onChange={(v) => atualizar(def.id, "valorContratadoCentavos", v)}
                />
                <CampoMoeda
                  id={campo("parcela")}
                  rotulo="Valor da parcela contratada"
                  valor={c.valorParcelaCentavos}
                  onChange={(v) => atualizar(def.id, "valorParcelaCentavos", v)}
                />
                <CampoTaxa
                  id={campo("taxa")}
                  rotulo="Taxa de juros contratada"
                  valor={c.taxaJuros}
                  onChange={(v) => atualizar(def.id, "taxaJuros", v)}
                />
                <CampoInteiro
                  id={campo("parcelas")}
                  rotulo="Total de parcelas"
                  sufixo="parcelas"
                  valor={c.totalParcelas}
                  onChange={(v) => atualizar(def.id, "totalParcelas", v)}
                />
                <CampoData
                  id={campo("primeira")}
                  rotulo="Data pgto da 1ª parcela"
                  valor={c.dataPrimeiraParcela}
                  onChange={(v) => atualizar(def.id, "dataPrimeiraParcela", v)}
                />
                {def.id === "in28" && (
                  <CampoTaxa
                    id={campo("teto")}
                    rotulo="Taxa máxima da IN 28 (teto na data)"
                    valor={c.taxaTetoIn28}
                    onChange={(v) => atualizar(def.id, "taxaTetoIn28", v)}
                  />
                )}
              </div>

              <footer className="cenario-acoes">
                <button
                  className="btn-secundario"
                  type="button"
                  disabled={!c.data}
                  title={c.data ? "Consultar o top 5 do BACEN nesta data" : `Preencha a ${def.rotuloData.toLowerCase()}`}
                  onClick={() => onConsultarBacen(c.data)}
                >
                  <IconeBusca />
                  Taxa BACEN nesta data
                </button>
                <div className="cenario-acoes-dir">
                  {origemCopia && (
                    <button
                      className="btn-link"
                      type="button"
                      onClick={() => copiar(origemCopia, def.id)}
                      title="Copia todos os campos do cenário anterior"
                    >
                      Copiar do cenário {idx}
                    </button>
                  )}
                  <button className="btn-link" type="button" onClick={() => limpar(def.id)}>
                    Limpar
                  </button>
                </div>
              </footer>
            </article>
          );
        })}
      </div>

      <GerarMinuta
        cenarios={cenarios}
        identificacao={identificacao}
        onIdentificacao={atualizarIdentificacao}
      />
    </section>
  );
}
