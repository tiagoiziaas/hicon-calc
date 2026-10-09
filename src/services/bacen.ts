/**
 * Consulta a API de Dados Abertos do Banco Central (portal Olinda) para obter,
 * dado um periodo de referencia, as modalidades de credito e as instituicoes
 * financeiras com as melhores taxas de juros.
 *
 * Fonte: "Taxas de juros de operacoes de credito por instituicao financeira"
 * Recurso OData: TaxasJurosDiariaPorInicioPeriodo
 *
 * As chamadas vao para /api/bacen, que o servidor do Vite repassa ao Bacen
 * (ver vite.config.ts) -- a API nao libera CORS para o navegador.
 */

import { dataParaIso, diaUtilAnterior, diaUtilAnteriorOuIgual, fimPeriodo, isoParaData } from "../utils/datas";
import { media, normalizar } from "../utils/formatos";

const BASE_URL = "/api/bacen/TaxasJurosDiariaPorInicioPeriodo";
const TAMANHO_PAGINA = 100;
const DIAS_UTEIS_PARA_TRAS = 20;

export const SEGMENTOS = ["PESSOA FÍSICA", "PESSOA JURÍDICA"] as const;
export type Segmento = (typeof SEGMENTOS)[number];

// Lista de reserva usada quando a API nao pode ser consultada.
export const MODALIDADES_PESSOA_FISICA_PADRAO = [
  "Aquisição de outros bens - Prefixado",
  "Aquisição de veículos - Prefixado",
  "Arrendamento mercantil de veículos - Prefixado",
  "Cartão de crédito - parcelado - Prefixado",
  "Cartão de crédito - rotativo total - Prefixado",
  "Cheque especial - Prefixado",
  "Crédito pessoal consignado INSS - Prefixado",
  "Crédito pessoal consignado privado - Prefixado",
  "Crédito pessoal consignado público - Prefixado",
  "Crédito pessoal não consignado - Prefixado",
  "Desconto de cheques - Prefixado",
];

export interface RegistroTaxa {
  InicioPeriodo: string;
  FimPeriodo: string;
  Segmento: string;
  Modalidade: string;
  Posicao: number;
  InstituicaoFinanceira: string;
  TaxaJurosAoMes: number;
  TaxaJurosAoAno: number;
  cnpj8: string;
}

export interface ResultadoModalidades {
  dataReferencia: string;
  periodoInicio: string;
  periodoFim: string;
  segmento: Segmento;
  modalidades: string[];
}

export interface ResultadoTop5 {
  dataReferencia: string;
  periodoInicio: string;
  periodoFim: string;
  segmento: Segmento;
  modalidade: string;
  totalInstituicoes: number;
  instituicoes: RegistroTaxa[];
  /** Todas as instituicoes do periodo, por posicao (a aba de indices da Minuta lista todas). */
  ranking: RegistroTaxa[];
  mediaAoMes: number | null;
  mediaAoAno: number | null;
}

// Cache em memoria: a API do Bacen e lenta e dados de periodos passados nao mudam.
const cache = new Map<string, Promise<unknown>>();

function emCache<T>(chave: string, funcao: () => Promise<T>): Promise<T> {
  const existente = cache.get(chave);
  if (existente) return existente as Promise<T>;
  const promessa = funcao().catch((erro) => {
    cache.delete(chave); // nao guarda falhas
    throw erro;
  });
  cache.set(chave, promessa);
  return promessa;
}

// OData usa aspas simples; uma aspa dentro do texto e escapada duplicando-a.
const literal = (texto: string) => `'${texto.replace(/'/g, "''")}'`;

// O Bacen limita chamadas em sequencia rapida (responde 403); como o app faz varias
// chamadas seguidas (paginacao + retrocesso dia a dia), um 403 costuma ser passageiro
// e se resolve sozinho em segundos. Tenta de novo, com uma pequena espera, antes de desistir.
const RETENTATIVAS_BLOQUEIO = 2;
const ESPERA_RETENTATIVA_MS = 1200;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function requisitarPagina(
  inicio: string,
  segmento: Segmento,
  skip: number,
  modalidade?: string,
): Promise<RegistroTaxa[]> {
  let filtro = `InicioPeriodo eq ${literal(inicio)} and Segmento eq ${literal(segmento)}`;
  if (modalidade) filtro += ` and Modalidade eq ${literal(modalidade)}`;

  // Sem $select: o Bacen passou a bloquear (403) qualquer requisicao com esse parametro
  // OData, em qualquer valor -- provavelmente uma regra nova do firewall deles que
  // confunde "$select" com um ataque (a palavra "select" e tambem comando SQL). $select
  // so existia para pedir campos de menos (resposta mais leve); sem ele, a API devolve o
  // registro inteiro, que e filtrado do lado de ca -- funciona igual, so com mais dados
  // trafegados.
  const params = new URLSearchParams({
    $format: "json",
    $filter: filtro,
    $top: String(TAMANHO_PAGINA),
    $skip: String(skip),
  });

  // URLSearchParams troca espaco por "+", que o OData do Bacen nao entende.
  const url = `${BASE_URL}?${params.toString().replace(/\+/g, "%20")}`;

  for (let tentativa = 0; ; tentativa++) {
    const resposta = await fetch(url);
    if (resposta.ok) {
      const dados = (await resposta.json()) as { value?: RegistroTaxa[] };
      return dados.value ?? [];
    }
    if ((resposta.status === 403 || resposta.status === 429) && tentativa < RETENTATIVAS_BLOQUEIO) {
      await esperar(ESPERA_RETENTATIVA_MS * (tentativa + 1));
      continue;
    }
    throw new Error(`O Bacen respondeu com erro HTTP ${resposta.status}.`);
  }
}

/** Busca todos os registros (com paginacao) de um InicioPeriodo e segmento. */
async function buscarPeriodo(inicio: string, segmento: Segmento, modalidade?: string) {
  const registros: RegistroTaxa[] = [];
  for (let skip = 0; ; skip += TAMANHO_PAGINA) {
    const pagina = await requisitarPagina(inicio, segmento, skip, modalidade);
    registros.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) break;
  }
  return registros;
}

/**
 * Procura, a partir do dia util da data de referencia e retrocedendo um dia util por
 * vez se preciso, o primeiro InicioPeriodo com dados publicados (qualquer modalidade).
 * Com cache: listarModalidades e consultarTop5 para a MESMA data/segmento compartilham
 * essa busca em vez de retroceder dia a dia cada uma por conta propria -- isso corta
 * praticamente pela metade as chamadas ao Bacen no uso normal (as duas sao chamadas
 * em sequencia para a mesma data), reduzindo a chance de tomar bloqueio por excesso
 * de chamadas.
 */
function acharInicioComDados(dataReferencia: string, segmento: Segmento) {
  return emCache(`inicio|${dataReferencia}|${segmento}`, async () => {
    let inicio = diaUtilAnteriorOuIgual(isoParaData(dataReferencia));
    let registros: RegistroTaxa[] = [];
    for (let tentativa = 0; tentativa <= DIAS_UTEIS_PARA_TRAS; tentativa++) {
      registros = await buscarPeriodo(dataParaIso(inicio), segmento);
      if (registros.length) break;
      inicio = diaUtilAnterior(inicio);
    }
    return {
      periodoInicio: dataParaIso(inicio),
      // O FimPeriodo oficial ja considera feriados; o calculado so pula fins de semana.
      periodoFim: registros[0]?.FimPeriodo ?? dataParaIso(fimPeriodo(inicio)),
      registros,
    };
  });
}

/** Lista as modalidades de credito disponiveis no periodo da data de referencia. */
export function listarModalidades(dataReferencia: string, segmento: Segmento): Promise<ResultadoModalidades> {
  return emCache(`modalidades|${dataReferencia}|${segmento}`, async () => {
    const { periodoInicio, periodoFim, registros } = await acharInicioComDados(dataReferencia, segmento);
    const modalidades = [...new Set(registros.map((r) => r.Modalidade))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { dataReferencia, periodoInicio, periodoFim, segmento, modalidades };
  });
}

/** As 5 instituicoes mais bem posicionadas (menor taxa) numa modalidade, e a media delas. */
export function consultarTop5(dataReferencia: string, segmento: Segmento, modalidade: string): Promise<ResultadoTop5> {
  return emCache(`top5|${dataReferencia}|${segmento}|${modalidade}`, async () => {
    // Reaproveita o dia ja descoberto (pelo cache acima); so faz UMA chamada extra,
    // ja filtrada pela modalidade, em vez de retroceder dia a dia de novo.
    let { periodoInicio, periodoFim } = await acharInicioComDados(dataReferencia, segmento);
    let registros = await buscarPeriodo(periodoInicio, segmento, modalidade);

    // Caso raro: o dia tem dados publicados (para outras modalidades), mas nao para
    // esta modalidade especifica -- retrocede independentemente, como antes.
    if (!registros.length) {
      let inicio = diaUtilAnterior(isoParaData(periodoInicio));
      for (let tentativa = 0; tentativa <= DIAS_UTEIS_PARA_TRAS && !registros.length; tentativa++) {
        registros = await buscarPeriodo(dataParaIso(inicio), segmento, modalidade);
        if (registros.length) {
          periodoInicio = dataParaIso(inicio);
          periodoFim = registros[0]?.FimPeriodo ?? dataParaIso(fimPeriodo(inicio));
          break;
        }
        inicio = diaUtilAnterior(inicio);
      }
    }

    registros.sort((a, b) => a.Posicao - b.Posicao);
    const instituicoes = registros.slice(0, 5);
    return {
      dataReferencia,
      periodoInicio,
      periodoFim,
      segmento,
      modalidade,
      totalInstituicoes: registros.length,
      instituicoes,
      ranking: registros,
      mediaAoMes: media(instituicoes.map((i) => i.TaxaJurosAoMes)),
      mediaAoAno: media(instituicoes.map((i) => i.TaxaJurosAoAno)),
    };
  });
}

/** Consignado INSS se existir (padrao do Hicon), senao a primeira da lista. */
export function escolherModalidadePadrao(modalidades: string[], preferida?: string | null): string | undefined {
  if (preferida && modalidades.includes(preferida)) return preferida;
  return (
    modalidades.find((m) => normalizar(m).includes("consignado") && normalizar(m).includes("inss")) ?? modalidades[0]
  );
}
