"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const CLAVE_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * La clave publicable es pública por diseño: lo que protege los datos es el RLS.
 * Las claves de DeepSeek y Gemini NO están aquí: viven como secretos en las
 * Edge Functions, que es lo único que impide que cualquiera las use.
 */
export const supabaseConfigurado = !!URL_SUPABASE && !!CLAVE_SUPABASE;

let cliente: SupabaseClient | null = null;

export function db(): SupabaseClient | null {
  if (!supabaseConfigurado) return null;
  if (!cliente) cliente = createBrowserClient(URL_SUPABASE, CLAVE_SUPABASE);
  return cliente;
}

/** Llama a una Edge Function con la sesión del usuario. */
export async function llamarFuncion<T>(nombre: string, cuerpo: unknown): Promise<T> {
  const c = db();
  if (!c) throw new Error("Supabase no está configurado.");
  const { data: sesion } = await c.auth.getSession();
  if (!sesion.session) throw new Error("Necesitas iniciar sesión.");

  const r = await fetch(`${URL_SUPABASE}/functions/v1/${nombre}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sesion.session.access_token}`,
      apikey: CLAVE_SUPABASE,
    },
    body: JSON.stringify(cuerpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
  return j as T;
}

export const TEMARIO_SLUG = "filosofia-secundaria";

let idTemario: string | null = null;
export async function temarioId(): Promise<string | null> {
  if (idTemario) return idTemario;
  const c = db();
  if (!c) return null;
  const { data } = await c.from("temarios").select("id").eq("slug", TEMARIO_SLUG).maybeSingle();
  idTemario = data?.id ?? null;
  return idTemario;
}
