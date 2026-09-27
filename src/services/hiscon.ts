// Contrato do Hiscon: taxa de juros e numero de meses calculados sozinhos,
// como na planilha "forma DAta" do escritorio:
//   meses = DATEDIF(inclusao; mes atual; "Y") * 12 + DATEDIF(inclusao; mes atual; "YM")
//   taxa  = RATE(meses; -parcela; valor financiado)

import type { ConfigHiscon, DadosCenario } from "../types/cenarios";
import { mesesCompletos, rate } from "./financeiro";

export type CalculoHiscon =
  | {
      ok: true;
      meses: number;
      taxa: number;
      /** taxa em % com precisao total, gravada no campo (vai para os calculos): "3,359851936714" */
      taxaTexto: string;
      /** taxa em % arredondada para mostrar na tela: "3,36" */
      taxaExibicao: string;
    }
  | { ok: false; motivo: string };

export function calcularHiscon(comum: DadosCenario, config: ConfigHiscon): CalculoHiscon {
  const faltando: string[] = [];
  if (!comum.data) faltando.push("data da inclusão");
  if (!config.mesAtual) faltando.push("mês atual");
  if (!comum.valorContratadoCentavos) faltando.push("valor contratado");
  if (!comum.valorParcelaCentavos) faltando.push("valor da parcela");
  if (faltando.length) return { ok: false, motivo: `Preencha ${faltando.join(", ")} para calcular.` };

  const meses = mesesCompletos(comum.data, config.mesAtual);
  if (meses <= 0) return { ok: false, motivo: "O mês atual precisa ser pelo menos 1 mês depois da data da inclusão." };

  const valor = comum.valorContratadoCentavos! / 100;
  const parcela = comum.valorParcelaCentavos! / 100;
  if (parcela * meses <= valor) {
    return { ok: false, motivo: `Em ${meses} meses as parcelas não pagam nem o valor contratado (taxa daria 0% ou negativa).` };
  }
  const taxa = rate(meses, parcela, valor);
  // Mostra 2 casas, mas calcula com o valor exato do RATE (igual ao Excel).
  return {
    ok: true,
    meses,
    taxa,
    taxaTexto: (taxa * 100).toFixed(12).replace(".", ","),
    taxaExibicao: (taxa * 100).toFixed(2).replace(".", ","),
  };
}
