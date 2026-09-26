import { useCallback, useEffect, useState } from "react";
import {
  cenarioVazio,
  cenariosVazios,
  type Cenarios,
  type DadosCenario,
  type IdCenario,
  type Identificacao,
} from "../types/cenarios";
import { hojeIso } from "../utils/datas";

const CHAVE = "hicon-cenarios";
const CHAVE_IDENTIFICACAO = "hicon-identificacao";

function ler<T>(chave: string): Partial<T> | null {
  try {
    const salvo = localStorage.getItem(chave);
    return salvo ? (JSON.parse(salvo) as Partial<T>) : null;
  } catch {
    return null; // armazenamento bloqueado ou dado corrompido: comeca vazio
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // sem armazenamento: so nao guarda o rascunho
  }
}

function carregarCenarios(): Cenarios {
  const dados = ler<Cenarios>(CHAVE);
  const base = cenariosVazios();
  if (dados) {
    for (const id of Object.keys(base) as IdCenario[]) base[id] = { ...cenarioVazio(), ...dados[id] };
  }
  return base;
}

const carregarIdentificacao = (): Identificacao => ({
  nomeCliente: "",
  numeroContrato: "",
  ...ler<Identificacao>(CHAVE_IDENTIFICACAO),
  // A data de referencia ("ate a presente data") e sempre a de hoje ao abrir.
  dataReferencia: hojeIso(),
});

/** Dados dos 3 cenarios e da identificacao, salvos no navegador enquanto sao digitados (rascunho). */
export function useCenarios() {
  const [cenarios, setCenarios] = useState<Cenarios>(carregarCenarios);
  const [identificacao, setIdentificacao] = useState<Identificacao>(carregarIdentificacao);

  useEffect(() => gravar(CHAVE, cenarios), [cenarios]);
  useEffect(() => gravar(CHAVE_IDENTIFICACAO, identificacao), [identificacao]);

  const atualizar = useCallback(<K extends keyof DadosCenario>(id: IdCenario, campo: K, valor: DadosCenario[K]) => {
    setCenarios((atual) => ({ ...atual, [id]: { ...atual[id], [campo]: valor } }));
  }, []);

  /** Grava o mesmo valor em um campo dos 3 cenarios (bloco "Dados comuns"). */
  const atualizarTodos = useCallback(<K extends keyof DadosCenario>(campo: K, valor: DadosCenario[K]) => {
    setCenarios((atual) => ({
      contrato: { ...atual.contrato, [campo]: valor },
      hiscon: { ...atual.hiscon, [campo]: valor },
      in28: { ...atual.in28, [campo]: valor },
    }));
  }, []);

  const copiar = useCallback((de: IdCenario, para: IdCenario) => {
    // A taxa maxima da IN 28 e propria do cenario IN 28: nao e copiada nem sobrescrita.
    setCenarios((atual) => ({ ...atual, [para]: { ...atual[de], taxaTetoIn28: atual[para].taxaTetoIn28 } }));
  }, []);

  const limpar = useCallback((id: IdCenario) => {
    setCenarios((atual) => ({ ...atual, [id]: cenarioVazio() }));
  }, []);

  const limparTodos = useCallback(() => {
    setCenarios(cenariosVazios());
    setIdentificacao({ nomeCliente: "", numeroContrato: "", dataReferencia: hojeIso() });
  }, []);

  const atualizarIdentificacao = useCallback(<K extends keyof Identificacao>(campo: K, valor: Identificacao[K]) => {
    setIdentificacao((atual) => ({ ...atual, [campo]: valor }));
  }, []);

  return { cenarios, identificacao, atualizar, atualizarTodos, atualizarIdentificacao, copiar, limpar, limparTodos };
}
