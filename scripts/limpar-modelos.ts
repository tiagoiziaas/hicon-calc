// Remove dados de clientes e do escritorio das planilhas modelo em public/modelos/
// (esses arquivos ficam publicos no site e no repositorio).
//
// Uso: npm run limpar:modelos
// Rode de novo sempre que substituir um modelo por uma planilha nova do escritorio.
//
// O que e removido:
//   - nome do cliente e numero do contrato da aba de dados;
//   - vinculos com outras planilhas (caminhos do Google Drive, que citam outros clientes)
//     e as formulas que dependiam deles (ficam so os valores; o sistema regrava tudo);
//   - nomes da equipe como autores do arquivo e dos comentarios;
//   - a pasta onde o arquivo foi salvo (absPath).

import { readFileSync, writeFileSync } from "node:fs";
import JSZip from "jszip";

const MODELOS = [
  { arquivo: "public/modelos/minuta-total-modelo.xlsx", celulaNome: "F3", celulaContrato: "F5" },
  { arquivo: "public/modelos/minuta-parcial-modelo.xlsx", celulaNome: "F3", celulaContrato: "F4" },
];
const ABA_DADOS = "xl/worksheets/sheet1.xml"; // primeira aba nos dois modelos
const AUTOR = "Hicon Calc";

async function texto(zip: JSZip, caminho: string): Promise<string> {
  const f = zip.file(caminho);
  if (!f) throw new Error(`${caminho} não existe no arquivo`);
  return f.async("string");
}

async function limpar({ arquivo, celulaNome, celulaContrato }: (typeof MODELOS)[number]) {
  const zip = await JSZip.loadAsync(readFileSync(arquivo));

  // 1. Nome do cliente (texto compartilhado) e numero do contrato.
  let dados = await texto(zip, ABA_DADOS);
  const nome = new RegExp(`<c r="${celulaNome}"[^>]*t="s"[^>]*><v>(\\d+)</v></c>`).exec(dados);
  if (nome) {
    const indice = Number(nome[1]);
    let n = -1;
    const ss = (await texto(zip, "xl/sharedStrings.xml")).replace(/<si>[\s\S]*?<\/si>/g, (si) =>
      ++n === indice ? "<si><t>NOME DO CLIENTE</t></si>" : si,
    );
    zip.file("xl/sharedStrings.xml", ss);
  }
  // So celulas com conteudo (<c ...>...</c>); uma ja vazia (<c .../>) fica como esta.
  dados = dados.replace(
    new RegExp(`<c r="${celulaContrato}"([^>]*[^/])>[\\s\\S]*?</c>`),
    `<c r="${celulaContrato}"$1/>`,
  );
  zip.file(ABA_DADOS, dados);

  // 2. Formulas que apontam para outras planilhas: ficam so com o valor calculado.
  let formulasRemovidas = 0;
  for (const caminho of Object.keys(zip.files).filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))) {
    const xml = await texto(zip, caminho);
    const limpo = xml.replace(/<c [^>]*>(?:(?!<\/c>)[\s\S])*?<f[^>]*>[^<]*\[\d+\][^<]*<\/f>[\s\S]*?<\/c>/g, (celula) => {
      formulasRemovidas++;
      return celula.replace(/<f[^>]*>[^<]*<\/f>/, "").replace(/ cm="\d+"/, "");
    });
    zip.file(caminho, limpo);
  }

  // 3. Vinculos externos (e a cadeia de calculo, que citava as formulas removidas).
  zip.file(
    "xl/workbook.xml",
    (await texto(zip, "xl/workbook.xml"))
      .replace(/<externalReferences>[\s\S]*?<\/externalReferences>/, "")
      // pasta onde o arquivo foi salvo pela ultima vez (caminho do Drive do escritorio)
      .replace(/<mc:AlternateContent[^>]*>(?:(?!<\/mc:AlternateContent>)[\s\S])*?absPath[\s\S]*?<\/mc:AlternateContent>/, ""),
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    (await texto(zip, "xl/_rels/workbook.xml.rels")).replace(
      /<Relationship [^>]*(?:\/externalLink"|calcChain\.xml")[^>]*\/>/g,
      "",
    ),
  );
  zip.file(
    "[Content_Types].xml",
    (await texto(zip, "[Content_Types].xml")).replace(
      /<Override PartName="\/xl\/(?:externalLinks\/[^"]+|calcChain\.xml)"[^>]*\/>/g,
      "",
    ),
  );
  zip.remove("xl/externalLinks");
  zip.remove("xl/calcChain.xml");

  // 4. Nomes da equipe (autor do arquivo e dos comentarios).
  zip.file(
    "docProps/core.xml",
    (await texto(zip, "docProps/core.xml"))
      .replace(/<dc:creator>[^<]*<\/dc:creator>/, `<dc:creator>${AUTOR}</dc:creator>`)
      .replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/, `<cp:lastModifiedBy>${AUTOR}</cp:lastModifiedBy>`),
  );
  for (const caminho of Object.keys(zip.files).filter((p) => /^xl\/comments\d+\.xml$/.test(p))) {
    let xml = await texto(zip, caminho);
    // Os autores aparecem na lista <authors> e tambem no inicio do texto de cada comentario.
    // Cada autor vira um nome DIFERENTE: o Excel recusa abrir o arquivo se a lista
    // <authors> tiver nomes repetidos.
    const autores = [...xml.matchAll(/<author>([^<]+)<\/author>/g)].map((m) => m[1]);
    const novoNome = new Map(autores.map((a, i) => [a, i === 0 ? AUTOR : `${AUTOR} ${i + 1}`]));
    // Nomes mais longos primeiro, para "Augusto Tinoco" nao virar "Augusto <novo>".
    for (const autor of [...novoNome.keys()].sort((a, b) => b.length - a.length)) {
      if (autor !== novoNome.get(autor)) xml = xml.split(autor).join(novoNome.get(autor)!);
    }
    zip.file(caminho, xml);
  }

  writeFileSync(arquivo, await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
  console.log(`${arquivo}: nome e contrato removidos, ${formulasRemovidas} fórmulas externas convertidas em valor`);
}

for (const m of MODELOS) await limpar(m);
