import { useEffect, useMemo, useState } from "react";
import { consultarTop5, escolherModalidadePadrao, listarModalidades, type ResultadoTop5 } from "../services/bacen";
import {
  calcularCenario,
  resumoParcial,
  taxaMediaParaCalculo,
  type Calculo,
  type ResultadoCenario,
} from "../services/calculoCenarios";
import { salvarCalculo, type ResumoSalvo } from "../services/calculosSalvos";
import { MODELOS, type IdModelo } from "../services/modelosMinuta";
import { supabaseConfigurado } from "../services/supabase";
import { CENARIOS, type Cenarios, type IdCenario, type Identificacao } from "../types/cenarios";
import { formatarDataBr, formatarPct } from "../utils/formatos";
import { CampoData, CampoTexto } from "./Campos";

interface Props {
  cenarios: Cenarios;
  identificacao: Identificacao;
  onIdentificacao: <K extends keyof Identificacao>(campo: K, valor: Identificacao[K]) => void;
  /** Registro do banco aberto no formulario (salvar atualiza ele). */
  idSalvo: string | null;
  /** Ha mudancas no formulario desde a ultima vez que foi salvo/aberto. */
  alterado: boolean;
  /** Minuta selecionada no calculo que acabou de ser aberto do banco. */
  modeloAberto: IdModelo | null;
  onSalvo: (registro: ResumoSalvo) => void;
}

type EstadoBacen =
  | { tipo: "sem-data" }
  | { tipo: "carregando" }
  | { tipo: "ok"; top: ResultadoTop5; media: number; taxa: number }
  | { tipo: "erro"; mensagem: string };

// Ordem das abas nas Minutas.
const ORDEM: IdCenario[] = ["hiscon", "in28", "contrato"];
const ROTULO_TAXA: Record<IdCenario, string> = {
  hiscon: "Taxa média BACEN",
  in28: "Taxa IN 28",
  contrato: "Taxa contratual",
};

const CHAVE_MODELO = "hicon-modelo-minuta";

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (decimal: number) => `${formatarPct(decimal * 100)}%`;

function nomeArquivo(modelo: IdModelo, id: Identificacao): string {
  const tipo = modelo === "total" ? "Minuta Total" : "Minuta Parcial";
  const partes = [tipo, id.nomeCliente.trim(), id.numeroContrato.trim()].filter(Boolean);
  return `${partes.join(" - ").replace(/[\\/:*?"<>|]+/g, " ")}.xlsx`;
}

function lerModelo(): IdModelo {
  try {
    return localStorage.getItem(CHAVE_MODELO) === "parcial" ? "parcial" : "total";
  } catch {
    return "total";
  }
}

const Linha = ({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) => (
  <div className={destaque ? "destaque" : undefined}>
    <dt>{rotulo}</dt>
    <dd>{valor}</dd>
  </div>
);

function ResultadoTotal({ id, r }: { id: IdCenario; r: ResultadoCenario }) {
  return (
    <dl>
      <Linha rotulo={ROTULO_TAXA[id]} valor={pct(r.taxaReferencia)} />
      <Linha rotulo="Taxa praticada" valor={pct(r.taxaPraticada)} />
      <Linha rotulo="Parcela recalculada" valor={moeda(r.parcelaNaTaxaReferencia)} />
      <Linha rotulo="Quitado na parcela" valor={`${r.quitacaoNaParcela}ª de ${r.totalParcelas}`} />
      <Linha rotulo="Parcelas pagas" valor={String(r.parcelasPagas)} />
      <Linha rotulo="Parcelas restantes" valor={String(r.parcelasIndevidas)} />
      <Linha rotulo="Total do indébito" valor={moeda(r.indebito)} destaque />
      <Linha rotulo="Em dobro" valor={moeda(r.indebitoDobro)} destaque />
    </dl>
  );
}

function ResultadoParcial({ id, r }: { id: IdCenario; r: ResultadoCenario }) {
  const p = resumoParcial(r);
  return (
    <dl>
      <Linha rotulo={ROTULO_TAXA[id]} valor={pct(r.taxaReferencia)} />
      <Linha rotulo="Parcela recalculada" valor={moeda(p.parcelaRecalculada)} />
      <Linha rotulo="Diferença por parcela" valor={moeda(r.parcela - p.parcelaRecalculada)} />
      <Linha rotulo={`Pagas (${p.pagas.length}) · indébito`} valor={moeda(p.indebito)} />
      <Linha rotulo="Indébito em dobro" valor={moeda(p.indebitoDobro)} />
      <Linha rotulo={`A vencer (${p.aVencer.length}) · taxa contrato`} valor={moeda(p.devidoTaxaContrato)} />
      <Linha rotulo="A vencer · taxa recalculada" valor={moeda(p.devidoTaxaReferencia)} />
      <Linha rotulo="Economia" valor={moeda(p.economia)} destaque />
      <Linha rotulo="Total (economia + dobro)" valor={moeda(p.totalGeral)} destaque />
    </dl>
  );
}

export function GerarMinuta({ cenarios, identificacao, onIdentificacao, idSalvo, alterado, modeloAberto, onSalvo }: Props) {
  const dataHiscon = cenarios.hiscon.data;
  const [modelo, setModelo] = useState<IdModelo>(lerModelo);
  const [salvando, setSalvando] = useState(false);
  const [statusSalvo, setStatusSalvo] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // Ao abrir um calculo salvo, volta para a minuta que estava selecionada nele.
  useEffect(() => {
    if (modeloAberto) setModelo(modeloAberto);
  }, [modeloAberto]);
  const [bacen, setBacen] = useState<EstadoBacen>({ tipo: "sem-data" });
  const [gerando, setGerando] = useState(false);
  const [erroGerar, setErroGerar] = useState("");
  const def = MODELOS[modelo];

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_MODELO, modelo);
    } catch {
      // sem armazenamento: so nao lembra a escolha
    }
  }, [modelo]);

  // Taxa media do Bacen (consignado INSS, pessoa fisica) na data da inclusao do Hiscon.
  useEffect(() => {
    if (!dataHiscon) {
      setBacen({ tipo: "sem-data" });
      return;
    }
    let cancelado = false;
    setBacen({ tipo: "carregando" });
    const timer = setTimeout(async () => {
      try {
        const { modalidades } = await listarModalidades(dataHiscon, "PESSOA FÍSICA");
        const modalidade = escolherModalidadePadrao(modalidades);
        if (!modalidade) throw new Error("O BACEN não tem dados para esta data.");
        const top = await consultarTop5(dataHiscon, "PESSOA FÍSICA", modalidade);
        if (cancelado) return;
        if (top.mediaAoMes == null) throw new Error("O BACEN não tem instituições para esta data.");
        setBacen({ tipo: "ok", top, media: top.mediaAoMes, taxa: taxaMediaParaCalculo(top.mediaAoMes) });
      } catch (e) {
        if (!cancelado) setBacen({ tipo: "erro", mensagem: (e as Error).message });
      }
    }, 400);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [dataHiscon]);

  const taxaMedia = bacen.tipo === "ok" ? bacen.taxa : null;
  const calculos = useMemo(
    () =>
      Object.fromEntries(
        ORDEM.map((id) => [id, calcularCenario(id, cenarios[id], identificacao.dataReferencia, taxaMedia)]),
      ) as Record<IdCenario, Calculo>,
    [cenarios, identificacao.dataReferencia, taxaMedia],
  );

  const tudoPronto = ORDEM.every((id) => calculos[id].ok) && bacen.tipo === "ok";

  const baixar = async () => {
    if (!tudoPronto || bacen.tipo !== "ok") return;
    setErroGerar("");
    setGerando(true);
    try {
      const resposta = await fetch(def.arquivo);
      if (!resposta.ok) throw new Error(`Não encontrei a planilha modelo (public${def.arquivo}).`);
      const r = (id: IdCenario) => {
        const c = calculos[id];
        if (!c.ok) throw new Error("Cenário incompleto");
        return c.resultado;
      };
      const arquivo = await def.preencher(await resposta.arrayBuffer(), {
        identificacao,
        contrato: r("contrato"),
        hiscon: r("hiscon"),
        in28: r("in28"),
        bacen: bacen.top,
        taxaMedia: bacen.taxa,
      });
      const url = URL.createObjectURL(
        new Blob([arquivo as BlobPart], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivo(modelo, identificacao);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setErroGerar(`Não foi possível gerar a planilha: ${(e as Error).message}`);
    } finally {
      setGerando(false);
    }
  };

  const podeSalvar = Boolean(identificacao.nomeCliente.trim() || identificacao.numeroContrato.trim());

  // Mensagem de status some quando o formulario muda.
  useEffect(() => {
    if (alterado) setStatusSalvo(null);
  }, [alterado, cenarios, identificacao]);

  const salvar = async () => {
    setSalvando(true);
    setStatusSalvo(null);
    try {
      const registro = await salvarCalculo(
        {
          identificacao,
          cenarios,
          modelo,
          calculos,
          bacen: bacen.tipo === "ok" ? bacen.top : null,
          taxaMedia: bacen.tipo === "ok" ? bacen.taxa : null,
        },
        idSalvo,
      );
      onSalvo(registro);
      setStatusSalvo({
        tipo: "ok",
        texto: `Salvo no banco em ${new Date(registro.atualizadoEm).toLocaleString("pt-BR")}.`,
      });
    } catch (e) {
      setStatusSalvo({ tipo: "erro", texto: `Não foi possível salvar: ${(e as Error).message}` });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="card minuta">
      <header className="minuta-head">
        <div>
          <h2>Gerar planilha da Minuta</h2>
          <p className="muted">Escolha a minuta, confira o resultado de cada aba e baixe a planilha preenchida.</p>
        </div>
        <div className="segmented seletor-minuta" role="radiogroup" aria-label="Qual minuta">
          {Object.values(MODELOS).map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={modelo === m.id}
              className={modelo === m.id ? "ativo" : undefined}
              onClick={() => setModelo(m.id)}
            >
              {m.nome}
            </button>
          ))}
        </div>
      </header>

      <p className="minuta-descricao">
        <strong>{def.nome}:</strong> {def.descricao}
      </p>

      <div className="minuta-ident">
        <CampoTexto
          id="ident-cliente"
          rotulo="Nome do cliente"
          placeholder="Ex.: Maria da Silva"
          valor={identificacao.nomeCliente}
          onChange={(v) => onIdentificacao("nomeCliente", v)}
        />
        <CampoTexto
          id="ident-contrato"
          rotulo="Número do contrato"
          placeholder="Ex.: 12345678"
          valor={identificacao.numeroContrato}
          onChange={(v) => onIdentificacao("numeroContrato", v)}
        />
        <CampoData
          id="ident-referencia"
          rotulo="Parcelas pagas até (data de referência)"
          valor={identificacao.dataReferencia}
          onChange={(v) => v && onIdentificacao("dataReferencia", v)}
        />
      </div>

      <div className="minuta-bacen">
        {bacen.tipo === "sem-data" && (
          <span className="muted">Taxa média BACEN: preencha a data da inclusão do Hiscon.</span>
        )}
        {bacen.tipo === "carregando" && <span className="muted">Buscando a taxa média no BACEN…</span>}
        {bacen.tipo === "erro" && <span className="texto-erro">BACEN: {bacen.mensagem}</span>}
        {bacen.tipo === "ok" && (
          <span>
            Taxa média BACEN (top 5, {formatarDataBr(bacen.top.periodoInicio)} a {formatarDataBr(bacen.top.periodoFim)}
            ): <strong>{bacen.media.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}%</strong> → usada nos
            cálculos (4 casas, como no Hicon): <strong>{pct(bacen.taxa)}</strong>
          </span>
        )}
      </div>

      <div className="minuta-grid">
        {ORDEM.map((id) => {
          const cenario = CENARIOS.find((d) => d.id === id)!;
          const calc = calculos[id];
          return (
            <div key={id} className={`minuta-aba ${calc.ok ? "pronta" : ""}`}>
              <div className="minuta-aba-titulo">
                <strong>{def.abas[id]}</strong>
                <span className="muted">{cenario.titulo}</span>
              </div>
              {calc.ok ? (
                modelo === "total" ? (
                  <ResultadoTotal id={id} r={calc.resultado} />
                ) : (
                  <ResultadoParcial id={id} r={calc.resultado} />
                )
              ) : (
                <p className="minuta-falta">{calc.erro ?? `Falta preencher: ${calc.faltando.join(", ")}.`}</p>
              )}
            </div>
          );
        })}
      </div>

      {erroGerar && <div className="alerta">{erroGerar}</div>}

      <div className="minuta-acoes">
        <button className="btn-primario" type="button" disabled={!tudoPronto || gerando} onClick={baixar}>
          {gerando ? "Gerando…" : `Baixar ${def.nome} preenchida (.xlsx)`}
        </button>
        {supabaseConfigurado && (
          <button
            className="btn-salvar"
            type="button"
            disabled={salvando || !podeSalvar}
            onClick={salvar}
            title={podeSalvar ? undefined : "Preencha o nome do cliente ou o número do contrato para salvar"}
          >
            {salvando ? "Salvando…" : idSalvo ? "Salvar alterações no banco" : "Salvar no banco"}
          </button>
        )}
        {!tudoPronto && <small className="muted">Complete os 3 cenários para liberar o download.</small>}
      </div>
      {supabaseConfigurado && (
        <div className="minuta-salvo">
          {statusSalvo ? (
            <span className={statusSalvo.tipo === "erro" ? "texto-erro" : "texto-ok"}>{statusSalvo.texto}</span>
          ) : idSalvo ? (
            <span className={alterado ? "texto-aviso" : "texto-ok"}>
              {alterado ? "Há alterações ainda não salvas neste cálculo." : "Cálculo salvo no banco, sem alterações pendentes."}
            </span>
          ) : (
            <span className="muted">Este cálculo ainda não foi salvo.</span>
          )}
        </div>
      )}
    </section>
  );
}
