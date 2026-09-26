// As duas planilhas que o sistema sabe preencher, escolhidas no botao "Minuta Total / Parcial".

import { preencherMinutaTotal, type DadosMinuta } from "./minuta";
import { preencherMinutaParcial } from "./minutaParcial";

export type IdModelo = "total" | "parcial";

export interface ModeloMinuta {
  id: IdModelo;
  nome: string;
  descricao: string;
  /** Caminho do .xlsx modelo em public/ */
  arquivo: string;
  /** Nome das abas de quitacao, na ordem Hiscon (taxa media), IN 28, Contrato. */
  abas: { hiscon: string; in28: string; contrato: string };
  preencher: (modelo: ArrayBuffer | Uint8Array, dados: DadosMinuta) => Promise<Uint8Array>;
}

export const MODELOS: Record<IdModelo, ModeloMinuta> = {
  total: {
    id: "total",
    nome: "Minuta Total",
    descricao: "Acha a parcela em que a dívida estaria quitada; as parcelas depois dela são o indébito.",
    arquivo: "/modelos/minuta-total-modelo.xlsx",
    abas: {
      hiscon: "1.1.1 Quitação pela taxa média",
      in28: "2.2.2 Quitação pela IN 28",
      contrato: "3.3.3 Quitação taxa contratual",
    },
    preencher: preencherMinutaTotal,
  },
  parcial: {
    id: "parcial",
    nome: "Minuta Parcial",
    descricao:
      "Compara parcela a parcela: a diferença nas parcelas já pagas é o indébito; nas parcelas a vencer, a economia.",
    arquivo: "/modelos/minuta-parcial-modelo.xlsx",
    abas: {
      hiscon: "1.1 Quitação parcial taxa média",
      in28: "2.2 Quitação parcial IN 28",
      contrato: "3.3 Quitação taxa contratual",
    },
    preencher: preencherMinutaParcial,
  },
};
