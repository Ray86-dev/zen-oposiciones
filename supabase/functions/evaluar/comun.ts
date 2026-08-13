// COPIA. El original está en supabase/functions/_compartido/comun.ts
// Si lo cambias ahí, vuelve a copiarlo en las dos funciones antes de desplegar.
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
/**
 * Cuánto se le deja pensar al modelo antes de responder.
 *
 * deepseek-v4-flash razona por defecto, y su presupuesto de razonamiento sale
 * del mismo `max_tokens` que la respuesta. Con 6000 se gastó los 6000 pensando
 * (reasoning_tokens: 6000) y devolvió el contenido vacío con finish_reason
 * "length": dos minutos de espera para nada. Redactar un enunciado con un
 * formato fijo no necesita cadena de pensamiento, así que por defecto va
 * apagada; quien la necesite, que la pida.
 */
export type Pensar = "no" | "poco" | "normal";

export async function deepseek(
  sistema: string,
  usuario: string,
  maxTokens = 8000,
  pensar: Pensar = "no",
) {
  const clave = Deno.env.get("DEEPSEEK_API_KEY");
  if (!clave) throw new Error("Falta el secreto DEEPSEEK_API_KEY");
  const modelo = Deno.env.get("DEEPSEEK_MODEL") ?? "deepseek-v4-flash";

  const pensamiento = pensar === "no"
    ? { type: "disabled" }
    : { type: "enabled", reasoning_effort: pensar === "poco" ? "low" : "high" };

  // La pasarela de Supabase corta la función a los ~150 s y devuelve un 504:
  // un error mudo, sin traza, que no dice si el modelo tardó, se atascó o no
  // existe. Mejor rendirse antes por nuestra cuenta y contarlo.
  const ESPERA_MAXIMA = 75_000;

  const pedir = async (tope: number, conPensamiento = true) => {
    const aborto = new AbortController();
    const reloj = setTimeout(() => aborto.abort(), ESPERA_MAXIMA);
    let r: Response;
    try {
      r = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${clave}` },
        body: JSON.stringify({
          model: modelo,
          messages: [
            { role: "system", content: sistema },
            { role: "user", content: usuario },
          ],
          temperature: 0.4,
          max_tokens: tope,
          ...(conPensamiento ? { thinking: pensamiento } : {}),
        }),
        signal: aborto.signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error(
          `El modelo ${modelo} no respondió en ${ESPERA_MAXIMA / 1000} s. ` +
          `Comprueba el secreto DEEPSEEK_MODEL y el saldo de la cuenta.`,
        );
      }
      throw e;
    } finally {
      clearTimeout(reloj);
    }
    if (!r.ok) {
      const cuerpo = (await r.text()).slice(0, 300);
      // Red de seguridad: si esta cuenta o este modelo aún no aceptan el
      // parámetro `thinking`, se repite sin él antes de dar la tarde por
      // perdida. Se pierde el control del razonamiento, no el servicio.
      if (r.status === 400 && conPensamiento && /thinking|reasoning/i.test(cuerpo)) {
        clearTimeout(reloj);
        return await pedir(tope, false);
      }
      throw new Error(`DeepSeek ${r.status}: ${cuerpo}`);
    }
    const j = await r.json();
    const eleccion = j.choices?.[0];
    return {
      texto: (eleccion?.message?.content ?? "") as string,
      motivo: (eleccion?.finish_reason ?? "sin finish_reason") as string,
      // Los modelos con cadena de pensamiento la devuelven en un campo aparte.
      razonando: Boolean(eleccion?.message?.reasoning_content),
      uso: j.usage ?? null,
      claves: Object.keys(j ?? {}).join(","),
    };
  };

  // Sin reintento: duplicar el tope duplicaba la espera y era lo que hacía
  // saltar el 504 de la pasarela. Antes de reintentar hay que saber por qué
  // vino vacío, y para eso está el detalle de abajo.
  const res = await pedir(maxTokens);

  if (!res.texto.trim()) {
    const detalle = [
      `modelo ${modelo}`,
      `finish_reason: ${res.motivo}`,
      res.razonando ? "devolvió cadena de pensamiento pero no respuesta" : null,
      res.uso ? `tokens: ${JSON.stringify(res.uso)}` : null,
      res.motivo === "sin finish_reason" ? `claves de la respuesta: ${res.claves}` : null,
    ].filter(Boolean).join(" · ");
    throw new Error(`El modelo no devolvió texto (${detalle}).`);
  }

  return { texto: res.texto, modelo };
}

// ------------------------------------------------------------------ Gemini
export interface OpcionesGemini {
  /** Esquema OpenAPI. Con él, el modelo no puede devolver otra cosa que JSON. */
  esquema?: unknown;
  /**
   * Cadena de pensamiento. Apagada por defecto y por el mismo motivo que en
   * DeepSeek: los tokens de razonamiento salen del mismo `maxOutputTokens` que
   * la respuesta, así que pensar de más devuelve una respuesta cortada por la
   * mitad. Rellenar un formato fijo no lo necesita.
   */
  pensar?: boolean;
}

export async function gemini(
  sistema: string,
  usuario: string,
  maxTokens = 8000,
  op: OpcionesGemini = {},
) {
  const clave = Deno.env.get("GEMINI_API_KEY");
  if (!clave) throw new Error("Falta el secreto GEMINI_API_KEY");
  const modelo = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.6-flash";

  const pedir = (conExtras: boolean) => fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: [{ role: "user", parts: [{ text: usuario }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: maxTokens,
          ...(conExtras && op.esquema
            ? { responseMimeType: "application/json", responseSchema: op.esquema }
            : {}),
          ...(conExtras && !op.pensar ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    },
  );

  let r = await pedir(true);
  if (!r.ok) {
    const detalle = (await r.text()).slice(0, 300);
    // Red de seguridad, igual que en DeepSeek: si este modelo aún no acepta el
    // esquema o el presupuesto de pensamiento, se repite sin ellos antes de dar
    // la generación por perdida. Se pierde la garantía, no el servicio.
    if (r.status === 400 && /thinking|responseSchema|responseMimeType|json/i.test(detalle)) {
      r = await pedir(false);
      if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
    } else {
      throw new Error(`Gemini ${r.status}: ${detalle}`);
    }
  }

  const j = await r.json();
  const candidato = j.candidates?.[0];
  const texto = (candidato?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "").join("");
  return {
    texto,
    modelo,
    // Sin esto, una respuesta cortada por el tope de tokens es indistinguible
    // de un modelo que no sabe obedecer el formato.
    motivo: (candidato?.finishReason ?? "sin finishReason") as string,
    uso: j.usageMetadata ?? null,
  };
}

/**
 * Corta el bloque final de bibliografía y webgrafía.
 *
 * Es una lista de obras reales que el modelo conoce de su entrenamiento, así que
 * mandarla como «material de partida» es una invitación a preguntar por libros
 * que el tema solo cita. Así salió una tarjeta sobre las etapas del saber en
 * Zubiri cuando Zubiri aparece una vez en el tema 1, en la bibliografía.
 */
export function sinBibliografia(texto: string): string {
  // El índice del principio también dice «Bibliografía», así que hay que
  // quedarse con la ÚLTIMA aparición, no con la primera: cortando por la
  // primera, el tema 1 pasaba de 22.100 caracteres a 762.
  const patron = /\n[^\n]{0,40}\b(BIBLIOGRAF[IÍ]A|REFERENCIAS BIBLIOGR)/gi;
  let corte = -1;
  for (const m of texto.matchAll(patron)) {
    if (m.index !== undefined) corte = m.index;
  }
  // Red de seguridad: si el corte se llevara más de un tercio del tema, es que
  // hemos acertado en el sitio equivocado. Mejor mandarlo entero.
  if (corte < 0 || corte < texto.length * 0.66) return texto;
  return texto.slice(0, corte).trimEnd();
}

/** Normaliza para comparar: sin tildes, sin puntuación y sin dobles espacios. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
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
