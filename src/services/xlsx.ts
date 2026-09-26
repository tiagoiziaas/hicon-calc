// Edicao "cirurgica" de um .xlsx existente: mexe so no XML das celulas que
// precisam mudar, preservando estilos, graficos, comentarios e o resto do
// arquivo (bibliotecas comuns de Excel costumam perder graficos ao salvar).
//
// Usa o DOMParser/XMLSerializer globais (navegador); em testes no Node eles
// sao fornecidos pelo @xmldom/xmldom.

import JSZip from "jszip";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL_DOC = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const DECLARACAO = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const elementos = (pai: Node): Element[] =>
  Array.from(pai.childNodes).filter((n): n is Element => n.nodeType === 1);

const filho = (pai: Element, nome: string): Element | undefined => elementos(pai).find((e) => e.localName === nome);

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, "application/xml");

const serializar = (doc: Document): string => {
  const xml = new XMLSerializer().serializeToString(doc);
  return xml.startsWith("<?xml") ? xml : DECLARACAO + xml;
};

/** "AB12" -> { coluna: 28, linha: 12 } */
function decomporRef(ref: string): { coluna: number; linha: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) throw new Error(`Referência de célula inválida: ${ref}`);
  const coluna = [...m[1]].reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0);
  return { coluna, linha: Number(m[2]) };
}

const letraColuna = (ref: string) => /^[A-Z]+/.exec(ref)![0];

export type ValorCache = number | string | null;

export class Aba {
  private readonly sheetData: Element;

  constructor(readonly doc: Document) {
    const sd = doc.getElementsByTagNameNS(NS, "sheetData")[0];
    if (!sd) throw new Error("Aba sem sheetData");
    this.sheetData = sd;
  }

  private novo(nome: string): Element {
    return this.doc.createElementNS(NS, nome);
  }

  linha(numero: number, criar = true): Element | undefined {
    const linhas = elementos(this.sheetData);
    const existente = linhas.find((r) => Number(r.getAttribute("r")) === numero);
    if (existente || !criar) return existente;
    const nova = this.novo("row");
    nova.setAttribute("r", String(numero));
    const depois = linhas.find((r) => Number(r.getAttribute("r")) > numero);
    this.sheetData.insertBefore(nova, depois ?? null);
    return nova;
  }

  celula(ref: string): Element {
    const { coluna, linha } = decomporRef(ref);
    const row = this.linha(linha)!;
    const celulas = elementos(row);
    const existente = celulas.find((c) => c.getAttribute("r") === ref);
    if (existente) return existente;
    const nova = this.novo("c");
    nova.setAttribute("r", ref);
    const depois = celulas.find((c) => decomporRef(c.getAttribute("r")!).coluna > coluna);
    row.insertBefore(nova, depois ?? null);
    return nova;
  }

  /** Remove o conteudo (formula, valor, texto) mantendo o estilo. */
  private esvaziar(c: Element) {
    for (const e of elementos(c)) c.removeChild(e);
    c.removeAttribute("t");
    c.removeAttribute("cm"); // metadados de formula matricial dinamica
    c.removeAttribute("vm"); // metadados de valor (ex.: #VALUE! de matriz)
  }

  private anexarValor(c: Element, valor: ValorCache) {
    if (valor == null) return;
    const v = this.novo("v");
    v.appendChild(this.doc.createTextNode(typeof valor === "number" ? String(valor) : valor));
    c.appendChild(v);
  }

  numero(ref: string, valor: number) {
    const c = this.celula(ref);
    this.esvaziar(c);
    this.anexarValor(c, valor);
  }

  texto(ref: string, valor: string) {
    const c = this.celula(ref);
    this.esvaziar(c);
    if (!valor) return;
    c.setAttribute("t", "inlineStr");
    const is = this.novo("is");
    const t = this.novo("t");
    t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    t.appendChild(this.doc.createTextNode(valor));
    is.appendChild(t);
    c.appendChild(is);
  }

  limpar(ref: string) {
    this.esvaziar(this.celula(ref));
  }

  /** Grava uma formula (sem o "=") com o resultado ja calculado em cache. */
  formula(ref: string, formula: string, cache: ValorCache) {
    const c = this.celula(ref);
    this.esvaziar(c);
    const f = this.novo("f");
    f.appendChild(this.doc.createTextNode(formula));
    c.appendChild(f);
    if (typeof cache === "string") c.setAttribute("t", "str");
    this.anexarValor(c, cache);
  }

  /** Atualiza so o resultado em cache de uma formula existente (a formula fica como esta). */
  cache(ref: string, valor: number) {
    const c = this.celula(ref);
    if (!filho(c, "f")) throw new Error(`${ref} não tem fórmula`);
    const v = filho(c, "v");
    if (v) c.removeChild(v);
    c.removeAttribute("t");
    this.anexarValor(c, valor);
  }

  temValor(ref: string): boolean {
    const { linha } = decomporRef(ref);
    const row = this.linha(linha, false);
    const c = row && elementos(row).find((e) => e.getAttribute("r") === ref);
    return !!c && (!!filho(c, "v") || !!filho(c, "is"));
  }

  // ---- linhas inteiras (cronograma) ----

  clonarLinha(numero: number): Element {
    const row = this.linha(numero, false);
    if (!row) throw new Error(`Linha ${numero} não existe no modelo`);
    return row.cloneNode(true) as Element;
  }

  removerLinhasAPartirDe(numero: number) {
    for (const r of elementos(this.sheetData)) {
      if (Number(r.getAttribute("r")) >= numero) this.sheetData.removeChild(r);
    }
  }

  /** Insere (no fim) um clone de linha renumerado; devolve o numero da linha. */
  inserirLinha(modelo: Element, numero: number): number {
    const row = modelo.cloneNode(true) as Element;
    row.setAttribute("r", String(numero));
    for (const c of elementos(row)) c.setAttribute("r", letraColuna(c.getAttribute("r")!) + numero);
    this.sheetData.appendChild(row);
    return numero;
  }

  // ---- mesclagens / metadados ----

  private get mergeCells(): Element | undefined {
    return this.doc.getElementsByTagNameNS(NS, "mergeCells")[0];
  }

  removerMesclagensAPartirDe(linha: number) {
    const mc = this.mergeCells;
    if (!mc) return;
    for (const m of elementos(mc)) {
      const inicio = m.getAttribute("ref")!.split(":")[0];
      if (decomporRef(inicio).linha >= linha) mc.removeChild(m);
    }
    mc.setAttribute("count", String(elementos(mc).length));
  }

  mesclar(ref: string) {
    const mc = this.mergeCells;
    if (!mc) throw new Error("Aba sem mergeCells");
    const m = this.novo("mergeCell");
    m.setAttribute("ref", ref);
    mc.appendChild(m);
    mc.setAttribute("count", String(elementos(mc).length));
  }

  dimensao(ref: string) {
    this.doc.getElementsByTagNameNS(NS, "dimension")[0]?.setAttribute("ref", ref);
  }

  /** Abre a aba no topo (o modelo foi salvo rolado para o meio do cronograma). */
  voltarAoTopo() {
    const view = this.doc.getElementsByTagNameNS(NS, "sheetView")[0];
    view?.removeAttribute("topLeftCell");
    const sel = view && filho(view, "selection");
    if (sel) {
      sel.setAttribute("activeCell", "B1");
      sel.setAttribute("sqref", "B1");
    }
  }
}

export class Pasta {
  private readonly abas = new Map<string, { caminho: string; aba: Aba }>();

  private constructor(private readonly zip: JSZip) {}

  static async abrir(dados: ArrayBuffer | Uint8Array): Promise<Pasta> {
    const zip = await JSZip.loadAsync(dados);
    const pasta = new Pasta(zip);
    const workbook = parse(await zip.file("xl/workbook.xml")!.async("string"));
    const rels = parse(await zip.file("xl/_rels/workbook.xml.rels")!.async("string"));
    const alvos = new Map(
      elementos(rels.documentElement).map((r) => [r.getAttribute("Id")!, r.getAttribute("Target")!]),
    );
    for (const sheet of Array.from(workbook.getElementsByTagNameNS(NS, "sheet"))) {
      const alvo = alvos.get(sheet.getAttributeNS(NS_REL_DOC, "id")!)!;
      const caminho = alvo.startsWith("/") ? alvo.slice(1) : `xl/${alvo}`;
      const xml = await zip.file(caminho)!.async("string");
      pasta.abas.set(sheet.getAttribute("name")!, { caminho, aba: new Aba(parse(xml)) });
    }
    return pasta;
  }

  aba(nome: string): Aba {
    const item = this.abas.get(nome);
    if (!item) throw new Error(`A planilha modelo não tem a aba "${nome}"`);
    return item.aba;
  }

  /** Gera o .xlsx: grava as abas, manda o Excel recalcular tudo ao abrir e descarta a cadeia de calculo antiga. */
  async gerar(): Promise<Uint8Array> {
    for (const { caminho, aba } of this.abas.values()) this.zip.file(caminho, serializar(aba.doc));

    const workbook = parse(await this.zip.file("xl/workbook.xml")!.async("string"));
    let calcPr = workbook.getElementsByTagNameNS(NS, "calcPr")[0];
    if (!calcPr) {
      calcPr = workbook.createElementNS(NS, "calcPr");
      workbook.documentElement.appendChild(calcPr);
    }
    calcPr.setAttribute("fullCalcOnLoad", "1");
    this.zip.file("xl/workbook.xml", serializar(workbook));

    // Vinculos com outras planilhas (ex.: arquivos no Google Drive do escritorio):
    // nenhuma formula preenchida usa mais, e eles so fariam o Excel perguntar
    // "atualizar vinculos?" ao abrir. Sao removidos do pacote.
    const refsExternas = workbook.getElementsByTagNameNS(NS, "externalReferences")[0];
    if (refsExternas) {
      refsExternas.parentNode!.removeChild(refsExternas);
      this.zip.file("xl/workbook.xml", serializar(workbook));
      const rels = parse(await this.zip.file("xl/_rels/workbook.xml.rels")!.async("string"));
      for (const r of elementos(rels.documentElement)) {
        if (r.getAttribute("Type")?.endsWith("/externalLink")) rels.documentElement.removeChild(r);
      }
      this.zip.file("xl/_rels/workbook.xml.rels", serializar(rels));
      const tipos = parse(await this.zip.file("[Content_Types].xml")!.async("string"));
      for (const o of elementos(tipos.documentElement)) {
        if (o.getAttribute("PartName")?.startsWith("/xl/externalLinks/")) tipos.documentElement.removeChild(o);
      }
      this.zip.file("[Content_Types].xml", serializar(tipos));
      this.zip.remove("xl/externalLinks");
    }

    // A calcChain lista as celulas com formula; como algumas formulas mudaram,
    // ela e removida (o Excel recria sozinho) para nao dar aviso de "reparo".
    if (this.zip.file("xl/calcChain.xml")) {
      this.zip.remove("xl/calcChain.xml");
      const rels = parse(await this.zip.file("xl/_rels/workbook.xml.rels")!.async("string"));
      for (const r of elementos(rels.documentElement)) {
        if (r.getAttribute("Target")?.endsWith("calcChain.xml")) rels.documentElement.removeChild(r);
      }
      this.zip.file("xl/_rels/workbook.xml.rels", serializar(rels));
      const tipos = parse(await this.zip.file("[Content_Types].xml")!.async("string"));
      for (const o of elementos(tipos.documentElement)) {
        if (o.getAttribute("PartName") === "/xl/calcChain.xml") tipos.documentElement.removeChild(o);
      }
      this.zip.file("[Content_Types].xml", serializar(tipos));
    }

    return this.zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  }
}
