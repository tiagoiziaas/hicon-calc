export const formatarPct = (valor: number | null | undefined): string =>
  valor == null
    ? "–"
    : valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "aaaa-mm-dd" -> "dd/mm/aaaa" */
export const formatarDataBr = (iso: string): string => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

/** CNPJ basico (8 digitos) -> "00.000.000" */
export const formatarCnpj8 = (cnpj8: string | null | undefined): string =>
  cnpj8 && cnpj8.length === 8 ? `${cnpj8.slice(0, 2)}.${cnpj8.slice(2, 5)}.${cnpj8.slice(5)}` : cnpj8 ?? "";

export const normalizar = (texto: string): string =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const media = (valores: number[]): number | null =>
  valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
