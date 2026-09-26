// Os 3 cenarios de calculo pedidos na orientacao do escritorio (Orientação.pdf).
// Cada cenario alimenta uma aba de quitacao das Minutas (Total / Parcial):
//   Contrato bancario -> 3.3.3 / 3.3 taxa contratual
//   Hiscon            -> 1.1.1 / 1.1 taxa media (com a taxa media do Bacen)
//   IN 28             -> 2.2.2 / 2.2 IN 28

export type IdCenario = "contrato" | "hiscon" | "in28";

export interface DadosCenario {
  /** "aaaa-mm-dd" -- data da contratacao (contrato) ou da inclusao (Hiscon / IN 28) */
  data: string;
  banco: string;
  /** Valores monetarios em centavos (inteiro) para nao perder precisao. */
  valorContratadoCentavos: number | null;
  valorParcelaCentavos: number | null;
  /** Taxa mensal em % como digitada (ex.: "1,85"). */
  taxaJuros: string;
  totalParcelas: number | null;
  /** "aaaa-mm-dd" */
  dataPrimeiraParcela: string;
  /** So no cenario IN 28: taxa maxima permitida pela IN 28 na data (% a.m., como digitada). */
  taxaTetoIn28: string;
}

export interface DefinicaoCenario {
  id: IdCenario;
  titulo: string;
  descricao: string;
  rotuloData: string;
}

export const CENARIOS: DefinicaoCenario[] = [
  {
    id: "contrato",
    titulo: "Contrato bancário",
    descricao: "Abas 3.3.3 / 3.3 · taxa contratual",
    rotuloData: "Data da contratação",
  },
  {
    id: "hiscon",
    titulo: "Extraídos do Hiscon",
    descricao: "Abas 1.1.1 / 1.1 · taxa média BACEN",
    rotuloData: "Data da inclusão",
  },
  {
    id: "in28",
    titulo: "Instrução Normativa 28 · INSS",
    descricao: "Abas 2.2.2 / 2.2 · taxa da IN 28",
    rotuloData: "Data da inclusão",
  },
];

export const cenarioVazio = (): DadosCenario => ({
  data: "",
  banco: "",
  valorContratadoCentavos: null,
  valorParcelaCentavos: null,
  taxaJuros: "",
  totalParcelas: null,
  dataPrimeiraParcela: "",
  taxaTetoIn28: "",
});

export type Cenarios = Record<IdCenario, DadosCenario>;

export const cenariosVazios = (): Cenarios => ({
  contrato: cenarioVazio(),
  hiscon: cenarioVazio(),
  in28: cenarioVazio(),
});

/** Campos que cada cenario precisa (o IN 28 tem a taxa maxima a mais). */
function valoresDosCampos(id: IdCenario, c: DadosCenario): unknown[] {
  const comuns = [
    c.data,
    c.banco.trim(),
    c.valorContratadoCentavos,
    c.valorParcelaCentavos,
    c.taxaJuros,
    c.totalParcelas,
    c.dataPrimeiraParcela,
  ];
  return id === "in28" ? [...comuns, c.taxaTetoIn28] : comuns;
}

export const totalCampos = (id: IdCenario): number => valoresDosCampos(id, cenarioVazio()).length;

/** Quantos campos do cenario ja foram preenchidos (para o indicador de progresso). */
export const camposPreenchidos = (id: IdCenario, c: DadosCenario): number =>
  valoresDosCampos(id, c).filter((v) => v !== "" && v != null).length;

/** "1,85" -> 0.0185 (decimal). null se vazio/invalido. */
export function taxaDecimal(texto: string): number | null {
  if (!texto) return null;
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n / 100 : null;
}

/** Dados que valem para a planilha toda (cabecalho da aba DADOS PARA PETIÇÃO INICIAL). */
export interface Identificacao {
  nomeCliente: string;
  numeroContrato: string;
  /** "aaaa-mm-dd" -- "ate a presente data": base para contar as parcelas ja pagas. */
  dataReferencia: string;
}
