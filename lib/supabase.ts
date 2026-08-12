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

  // Sin tope, un fallo de la pasarela deja la interfaz girando para siempre.
  const aborto = new AbortController();
  const reloj = setTimeout(() => aborto.abort(), 150_000);

  let r: Response;
  try {
    r = await fetch(`${URL_SUPABASE}/functions/v1/${nombre}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sesion.session.access_token}`,
        apikey: CLAVE_SUPABASE,
      },
      body: JSON.stringify(cuerpo),
      signal: aborto.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("La generación ha tardado demasiado y se ha cancelado. Vuelve a intentarlo.");
    }
    throw e;
  } finally {
    clearTimeout(reloj);
  }

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    // Un 504 lo devuelve la pasarela, no la función: ahí no hay j.error.
    if (r.status === 504) {
      throw new Error("El servidor ha cortado la generación por tiempo (504). El modelo tardó demasiado en responder.");
    }
    throw new Error(j.error ?? `Error ${r.status}`);
  }
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
