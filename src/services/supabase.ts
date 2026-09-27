import { createClient } from "@supabase/supabase-js";

// Chave PUBLICA (publishable): pode ficar no navegador. O que ela consegue fazer
// no banco e definido pelas politicas de acesso em supabase/schema.sql.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && chave);

export const supabase = supabaseConfigurado
  ? createClient(url!, chave!, { auth: { persistSession: false } })
  : null;
