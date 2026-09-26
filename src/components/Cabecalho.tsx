import type { Tema } from "../hooks/useTema";
import { IconeLua, IconeSol } from "./Icones";

interface Props {
  tema: Tema;
  onAlternarTema: () => void;
}

export function Cabecalho({ tema, onAlternarTema }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">H</div>
        <div>
          <div className="brand-name">
            Hicon <span>Calc</span>
          </div>
          <div className="brand-sub">Taxas de juros · Banco Central</div>
        </div>
      </div>
      <button className="theme-toggle" type="button" onClick={onAlternarTema} aria-label="Alternar tema claro/escuro">
        {tema === "dark" ? <IconeSol /> : <IconeLua />}
        <span>{tema === "dark" ? "Tema claro" : "Tema escuro"}</span>
      </button>
    </header>
  );
}
