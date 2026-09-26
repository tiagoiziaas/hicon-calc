// Graficos das abas de percentual/indice das Minutas (Total e Parcial).
//
// Cada uma dessas abas tem:
//   - grafico de BARRAS "COMPARATIVO DOS JUROS": taxa de referencia (B3/C3) x taxa cobrada (B4/C4);
//   - grafico de ROSCA "Indice acima da taxa": % acima (C61) e o restante (C62);
//   - caixa de texto no meio da rosca, ligada a celula do % (TxLink).
//
// Nos modelos originais os graficos apontavam para OUTRAS planilhas ([1]Planilha1...)
// ou para a aba 1.1.1 -- por isso nao mudavam. Aqui eles passam a apontar para as
// celulas da propria aba e ja levam os valores calculados (o Excel continua
// atualizando sozinho se alguem alterar as celulas). O grafico de barras tambem e
// reconfigurado: eixo a partir de 0%, legenda embaixo e o valor como rotulo da barra.

import { formatarPct } from "../utils/formatos";
import type { Pasta } from "./xlsx";

const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_XDR = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";

/** Tamanhos de fonte dos graficos, em centesimos de ponto (1600 = 16 pt). */
const FONTE = {
  titulo: 1600,
  eixo: 1200,
  legenda: 1200,
  valorBarra: 1400,
  centroRosca: 2000,
};

/** Aplica o tamanho de fonte em todos os trechos de texto dentro de um elemento. */
function tamanhoFonte(elemento: Element | undefined, sz: number) {
  if (!elemento) return;
  for (const nome of ["defRPr", "rPr", "endParaRPr"]) {
    for (const e of Array.from(elemento.getElementsByTagNameNS(NS_A, nome))) e.setAttribute("sz", String(sz));
  }
}

export interface ValoresGrafico {
  /** Taxa de referencia (media, IN 28 ou contratual), decimal -- celula C3. */
  taxaReferencia: number;
  /** Taxa cobrada (praticada ou contratada, conforme a aba), decimal -- celula C4. */
  taxaCobrada: number;
  /** % acima da referencia (C61); o grafico usa tambem 1 - % (C62). */
  percentual: number;
}

const filhosC = (pai: Element, nome: string): Element[] =>
  Array.from(pai.childNodes).filter((n): n is Element => n.nodeType === 1 && (n as Element).localName === nome);

const filhoC = (pai: Element, nome: string): Element | undefined => filhosC(pai, nome)[0];

/** Troca a referencia (<c:f>) e o cache (<c:numCache>/<c:strCache>) de um numRef/strRef. */
function religar(ref: Element, formula: string, valores: (number | string)[]) {
  const doc = ref.ownerDocument!;
  const f = filhoC(ref, "f")!;
  f.textContent = formula;

  const ehNumero = ref.localName === "numRef";
  const nomeCache = ehNumero ? "numCache" : "strCache";
  let cache = filhoC(ref, nomeCache);
  const formato = cache && filhoC(cache, "formatCode")?.textContent;
  if (cache) ref.removeChild(cache);
  cache = doc.createElementNS(NS_C, `c:${nomeCache}`);
  if (ehNumero) {
    const fc = doc.createElementNS(NS_C, "c:formatCode");
    fc.textContent = formato ?? "General";
    cache.appendChild(fc);
  }
  const total = doc.createElementNS(NS_C, "c:ptCount");
  total.setAttribute("val", String(valores.length));
  cache.appendChild(total);
  valores.forEach((valor, i) => {
    const pt = doc.createElementNS(NS_C, "c:pt");
    pt.setAttribute("idx", String(i));
    const v = doc.createElementNS(NS_C, "c:v");
    v.textContent = String(valor);
    pt.appendChild(v);
    cache!.appendChild(pt);
  });
  ref.appendChild(cache);
}

const pctTexto = (decimal: number) => `${formatarPct(decimal * 100)}%`;

/** Texto salvo dentro de um campo vinculado (<a:fld type="TxLink">) de uma forma. */
function trocarTextoVinculado(forma: Element, texto: string) {
  for (const campo of Array.from(forma.getElementsByTagNameNS(NS_A, "fld"))) {
    if (campo.getAttribute("type") !== "TxLink") continue;
    const t = campo.getElementsByTagNameNS(NS_A, "t")[0];
    if (t) t.textContent = texto;
  }
}

function elementoC(doc: Document, nome: string, val?: string): Element {
  const e = doc.createElementNS(NS_C, `c:${nome}`);
  if (val !== undefined) e.setAttribute("val", val);
  return e;
}

/**
 * Arruma o grafico de barras "COMPARATIVO DOS JUROS" do modelo, que:
 *   - deixava o eixo comecar perto do menor valor (ex.: 1,90%) -- em varios visualizadores
 *     (Excel online, Google Planilhas, celular) isso faz as barras sairem PARA BAIXO;
 *   - tinha a legenda posicionada a mao no meio do grafico, por cima da 2a barra;
 *   - mostrava os valores em caixas de texto soltas (removidas em removerCaixasDasBarras).
 */
function arrumarGraficoDeBarras(doc: Document, barras: Element) {
  // Eixo de valores: sempre de 0% para cima, em percentual.
  const eixo = doc.getElementsByTagNameNS(NS_C, "valAx")[0];
  if (eixo) {
    const escala = filhoC(eixo, "scaling")!;
    for (const lim of [...filhosC(escala, "min"), ...filhosC(escala, "max")]) escala.removeChild(lim);
    const orientacao = filhoC(escala, "orientation");
    escala.insertBefore(elementoC(doc, "min", "0"), orientacao ? orientacao.nextSibling : escala.firstChild);
    const formato = filhoC(eixo, "numFmt");
    formato?.setAttribute("formatCode", "0.00%");
    formato?.setAttribute("sourceLinked", "0");
  }

  // Area do grafico e legenda em layout automatico, legenda embaixo (sem cobrir as barras).
  const area = doc.getElementsByTagNameNS(NS_C, "plotArea")[0];
  const layoutArea = area && filhoC(area, "layout");
  if (layoutArea) while (layoutArea.firstChild) layoutArea.removeChild(layoutArea.firstChild);
  const legenda = doc.getElementsByTagNameNS(NS_C, "legend")[0];
  tamanhoFonte(eixo, FONTE.eixo);
  tamanhoFonte(legenda, FONTE.legenda);
  if (legenda) {
    filhoC(legenda, "legendPos")?.setAttribute("val", "b");
    const layoutLegenda = filhoC(legenda, "layout");
    if (layoutLegenda) legenda.removeChild(layoutLegenda);
  }

  // Valor em cima de cada barra (rotulo do proprio grafico, acompanha a altura da barra).
  for (const ser of filhosC(barras, "ser")) {
    for (const d of filhosC(ser, "dLbls")) ser.removeChild(d);
  }
  let rotulos = filhoC(barras, "dLbls");
  if (!rotulos) {
    rotulos = elementoC(doc, "dLbls");
    barras.insertBefore(rotulos, filhoC(barras, "gapWidth") ?? filhoC(barras, "overlap") ?? filhoC(barras, "axId") ?? null);
  }
  while (rotulos.firstChild) rotulos.removeChild(rotulos.firstChild);
  const numFmt = elementoC(doc, "numFmt");
  numFmt.setAttribute("formatCode", "0.00%");
  numFmt.setAttribute("sourceLinked", "0");
  rotulos.appendChild(numFmt);
  const txPr = elementoC(doc, "txPr");
  const a = (nome: string) => doc.createElementNS(NS_A, `a:${nome}`);
  const pPr = a("pPr");
  const defRPr = a("defRPr");
  defRPr.setAttribute("sz", String(FONTE.valorBarra));
  defRPr.setAttribute("b", "1");
  pPr.appendChild(defRPr);
  const paragrafo = a("p");
  paragrafo.appendChild(pPr);
  const fim = a("endParaRPr");
  fim.setAttribute("lang", "pt-BR");
  paragrafo.appendChild(fim);
  txPr.appendChild(a("bodyPr"));
  txPr.appendChild(a("lstStyle"));
  txPr.appendChild(paragrafo);
  rotulos.appendChild(txPr);
  rotulos.appendChild(elementoC(doc, "dLblPos", "outEnd"));
  for (const [nome, val] of [
    ["showLegendKey", "0"],
    ["showVal", "1"],
    ["showCatName", "0"],
    ["showSerName", "0"],
    ["showPercent", "0"],
    ["showBubbleSize", "0"],
  ]) {
    rotulos.appendChild(elementoC(doc, nome, val));
  }
}

/**
 * Remove as caixas de texto soltas que o modelo punha por cima das barras (ligadas a
 * C3/C4). Ficavam em posicao fixa -- desalinhadas das barras -- e, na Minuta Parcial,
 * com o vinculo quebrado. O valor agora e o rotulo da propria barra.
 */
async function removerCaixasDasBarras(pasta: Pasta, nomeAba: string) {
  for (const caminho of await pasta.desenhosDaAba(nomeAba)) {
    const doc = await pasta.parte(caminho);
    const caixas = Array.from(doc.getElementsByTagNameNS(NS_XDR, "sp")).filter((sp) =>
      Array.from(sp.getElementsByTagNameNS(NS_A, "fld")).some((f) => f.getAttribute("type") === "TxLink"),
    );
    for (const sp of caixas) {
      const ancora = sp.parentNode as Element; // twoCellAnchor / oneCellAnchor / absoluteAnchor
      ancora.parentNode?.removeChild(ancora);
    }
  }
}

export async function atualizarGraficosDaAba(pasta: Pasta, nomeAba: string, v: ValoresGrafico) {
  const aba = `'${nomeAba}'!`;
  const rotulos = [await pasta.textoCelula(nomeAba, "B3"), await pasta.textoCelula(nomeAba, "B4")];
  const graficos = await pasta.graficosDaAba(nomeAba);
  if (!graficos.length) throw new Error(`A aba "${nomeAba}" não tem gráficos no modelo`);

  for (const caminho of graficos) {
    const doc = await pasta.parte(caminho);
    const barras = doc.getElementsByTagNameNS(NS_C, "barChart")[0];
    const rosca = doc.getElementsByTagNameNS(NS_C, "doughnutChart")[0] ?? doc.getElementsByTagNameNS(NS_C, "pieChart")[0];

    tamanhoFonte(doc.getElementsByTagNameNS(NS_C, "title")[0], FONTE.titulo);

    if (barras) {
      // Serie 1 = linha 3 (referencia), serie 2 = linha 4 (cobrada).
      filhosC(barras, "ser").forEach((ser, i) => {
        const linha = 3 + i;
        const nome = filhoC(filhoC(ser, "tx") ?? ser, "strRef");
        if (nome) religar(nome, `${aba}$B$${linha}`, [rotulos[i] ?? ""]);
        const valores = filhoC(filhoC(ser, "val")!, "numRef")!;
        religar(valores, `${aba}$C$${linha}`, [i === 0 ? v.taxaReferencia : v.taxaCobrada]);
      });
      arrumarGraficoDeBarras(doc, barras);
    }

    if (rosca) {
      for (const ser of filhosC(rosca, "ser")) {
        const valores = filhoC(filhoC(ser, "val")!, "numRef")!;
        religar(valores, `${aba}$C$61:$C$62`, [v.percentual, 1 - v.percentual]);
      }
      // Caixa de texto no meio da rosca: ja vinculada a celula; so atualiza o texto salvo.
      for (const formas of await pasta.relacionadas(caminho, "/chartUserShapes")) {
        const centro = (await pasta.parte(formas)).documentElement;
        trocarTextoVinculado(centro, pctTexto(v.percentual));
        tamanhoFonte(centro, FONTE.centroRosca);
        // Caixa estreita: sem quebra de linha o "28,76%" nao vira "28,76" + "%".
        for (const corpo of Array.from(centro.getElementsByTagNameNS(NS_A, "bodyPr"))) corpo.setAttribute("wrap", "none");
      }
    }
  }

  await removerCaixasDasBarras(pasta, nomeAba);
}
