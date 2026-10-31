import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null | undefined;

/**
 * Cliente do Supabase (somente servidor, usa a service role).
 * O Supabase é opcional: sem variáveis de ambiente o app funciona direto com o TMDb.
 */
export function getSupabase(): SupabaseClient | null {
  if (cliente !== undefined) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cliente =
    url && chave ? createClient(url, chave, { auth: { persistSession: false } }) : null;
  return cliente;
}
