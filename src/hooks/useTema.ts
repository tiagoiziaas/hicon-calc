import { useCallback, useEffect, useState } from "react";

export type Tema = "dark" | "light";

const CHAVE = "hicon-tema";

export function useTema() {
  const [tema, setTema] = useState<Tema>(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    try {
      localStorage.setItem(CHAVE, tema);
    } catch {
      // navegacao privada / armazenamento bloqueado: so nao lembra o tema
    }
  }, [tema]);

  const alternar = useCallback(() => setTema((t) => (t === "dark" ? "light" : "dark")), []);

  return { tema, alternar };
}
