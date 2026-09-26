// Preenche a planilha "Minuta Parcial finalizado" com os 3 cenarios:
//   Contrato bancario -> DADOS APLICAÇÃO CALCULO + 3.3 QUITAÇÃO TAXA CONTRATUAL
//   Hiscon            -> 1.1 QUITACAO PARCIAL TAXA MEDIA (taxa media do Bacen na data da inclusao)
//   IN 28             -> 2.2 QUITAÇÃO PARCIAL TAX IN 28
//
// Diferente da Minuta Total, cada aba de quitacao tem dois blocos: as parcelas ja
// pagas (diferenca parcela a parcela = indebito) e as parcelas a vencer (total
// devido na taxa do contrato x na taxa de referencia = economia).
//
// O modelo original tinha varias formulas apontando para OUTRAS planilhas
// ([1], [2]...) e #REF!: aqui todas passam a apontar para celulas desta pasta.

import { resumoParcial, type ResultadoCenario, type ResumoParcial } from "./calculoCenarios";
import { serialExcel } from "./financeiro";
import { atualizarGraficosDaAba } from "./graficos";
import { data, percentualAcima, preencherTodos, type DadosMinuta } from "./minuta";
import { Pasta, type Aba } from "./xlsx";

export const ABAS_PARCIAL = {
  dados: "DADOS APLICAÇÃO CALCULO",
  datas: "CALCULO DE DATAS",
  taxaMedia: "TAXA MEDIA ",
  todos: "TODOS 6 CALCULOS",
  quitacaoMedia: "1.1 QUITACAO PARCIAL TAXA MEDIA",
  indiceMedia: "1.1. INDICE ACIMA TAXA MEDIA",
  quitacaoIn28: "2.2 QUITAÇÃO PARCIAL TAX IN 28",
  indiceIn28: "2.2 INDICE ACIMA DA TAXA IN 28",
  quitacaoContrato: "3.3 QUITAÇÃO TAXA CONTRATUAL",
  indiceContrato: "3.3 INDICE ACIMA TAXA CONTRATUA",
} as const;

const D = `'${ABAS_PARCIAL.dados}'!`;
const T = `'${ABAS_PARCIAL.todos}'!`;

function preencherDados(aba: Aba, d: DadosMinuta, pc: ResumoParcial) {
  const { contrato: c, hiscon: h, in28: i, identificacao: id } = d;

  aba.texto("F3", id.nomeCliente.trim());
  aba.texto("F4", id.numeroContrato.trim());
  data(aba, "F5", c.data);
  // Dados do caso anterior que o sistema ainda nao coleta: ficam em branco.
  aba.limpar("F6");
  aba.limpar("F7");

  data(aba, "I10", c.data);
  aba.numero("I11", c.valorContratado);
  aba.limpar("I12"); // troco: o "valor contratado" do sistema ja e o valor financiado
  aba.limpar("I14"); // IOF: nao entra nos calculos
  aba.formula("J13", "SUM(I11:I12)", c.valorContratado);
  aba.formula("I18", "SUM(I11:I17)", c.valorContratado);
  aba.numero("I19", c.totalParcelas);
  aba.numero("I20", c.parcela);
  aba.numero("I21", c.taxaContratada);
  data(aba, "I22", c.primeiraParcela);
  aba.formula("I23", `${T}D6`, c.taxaPraticada);
  aba.formula("I24", `${T}D14`, c.parcelaNaTaxaReferencia);
  aba.numero("I27", c.parcelasPagas);
  aba.formula("I28", `${T}$D$19`, c.quitacaoNaParcela);
  aba.formula("I29", "I27*I20", c.parcelasPagas * c.parcela);
  aba.formula("I33", `'${ABAS_PARCIAL.indiceContrato}'!C5`, pc.percentualAcima);

  aba.formula("I38", `'${ABAS_PARCIAL.taxaMedia}'!E46`, d.taxaMedia);
  aba.formula("I39", `${T}D50`, h.parcelaNaTaxaReferencia);
  aba.formula("I42", `${T}D41`, h.quitacaoNaParcela);

  aba.numero("I48", i.taxaReferencia);
  aba.formula("I52", `${T}D26`, i.quitacaoNaParcela);
}

function preencherDatas(aba: Aba, d: DadosMinuta) {
  const ref = d.identificacao.dataReferencia;
  data(aba, "E4", ref); // fim do periodo considerado
  data(aba, "K4", ref); // "mes atual"
  aba.numero("F9", d.contrato.totalParcelas); // antes vinha de outra planilha
  data(aba, "E18", ref); // antes vinha de outra planilha
}

const LINHA_INICIAL_TAXAS = 8;
const LINHAS_TAXAS = 37; // linhas 8 a 44 no modelo

function preencherTaxaMedia(aba: Aba, d: DadosMinuta) {
  const b = d.bacen;
  data(aba, "D4", b.periodoInicio);
  data(aba, "F4", b.periodoFim);
  aba.texto("D5", b.modalidade);
  for (let k = 0; k < LINHAS_TAXAS; k++) {
    const linha = LINHA_INICIAL_TAXAS + k;
    const inst = b.ranking[k];
    if (inst) {
      aba.numero(`B${linha}`, inst.Posicao);
      aba.numero(`C${linha}`, Number(inst.cnpj8));
      aba.texto(`D${linha}`, inst.InstituicaoFinanceira);
      aba.numero(`E${linha}`, inst.TaxaJurosAoMes);
      aba.numero(`F${linha}`, inst.TaxaJurosAoAno);
    } else {
      for (const col of ["B", "C", "D", "E", "F"]) aba.limpar(`${col}${linha}`);
    }
  }
  aba.cache("E45", b.mediaAoMes ?? 0);
  aba.numero("E46", d.taxaMedia);
}

/**
 * Abas de indice: C3 = taxa de referencia, C4 = "Taxa Cobrada pelo Banco".
 * A taxa cobrada e SEMPRE a Taxa de Juros Praticada da aba TODOS 6 CALCULOS (D6).
 * Devolve o % acima (C5).
 */
function preencherIndice(aba: Aba, referencia: number, praticada: number, formulaRef?: string): number {
  const pct = percentualAcima(praticada, referencia);
  if (formulaRef) aba.formula("C3", formulaRef, referencia);
  else aba.cache("C3", referencia);
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

/** Linhas do modelo usadas como molde em cada aba de quitacao parcial. */
interface LinhasModelo {
  paga: number;
  totalIndebito: number;
  dobro: number;
  aVencer: number;
  devidoContrato: number;
  devidoReferencia: number;
  economia: number;
}

const LINHAS: Record<"media" | "in28" | "contrato", LinhasModelo> = {
  media: { paga: 9, totalIndebito: 64, dobro: 65, aVencer: 66, devidoContrato: 91, devidoReferencia: 92, economia: 93 },
  in28: { paga: 9, totalIndebito: 45, dobro: 46, aVencer: 47, devidoContrato: 91, devidoReferencia: 92, economia: 93 },
  contrato: { paga: 9, totalIndebito: 45, dobro: 46, aVencer: 47, devidoContrato: 84, devidoReferencia: 85, economia: 86 },
};

/**
 * Cabecalho (linhas 3, 5 e 7) + os dois blocos de parcelas, refeitos do zero a
 * partir das linhas-modelo da propria aba (mantem cores, bordas e formatos).
 */
function preencherQuitacao(
  aba: Aba,
  pc: ResumoParcial,
  numeroContrato: string,
  cabecalho: Record<string, Celula>,
  l: LinhasModelo,
) {
  aba.texto("D3", numeroContrato.trim());
  for (const [ref, cel] of Object.entries(cabecalho)) gravar(aba, ref, cel);

  const molde = {
    paga: aba.clonarLinha(l.paga),
    totalIndebito: aba.clonarLinha(l.totalIndebito),
    dobro: aba.clonarLinha(l.dobro),
    aVencer: aba.clonarLinha(l.aVencer),
    devidoContrato: aba.clonarLinha(l.devidoContrato),
    devidoReferencia: aba.clonarLinha(l.devidoReferencia),
    economia: aba.clonarLinha(l.economia),
  };
  aba.removerLinhasAPartirDe(9);
  aba.removerMesclagensAPartirDe(9);

  let linha = 9;

  // Bloco 1: parcelas ja pagas.
  const inicioPagas = linha;
  for (const p of pc.pagas) {
    aba.inserirLinha(molde.paga, linha);
    aba.numero(`B${linha}`, p.numero);
    data(aba, `C${linha}`, p.data);
    aba.numero(`D${linha}`, p.valor);
    aba.numero(`E${linha}`, p.valorRecalculado);
    aba.formula(`F${linha}`, `D${linha}-E${linha}`, p.diferenca);
    linha++;
  }
  const fimPagas = linha - 1;

  const lt = aba.inserirLinha(molde.totalIndebito, linha++);
  if (pc.pagas.length) aba.formula(`F${lt}`, `SUM(F${inicioPagas}:F${fimPagas})`, pc.indebito);
  else aba.numero(`F${lt}`, 0);
  const ld = aba.inserirLinha(molde.dobro, linha++);
  aba.formula(`F${ld}`, `F${lt}*2`, pc.indebitoDobro);
  aba.mesclar(`B${lt}:C${ld}`);
  aba.mesclar(`D${lt}:E${lt}`);
  aba.mesclar(`D${ld}:E${ld}`);

  // Bloco 2: parcelas a vencer.
  const inicioAVencer = linha;
  for (const p of pc.aVencer) {
    aba.inserirLinha(molde.aVencer, linha);
    aba.numero(`B${linha}`, p.numero);
    data(aba, `C${linha}`, p.data);
    aba.numero(`D${linha}`, p.valor);
    aba.numero(`E${linha}`, p.valorRecalculado);
    linha++;
  }
  const fimAVencer = linha - 1;
  const temAVencer = pc.aVencer.length > 0;

  const lc = aba.inserirLinha(molde.devidoContrato, linha++);
  if (temAVencer) aba.formula(`D${lc}`, `SUM(D${inicioAVencer}:D${fimAVencer})`, pc.devidoTaxaContrato);
  else aba.numero(`D${lc}`, 0);
  aba.mesclar(`B${lc}:C${lc}`);

  const lr = aba.inserirLinha(molde.devidoReferencia, linha++);
  if (temAVencer) aba.formula(`E${lr}`, `SUM(E${inicioAVencer}:E${fimAVencer})`, pc.devidoTaxaReferencia);
  else aba.numero(`E${lr}`, 0);
  aba.mesclar(`B${lr}:D${lr}`);

  const le = aba.inserirLinha(molde.economia, linha);
  aba.formula(`E${le}`, `D${lc}-E${lr}`, pc.economia);
  aba.formula(`F${le}`, `E${le}+F${ld}`, pc.totalGeral);
  aba.mesclar(`C${le}:D${le}`);

  aba.dimensao(`B1:G${le}`);
  aba.voltarAoTopo();
}

/** Cabecalho de uma aba de quitacao ligado aos calculos da aba TODOS 6 CALCULOS. */
function cabecalhoTodos(
  r: ResultadoCenario,
  celulaTaxaRef: string,
  todos: { nper: string; n: string; parcela: string; pmt: string },
  praticada: number,
): Record<string, Celula> {
  return {
    B5: { data: r.data },
    C5: { valor: r.taxaContratada },
    D5: { formula: celulaTaxaRef, cache: r.taxaReferencia },
    E5: { formula: `${T}D6`, cache: praticada },
    F5: { formula: `${T}${todos.nper}`, cache: r.quitacaoNaParcela },
    B7: { data: r.primeiraParcela },
    C7: { formula: `${T}${todos.n}`, cache: r.totalParcelas },
    D7: { formula: `${T}${todos.parcela}`, cache: r.parcela },
    E7: { formula: `${T}${todos.pmt}`, cache: r.parcelaNaTaxaReferencia },
    F7: { valor: r.parcelasPagas },
  };
}

export async function preencherMinutaParcial(modelo: ArrayBuffer | Uint8Array, d: DadosMinuta): Promise<Uint8Array> {
  const pasta = await Pasta.abrir(modelo);
  const { contrato: c, hiscon: h, in28: i } = d;
  const contrato = d.identificacao.numeroContrato;
  const pc = { contrato: resumoParcial(c), hiscon: resumoParcial(h), in28: resumoParcial(i) };

  preencherDados(pasta.aba(ABAS_PARCIAL.dados), d, pc.contrato);
  preencherDatas(pasta.aba(ABAS_PARCIAL.datas), d);
  preencherTaxaMedia(pasta.aba(ABAS_PARCIAL.taxaMedia), d);
  preencherTodos(pasta.aba(ABAS_PARCIAL.todos), d, `${D}I48`, `${D}I38`);

  const praticada = c.taxaPraticada; // 'TODOS 6 CALCULOS'!D6
  const pctMedia = preencherIndice(pasta.aba(ABAS_PARCIAL.indiceMedia), d.taxaMedia, praticada);
  const pctIn28 = preencherIndice(pasta.aba(ABAS_PARCIAL.indiceIn28), i.taxaReferencia, praticada, `${D}I48`);
  const pctContrato = preencherIndice(pasta.aba(ABAS_PARCIAL.indiceContrato), c.taxaContratada, praticada);

  // Graficos das abas de indice: passam a usar as celulas da propria aba.
  await atualizarGraficosDaAba(pasta, ABAS_PARCIAL.indiceMedia, {
    taxaReferencia: d.taxaMedia,
    taxaCobrada: praticada,
    percentual: pctMedia,
  });
  await atualizarGraficosDaAba(pasta, ABAS_PARCIAL.indiceIn28, {
    taxaReferencia: i.taxaReferencia,
    taxaCobrada: praticada,
    percentual: pctIn28,
  });
  await atualizarGraficosDaAba(pasta, ABAS_PARCIAL.indiceContrato, {
    taxaReferencia: c.taxaContratada,
    taxaCobrada: praticada,
    percentual: pctContrato,
  });

  // 1.1 -- Hiscon x taxa media do Bacen
  preencherQuitacao(
    pasta.aba(ABAS_PARCIAL.quitacaoMedia),
    pc.hiscon,
    contrato,
    cabecalhoTodos(h, `${D}I38`, { nper: "D41", n: "D48", parcela: "D43", pmt: "D50" }, praticada),
    LINHAS.media,
  );

  // 2.2 -- IN 28 (antes usava a parcela da taxa media no lugar da parcela pela IN 28)
  preencherQuitacao(
    pasta.aba(ABAS_PARCIAL.quitacaoIn28),
    pc.in28,
    contrato,
    cabecalhoTodos(i, `${D}I48`, { nper: "D26", n: "D33", parcela: "D28", pmt: "D35" }, praticada),
    LINHAS.in28,
  );

  // 3.3 -- contrato bancario x taxa contratual
  preencherQuitacao(
    pasta.aba(ABAS_PARCIAL.quitacaoContrato),
    pc.contrato,
    contrato,
    {
      B5: { formula: `${D}F5`, cache: serialExcel(c.data) },
      C5: { formula: `${D}I21`, cache: c.taxaContratada },
      D5: { formula: `${D}I38`, cache: d.taxaMedia },
      E5: { formula: `${D}I23`, cache: c.taxaPraticada },
      F5: { formula: `${D}I28`, cache: c.quitacaoNaParcela },
      B7: { formula: `${D}I22`, cache: serialExcel(c.primeiraParcela) },
      C7: { formula: `${D}I19`, cache: c.totalParcelas },
      D7: { formula: `${D}I20`, cache: c.parcela },
      E7: { formula: `${D}I24`, cache: c.parcelaNaTaxaReferencia },
      F7: { formula: `${D}I27`, cache: c.parcelasPagas },
    },
    LINHAS.contrato,
  );

  return pasta.gerar();
}
