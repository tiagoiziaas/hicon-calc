// Preenche a planilha "Minuta Total finalizado" com os 3 cenarios:
//   Contrato bancario -> DADOS PARA PETIÇÃO INICIAL + 3.3.3 QUITAÇÃO TAXA CONTRATUAL
//   Hiscon            -> 1.1.1 QUITAÇÃO PELA TAXA MEDIA (taxa media do Bacen na data da inclusao)
//   IN 28             -> 2.2.2 QUITAÇÃO PELA IN  28 INSS
//
// As formulas da planilha continuam funcionando: os valores de entrada vao nas
// celulas certas, as formulas que estavam quebradas ou com numeros digitados
// passam a apontar para as celulas certas, e cada formula ja leva o resultado
// calculado aqui (o Excel recalcula tudo ao abrir).

import type { ResultadoTop5 } from "./bacen";
import type { ResultadoCenario } from "./calculoCenarios";
import { serialExcel } from "./financeiro";
import { atualizarGraficosDaAba } from "./graficos";
import { Pasta, type Aba } from "./xlsx";
import type { Identificacao } from "../types/cenarios";

export const ABAS_TOTAL = {
  dados: "DADOS PARA PETIÇÃO INICIAL",
  datas: "CALCULO DE DATAS",
  todos: "TODOS 6 CALCULOS",
  indices: "INDICES BACARIOS APURAR TX MEDI",
  quitacaoMedia: "1.1.1 QUITAÇÃO PELA TAXA MEDIA",
  percentualMedia: "1.1.1 PERCENTUAL TAXA MEDIA",
  quitacaoIn28: "2.2.2 QUITAÇÃO PELA IN  28 INSS",
  percentualIn28: "2.2.2 PERCENTUAL IN 28",
  quitacaoContrato: "3.3.3 QUITAÇÃO TAXA CONTRATUAL",
  percentualContrato: "3.3.3 PERCENTUAL CONTRATO",
} as const;

const D = `'${ABAS_TOTAL.dados}'!`;
export const T = `'${ABAS_TOTAL.todos}'!`;

export interface DadosMinuta {
  identificacao: Identificacao;
  contrato: ResultadoCenario;
  hiscon: ResultadoCenario;
  in28: ResultadoCenario;
  /** Consulta do Bacen na data da inclusao do Hiscon (ranking completo vai para a aba de indices). */
  bacen: ResultadoTop5;
  /** Taxa media usada nos calculos (decimal, 4 casas). */
  taxaMedia: number;
}

export const data = (aba: Aba, ref: string, iso: string) => aba.numero(ref, serialExcel(iso));

function preencherDados(aba: Aba, d: DadosMinuta) {
  const { contrato: c, hiscon: h, in28: i, identificacao: id } = d;

  aba.texto("F3", id.nomeCliente.trim());
  aba.texto("F4", c.banco);
  aba.texto("F5", id.numeroContrato.trim());
  data(aba, "F6", c.data);
  // Dados do caso anterior que o sistema ainda nao coleta: ficam em branco.
  aba.limpar("F7");
  aba.limpar("F8");

  data(aba, "I11", c.data);
  aba.numero("I12", c.valorContratado);
  aba.limpar("I13"); // troco: o "valor contratado" do sistema ja e o valor financiado
  aba.limpar("I15"); // IOF: nao entra nos calculos (so no "total contratado")
  aba.formula("J14", "SUM(I12:I13)", c.valorContratado);
  aba.formula("I19", "SUM(I12:I18)", c.valorContratado);
  aba.numero("I20", c.totalParcelas);
  aba.numero("I21", c.parcela);
  aba.numero("I22", c.taxaContratada);
  data(aba, "I23", c.primeiraParcela);
  aba.formula("I24", `${T}D6`, c.taxaPraticada);
  aba.formula("I25", `${T}D14`, c.parcelaNaTaxaReferencia);
  // Parcelas vencidas desde a 1a parcela ate a data de referencia.
  aba.numero("I28", c.parcelasPagas);
  aba.formula("I29", `${T}$D$19`, c.quitacaoNaParcela);
  aba.formula("I30", "I28*I21", c.parcelasPagas * c.parcela);
  aba.cache("I34", percentualAcima(c.taxaPraticada, d.taxaMedia));

  aba.formula("I39", `'${ABAS_TOTAL.indices}'!F${LINHA_MEDIA_INDICES}`, d.taxaMedia);
  aba.formula("I40", `${T}D50`, h.parcelaNaTaxaReferencia);
  aba.formula("I43", `${T}D41`, h.quitacaoNaParcela);

  aba.numero("I49", i.taxaReferencia);
  aba.formula("I53", `${T}D26`, i.quitacaoNaParcela);
}

/**
 * Aba "TODOS 6 CALCULOS" (igual nas minutas Total e Parcial). As taxas da IN 28 e
 * media passam a vir das celulas de entrada informadas (antes eram digitadas ou
 * vinham de outras planilhas).
 */
export function preencherTodos(aba: Aba, d: DadosMinuta, celulaTetoIn28: string, celulaMedia: string) {
  const { contrato: c, hiscon: h, in28: i } = d;

  // Taxa cobrada e taxa contratual: continuam puxando da aba DADOS (contrato).
  aba.cache("D5", c.totalParcelas);
  aba.cache("D6", c.taxaPraticada);
  aba.cache("D7", c.parcela);
  aba.cache("D8", c.valorContratado);
  aba.cache("D12", c.totalParcelas);
  aba.cache("D13", c.taxaContratada);
  aba.cache("D14", c.parcelaNaTaxaReferencia);
  aba.cache("D15", c.valorContratado);
  aba.cache("F11", c.parcela);
  aba.cache("F13", c.parcelaNaTaxaReferencia);
  aba.cache("F15", c.diferencaParcela);
  aba.cache("D19", c.quitacaoNaParcela);
  aba.cache("D20", c.taxaContratada);
  aba.cache("D21", c.parcela);
  aba.cache("D22", c.valorContratado);

  // IN 28: dados do cenario IN 28.
  aba.cache("D26", i.quitacaoNaParcela);
  aba.formula("D27", celulaTetoIn28, i.taxaReferencia);
  aba.numero("D28", i.parcela);
  aba.numero("D29", i.valorContratado);
  aba.numero("D33", i.totalParcelas);
  aba.formula("D34", celulaTetoIn28, i.taxaReferencia);
  aba.cache("D35", i.parcelaNaTaxaReferencia);
  aba.numero("D36", i.valorContratado);
  aba.formula("F31", "D28", i.parcela);
  aba.cache("F33", i.parcelaNaTaxaReferencia);
  aba.cache("F35", i.diferencaParcela);

  // Taxa media: dados do Hiscon.
  aba.cache("D41", h.quitacaoNaParcela);
  aba.formula("D42", celulaMedia, h.taxaReferencia);
  aba.numero("D43", h.parcela);
  aba.numero("D44", h.valorContratado);
  aba.numero("D48", h.totalParcelas);
  aba.formula("D49", celulaMedia, h.taxaReferencia);
  aba.cache("D50", h.parcelaNaTaxaReferencia);
  aba.numero("D51", h.valorContratado);
  aba.cache("F47", h.parcela);
  aba.cache("F49", h.parcelaNaTaxaReferencia);
  aba.cache("F51", h.diferencaParcela);
}

const LINHA_INICIAL_INDICES = 7;
/** Posicoes do ranking do Bacen mostradas na aba (o modelo trazia 37; o escritorio usa ate a 20a). */
const POSICOES_INDICES = 20;
const LINHA_MEDIA_MODELO = 44; // linha da taxa media no modelo original
/** Linha da taxa media depois de remover as posicoes 21 em diante (logo abaixo da 20a). */
export const LINHA_MEDIA_INDICES = LINHA_INICIAL_INDICES + POSICOES_INDICES;

function preencherIndices(aba: Aba, d: DadosMinuta) {
  const b = d.bacen;
  data(aba, "D3", b.periodoInicio);
  data(aba, "G3", b.periodoFim);
  aba.texto("D4", b.modalidade);
  for (let k = 0; k < POSICOES_INDICES; k++) {
    const linha = LINHA_INICIAL_INDICES + k;
    const inst = b.ranking[k];
    if (inst) {
      aba.numero(`B${linha}`, inst.Posicao);
      aba.numero(`C${linha}`, Number(inst.cnpj8));
      aba.texto(`D${linha}`, inst.InstituicaoFinanceira);
      aba.numero(`F${linha}`, inst.TaxaJurosAoMes);
      aba.numero(`G${linha}`, inst.TaxaJurosAoAno);
    } else {
      for (const col of ["B", "C", "D", "F", "G"]) aba.limpar(`${col}${linha}`);
    }
  }

  // Remove as linhas das posicoes 21 em diante e sobe a linha da taxa media para
  // logo abaixo da 20a posicao (mantendo o estilo e a mesclagem D:E dela).
  const linhaMedia = aba.clonarLinha(LINHA_MEDIA_MODELO);
  aba.removerLinhasAPartirDe(LINHA_MEDIA_INDICES);
  aba.removerMesclagensAPartirDe(LINHA_MEDIA_INDICES);
  aba.inserirLinha(linhaMedia, LINHA_MEDIA_INDICES);
  aba.mesclar(`D${LINHA_MEDIA_INDICES}:E${LINHA_MEDIA_INDICES}`);
  aba.numero(`F${LINHA_MEDIA_INDICES}`, d.taxaMedia);
  aba.dimensao(`A1:J${LINHA_MEDIA_INDICES}`);
}

/** Quanto a taxa cobrada esta acima da taxa de referencia (formula das abas de percentual). */
export const percentualAcima = (cobrada: number, referencia: number) => (cobrada - referencia) / referencia;

/**
 * Abas de percentual: C3 = taxa de referencia, C4 = "Taxa Cobrada pelo Banco".
 * A taxa cobrada e SEMPRE a Taxa de Juros Praticada da aba TODOS 6 CALCULOS (D6).
 * Devolve o % acima (C5).
 */
function preencherPercentual(aba: Aba, referencia: number, praticada: number): number {
  const pct = percentualAcima(praticada, referencia);
  aba.cache("C3", referencia);
  aba.formula("C4", `${T}D6`, praticada);
  aba.cache("C5", pct);
  aba.cache("C61", pct);
  aba.cache("C62", 1 - pct);
  return pct;
}

type Celula = { formula: string; cache: number } | { valor: number } | { data: string };

function gravar(aba: Aba, ref: string, cel: Celula) {
  if ("formula" in cel) aba.formula(ref, cel.formula, cel.cache);
  else if ("data" in cel) data(aba, ref, cel.data);
  else aba.numero(ref, cel.valor);
}

/**
 * Cabecalho (linhas 2, 4 e 6) + cronograma de parcelas de uma aba de quitacao.
 * O cronograma e refeito do zero a partir das linhas-modelo da propria aba
 * (verde = quitada, vermelha = cobrada indevidamente, rotulo "QUITOU NA PARCELA").
 */
function preencherQuitacao(aba: Aba, r: ResultadoCenario, numeroContrato: string, cabecalho: Record<string, Celula>) {
  aba.texto("D2", numeroContrato.trim());
  for (const [ref, cel] of Object.entries(cabecalho)) gravar(aba, ref, cel);

  // Linhas-modelo (antes de apagar o cronograma antigo).
  const verde = aba.clonarLinha(8);
  const vermelha = aba.clonarLinha(76);
  let numeroRotulo = 0;
  for (let l = 8; l <= 80; l++) {
    if (!aba.temValor(`B${l}`) && aba.temValor(`C${l}`)) numeroRotulo = l;
  }
  if (!numeroRotulo) throw new Error("Não achei a linha 'QUITOU NA PARCELA' no modelo");
  const rotulo = aba.clonarLinha(numeroRotulo);
  const total = aba.clonarLinha(81);
  const dobro = aba.clonarLinha(82);

  aba.removerLinhasAPartirDe(8);
  aba.removerMesclagensAPartirDe(8);

  let linha = 8;
  let primeiraIndevida = 0;
  let ultimaIndevida = 0;

  const inserirRotulo = (textoRotulo: string) => {
    aba.inserirLinha(rotulo, linha);
    aba.texto(`C${linha}`, textoRotulo);
    aba.mesclar(`C${linha}:F${linha}`);
    linha++;
  };

  for (const p of r.cronograma) {
    aba.inserirLinha(p.cobradaIndevidamente ? vermelha : verde, linha);
    aba.numero(`B${linha}`, p.numero);
    data(aba, `C${linha}`, p.data);
    aba.numero(`D${linha}`, p.valor);
    aba.mesclar(`E${linha}:F${linha}`);
    if (p.cobradaIndevidamente) {
      primeiraIndevida ||= linha;
      ultimaIndevida = linha;
    }
    linha++;
    if (p.numero === r.quitacaoNaParcela) inserirRotulo(`QUITOU NA PARCELA ${r.quitacaoNaParcela}ª`);
  }
  if (r.quitacaoNaParcela > r.totalParcelas) {
    inserirRotulo(`QUITAÇÃO SÓ NA PARCELA ${r.quitacaoNaParcela}ª - SEM PARCELAS A MAIS`);
  }

  const linhaTotal = aba.inserirLinha(total, linha++);
  if (primeiraIndevida) aba.formula(`D${linhaTotal}`, `SUM(D${primeiraIndevida}:D${ultimaIndevida})`, r.indebito);
  else aba.numero(`D${linhaTotal}`, 0);
  aba.mesclar(`B${linhaTotal}:C${linhaTotal}`);

  const linhaDobro = aba.inserirLinha(dobro, linha);
  aba.formula(`D${linhaDobro}`, `D${linhaTotal}*2`, r.indebitoDobro);
  aba.mesclar(`B${linhaDobro}:C${linhaDobro}`);

  aba.dimensao(`B1:F${linhaDobro}`);
  aba.voltarAoTopo();
}

export async function preencherMinutaTotal(modelo: ArrayBuffer | Uint8Array, d: DadosMinuta): Promise<Uint8Array> {
  const pasta = await Pasta.abrir(modelo);
  const { contrato: c, hiscon: h, in28: i } = d;
  const contrato = d.identificacao.numeroContrato;

  preencherDados(pasta.aba(ABAS_TOTAL.dados), d);
  const datas = pasta.aba(ABAS_TOTAL.datas);
  data(datas, "E2", d.identificacao.dataReferencia);
  // Estas duas vinham de outra planilha (vinculo externo, removido do arquivo).
  datas.numero("F7", c.totalParcelas);
  data(datas, "C10", c.data);
  preencherTodos(pasta.aba(ABAS_TOTAL.todos), d, `${D}I49`, `${D}I39`);
  preencherIndices(pasta.aba(ABAS_TOTAL.indices), d);

  const praticada = c.taxaPraticada; // 'TODOS 6 CALCULOS'!D6
  const pctMedia = preencherPercentual(pasta.aba(ABAS_TOTAL.percentualMedia), d.taxaMedia, praticada);
  const pctIn28 = preencherPercentual(pasta.aba(ABAS_TOTAL.percentualIn28), i.taxaReferencia, praticada);
  const pctContrato = preencherPercentual(pasta.aba(ABAS_TOTAL.percentualContrato), c.taxaContratada, praticada);

  // Graficos das abas de percentual: passam a usar as celulas da propria aba.
  await atualizarGraficosDaAba(pasta, ABAS_TOTAL.percentualMedia, {
    taxaReferencia: d.taxaMedia,
    taxaCobrada: praticada,
    percentual: pctMedia,
  });
  await atualizarGraficosDaAba(pasta, ABAS_TOTAL.percentualIn28, {
    taxaReferencia: i.taxaReferencia,
    taxaCobrada: praticada,
    percentual: pctIn28,
  });
  await atualizarGraficosDaAba(pasta, ABAS_TOTAL.percentualContrato, {
    taxaReferencia: c.taxaContratada,
    taxaCobrada: praticada,
    percentual: pctContrato,
  });

  // 1.1.1 -- Hiscon x taxa media do Bacen
  preencherQuitacao(pasta.aba(ABAS_TOTAL.quitacaoMedia), h, contrato, {
    B4: { data: h.data },
    C4: { valor: h.taxaContratada },
    D4: { formula: `${D}I39`, cache: d.taxaMedia },
    E4: { formula: `${T}D6`, cache: praticada },
    F4: { formula: `${T}D41`, cache: h.quitacaoNaParcela },
    B6: { data: h.primeiraParcela },
    C6: { formula: `${T}D48`, cache: h.totalParcelas },
    D6: { formula: `${T}D43`, cache: h.parcela },
    E6: { formula: `${T}D50`, cache: h.parcelaNaTaxaReferencia },
    F6: { valor: h.parcelasPagas },
  });

  // 2.2.2 -- IN 28 (a coluna D mostra a taxa da IN 28 em vez da taxa media)
  const in28 = pasta.aba(ABAS_TOTAL.quitacaoIn28);
  in28.texto("D3", "TAXA\nIN 28");
  preencherQuitacao(in28, i, contrato, {
    B4: { data: i.data },
    C4: { valor: i.taxaContratada },
    D4: { formula: `${D}I49`, cache: i.taxaReferencia },
    E4: { formula: `${T}D6`, cache: praticada },
    F4: { formula: `${T}D26`, cache: i.quitacaoNaParcela },
    B6: { data: i.primeiraParcela },
    C6: { formula: `${T}D33`, cache: i.totalParcelas },
    D6: { formula: `${T}D28`, cache: i.parcela },
    E6: { formula: `${T}D35`, cache: i.parcelaNaTaxaReferencia },
    F6: { valor: i.parcelasPagas },
  });

  // 3.3.3 -- contrato bancario x taxa contratual (corrige B6 e F6, que apontavam para celulas erradas)
  preencherQuitacao(pasta.aba(ABAS_TOTAL.quitacaoContrato), c, contrato, {
    B4: { formula: `${D}I11`, cache: serialExcel(c.data) },
    C4: { formula: `${D}I22`, cache: c.taxaContratada },
    D4: { formula: `${D}I39`, cache: d.taxaMedia },
    E4: { formula: `${D}I24`, cache: c.taxaPraticada },
    F4: { formula: `${D}I29`, cache: c.quitacaoNaParcela },
    B6: { formula: `${D}I23`, cache: serialExcel(c.primeiraParcela) },
    C6: { formula: `${D}I20`, cache: c.totalParcelas },
    D6: { formula: `${D}I21`, cache: c.parcela },
    E6: { formula: `${D}I25`, cache: c.parcelaNaTaxaReferencia },
    F6: { formula: `${D}I28`, cache: c.parcelasPagas },
  });

  return pasta.gerar();
}
