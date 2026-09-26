// Regras de periodo da API do Bacen (TaxasJurosDiariaPorInicioPeriodo).
// Cada dia util e um "InicioPeriodo" valido; o periodo cobre esse dia mais os
// 4 dias uteis seguintes (pulando fins de semana) -- nao e sempre seg a sex.

export const DATA_MINIMA = "2012-01-02";

/** Cria uma data local (sem fuso) a partir de "aaaa-mm-dd". */
export function isoParaData(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function dataParaIso(data: Date): string {
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${m}-${d}`;
}

export function hojeIso(): string {
  return dataParaIso(new Date());
}

function somarDias(data: Date, dias: number): Date {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

const ehFimDeSemana = (data: Date) => data.getDay() === 0 || data.getDay() === 6;

/** A propria data se for dia util, senao o ultimo dia util anterior. */
export function diaUtilAnteriorOuIgual(data: Date): Date {
  let atual = new Date(data);
  while (ehFimDeSemana(atual)) atual = somarDias(atual, -1);
  return atual;
}

/** Dia util imediatamente anterior (usado para retroceder na busca). */
export function diaUtilAnterior(data: Date): Date {
  return diaUtilAnteriorOuIgual(somarDias(data, -1));
}

/** FimPeriodo correspondente a um InicioPeriodo: o dia + 4 dias uteis seguintes. */
export function fimPeriodo(inicio: Date): Date {
  let fim = new Date(inicio);
  let somados = 0;
  while (somados < 4) {
    fim = somarDias(fim, 1);
    if (!ehFimDeSemana(fim)) somados++;
  }
  return fim;
}
