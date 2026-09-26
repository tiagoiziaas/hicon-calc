import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// A API Olinda do Bacen nao libera CORS para o navegador. Todas as chamadas
// saem para /api/bacen e o proprio servidor do Vite repassa ao Bacen.
const proxyBacen: Record<string, ProxyOptions> = {
  "/api/bacen": {
    target: "https://olinda.bcb.gov.br",
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/api\/bacen/, "/olinda/servico/taxaJuros/versao/v2/odata"),
    headers: { "User-Agent": "Mozilla/5.0" },
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true, proxy: proxyBacen },
  preview: { port: 4173, open: true, proxy: proxyBacen },
});
