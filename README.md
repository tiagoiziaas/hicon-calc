# Hicon Calc

Aplicação web (Vite + React + TypeScript) que consulta os dados abertos do BACEN
e mostra as 5 instituições financeiras com as menores taxas de juros para uma
data, segmento e modalidade de crédito, com a taxa média entre elas.

## Rodar

```bash
npm install
npm run dev       # desenvolvimento: http://localhost:5173
npm run build     # checa os tipos e gera a versão de produção em dist/
npm run preview   # serve o dist/ em http://localhost:4173
```

## Como a consulta ao BACEN funciona

- Fonte: API Olinda, recurso `TaxasJurosDiariaPorInicioPeriodo`.
- A API não libera CORS, então o navegador chama `/api/bacen/...` e o servidor
  do Vite repassa ao BACEN (proxy em `vite.config.ts`, em `dev` e `preview`).
  Em produção (Vercel) o mesmo repasse é feito pelo `vercel.json`.
- Regra de período (igual ao Hicon v3): cada dia útil é um `InicioPeriodo`; se a
  data escolhida ainda não tem dados publicados, volta um dia útil por vez (até 20).
- As instituições são ordenadas por `Posicao` e ficam as 5 primeiras; a taxa
  média é a média simples da taxa a.m. (e a.a.) delas.

## Planilhas da Minuta (Total e Parcial)

Na aba "Dados dos cenários", o painel **Gerar planilha da Minuta** tem um seletor
**Minuta Total | Minuta Parcial** e preenche o modelo escolhido em `public/modelos/`:

| Cenário do sistema | Minuta Total | Minuta Parcial | Taxa usada no recálculo |
|---|---|---|---|
| Contrato bancário | 3.3.3 QUITAÇÃO TAXA CONTRATUAL | 3.3 QUITAÇÃO TAXA CONTRATUAL | taxa contratada |
| Extraídos do BACEN | 1.1.1 QUITAÇÃO PELA TAXA MEDIA | 1.1 QUITACAO PARCIAL TAXA MEDIA | média do top 5 do BACEN na data da inclusão (4 casas) |
| Instrução Normativa 28 | 2.2.2 QUITAÇÃO PELA IN 28 INSS | 2.2 QUITAÇÃO PARCIAL TAX IN 28 | taxa máxima da IN 28 informada |

- **Total**: acha a parcela em que a dívida estaria quitada (NPER); as parcelas depois dela são o indébito.
- **Parcial**: compara parcela a parcela; nas pagas a diferença é o indébito, nas a vencer é a economia;
  total = economia + indébito em dobro.

O arquivo é editado direto no XML (`src/services/xlsx.ts`), preservando estilos e gráficos. O
mapeamento célula a célula está em `src/services/minuta.ts` (Total) e `src/services/minutaParcial.ts`
(Parcial); a lista de modelos, em `src/services/modelosMinuta.ts`.
`npm run testar:minuta -- <pasta>` gera as duas planilhas de teste fora do navegador.

## Publicação (Vercel)

O `vercel.json` já configura o build (`npm run build` → `dist/`) e o proxy
`/api/bacen/*` → API Olinda do BACEN. Com o repositório importado no Vercel,
cada `git push` na branch `main` publica uma nova versão.

## Dados de clientes

As planilhas originais do escritório **não** vão para o repositório (`.gitignore`).
Os modelos em `public/modelos/` são públicos no site, então, ao trocar um modelo
por uma planilha nova, rode `npm run limpar:modelos`: ele remove nome do cliente,
número do contrato, vínculos com outras planilhas (caminhos do Drive), a pasta
onde o arquivo foi salvo e os nomes da equipe nos comentários e no autor.

## Estrutura

```
src/
  services/bacen.ts     consulta ao BACEN (paginação, período, top 5, cache)
  utils/datas.ts        regras de dia útil / período
  utils/formatos.ts     formatação pt-BR (%, datas, CNPJ)
  hooks/useTema.ts      tema claro/escuro (salvo no navegador)
  components/           Cabecalho, Filtros, Resumo, Ranking
  App.tsx               tela principal
  styles.css            visual (roxo/preto e roxo/branco)
```
