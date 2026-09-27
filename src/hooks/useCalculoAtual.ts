import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalculoSalvo, ResumoSalvo } from "../services/calculosSalvos";
import type { IdModelo } from "../services/modelosMinuta";
import { useCenarios } from "./useCenarios";

const CHAVE_ASSINATURA = "hicon-assinatura-salva";

/**
 * O calculo que esta no formulario + a ligacao dele com o banco:
 * qual registro esta aberto, se ha alteracoes nao salvas e a minuta escolhida nele.
 * Fica no App para ser compartilhado pelas abas "Dados dos cenarios" e "Calculos salvos".
 */
export function useCalculoAtual() {
  const cenariosHook = useCenarios();
  const { cenarios, identificacao, setIdSalvo, limparTodos, carregar } = cenariosHook;

  /** Muda a cada gravacao para a lista de salvos recarregar. */
  const [versaoLista, setVersaoLista] = useState(0);
  /** Minuta (Total/Parcial) do calculo que acabou de ser aberto do banco. */
  const [modeloAberto, setModeloAberto] = useState<IdModelo | null>(null);

  const assinaturaAtual = useMemo(() => JSON.stringify({ cenarios, identificacao }), [cenarios, identificacao]);
  // Lembrada no navegador: ao recarregar a pagina o calculo aberto continua "salvo".
  const [assinaturaSalva, setAssinaturaSalva] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CHAVE_ASSINATURA);
    } catch {
      return null;
    }
  });
  useEffect(() => {
    try {
      if (assinaturaSalva) localStorage.setItem(CHAVE_ASSINATURA, assinaturaSalva);
      else localStorage.removeItem(CHAVE_ASSINATURA);
    } catch {
      // sem armazenamento
    }
  }, [assinaturaSalva]);

  const alterado = assinaturaSalva !== assinaturaAtual;

  const abrir = useCallback(
    (calc: CalculoSalvo) => {
      carregar(calc);
      setAssinaturaSalva(JSON.stringify({ cenarios: calc.cenarios, identificacao: calc.identificacao }));
      setModeloAberto(calc.modelo);
    },
    [carregar],
  );

  const novo = useCallback(() => {
    limparTodos();
    setAssinaturaSalva(null);
    setModeloAberto(null);
  }, [limparTodos]);

  const marcarSalvo = useCallback(
    (registro: ResumoSalvo) => {
      setIdSalvo(registro.id);
      setAssinaturaSalva(assinaturaAtual);
      setVersaoLista((v) => v + 1);
    },
    [setIdSalvo, assinaturaAtual],
  );

  return { ...cenariosHook, versaoLista, modeloAberto, alterado, abrir, novo, marcarSalvo };
}

export type CalculoAtual = ReturnType<typeof useCalculoAtual>;
