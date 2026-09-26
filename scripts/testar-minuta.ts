// Teste de ponta a ponta do preenchimento da Minuta, fora do navegador.
// Uso: npx tsx scripts/testar-minuta.ts <pasta-de-saida>
// Gera minuta-total-teste.xlsx e minuta-parcial-teste.xlsx.
// Usa valores de exemplo (cliente ficticio) e a taxa media real do Bacen.

import { readFileSync, writeFileSync } from "node:fs";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { RegistroTaxa, ResultadoTop5 } from "../src/services/bacen";
import { calcularCenario, resumoParcial, taxaMediaParaCalculo } from "../src/services/calculoCenarios";
import { MODELOS } from "../src/services/modelosMinuta";
import type { DadosCenario } from "../src/types/cenarios";

Object.assign(globalThis, { DOMParser, XMLSerializer });

const pastaSaida = process.argv[2] ?? ".";
const MODALIDADE = "Crédito pessoal consignado INSS - Prefixado";

async function bacen(inicio: string): Promise<ResultadoTop5> {
  const filtro = `InicioPeriodo eq '${inicio}' and Segmento eq 'PESSOA FÍSICA' and Modalidade eq '${MODALIDADE}'`;
  const url =
    "https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosDiariaPorInicioPeriodo?" +
    new URLSearchParams({ $format: "json", $filter: filtro, $top: "100" }).toString().replace(/\+/g, "%20");
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const ranking = ((await r.json()) as { value: RegistroTaxa[] }).value.sort((a, b) => a.Posicao - b.Posicao);
  const top = ranking.slice(0, 5);
  return {
    dataReferencia: inicio,
    periodoInicio: inicio,
    periodoFim: ranking[0].FimPeriodo,
    segmento: "PESSOA FÍSICA",
    modalidade: MODALIDADE,
    totalInstituicoes: ranking.length,
    instituicoes: top,
    ranking,
    mediaAoMes: top.reduce((s, i) => s + i.TaxaJurosAoMes, 0) / top.length,
    mediaAoAno: null,
  };
}

const base: DadosCenario = {
  data: "2023-08-10",
  banco: "BANCO EXEMPLO",
  valorContratadoCentavos: 4531844,
  valorParcelaCentavos: 122135,
  taxaJuros: "1,97",
  totalParcelas: 72,
  dataPrimeiraParcela: "2023-10-09",
  taxaTetoIn28: "",
};
const dataReferencia = "2026-08-30";

const top = await bacen(base.data);
const taxaMedia = taxaMediaParaCalculo(top.mediaAoMes!);

const calc = (id: "contrato" | "hiscon" | "in28", c: DadosCenario) => {
  const r = calcularCenario(id, c, dataReferencia, taxaMedia);
  if (!r.ok) throw new Error(`${id}: ${r.erro ?? r.faltando.join(", ")}`);
  return r.resultado;
};
const contrato = calc("contrato", base);
const hiscon = calc("hiscon", base);
const in28 = calc("in28", { ...base, taxaTetoIn28: "1,97" });

const dados = {
  identificacao: { nomeCliente: "CLIENTE TESTE", numeroContrato: "12345678", dataReferencia },
  contrato,
  hiscon,
  in28,
  bacen: top,
  taxaMedia,
};
for (const m of Object.values(MODELOS)) {
  const modelo = readFileSync(`public${m.arquivo}`);
  const saida = `${pastaSaida}/minuta-${m.id}-teste.xlsx`;
  writeFileSync(saida, await m.preencher(modelo, dados));
  console.log("gerado:", saida);
}

const resumo = (nome: string, r: typeof contrato) => ({
  aba: nome,
  taxaRef: r.taxaReferencia,
  praticada: +r.taxaPraticada.toFixed(6),
  parcelaRecalc: +r.parcelaNaTaxaReferencia.toFixed(2),
  quitacao: r.quitacaoNaParcela,
  pagas: r.parcelasPagas,
  indevidas: r.parcelasIndevidas,
  indebito: r.indebito,
  dobro: r.indebitoDobro,
});
const resumoP = (nome: string, r: typeof contrato) => {
  const p = resumoParcial(r);
  return { aba: nome, parcelaRecalc: p.parcelaRecalculada, pagas: p.pagas.length, indebito: p.indebito, dobro: p.indebitoDobro,
    aVencer: p.aVencer.length, devidoContrato: p.devidoTaxaContrato, devidoRef: p.devidoTaxaReferencia, economia: p.economia, total: p.totalGeral };
};
console.log("media top5 Bacen:", top.mediaAoMes, "-> usada", taxaMedia);
console.log("MINUTA TOTAL");
console.table([resumo("1.1.1 hiscon", hiscon), resumo("2.2.2 in28", in28), resumo("3.3.3 contrato", contrato)]);
console.log("MINUTA PARCIAL");
console.table([resumoP("1.1 hiscon", hiscon), resumoP("2.2 in28", in28), resumoP("3.3 contrato", contrato)]);
