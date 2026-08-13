// Genera material de estudio a partir del texto de un tema.
// DeepSeek para trabajo estructural (esquemas, resúmenes, tema de examen).
// Gemini para material didáctico (guía de estudio, flashcards, preguntas).

import {
  CORS, json, clienteAdmin, usuarioDe, dentroDelCupo, registrarUso,
  deepseek, gemini, recortar, sinBibliografia, normalizar,
} from "./comun.ts";

const CONTEXTO_OPOSICION = `
Eres un preparador experto de oposiciones al Cuerpo de Profesores de Enseñanza
Secundaria, especialidad Filosofía (590/201), en la Comunidad Autónoma de Canarias.

Conoces la plantilla de corrección oficial del tribunal para la Parte A (10 puntos):
- Estructura y organización (1,5): índice y una introducción, reparto equilibrado
  de los apartados, secuenciación lógica.
- Desarrollo y rigor científico (6): argumentación precisa y actualizada (2),
  vocabulario técnico (2), conclusión personal (0,75), citas de autores y aspectos
  históricos (1), referencias bibliográficas (0,25).
- Competencia comunicativa (1): presentación, ortografía, cohesión, riqueza léxica.
- Originalidad (1,5): planteamiento innovador (0,75) y conexión con problemas
  contemporáneos o tendencias actuales (0,75).

Condición material determinante: la persona aspirante escribe A MANO en 2 h 30,
lo que equivale a unas 3.000-4.000 palabras. Todo lo que produzcas debe ser
utilizable dentro de ese límite.

Escribe en español de España, con registro académico y sin florituras.
Nunca inventes citas, obras, páginas ni datos bibliográficos: si no estás seguro
de una referencia, omítela.

Una obra citada NO es contenido estudiado. Que el material mencione un libro no
te autoriza a explicar lo que dice ese libro con lo que sepas por tu cuenta: la
persona que estudia solo tiene delante el material, y una pregunta que no puede
responder con él le hace memorizar algo que nadie ha verificado.`;

const TAREAS: Record<string, { proveedor: "deepseek" | "gemini"; sistema: string; instruccion: string; tokens: number }> = {
  esquema: {
    proveedor: "deepseek", tokens: 4000,
    sistema: CONTEXTO_OPOSICION,
    instruccion: `Elabora un ESQUEMA JERÁRQUICO del tema, pensado para memorizar y para
reconstruir el índice en el examen.

Requisitos:
- Entre 4 y 6 epígrafes principales, numerados.
- Bajo cada epígrafe, subapartados con las ideas clave en forma telegráfica.
- Marca en **negrita** los términos técnicos que hay que citar sí o sí.
- Añade entre corchetes el autor o la obra asociada a cada idea cuando proceda.
- Al final, una línea «Minutos sugeridos» repartiendo 150 minutos entre epígrafes.
Devuelve Markdown. No añadas comentarios sobre tu propio trabajo.`,
  },
  resumen: {
    proveedor: "deepseek", tokens: 6000,
    sistema: CONTEXTO_OPOSICION,
    instruccion: `Redacta un RESUMEN de entre 900 y 1.200 palabras que condense el tema
sin perder rigor. Prosa continua, no lista. Conserva los términos técnicos y los
nombres propios imprescindibles. Cierra con tres o cuatro líneas de síntesis.
Devuelve Markdown.`,
  },
  tema_examen: {
    proveedor: "deepseek", tokens: 9000,
    sistema: CONTEXTO_OPOSICION,
    instruccion: `Redacta el tema TAL Y COMO habría que escribirlo en el examen, ajustado
a lo que cabe a mano en 2 h 30 (3.000-3.500 palabras).

Estructura obligatoria, siguiendo la plantilla del tribunal:
1. Índice numerado.
2. Introducción que justifique la relevancia del tema.
3. Cuatro o cinco epígrafes equilibrados, con citas de autores y anclajes históricos.
4. Un apartado que conecte el tema con un problema contemporáneo (puntúa la originalidad).
5. Conclusión personal, argumentada y coherente con el desarrollo.
6. Bibliografía: tres o cuatro referencias reales y verificables.

Devuelve Markdown.`,
  },
  guia_estudio: {
    proveedor: "gemini", tokens: 7000,
    sistema: CONTEXTO_OPOSICION,
    instruccion: `Crea una GUÍA DE ESTUDIO del tema con esta estructura:
- «En una frase»: la tesis del tema resumida en una sola oración.
- «Mapa del tema»: los conceptos principales y cómo se relacionan entre sí.
- «Glosario»: entre 8 y 12 términos técnicos definidos en una línea cada uno.
- «Autores imprescindibles»: quién, qué aportó y una obra suya.
- «Errores frecuentes»: cuatro confusiones típicas que penalizan en el tribunal.
- «Puentes con la actualidad»: tres conexiones con problemas contemporáneos.
- «Temas conectados»: con qué otros temas del temario enlaza y por qué.
Devuelve Markdown.`,
  },
  flashcards: {
    // Cada tarjeta pasó a llevar un ancla de hasta 15 palabras, así que ocupa
    // casi el doble que antes. Con los 6.000 de siempre la respuesta llegaba
    // cortada a media tarjeta y sin cerrar el array.
    proveedor: "gemini", tokens: 14000,
    sistema: CONTEXTO_OPOSICION,
    instruccion: `Genera entre 20 y 30 tarjetas de repaso activo. Ni una más.

Toda tarjeta debe poder responderse ÚNICAMENTE con el material de partida. No
uses nada que sepas por tu cuenta, por seguro que estés. Si un autor solo
aparece mencionado de pasada, no preguntes por su pensamiento.

Cada tarjeta lleva un «ancla»: un fragmento COPIADO LITERALMENTE del material,
de entre 5 y 15 palabras, que contenga la respuesta. Cópialo tal cual, sin
reescribirlo ni resumirlo. Si no encuentras un fragmento literal que sostenga la
respuesta, esa tarjeta no vale: descártala y haz otra.

Devuelve EXCLUSIVAMENTE un array JSON válido, sin texto alrededor ni vallas de
código, con esta forma:
[{"anverso":"pregunta","reverso":"respuesta","tipo":"concepto|autor|fecha|argumento","ancla":"fragmento literal del material"}]
Las preguntas deben obligar a recordar, no a reconocer.`,
  },
  preguntas: {
    proveedor: "gemini", tokens: 5000,
    sistema: CONTEXTO_OPOSICION,
    instruccion: `Plantea 10 PREGUNTAS DE AUTOEVALUACIÓN del nivel que exigiría el tribunal,
de menor a mayor dificultad. Tras cada pregunta, incluye en cursiva qué debería
contener una buena respuesta, en dos o tres líneas. Devuelve Markdown.`,
  },
  mapa_conceptual: {
    proveedor: "gemini", tokens: 3000,
    sistema: CONTEXTO_OPOSICION,
    instruccion: `Elabora un MAPA CONCEPTUAL en sintaxis Mermaid.
Devuelve EXCLUSIVAMENTE el bloque de código Mermaid, empezando por «graph TD».
Usa entre 12 y 20 nodos con etiquetas breves y aristas etiquetadas cuando aclaren
la relación. Evita tildes en los identificadores de nodo.`,
  },
};

/**
 * Formato exigido al modelo, no sugerido. Con esquema, la API no le deja
 * devolver prosa, disculpas ni vallas de código alrededor del JSON.
 */
const ESQUEMA_TARJETAS = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      anverso: { type: "STRING" },
      reverso: { type: "STRING" },
      tipo: { type: "STRING", enum: ["concepto", "autor", "fecha", "argumento"] },
      ancla: { type: "STRING" },
    },
    required: ["anverso", "reverso", "ancla"],
  },
};

/** Ni una tarjeta más de las que caben en una sesión de repaso. */
const TOPE_TARJETAS = 30;
/** Un ancla de tres palabras aparece en cualquier parte: no prueba nada. */
const MINIMO_PALABRAS_ANCLA = 4;

interface Tarjeta { anverso: string; reverso: string; tipo?: string; ancla?: string }

/**
 * Se queda solo con las tarjetas cuya ancla aparece de verdad en el tema.
 *
 * Pedirle al modelo que no se salga del material reduce el problema; comprobarlo
 * lo cierra. La comparación es indulgente con tildes, mayúsculas y puntuación
 * —eso son maneras de escribir lo mismo— y estricta con el contenido.
 */
function depurarTarjetas(bruto: string, material: string) {
  const limpio = bruto.replace(/```(?:json)?/g, "").trim();
  const a = limpio.indexOf("[");
  if (a === -1) return { error: "El modelo no devolvió un array JSON." };

  let crudas: unknown;
  try { crudas = JSON.parse(limpio.slice(a, limpio.lastIndexOf("]") + 1)); }
  catch { crudas = null; }

  // Rescate de una respuesta cortada por el tope de tokens: se cierra el array
  // después de la última tarjeta completa. Perder las diez últimas es mejor que
  // perder las veinte buenas que sí llegaron.
  if (!Array.isArray(crudas)) {
    const ultima = limpio.lastIndexOf("}");
    if (ultima > a) {
      try { crudas = JSON.parse(limpio.slice(a, ultima + 1) + "]"); }
      catch { crudas = null; }
    }
  }
  if (!Array.isArray(crudas)) {
    return { error: "El modelo devolvió un JSON que no se puede leer." };
  }

  const base = normalizar(material);
  const buenas: Tarjeta[] = [];
  const descartadas: string[] = [];

  for (const c of crudas as Tarjeta[]) {
    if (!c?.anverso || !c?.reverso) continue;
    if (buenas.length >= TOPE_TARJETAS) { descartadas.push(`${c.anverso} (sobra del tope)`); continue; }
    const ancla = normalizar(String(c.ancla ?? ""));
    if (ancla.split(" ").filter(Boolean).length < MINIMO_PALABRAS_ANCLA) {
      descartadas.push(`${c.anverso} (sin ancla)`);
      continue;
    }
    if (!base.includes(ancla)) {
      descartadas.push(`${c.anverso} (el ancla no está en el tema)`);
      continue;
    }
    buenas.push({ anverso: c.anverso, reverso: c.reverso, tipo: c.tipo, ancla: c.ancla });
  }

  if (!buenas.length) {
    return { error: "Ninguna tarjeta se sostiene sobre el texto del tema. Vuelve a generarlas." };
  }
  return { buenas, descartadas };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const usuario = await usuarioDe(req);
    if (!usuario) return json({ error: "Necesitas iniciar sesión." }, 401);

    const { temaNumero, tipo, regenerar } = await req.json();
    const tarea = TAREAS[tipo];
    if (!tarea) return json({ error: `Tipo de material desconocido: ${tipo}` }, 400);
    if (!Number.isInteger(temaNumero) || temaNumero < 1 || temaNumero > 71) {
      return json({ error: "El número de tema debe estar entre 1 y 71." }, 400);
    }

    const admin = clienteAdmin();

    const { data: temario } = await admin
      .from("temarios").select("id").eq("slug", "filosofia-secundaria").single();
    if (!temario) return json({ error: "No se encuentra el temario." }, 500);

    // Si ya se generó antes, se devuelve la copia guardada.
    if (!regenerar) {
      const { data: previo } = await admin
        .from("materiales_ia")
        .select("contenido, modelo, created_at")
        .eq("user_id", usuario.id).eq("temario_id", temario.id)
        .eq("tema_numero", temaNumero).eq("tipo", tipo)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (previo) return json({ ...previo, cacheado: true });
    }

    const cupo = await dentroDelCupo(admin, usuario.id);
    if (!cupo.ok) {
      return json({ error: `Has alcanzado el límite de ${cupo.limite} generaciones diarias.` }, 429);
    }

    const { data: contenido } = await admin
      .from("tema_contenido").select("html")
      .eq("temario_id", temario.id).eq("numero", temaNumero).maybeSingle();
    if (!contenido) return json({ error: `El tema ${temaNumero} aún no tiene contenido cargado.` }, 404);

    const { data: meta } = await admin
      .from("temas").select("titulo, bloque_nombre")
      .eq("temario_id", temario.id).eq("numero", temaNumero).maybeSingle();

    // Las tarjetas se generan sin la bibliografía delante: es una lista de obras
    // reales que el modelo conoce, y con ella a la vista pregunta por libros que
    // el tema solo cita. El tema de examen sí la necesita, que puntúa.
    const material = tipo === "flashcards"
      ? sinBibliografia(recortar(contenido.html))
      : recortar(contenido.html);

    const prompt = [
      `TEMA ${temaNumero}: ${meta?.titulo ?? ""}`,
      meta?.bloque_nombre ? `Bloque: ${meta.bloque_nombre}` : "",
      "",
      "TAREA:",
      tarea.instruccion,
      "",
      "MATERIAL DE PARTIDA:",
      material,
    ].join("\n");

    const { texto, modelo, motivo, uso } = tarea.proveedor === "deepseek"
      ? { ...await deepseek(tarea.sistema, prompt, tarea.tokens), motivo: "", uso: null }
      : await gemini(tarea.sistema, prompt, tarea.tokens,
          tipo === "flashcards" ? { esquema: ESQUEMA_TARJETAS } : {});
    if (!texto.trim()) return json({ error: "El modelo devolvió una respuesta vacía." }, 502);

    let contenidoFinal = texto;
    let descartadas: string[] = [];
    if (tipo === "flashcards") {
      const r = depurarTarjetas(texto, material);
      if (r.error) {
        // Con el detalle delante, el siguiente fallo se diagnostica en un vistazo
        // en vez de a ciegas: MAX_TOKENS dice «se cortó», STOP dice «no obedece».
        const detalle = [
          `motivo: ${motivo}`,
          uso ? `tokens: ${JSON.stringify(uso)}` : null,
          `devolvió ${texto.length} caracteres`,
        ].filter(Boolean).join(" · ");
        return json({ error: `${r.error} (${detalle})` }, 502);
      }
      contenidoFinal = JSON.stringify(r.buenas);
      descartadas = r.descartadas ?? [];
    }

    await admin.from("materiales_ia").insert({
      user_id: usuario.id, temario_id: temario.id, tema_numero: temaNumero,
      tipo, modelo, contenido: contenidoFinal,
      metadatos: {
        proveedor: tarea.proveedor,
        palabras: contenidoFinal.split(/\s+/).length,
        ...(tipo === "flashcards" ? { descartadas: descartadas.length, motivos: descartadas.slice(0, 20) } : {}),
      },
    });
    await registrarUso(admin, usuario.id, tipo, `tema-${temaNumero}`);

    return json({
      contenido: contenidoFinal, modelo, cacheado: false,
      usadasHoy: cupo.usadas + 1, limite: cupo.limite,
      ...(tipo === "flashcards" ? { descartadas: descartadas.length } : {}),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error inesperado" }, 500);
  }
});
