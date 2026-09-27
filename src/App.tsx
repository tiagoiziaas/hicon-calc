import { useCallback, useEffect, useRef, useState } from "react";
import { CalculosSalvos } from "./components/CalculosSalvos";
import { Cabecalho } from "./components/Cabecalho";
import { Filtros } from "./components/Filtros";
import { FormCenarios } from "./components/FormCenarios";
import { Ranking } from "./components/Ranking";
import { Resumo } from "./components/Resumo";
import { useCalculoAtual } from "./hooks/useCalculoAtual";
import { useTema } from "./hooks/useTema";
import {
  MODALIDADES_PESSOA_FISICA_PADRAO,
  consultarTop5,
  escolherModalidadePadrao,
  listarModalidades,
  type ResultadoTop5,
  type Segmento,
} from "./services/bacen";
import { hojeIso } from "./utils/datas";
import { formatarDataBr } from "./utils/formatos";

type Aba = "cenarios" | "salvos" | "bacen";

export default function App() {
  const { tema, alternar } = useTema();
  const [aba, setAba] = useState<Aba>("cenarios");
  // Calculo do formulario: compartilhado entre "Dados dos cenarios" e "Calculos salvos".
  const atual = useCalculoAtual();

  const [data, setData] = useState(hojeIso);
  const [segmento, setSegmento] = useState<Segmento>("PESSOA FÍSICA");
  const [modalidades, setModalidades] = useState<string[]>([]);
  const [modalidade, setModalidade] = useState("");
  const [carregandoModalidades, setCarregandoModalidades] = useState(true);
  const [dicaModalidades, setDicaModalidades] = useState("");

  const [resultado, setResultado] = useState<ResultadoTop5 | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [erro, setErro] = useState("");
  const [toast, setToast] = useState("");

  // Ultima modalidade escolhida: mantida ao trocar data/segmento, se existir na nova lista.
  const preferida = useRef<string | null>(null);
  // Consulta o top 5 assim que a lista de modalidades carregar (na primeira
  // carga e quando uma data vem de um cenario).
  const consultarAoCarregar = useRef(true);

  const consultar = useCallback(
    async (mod: string, dataRef = data, seg = segmento) => {
      if (!mod) return;
      preferida.current = mod;
      setErro("");
      setConsultando(true);
      setResultado(null);
      try {
        const r = await consultarTop5(dataRef, seg, mod);
        if (!r.instituicoes.length) {
          setErro("Nenhuma instituição encontrada para esta modalidade no período (até 20 dias úteis para trás).");
        } else {
          setResultado(r);
        }
      } catch (e) {
        setErro(`Falha ao consultar a API do Bacen: ${(e as Error).message}`);
      } finally {
        setConsultando(false);
      }
    },
    [data, segmento],
  );

  // Recarrega a lista de modalidades sempre que data ou segmento mudam.
  useEffect(() => {
    let cancelado = false;
    setCarregandoModalidades(true);
    setDicaModalidades("Buscando modalidades disponíveis no BACEN…");

    const timer = setTimeout(async () => {
      let lista: string[] = [];
      try {
        const r = await listarModalidades(data, segmento);
        if (cancelado) return;
        lista = r.modalidades;
        setDicaModalidades(
          lista.length
            ? `${lista.length} modalidades · período ${formatarDataBr(r.periodoInicio)} a ${formatarDataBr(r.periodoFim)}`
            : "Sem dados para esta data/segmento.",
        );
      } catch {
        if (cancelado) return;
        lista = segmento === "PESSOA FÍSICA" ? MODALIDADES_PESSOA_FISICA_PADRAO : [];
        setDicaModalidades("Lista padrão (BACEN indisponível no momento).");
      }
      const escolhida = escolherModalidadePadrao(lista, preferida.current) ?? "";
      setModalidades(lista);
      setModalidade(escolhida);
      setCarregandoModalidades(false);

      if (consultarAoCarregar.current && escolhida) {
        consultarAoCarregar.current = false;
        consultar(escolhida, data, segmento);
      }
    }, 300);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
    // consultar fica fora das dependencias: aqui ela so dispara a consulta automatica.
  }, [data, segmento]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const consultarBacenNaData = (dataCenario: string) => {
    setAba("bacen");
    if (dataCenario === data) {
      consultar(modalidade);
    } else {
      consultarAoCarregar.current = true;
      setData(dataCenario);
    }
  };

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setToast(`Taxa média ${texto}% copiada`);
    } catch {
      setToast("Não foi possível copiar");
    }
  };

  return (
    <>
      <div className="bg-glow" aria-hidden="true" />
      <Cabecalho tema={tema} onAlternarTema={alternar} />

      <main className="container">
        <nav className="abas" role="tablist" aria-label="Seções">
          <button
            type="button"
            role="tab"
            aria-selected={aba === "cenarios"}
            className={aba === "cenarios" ? "ativa" : undefined}
            onClick={() => setAba("cenarios")}
          >
            Dados dos cenários
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === "salvos"}
            className={aba === "salvos" ? "ativa" : undefined}
            onClick={() => setAba("salvos")}
          >
            Cálculos salvos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === "bacen"}
            className={aba === "bacen" ? "ativa" : undefined}
            onClick={() => setAba("bacen")}
          >
            Taxas BACEN
          </button>
        </nav>

        {aba === "cenarios" ? (
          <>
            <section className="hero">
              <h1>
                Dados para os <span className="grad">3 cenários de cálculo</span>
              </h1>
              <p>
                Contrato bancário, dados extraídos do Hiscon e dados para a Instrução Normativa 28 do INSS. Preencha
                cada cenário para comparar e calcular.
              </p>
            </section>
            <FormCenarios atual={atual} onConsultarBacen={consultarBacenNaData} />
          </>
        ) : aba === "salvos" ? (
          <>
            <section className="hero">
              <h1>
                Cálculos <span className="grad">salvos</span>
              </h1>
              <p>Todos os cálculos gravados no banco de dados. Abra um para continuar editando ou gerar a planilha de novo.</p>
            </section>
            <CalculosSalvos
              idAberto={atual.idSalvo}
              versao={atual.versaoLista}
              onAbrir={(calc) => {
                atual.abrir(calc);
                setAba("cenarios");
              }}
              onNovo={() => {
                atual.novo();
                setAba("cenarios");
              }}
            />
          </>
        ) : (
          <>
            <section className="hero">
              <h1>
                Top 5 instituições <span className="grad">com as menores taxas</span>
              </h1>
              <p>
                Consulta direta aos dados abertos do BACEN. Escolha a data, o segmento e a modalidade de crédito para ver
                as 5 instituições mais bem posicionadas no período e a taxa média entre elas.
              </p>
            </section>

            <Filtros
              data={data}
              segmento={segmento}
              modalidade={modalidade}
              modalidades={modalidades}
              carregandoModalidades={carregandoModalidades}
              dicaModalidades={dicaModalidades}
              consultando={consultando}
              onData={setData}
              onSegmento={setSegmento}
              onModalidade={(m) => {
                setModalidade(m);
                preferida.current = m;
              }}
              onConsultar={() => consultar(modalidade)}
            />

            {erro && <div className="alerta">{erro}</div>}

            {consultando && (
              <section className="card carregando">
                <div className="spinner" />
                <div>
                  <strong>Consultando o Banco Central…</strong>
                  <p className="muted">A API do BACEN pode levar alguns segundos para responder.</p>
                </div>
              </section>
            )}

            {resultado && (
              <section className="resultado">
                <Resumo resultado={resultado} onCopiar={copiar} />
                <Ranking resultado={resultado} />
              </section>
            )}
          </>
        )}
      </main>

      <footer className="rodape">
        Fonte: BACEN — Dados Abertos · Taxas de juros de operações de crédito por instituição financeira
        (TaxasJurosDiariaPorInicioPeriodo)
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
