// Campos de formulario com mascara no padrao brasileiro.

interface CampoBase {
  id: string;
  rotulo: string;
}

const formatarCentavos = (centavos: number | null): string =>
  centavos == null
    ? ""
    : (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Valor em R$: o usuario so digita numeros e a virgula entra sozinha (ex.: 123456 -> 1.234,56). */
export function CampoMoeda({ id, rotulo, valor, onChange }: CampoBase & {
  valor: number | null;
  onChange: (centavos: number | null) => void;
}) {
  return (
    <div className="form-campo">
      <label htmlFor={id}>{rotulo}</label>
      <div className="input-afixo">
        <span className="afixo">R$</span>
        <input
          id={id}
          inputMode="numeric"
          placeholder="0,00"
          value={formatarCentavos(valor)}
          onChange={(e) => {
            const digitos = e.target.value.replace(/\D/g, "").slice(0, 13);
            onChange(digitos ? Number(digitos) : null);
          }}
        />
      </div>
    </div>
  );
}

/** Taxa em % a.m. com ate 4 casas decimais (ex.: 1,85). */
export function CampoTaxa({ id, rotulo, valor, onChange, desabilitado }: CampoBase & {
  valor: string;
  onChange: (valor: string) => void;
  /** Campo calculado sozinho (ex.: Hiscon): so mostra o valor. */
  desabilitado?: boolean;
}) {
  return (
    <div className="form-campo">
      <label htmlFor={id}>{rotulo}</label>
      <div className="input-afixo">
        <input
          id={id}
          inputMode="decimal"
          placeholder="0,00"
          disabled={desabilitado}
          value={valor}
          onChange={(e) => {
            let v = e.target.value.replace(/\./g, ",").replace(/[^\d,]/g, "");
            const [inteiro, ...resto] = v.split(",");
            v = resto.length ? `${inteiro.slice(0, 3)},${resto.join("").slice(0, 4)}` : inteiro.slice(0, 3);
            onChange(v);
          }}
        />
        <span className="afixo">% a.m.</span>
      </div>
    </div>
  );
}

export function CampoInteiro({ id, rotulo, valor, sufixo, onChange, desabilitado }: CampoBase & {
  valor: number | null;
  sufixo?: string;
  onChange: (valor: number | null) => void;
  /** Campo calculado sozinho (ex.: Hiscon): so mostra o valor. */
  desabilitado?: boolean;
}) {
  return (
    <div className="form-campo">
      <label htmlFor={id}>{rotulo}</label>
      <div className="input-afixo">
        <input
          id={id}
          inputMode="numeric"
          placeholder="0"
          disabled={desabilitado}
          value={valor ?? ""}
          onChange={(e) => {
            const digitos = e.target.value.replace(/\D/g, "").slice(0, 4);
            onChange(digitos ? Number(digitos) : null);
          }}
        />
        {sufixo && <span className="afixo">{sufixo}</span>}
      </div>
    </div>
  );
}

export function CampoData({ id, rotulo, valor, onChange }: CampoBase & {
  valor: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div className="form-campo">
      <label htmlFor={id}>{rotulo}</label>
      <input id={id} type="date" value={valor} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function CampoTexto({ id, rotulo, valor, placeholder, onChange }: CampoBase & {
  valor: string;
  placeholder?: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div className="form-campo">
      <label htmlFor={id}>{rotulo}</label>
      <input id={id} type="text" placeholder={placeholder} value={valor} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
