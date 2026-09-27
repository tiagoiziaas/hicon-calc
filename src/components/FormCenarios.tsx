import type { CalculoAtual } from "../hooks/useCalculoAtual";
import { CENARIOS, camposPreenchidos, totalCampos, type DadosCenario, type IdCenario } from "../types/cenarios";
import { CampoData, CampoInteiro, CampoMoeda, CampoTaxa, CampoTexto } from "./Campos";
import { GerarMinuta } from "./GerarMinuta";
import { IconeBusca } from "./Icones";

/** Campos preenchidos uma vez so e copiados para os 3 cenarios. */
const CAMPOS_COMUNS = [
  "data",
  "banco",
  "valorContratadoCentavos",
  "valorParcelaCentavos",
  "totalParcelas",
  "dataPrimeiraParcela",
] as const satisfies readonly (keyof DadosCenario)[];

interface Props {
  /** Calculo do formulario (fica no App, compartilhado com a aba "Calculos salvos"). */
  atual: CalculoAtual;
  /** Leva a data do cenario para a consulta do BACEN. */
  onConsultarBacen: (data: string) => void;
}

export function FormCenarios({ atual, onConsultarBacen }: Props) {
  const {
    cenarios,
    identificacao,
    idSalvo,
    atualizar,
    atualizarTodos,
    atualizarIdentificacao,
    copiar,
    limpar,
    novo,
    alterado,
    modeloAberto,
    marcarSalvo,
  } = atual;

  // O bloco comum mostra os valores do contrato bancario (os 3 recebem o que for digitado nele).
  const comum = cenarios.contrato;
  const divergentes = (id: IdCenario) => CAMPOS_COMUNS.filter((k) => cenarios[id][k] !== comum[k]);

  return (
    <section className="cenarios">
      <div className="cenarios-topo">
        <p className="muted">
          Preencha os dados comuns uma vez só: eles vão automaticamente para os 3 cenários. Tudo fica salvo neste
          navegador enquanto você digita.
        </p>
        <button className="btn-secundario" type="button" onClick={novo}>
          Limpar tudo
        </button>
      </div>

      <article className="card comuns">
        <header className="comuns-head">
          <h2>Dados comuns aos 3 cenários</h2>
          <p className="muted">
            Preenchidos aqui, vão para Contrato bancário, Extraídos do Hiscon e Instrução Normativa 28. Se um cenário
            precisar de um valor diferente, ajuste direto no card dele.
          </p>
        </header>
        <div className="comuns-campos">
          <CampoData id="comum-data" rotulo="Data da contratação" valor={comum.data} onChange={(v) => atualizarTodos("data", v)} />
          <CampoTexto
            id="comum-banco"
            rotulo="Nome do banco"
            placeholder="Ex.: Banco Safra S.A."
            valor={comum.banco}
            onChange={(v) => atualizarTodos("banco", v)}
          />
          <CampoMoeda
            id="comum-valor"
            rotulo="Valor contratado"
            valor={comum.valorContratadoCentavos}
            onChange={(v) => atualizarTodos("valorContratadoCentavos", v)}
          />
          <CampoMoeda
            id="comum-parcela"
            rotulo="Valor da parcela contratada"
            valor={comum.valorParcelaCentavos}
            onChange={(v) => atualizarTodos("valorParcelaCentavos", v)}
          />
          <CampoInteiro
            id="comum-parcelas"
            rotulo="Total de parcelas"
            sufixo="parcelas"
            valor={comum.totalParcelas}
            onChange={(v) => atualizarTodos("totalParcelas", v)}
          />
          <CampoData
            id="comum-primeira"
            rotulo="Data pgto da 1ª parcela"
            valor={comum.dataPrimeiraParcela}
            onChange={(v) => atualizarTodos("dataPrimeiraParcela", v)}
          />
        </div>
      </article>

      <div className="cenarios-grid">
        {CENARIOS.map((def, idx) => {
          const c = cenarios[def.id];
          const preenchidos = camposPreenchidos(def.id, c);
          const TOTAL_CAMPOS = totalCampos(def.id);
          const campo = (nome: string) => `${def.id}-${nome}`;
          const origemCopia: IdCenario | null = idx > 0 ? CENARIOS[idx - 1].id : null;
          const diferentes = def.id === "contrato" ? [] : divergentes(def.id);

          return (
            <article key={def.id} className="card cenario">
              <header className="cenario-head">
                <div className="cenario-num">{idx + 1}</div>
                <div className="cenario-titulo">
                  <h2>{def.titulo}</h2>
                  <p className="muted">{def.descricao}</p>
                </div>
              </header>

              {diferentes.length > 0 && (
                <div className="aviso-diferente">
                  <span>Diferente dos dados comuns</span>
                  <button
                    className="btn-link"
                    type="button"
                    onClick={() => diferentes.forEach((k) => atualizar(def.id, k, comum[k]))}
                  >
                    Usar dados comuns
                  </button>
                </div>
              )}

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
        idSalvo={idSalvo}
        alterado={alterado}
        modeloAberto={modeloAberto}
        onSalvo={marcarSalvo}
      />
    </section>
  );
}
