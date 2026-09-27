// Calculos salvos no Supabase (tabela public.calculos -- ver supabase/schema.sql).

import type { Cenarios, IdCenario, Identificacao } from "../types/cenarios";
import { cenarioVazio } from "../types/cenarios";
import type { ResultadoTop5 } from "./bacen";
import { resumoParcial, type Calculo } from "./calculoCenarios";
import type { IdModelo } from "./modelosMinuta";
import { supabase } from "./supabase";

const TABELA = "calculos";

export interface ResumoSalvo {
  id: string;
  criadoEm: string;
  atualizadoEm: string;
  nomeCliente: string;
  numeroContrato: string;
  /** "aaaa-mm-dd" */
  dataReferencia: string;
  modelo: IdModelo | null;
}

export interface CalculoSalvo extends ResumoSalvo {
  identificacao: Identificacao;
  cenarios: Cenarios;
}

export interface DadosParaSalvar {
  identificacao: Identificacao;
  cenarios: Cenarios;
  modelo: IdModelo;
  calculos: Record<IdCenario, Calculo>;
  bacen: ResultadoTop5 | null;
  taxaMedia: number | null;
}

function cliente() {
  if (!supabase) throw new Error("Banco de dados não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).");
  return supabase;
}

/** Mensagem legivel para os erros mais comuns do Supabase. */
function erroDoBanco(e: { message?: string; code?: string } | null): Error {
  if (e?.code === "PGRST205" || e?.code === "42P01") {
    return new Error("A tabela 'calculos' ainda não existe no Supabase. Rode o arquivo supabase/schema.sql no SQL Editor.");
  }
  if (e?.code === "42501") return new Error("O Supabase recusou a gravação (permissões da tabela).");
  return new Error(e?.message ?? "Erro desconhecido no banco de dados.");
}

/** Resumo dos resultados de cada aba (Total e Parcial) para consulta no banco. */
function resumirResultados(calculos: Record<IdCenario, Calculo>) {
  const saida: Record<string, unknown> = {};
  for (const [id, calc] of Object.entries(calculos)) {
    if (!calc.ok) {
      saida[id] = { completo: false, faltando: calc.faltando, erro: calc.erro ?? null };
      continue;
    }
    const r = calc.resultado;
    const p = resumoParcial(r);
    saida[id] = {
      completo: true,
      taxaReferencia: r.taxaReferencia,
      taxaPraticada: r.taxaPraticada,
      total: {
        parcelaRecalculada: r.parcelaNaTaxaReferencia,
        quitacaoNaParcela: r.quitacaoNaParcela,
        parcelasPagas: r.parcelasPagas,
        parcelasRestantes: r.parcelasIndevidas,
        indebito: r.indebito,
        indebitoDobro: r.indebitoDobro,
      },
      parcial: {
        parcelaRecalculada: p.parcelaRecalculada,
        parcelasPagas: p.pagas.length,
        parcelasAVencer: p.aVencer.length,
        indebito: p.indebito,
        indebitoDobro: p.indebitoDobro,
        devidoTaxaContrato: p.devidoTaxaContrato,
        devidoTaxaReferencia: p.devidoTaxaReferencia,
        economia: p.economia,
        totalGeral: p.totalGeral,
      },
    };
  }
  return saida;
}

type Linha = {
  id: string;
  criado_em: string;
  atualizado_em: string;
  nome_cliente: string | null;
  numero_contrato: string | null;
  data_referencia: string | null;
  modelo: IdModelo | null;
  cenarios?: Partial<Cenarios>;
};

const paraResumo = (l: Linha): ResumoSalvo => ({
  id: l.id,
  criadoEm: l.criado_em,
  atualizadoEm: l.atualizado_em,
  nomeCliente: l.nome_cliente ?? "",
  numeroContrato: l.numero_contrato ?? "",
  dataReferencia: l.data_referencia ?? "",
  modelo: l.modelo,
});

/** Grava o calculo: cria um registro novo ou atualiza o existente (idExistente). Devolve o id. */
export async function salvarCalculo(d: DadosParaSalvar, idExistente?: string | null): Promise<ResumoSalvo> {
  const registro = {
    nome_cliente: d.identificacao.nomeCliente.trim() || null,
    numero_contrato: d.identificacao.numeroContrato.trim() || null,
    data_referencia: d.identificacao.dataReferencia || null,
    modelo: d.modelo,
    cenarios: d.cenarios,
    taxa_media: d.taxaMedia,
    bacen: d.bacen
      ? {
          modalidade: d.bacen.modalidade,
          periodoInicio: d.bacen.periodoInicio,
          periodoFim: d.bacen.periodoFim,
          mediaAoMes: d.bacen.mediaAoMes,
          top5: d.bacen.instituicoes.map((i) => ({
            posicao: i.Posicao,
            instituicao: i.InstituicaoFinanceira,
            taxaMes: i.TaxaJurosAoMes,
            taxaAno: i.TaxaJurosAoAno,
          })),
        }
      : null,
    resultados: resumirResultados(d.calculos),
  };
  const colunas = "id, criado_em, atualizado_em, nome_cliente, numero_contrato, data_referencia, modelo";
  const consulta = idExistente
    ? cliente().from(TABELA).update(registro).eq("id", idExistente).select(colunas).single()
    : cliente().from(TABELA).insert(registro).select(colunas).single();
  const { data, error } = await consulta;
  if (error) throw erroDoBanco(error);
  return paraResumo(data as Linha);
}

/** Ultimos calculos salvos (mais recentes primeiro), filtrando por cliente ou contrato. */
export async function listarCalculos(busca = "", limite = 1000): Promise<ResumoSalvo[]> {
  let consulta = cliente()
    .from(TABELA)
    .select("id, criado_em, atualizado_em, nome_cliente, numero_contrato, data_referencia, modelo")
    .order("atualizado_em", { ascending: false })
    .limit(limite);
  const termo = busca.trim().replace(/[%,()]/g, " ");
  if (termo) consulta = consulta.or(`nome_cliente.ilike.%${termo}%,numero_contrato.ilike.%${termo}%`);
  const { data, error } = await consulta;
  if (error) throw erroDoBanco(error);
  return (data as Linha[]).map(paraResumo);
}

/** Carrega um calculo salvo completo, pronto para voltar ao formulario. */
export async function carregarCalculo(id: string): Promise<CalculoSalvo> {
  const { data, error } = await cliente().from(TABELA).select("*").eq("id", id).single();
  if (error) throw erroDoBanco(error);
  const l = data as Linha;
  const salvos = l.cenarios ?? {};
  const cenarios: Cenarios = {
    contrato: { ...cenarioVazio(), ...salvos.contrato },
    hiscon: { ...cenarioVazio(), ...salvos.hiscon },
    in28: { ...cenarioVazio(), ...salvos.in28 },
  };
  return {
    ...paraResumo(l),
    identificacao: {
      nomeCliente: l.nome_cliente ?? "",
      numeroContrato: l.numero_contrato ?? "",
      dataReferencia: l.data_referencia ?? new Date().toISOString().slice(0, 10),
    },
    cenarios,
  };
}
