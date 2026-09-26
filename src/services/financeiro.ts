// Calculos financeiros equivalentes as funcoes do Excel usadas na Minuta
// (RATE / PMT / NPER / EDATE / ARRED). Taxas sempre em DECIMAL (1,97% = 0.0197).

/** ARRED do Excel: arredondamento "metade para cima" (o Math.round do JS erra em x,5 negativos e em binario). */
export function arred(valor: number, casas = 0): number {
  const fator = 10 ** casas;
  return Math.sign(valor) * Math.round(Math.abs(valor) * fator + Number.EPSILON) / fator;
}

/** -PMT(taxa; n; vp): parcela fixa de um financiamento (tabela Price). */
export function pmt(taxa: number, n: number, valor: number): number {
  if (taxa === 0) return valor / n;
  return (valor * taxa) / (1 - (1 + taxa) ** -n);
}

/** NPER(taxa; parcela; -vp): quantas parcelas quitam o valor. Lanca erro se a parcela nao cobre os juros. */
export function nper(taxa: number, parcela: number, valor: number): number {
  if (taxa === 0) return valor / parcela;
  const base = 1 - (valor * taxa) / parcela;
  if (base <= 0) throw new Error("A parcela não cobre nem os juros do mês; a dívida nunca seria quitada.");
  return -Math.log(base) / Math.log(1 + taxa);
}

/** RATE(n; -parcela; vp): taxa de juros efetivamente praticada (bissecao; pmt cresce com a taxa). */
export function rate(n: number, parcela: number, valor: number): number {
  if (parcela * n <= valor) return 0;
  let baixo = 0;
  let alto = 1;
  while (pmt(alto, n, valor) < parcela) alto *= 2;
  for (let i = 0; i < 200; i++) {
    const meio = (baixo + alto) / 2;
    if (pmt(meio, n, valor) < parcela) baixo = meio;
    else alto = meio;
  }
  return (baixo + alto) / 2;
}

/** EDATE do Excel: soma meses mantendo o dia (limitado ao ultimo dia do mes). Datas "aaaa-mm-dd". */
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const total = a * 12 + (m - 1) + meses;
  const ano = Math.floor(total / 12);
  const mes = total % 12;
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const dia = Math.min(d, ultimoDia);
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Numero de serie de data do Excel (dias desde 30/12/1899). */
export function serialExcel(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return (Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/** Quantas parcelas ja venceram ate a data de referencia (a 1a parcela conta no proprio dia). */
export function parcelasVencidas(primeiraParcela: string, totalParcelas: number, dataReferencia: string): number {
  let vencidas = 0;
  while (vencidas < totalParcelas && somarMeses(primeiraParcela, vencidas) <= dataReferencia) vencidas++;
  return vencidas;
}
