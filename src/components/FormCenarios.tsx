import { useEffect, useMemo } from "react";
import type { CalculoAtual } from "../hooks/useCalculoAtual";
import { calcularHiscon } from "../services/hiscon";
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
    configHiscon,
    atualizarHiscon,
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

  // Contrato do Hiscon: taxa de juros e numero de meses calculados sozinhos (planilha "forma DAta").
  const hiscon = configHiscon.ativo;
  const calcHiscon = useMemo(
    () => (hiscon ? calcularHiscon(comum, configHiscon) : null),
    [hiscon, comum, configHiscon],
  );
  // A taxa maxima da IN 28 e sempre a mesma taxa de juros do cenario IN 28.
  useEffect(() => {
    if (cenarios.in28.taxaTetoIn28 !== cenarios.in28.taxaJuros) {
      atualizar("in28", "taxaTetoIn28", cenarios.in28.taxaJuros);
    }
  }, [cenarios.in28.taxaJuros, cenarios.in28.taxaTetoIn28, atualizar]);

  // Grava o resultado nos 3 cenarios sempre que a data, os valores ou o mes atual mudam.
  useEffect(() => {
    if (!calcHiscon?.ok) return;
    const { meses, taxaTexto } = calcHiscon;
    const ids: IdCenario[] = ["contrato", "hiscon", "in28"];
    if (ids.some((id) => cenarios[id].totalParcelas !== meses)) atualizarTodos("totalParcelas", meses);
    if (ids.some((id) => cenarios[id].taxaJuros !== taxaTexto)) atualizarTodos("taxaJuros", taxaTexto);
  }, [calcHiscon, cenarios, atualizarTodos]);

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
            Preenchidos aqui, vão para Contrato bancário, Extraídos do BACEN e Instrução Normativa 28. Se um cenário
            precisar de um valor diferente, ajuste direto no card dele.
          </p>
        </header>
        <div className="hiscon-pergunta">
          <span className="hiscon-rotulo">O contrato é do Hiscon?</span>
          <div className="segmented" role="radiogroup" aria-label="O contrato é do Hiscon?">
            {[
              { valor: true, texto: "Sim" },
              { valor: false, texto: "Não" },
            ].map((op) => (
              <button
                key={op.texto}
                type="button"
                role="radio"
                aria-checked={hiscon === op.valor}
                className={hiscon === op.valor ? "ativo" : undefined}
                onClick={() => {
                  atualizarHiscon("ativo", op.valor);
                  // Voltando para "Nao" a taxa passa a ser digitada: sai a precisao total do Hiscon
                  // e fica com 2 casas, como seria digitada a mao.
                  const taxa = Number(comum.taxaJuros.replace(",", "."));
                  if (!op.valor && comum.taxaJuros.length > 7 && Number.isFinite(taxa)) {
                    atualizarTodos("taxaJuros", taxa.toFixed(2).replace(".", ","));
                  }
                }}
              >
                {op.texto}
              </button>
            ))}
          </div>
          {hiscon && (
            <>
              <div className="hiscon-mes">
                <CampoData
                  id="hiscon-mes-atual"
                  rotulo="Mês atual"
                  valor={configHiscon.mesAtual}
                  onChange={(v) => v && atualizarHiscon("mesAtual", v)}
                />
              </div>
              <div className={calcHiscon?.ok ? "hiscon-resultado" : "hiscon-resultado pendente"}>
                {calcHiscon?.ok ? (
                  <>
                    <span>
                      Número de meses: <strong>{calcHiscon.meses}</strong>
                    </span>
                    <span>
                      Taxa de juros praticada: <strong>{calcHiscon.taxaExibicao}% a.m.</strong>
                    </span>
                    <small className="muted">Preenchidos automaticamente nos 3 cenários.</small>
                  </>
                ) : (
                  <span>{calcHiscon?.motivo}</span>
                )}
              </div>
            </>
          )}
        </div>
        <div className="comuns-campos">
          <CampoData
            id="comum-data"
            rotulo={hiscon ? "Data da inclusão" : "Data da contratação"}
            valor={comum.data}
            onChange={(v) => atualizarTodos("data", v)}
          />
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
            rotulo={hiscon ? "Total de parcelas (nº de meses · automático)" : "Total de parcelas"}
            sufixo="parcelas"
            valor={comum.totalParcelas}
            desabilitado={hiscon}
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
                  rotulo={hiscon ? "Taxa de juros (automática · Hiscon)" : "Taxa de juros contratada"}
                  valor={c.taxaJuros}
                  desabilitado={hiscon}
                  onChange={(v) => atualizar(def.id, "taxaJuros", v)}
                />
                <CampoInteiro
                  id={campo("parcelas")}
                  rotulo={hiscon ? "Total de parcelas (automático · Hiscon)" : "Total de parcelas"}
                  sufixo="parcelas"
                  valor={c.totalParcelas}
                  desabilitado={hiscon}
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
                    rotulo="Taxa máxima da IN 28 (igual à taxa de juros)"
                    valor={c.taxaTetoIn28}
                    desabilitado
                    onChange={() => undefined}
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
        configHiscon={configHiscon}
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
