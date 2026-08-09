// Utilidades compartidas por las funciones de IA.
// Las claves viven aquí, en el servidor, NUNCA en el cliente.

import { createClient } from "jsr:@supabase/supabase-js@2";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const LIMITE_DIARIO = Number(Deno.env.get("LIMITE_IA_DIARIO") ?? "40");

export function json(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export function clienteAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** Devuelve el usuario autenticado o null. */
export async function usuarioDe(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const cliente = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );
  const { data, error } = await cliente.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/** Comprueba el cupo diario de generaciones. */
export async function dentroDelCupo(admin: ReturnType<typeof clienteAdmin>, userId: string) {
  const { data } = await admin.rpc("uso_ia_hoy", { p_user: userId });
  const usadas = Number(data ?? 0);
  return { ok: usadas < LIMITE_DIARIO, usadas, limite: LIMITE_DIARIO };
}

export async function registrarUso(
  admin: ReturnType<typeof clienteAdmin>,
  userId: string, tipo: string, temaSlug: string,
) {
  const permitidos = ["esquema", "resumen", "flashcards", "mapa_mental", "examen"];
  await admin.from("ia_usage").insert({
    user_id: userId,
    temario_slug: "filosofia-secundaria",
    tema_slug: temaSlug,
    material_type: permitidos.includes(tipo) ? tipo : "resumen",
  });
}

// ---------------------------------------------------------------- DeepSeek
export async function deepseek(sistema: string, usuario: string, maxTokens = 8000) {
  const clave = Deno.env.get("DEEPSEEK_API_KEY");
  if (!clave) throw new Error("Falta el secreto DEEPSEEK_API_KEY");
  const modelo = Deno.env.get("DEEPSEEK_MODEL") ?? "deepseek-v4-flash";

  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${clave}` },
    body: JSON.stringify({
      model: modelo,
      messages: [
        { role: "system", content: sistema },
        { role: "user", content: usuario },
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  });
  if (!r.ok) throw new Error(`DeepSeek ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return { texto: j.choices?.[0]?.message?.content ?? "", modelo };
}

// ------------------------------------------------------------------ Gemini
export async function gemini(sistema: string, usuario: string, maxTokens = 8000) {
  const clave = Deno.env.get("GEMINI_API_KEY");
  if (!clave) throw new Error("Falta el secreto GEMINI_API_KEY");
  const modelo = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.6-flash";

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: [{ role: "user", parts: [{ text: usuario }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: maxTokens },
      }),
    },
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  const texto = (j.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "").join("");
  return { texto, modelo };
}

/** Recorta el tema para no exceder la ventana de contexto. */
export function recortar(html: string, maxCaracteres = 60000) {
  const texto = html
    .replace(/<h([1-5])[^>]*>/g, "\n\n## ")
    .replace(/<\/h[1-5]>/g, "\n")
    .replace(/<li[^>]*>/g, "\n- ")
    .replace(/<\/p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (texto.length <= maxCaracteres) return texto;
  // conserva principio y final, que es donde están índice y conclusiones
  const mitad = Math.floor(maxCaracteres / 2);
  return texto.slice(0, mitad) + "\n\n[…fragmento intermedio omitido…]\n\n" + texto.slice(-mitad);
}
