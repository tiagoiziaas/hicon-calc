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
// atualizando sozinho se alguem alterar as celulas).

import { formatarPct } from "../utils/formatos";
import type { Pasta } from "./xlsx";

const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_XDR = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";

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

/**
 * Caixas de texto por cima das barras (valor de cada barra, escrito na vertical).
 * Sao vinculadas a C3 (referencia) e C4 (cobrada); na Minuta Parcial o vinculo
 * estava quebrado (#REF!) e elas mostravam valores de outro caso.
 */
async function atualizarCaixasDasBarras(pasta: Pasta, nomeAba: string, v: ValoresGrafico) {
  const valorDa: Record<string, number> = { $C$3: v.taxaReferencia, $C$4: v.taxaCobrada };
  for (const caminho of await pasta.desenhosDaAba(nomeAba)) {
    const doc = await pasta.parte(caminho);
    const caixas = Array.from(doc.getElementsByTagNameNS(NS_XDR, "sp")).filter((sp) =>
      Array.from(sp.getElementsByTagNameNS(NS_A, "fld")).some((f) => f.getAttribute("type") === "TxLink"),
    );
    // As caixas quebradas recebem, na ordem, as celulas que ainda nao tem caixa.
    const livres = Object.keys(valorDa).filter((ref) => !caixas.some((sp) => sp.getAttribute("textlink") === ref));
    for (const sp of caixas) {
      let ref = sp.getAttribute("textlink") ?? "";
      if (!(ref in valorDa)) {
        ref = livres.shift() ?? "";
        if (!ref) continue;
        sp.setAttribute("textlink", ref);
      }
      trocarTextoVinculado(sp, pctTexto(valorDa[ref]));
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

    if (barras) {
      // Serie 1 = linha 3 (referencia), serie 2 = linha 4 (cobrada).
      filhosC(barras, "ser").forEach((ser, i) => {
        const linha = 3 + i;
        const nome = filhoC(filhoC(ser, "tx") ?? ser, "strRef");
        if (nome) religar(nome, `${aba}$B$${linha}`, [rotulos[i] ?? ""]);
        const valores = filhoC(filhoC(ser, "val")!, "numRef")!;
        religar(valores, `${aba}$C$${linha}`, [i === 0 ? v.taxaReferencia : v.taxaCobrada]);
      });
    }

    if (rosca) {
      for (const ser of filhosC(rosca, "ser")) {
        const valores = filhoC(filhoC(ser, "val")!, "numRef")!;
        religar(valores, `${aba}$C$61:$C$62`, [v.percentual, 1 - v.percentual]);
      }
      // Caixa de texto no meio da rosca: ja vinculada a celula; so atualiza o texto salvo.
      for (const formas of await pasta.relacionadas(caminho, "/chartUserShapes")) {
        trocarTextoVinculado((await pasta.parte(formas)).documentElement, pctTexto(v.percentual));
      }
    }
  }

  await atualizarCaixasDasBarras(pasta, nomeAba, v);
}
