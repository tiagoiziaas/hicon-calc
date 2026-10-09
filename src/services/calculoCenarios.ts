// Calcula cada cenario exatamente como as abas de quitacao da Minuta:
//   taxa praticada  = RATE(n; -parcela; valor)
//   parcela na taxa = -PMT(taxa referencia; n; valor)
//   quitacao        = ARRED(NPER(taxa referencia; parcela; -valor); 0)
//   indebito        = soma das parcelas depois da quitacao; em dobro = x2

import { taxaDecimal, type DadosCenario, type IdCenario } from "../types/cenarios";
import { arred, nper, parcelasVencidas, pmt, rate, somarMeses } from "./financeiro";

export interface ParcelaCronograma {
  numero: number;
  /** "aaaa-mm-dd" */
  data: string;
  valor: number;
  cobradaIndevidamente: boolean;
}

export interface ResultadoCenario {
  id: IdCenario;
  data: string;
  banco: string;
  valorContratado: number;
  parcela: number;
  totalParcelas: number;
  primeiraParcela: string;
  taxaContratada: number;
  /** Taxa usada no recalculo: contratada (contrato), media Bacen (Hiscon) ou teto (IN 28). */
  taxaReferencia: number;
  taxaPraticada: number;
  parcelaNaTaxaReferencia: number;
  diferencaParcela: number;
  quitacaoNaParcela: number;
  parcelasPagas: number;
  cronograma: ParcelaCronograma[];
  parcelasIndevidas: number;
  indebito: number;
  indebitoDobro: number;
  /** Mesma conta das abas de PERCENTUAL: (taxa cobrada - referencia) / referencia. */
  percentualAcima: number;
  taxaCobradaPercentual: number;
}

export type Calculo = { ok: true; resultado: ResultadoCenario } | { ok: false; faltando: string[]; erro?: string };

const ROTULOS: Record<string, string> = {
  data: "data",
  banco: "nome do banco",
  valor: "valor contratado",
  parcela: "valor da parcela",
  taxa: "taxa de juros contratada",
  total: "total de parcelas",
  primeira: "data da 1ª parcela",
  teto: "taxa máxima da IN 28",
  media: "taxa média do BACEN",
};

export function calcularCenario(
  id: IdCenario,
  c: DadosCenario,
  dataReferencia: string,
  taxaMediaBacen: number | null,
): Calculo {
  const taxaContratada = taxaDecimal(c.taxaJuros);
  const teto = taxaDecimal(c.taxaTetoIn28);

  const faltando: string[] = [];
  if (!c.data) faltando.push(ROTULOS.data);
  if (!c.banco.trim()) faltando.push(ROTULOS.banco);
  if (!c.valorContratadoCentavos) faltando.push(ROTULOS.valor);
  if (!c.valorParcelaCentavos) faltando.push(ROTULOS.parcela);
  if (taxaContratada == null) faltando.push(ROTULOS.taxa);
  if (!c.totalParcelas) faltando.push(ROTULOS.total);
  if (!c.dataPrimeiraParcela) faltando.push(ROTULOS.primeira);
  if (id === "in28" && teto == null) faltando.push(ROTULOS.teto);
  if (id === "hiscon" && c.data && taxaMediaBacen == null) faltando.push(ROTULOS.media);
  if (faltando.length) return { ok: false, faltando };

  const valor = c.valorContratadoCentavos! / 100;
  const parcela = c.valorParcelaCentavos! / 100;
  const n = c.totalParcelas!;
  const taxaReferencia = id === "contrato" ? taxaContratada! : id === "hiscon" ? taxaMediaBacen! : teto!;

  let quitacaoNaParcela: number;
  try {
    quitacaoNaParcela = arred(nper(taxaReferencia, parcela, valor), 0);
  } catch (e) {
    return { ok: false, faltando: [], erro: (e as Error).message };
  }

  const cronograma: ParcelaCronograma[] = Array.from({ length: n }, (_, i) => ({
    numero: i + 1,
    data: somarMeses(c.dataPrimeiraParcela, i),
    valor: parcela,
    cobradaIndevidamente: i + 1 > quitacaoNaParcela,
  }));
  const indevidas = cronograma.filter((p) => p.cobradaIndevidamente);
  const indebito = arred(indevidas.reduce((s, p) => s + p.valor, 0), 2);

  const taxaPraticada = rate(n, parcela, valor);
  const parcelaNaTaxaReferencia = pmt(taxaReferencia, n, valor);

  // Taxa "cobrada pelo banco" nas abas de PERCENTUAL: sempre a taxa praticada (RATE),
  // a mesma da aba TODOS 6 CALCULOS (D6).
  const taxaCobradaPercentual = taxaPraticada;
  const referenciaPercentual = id === "contrato" ? taxaContratada! : taxaReferencia;

  return {
    ok: true,
    resultado: {
      id,
      data: c.data,
      banco: c.banco.trim(),
      valorContratado: valor,
      parcela,
      totalParcelas: n,
      primeiraParcela: c.dataPrimeiraParcela,
      taxaContratada: taxaContratada!,
      taxaReferencia,
      taxaPraticada,
      parcelaNaTaxaReferencia,
      diferencaParcela: parcela - parcelaNaTaxaReferencia,
      quitacaoNaParcela,
      parcelasPagas: parcelasVencidas(c.dataPrimeiraParcela, n, dataReferencia),
      cronograma,
      parcelasIndevidas: indevidas.length,
      indebito,
      indebitoDobro: arred(indebito * 2, 2),
      percentualAcima: (taxaCobradaPercentual - referenciaPercentual) / referenciaPercentual,
      taxaCobradaPercentual,
    },
  };
}

// ---------------------------------------------------------------------------
// Minuta PARCIAL: em vez de achar a parcela de quitacao, compara parcela a
// parcela o valor cobrado com a parcela recalculada na taxa de referencia.
//   parcelas ja pagas -> diferenca de cada uma = indebito (e em dobro)
//   parcelas a vencer -> total devido na taxa do contrato x na taxa de referencia = economia
//   total geral       -> economia + indebito em dobro

export interface ParcelaParcial {
  numero: number;
  data: string;
  valor: number;
  valorRecalculado: number;
  diferenca: number;
}

export interface ResumoParcial {
  /** -PMT(taxa referencia; n; valor) arredondada em centavos, como na planilha. */
  parcelaRecalculada: number;
  pagas: ParcelaParcial[];
  aVencer: ParcelaParcial[];
  indebito: number;
  indebitoDobro: number;
  devidoTaxaContrato: number;
  devidoTaxaReferencia: number;
  economia: number;
  totalGeral: number;
  /** Abas "INDICE ACIMA": (taxa praticada - taxa referencia) / taxa referencia. */
  percentualAcima: number;
}

export function resumoParcial(r: ResultadoCenario): ResumoParcial {
  const parcelaRecalculada = arred(r.parcelaNaTaxaReferencia, 2);
  const linhas = r.cronograma.map<ParcelaParcial>((p) => ({
    numero: p.numero,
    data: p.data,
    valor: p.valor,
    valorRecalculado: parcelaRecalculada,
    diferenca: arred(p.valor - parcelaRecalculada, 2),
  }));
  const pagas = linhas.slice(0, r.parcelasPagas);
  const aVencer = linhas.slice(r.parcelasPagas);
  const soma = (l: ParcelaParcial[], campo: keyof ParcelaParcial) =>
    arred(l.reduce((s, p) => s + (p[campo] as number), 0), 2);

  const indebito = soma(pagas, "diferenca");
  const indebitoDobro = arred(indebito * 2, 2);
  const devidoTaxaContrato = soma(aVencer, "valor");
  const devidoTaxaReferencia = soma(aVencer, "valorRecalculado");
  const economia = arred(devidoTaxaContrato - devidoTaxaReferencia, 2);

  return {
    parcelaRecalculada,
    pagas,
    aVencer,
    indebito,
    indebitoDobro,
    devidoTaxaContrato,
    devidoTaxaReferencia,
    economia,
    totalGeral: arred(economia + indebitoDobro, 2),
    percentualAcima: (r.taxaPraticada - r.taxaReferencia) / r.taxaReferencia,
  };
}

/** Media do top 5 do Bacen como a Minuta/Hicon usam: decimal com 4 casas (1,534% -> 0,0153). */
export const taxaMediaParaCalculo = (mediaPercentual: number): number => arred(mediaPercentual / 100, 4);
