import { useEffect, useState } from "react";
import { carregarCalculo, listarCalculos, type CalculoSalvo, type ResumoSalvo } from "../services/calculosSalvos";
import { supabaseConfigurado } from "../services/supabase";
import { formatarDataBr } from "../utils/formatos";

interface Props {
  /** Registro aberto no formulario (destacado na lista). */
  idAberto: string | null;
  /** Muda a cada gravacao para a lista recarregar. */
  versao: number;
  onAbrir: (calculo: CalculoSalvo) => void;
  onNovo: () => void;
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const NOME_MODELO = { total: "Minuta Total", parcial: "Minuta Parcial" } as const;

/** Aba "Calculos salvos": todos os calculos gravados no banco, com busca. */
export function CalculosSalvos({ idAberto, versao, onAbrir, onNovo }: Props) {
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<ResumoSalvo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let cancelado = false;
    setCarregando(true);
    const timer = setTimeout(async () => {
      try {
        const itens = await listarCalculos(busca);
        if (!cancelado) {
          setLista(itens);
          setErro("");
        }
      } catch (e) {
        if (!cancelado) setErro((e as Error).message);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [busca, versao, recarregar]);

  if (!supabaseConfigurado) {
    return <div className="alerta">Banco de dados não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).</div>;
  }

  const abrir = async (id: string) => {
    setAbrindo(id);
    setErro("");
    try {
      onAbrir(await carregarCalculo(id));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setAbrindo(null);
    }
  };

  return (
    <section className="card salvos">
      <header className="salvos-head">
        <div>
          <h2>Todos os cálculos salvos</h2>
          <p className="muted">
            {carregando ? "Carregando…" : `${lista.length} ${lista.length === 1 ? "cálculo" : "cálculos"}${busca ? " encontrados" : ""}`}
            {" · "}Clique em <strong>Abrir</strong> para continuar editando ou baixar a planilha de novo.
          </p>
        </div>
        <div className="salvos-botoes">
          <button className="btn-link" type="button" onClick={() => setRecarregar((n) => n + 1)} title="Buscar de novo no banco">
            Atualizar lista
          </button>
          <button className="btn-secundario" type="button" onClick={onNovo} title="Limpa o formulário para um cálculo novo">
            + Novo cálculo
          </button>
        </div>
      </header>

      <input
        className="salvos-busca"
        type="search"
        placeholder="Buscar por nome do cliente ou número do contrato"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        aria-label="Buscar cálculos salvos"
      />

      {erro && <div className="alerta">{erro}</div>}

      {!carregando && !lista.length ? (
        <p className="muted salvos-vazio">
          {busca ? "Nenhum cálculo encontrado para essa busca." : "Nenhum cálculo salvo ainda. Use o botão \"Salvar no banco\" na aba Dados dos cenários."}
        </p>
      ) : (
        <div className="salvos-tabela" role="table" aria-label="Cálculos salvos">
          <div className="salvos-linha salvos-cabecalho" role="row">
            <span role="columnheader">Cliente</span>
            <span role="columnheader">Contrato</span>
            <span role="columnheader">Minuta</span>
            <span role="columnheader">Parcelas pagas até</span>
            <span role="columnheader">Última alteração</span>
            <span role="columnheader" aria-label="Ações" />
          </div>
          {lista.map((c) => (
            <div key={c.id} className={`salvos-linha${c.id === idAberto ? " aberto" : ""}`} role="row">
              <strong role="cell" data-rotulo="Cliente">{c.nomeCliente || "Sem nome do cliente"}</strong>
              <span role="cell" data-rotulo="Contrato">{c.numeroContrato || "—"}</span>
              <span role="cell" data-rotulo="Minuta">{c.modelo ? NOME_MODELO[c.modelo] : "—"}</span>
              <span role="cell" data-rotulo="Parcelas pagas até">{c.dataReferencia ? formatarDataBr(c.dataReferencia) : "—"}</span>
              <span role="cell" data-rotulo="Última alteração">{dataHora(c.atualizadoEm)}</span>
              <span role="cell" className="salvos-acao">
                {c.id === idAberto ? (
                  <span className="salvos-aberto">Aberto no formulário</span>
                ) : (
                  <button className="btn-secundario" type="button" disabled={abrindo === c.id} onClick={() => abrir(c.id)}>
                    {abrindo === c.id ? "Abrindo…" : "Abrir"}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
