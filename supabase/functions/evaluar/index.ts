// Corrige pruebas de dominio. Dos modos:
//   transcribir → lee el manuscrito con Gemini y devuelve el texto para confirmar
//   evaluar     → puntúa contra la rúbrica oficial del tribunal
//
// La transcripción va separada a propósito: si el OCR lee mal una palabra y
// encima se puntúa por ello, la nota no vale nada. El usuario confirma primero.

import { CORS, json, clienteAdmin, usuarioDe, dentroDelCupo, registrarUso, deepseek } from "./comun.ts";

const SISTEMA_TRANSCRIBIR = `
Transcribes exámenes manuscritos de oposiciones de Filosofía en español.

- Devuelve ÚNICAMENTE la transcripción literal, sin comentarios ni valoraciones.
- Respeta la estructura: si hay un índice numerado, transcríbelo como lista;
  si hay epígrafes, márcalos con ## delante.
- Conserva la ortografía original, incluidas las faltas: se está evaluando.
- Si una palabra es ilegible, escribe [ilegible] en su lugar. No inventes.
- Si hay tachones o texto entre paréntesis tachado, omítelo: en esta oposición
  las rectificaciones se marcan así deliberadamente.
- No corrijas, no completes y no mejores nada.`;

const RUBRICA_A = `
Criterios oficiales de la Parte A (desarrollo del tema), Comisión de Coordinación
de Filosofía, Canarias. Cuerpo 590, especialidad 201. Total 10 puntos:

A. Estructura y organización (1,5)
   - Índice bien estructurado e introducción (0,5)
   - Estructuración adecuada y tratamiento equilibrado de los apartados (0,5)
   - Coherencia entre apartados y secuenciación lógica (0,5)
B. Desarrollo, contenido y rigor científico (6)
   - Exposición y argumentación con rigor, conocimiento profundo y actualizado (2)
   - Vocabulario técnico y precisión terminológica (2)
   - Conclusión personal y coherente con el desarrollo (0,75)
   - Cita de aspectos históricos, autores o autoras (1)
   - Referencias bibliográficas y webs (0,25)
C. Competencia comunicativa (1)
   - Presentación, orden, claridad y legibilidad (0,25)
   - Corrección ortográfica (0,25)
   - Coherencia y cohesión sintáctica y semántica (0,25)
   - Adecuación y riqueza léxica (0,25)
D. Originalidad en el planteamiento (1,5)
   - Planteamiento original o innovador (0,75)
   - Conexión con problemas contemporáneos o tendencias actuales (0,75)`;

async function gemini(sistema: string, partes: unknown[], maxTokens = 8000) {
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
        contents: [{ role: "user", parts: partes }],
        generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens },
      }),
    },
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 250)}`);
  const j = await r.json();
  return (j.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "").join("").trim();
}

/** El texto del tema, recortado, sirve de referencia para corregir. */
function aTexto(html: string, max = 45000) {
  const t = html
    .replace(/<h([1-5])[^>]*>/g, "\n\n## ").replace(/<\/h[1-5]>/g, "\n")
    .replace(/<li[^>]*>/g, "\n- ").replace(/<\/p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n").trim();
  return t.length <= max ? t : t.slice(0, max) + "\n\n[…]";
}

/** Solo los encabezados: es lo que se compara al reconstruir el índice. */
function indiceDe(html: string) {
  return [...html.matchAll(/<h[23][^>]*>(.*?)<\/h[23]>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter((t) => t && !/^ÍNDICE$/i.test(t));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const usuario = await usuarioDe(req);
    if (!usuario) return json({ error: "Necesitas iniciar sesión." }, 401);

    const cuerpo = await req.json();
    const { modo, temaNumero } = cuerpo;
    if (!Number.isInteger(temaNumero) || temaNumero < 1 || temaNumero > 71) {
      return json({ error: "Número de tema no válido." }, 400);
    }

    const admin = clienteAdmin();
    const cupo = await dentroDelCupo(admin, usuario.id);
    if (!cupo.ok) return json({ error: `Límite de ${cupo.limite} usos diarios alcanzado.` }, 429);

    // ---------------------------------------------------- transcribir
    if (modo === "transcribir") {
      const imagenes: { mime: string; datos: string }[] = cuerpo.imagenes ?? [];
      if (!imagenes.length) return json({ error: "No has adjuntado ninguna imagen." }, 400);
      if (imagenes.length > 8) return json({ error: "Máximo ocho páginas por prueba." }, 400);

      const partes = [
        { text: "Transcribe estas páginas manuscritas en orden. Devuelve solo el texto." },
        ...imagenes.map((i) => ({ inlineData: { mimeType: i.mime, data: i.datos } })),
      ];
      const texto = await gemini(SISTEMA_TRANSCRIBIR, partes, 6000);
      await registrarUso(admin, usuario.id, "resumen", `transcripcion-${temaNumero}`);
      return json({ transcripcion: texto, paginas: imagenes.length });
    }

    // ---------------------------------------------------- test rápido
    // Comprobación barata para el escalón de «memorizado». No abre la puerta
    // de «dominado»: el reconocimiento no predice la escritura de un tema.
    if (modo === "test") {
      const { data: temario } = await admin
        .from("temarios").select("id").eq("slug", "filosofia-secundaria").single();
      const { data: contenido } = await admin
        .from("tema_contenido").select("html")
        .eq("temario_id", temario!.id).eq("numero", temaNumero).maybeSingle();
      if (!contenido) return json({ error: "El tema no tiene contenido cargado." }, 404);

      const { texto: bruto } = await deepseek(
        `Eres preparador de oposiciones de Filosofía. Redactas preguntas de opción
múltiple exigentes: los distractores deben ser plausibles para quien ha leído el tema
por encima, y solo distinguibles por quien lo domina. Nada de preguntas de detalle
anecdótico ni de fechas sueltas.`,
        `Escribe 10 preguntas de opción múltiple sobre este tema, con cuatro opciones cada una
y una sola correcta. Cubre los apartados principales, no solo el primero.

Devuelve SOLO un array JSON válido, sin vallas de código:
[{"pregunta":"...","opciones":["a","b","c","d"],"correcta":<0-3>,"porque":"<por qué es la correcta, una frase>"}]

=== TEMA ===
${aTexto(contenido.html, 40000)}`,
        6000,
      );
      let preguntas: unknown;
      try {
        const l = bruto.replace(/```(?:json)?/g, "").trim();
        preguntas = JSON.parse(l.slice(l.indexOf("["), l.lastIndexOf("]") + 1));
      } catch {
        return json({ error: "No se pudo generar el test. Inténtalo de nuevo." }, 502);
      }
      await registrarUso(admin, usuario.id, "examen", `test-${temaNumero}`);
      return json({ preguntas, usadasHoy: cupo.usadas + 1, limite: cupo.limite });
    }

    // ---------------------------------------------------- evaluar
    if (modo !== "evaluar") return json({ error: "Modo no reconocido." }, 400);

    const { tipo, texto, minutos, origen } = cuerpo;
    if (!["indice", "epigrafe", "tema_completo"].includes(tipo)) {
      return json({ error: "Tipo de prueba no válido." }, 400);
    }
    if (!texto || texto.trim().length < 20) {
      return json({ error: "El texto está vacío o es demasiado corto." }, 400);
    }

    const { data: temario } = await admin
      .from("temarios").select("id").eq("slug", "filosofia-secundaria").single();
    const { data: contenido } = await admin
      .from("tema_contenido").select("html")
      .eq("temario_id", temario!.id).eq("numero", temaNumero).maybeSingle();
    if (!contenido) return json({ error: "El tema no tiene contenido cargado." }, 404);
    const { data: meta } = await admin
      .from("temas").select("titulo").eq("temario_id", temario!.id)
      .eq("numero", temaNumero).maybeSingle();

    let sistema: string, encargo: string, umbral: number;

    if (tipo === "indice") {
      umbral = 7;
      sistema = `Evalúas la reconstrucción de memoria del índice de un tema de oposición
de Filosofía. Eres exigente pero justo: no penalizas que las palabras no sean idénticas,
sí que falten apartados, sobren inventados o el orden esté cambiado.`;
      encargo = `TEMA ${temaNumero}: ${meta?.titulo ?? ""}

ÍNDICE REAL DEL TEMA:
${indiceDe(contenido.html).map((t, i) => `${i + 1}. ${t}`).join("\n")}

LO QUE HA ESCRITO DE MEMORIA:
${texto}

Evalúa la reconstrucción y devuelve SOLO un JSON válido, sin vallas de código:
{
  "nota": <0 a 10>,
  "aciertos": ["apartados recordados correctamente"],
  "olvidos": ["apartados del índice real que faltan"],
  "sobrantes": ["apartados escritos que no están en el tema"],
  "orden_correcto": <true|false>,
  "comentario": "<dos o tres frases, en segunda persona, concretas>"
}
Criterio: 10 si están todos los apartados principales en orden; descuenta 1 por
cada apartado principal olvidado y 0,5 por cada uno inventado o mal ordenado.`;
    } else {
      umbral = 7;
      sistema = `Eres miembro del tribunal de oposiciones de Filosofía (cuerpo 590,
especialidad 201) de la Comunidad Autónoma de Canarias. Corriges con la plantilla
oficial, con rigor y sin condescendencia: una nota inflada no ayuda a nadie.

${RUBRICA_A}`;
      encargo = `TEMA ${temaNumero}: ${meta?.titulo ?? ""}
${tipo === "epigrafe" ? "Se ha escrito UN EPÍGRAFE del tema, no el tema completo: evalúa solo lo que corresponda a un fragmento." : "Se ha escrito el TEMA COMPLETO."}
${minutos ? `Tiempo empleado: ${minutos} minutos.` : ""}
${origen === "manuscrito" ? "Está escrito a mano y transcrito, así que no valores la caligrafía; sí la ortografía y el orden expositivo." : ""}

TEXTO ESCRITO POR LA PERSONA ASPIRANTE:
${texto}

TEMA DE REFERENCIA (para contrastar el contenido):
${aTexto(contenido.html)}

Devuelve SOLO un JSON válido, sin vallas de código:
{
  "nota": <0 a 10 con un decimal>,
  "bloques": [
    {"id":"A","nombre":"Estructura y organización","max":1.5,"obtenido":<n>,"comentario":"<una frase>"},
    {"id":"B","nombre":"Desarrollo y rigor científico","max":6,"obtenido":<n>,"comentario":"<una frase>"},
    {"id":"C","nombre":"Competencia comunicativa","max":1,"obtenido":<n>,"comentario":"<una frase>"},
    {"id":"D","nombre":"Originalidad","max":1.5,"obtenido":<n>,"comentario":"<una frase>"}
  ],
  "fuerte": ["dos o tres cosas que ha hecho bien, concretas"],
  "flojo": ["dos o tres cosas que le han restado puntos, concretas"],
  "olvidos": ["contenidos del tema de referencia que ha omitido y debería haber incluido"],
  "siguiente_paso": "<qué debería hacer antes de volver a intentarlo, una frase>"
}
La nota debe ser la suma de los bloques. Sé exigente: un 7 es un buen tema.`;
    }

    const { texto: bruto, modelo } = await deepseek(sistema, encargo, 4000);
    let detalle: Record<string, unknown>;
    try {
      const limpio = bruto.replace(/```(?:json)?/g, "").trim();
      detalle = JSON.parse(limpio.slice(limpio.indexOf("{"), limpio.lastIndexOf("}") + 1));
    } catch {
      return json({ error: "No se pudo interpretar la corrección. Inténtalo de nuevo." }, 502);
    }

    const nota = Math.max(0, Math.min(10, Number(detalle.nota) || 0));
    const aprobada = nota >= umbral;

    const { data: fila } = await admin.from("pruebas").insert({
      user_id: usuario.id, temario_id: temario!.id, tema_numero: temaNumero,
      tipo, origen: origen ?? "teclado", minutos: minutos ?? 0,
      transcripcion: origen === "manuscrito" ? texto : null,
      respuesta: origen === "manuscrito" ? null : texto,
      nota, detalle, aprobada,
    }).select("id").single();

    await registrarUso(admin, usuario.id, "examen", `prueba-${temaNumero}-${tipo}`);

    const { data: progreso } = await admin
      .from("progreso_temas").select("estado, recuerdos, dominado_desde")
      .eq("user_id", usuario.id).eq("temario_id", temario!.id)
      .eq("tema_numero", temaNumero).maybeSingle();

    return json({
      id: fila?.id, nota, aprobada, umbral, detalle, modelo,
      estado: progreso?.estado, recuerdos: progreso?.recuerdos ?? 0,
      usadasHoy: cupo.usadas + 1, limite: cupo.limite,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error inesperado" }, 500);
  }
});
