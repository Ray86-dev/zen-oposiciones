// Genera supuestos prácticos nuevos con el formato real del tribunal de Canarias
// y anclados al currículo LOMLOE de la comunidad.

import {
  CORS, json, clienteAdmin, usuarioDe, dentroDelCupo, registrarUso, deepseek,
} from "./comun.ts";

const SISTEMA = `
Eres miembro de la Comisión de Coordinación de Filosofía de los procedimientos
selectivos de la Consejería de Educación del Gobierno de Canarias. Tu tarea es
redactar enunciados de supuestos prácticos para la Parte A de la primera prueba
del Cuerpo 590, especialidad 201.

Formato real de la convocatoria de 2025, que debes reproducir con exactitud:

1. Un ejercicio de análisis, que puede ser de dos tipos:
   a) ANÁLISIS HISTÓRICO-SEMÁNTICO de un término filosófico, con este guion literal:
      a) Analice el término secuenciando las distintas interpretaciones históricamente dadas.
      b) Profundice en al menos tres de las definiciones establecidas en la pregunta anterior,
         situando cada una de ellas en un período histórico (Edad Antigua, Edad Moderna y
         Edad Contemporánea).
      c) Relacione las distintas concepciones del término habidas a lo largo de la historia de
         la filosofía.
      d) Valore y reflexione críticamente sobre la actualidad filosófica del término.
   b) COMENTARIO DE TEXTO, con este guion literal:
      a) Explique las ideas fundamentales del texto.
      b) Relacione las ideas del texto con el conjunto de la obra del autor.
      c) Establezca relaciones de semejanza y diferencia con otras concepciones filosóficas.
      d) Valore y reflexione críticamente sobre la actualidad filosófica de las ideas del texto
         y del autor.

2. Una INTERVENCIÓN DIDÁCTICA con un contexto de aula concreto: materia, curso,
   modalidad, número de estudiantes, alumnado NEAE con sus siglas oficiales, bloque
   de saberes básicos del currículo canario y un encargo del centro (una efeméride,
   una petición de vicedirección, una aportación a un eje temático o a un proyecto).
   Termina siempre con: «Tiene usted que elaborar una propuesta didáctica.»

Reglas innegociables:
- El contexto de aula debe ser verosímil: ratios reales, siglas NEAE correctas
  (TEA, TDAH, DEA, ALCAIN, INTARSE, DM, ECOPHE), y una casuística coherente con el curso.
- El bloque de saberes básicos debe ser exactamente uno de los que se te faciliten.
- Si generas un comentario de texto, el fragmento debe ser una cita REAL y verificable
  de una obra publicada, con su referencia bibliográfica. Si no puedes garantizar la
  literalidad de una cita, elige un autor y una obra que domines, y señala la referencia
  con precisión. Jamás inventes una cita atribuyéndola a un autor.
- Escribe en español de España, con el registro administrativo propio de estos documentos.
- No añadas soluciones, orientaciones ni comentarios: solo el enunciado.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const usuario = await usuarioDe(req);
    if (!usuario) return json({ error: "Necesitas iniciar sesión." }, 401);

    const { tipo, materia, curso, bloque, saberes, temaNumero, dificultad } = await req.json();
    if (!["analisis-historico-semantico", "comentario-de-texto"].includes(tipo)) {
      return json({ error: "Tipo de supuesto no válido." }, 400);
    }
    if (!materia || !curso || !bloque) {
      return json({ error: "Faltan materia, curso o bloque." }, 400);
    }

    const admin = clienteAdmin();
    const cupo = await dentroDelCupo(admin, usuario.id);
    if (!cupo.ok) {
      return json({ error: `Has alcanzado el límite de ${cupo.limite} generaciones diarias.` }, 429);
    }

    const { data: temario } = await admin
      .from("temarios").select("id").eq("slug", "filosofia-secundaria").single();

    let anclaje = "";
    if (Number.isInteger(temaNumero)) {
      const { data: meta } = await admin
        .from("temas").select("numero, titulo")
        .eq("temario_id", temario!.id).eq("numero", temaNumero).maybeSingle();
      if (meta) {
        anclaje = `El ejercicio de análisis debe poder resolverse con el tema ${meta.numero} ` +
                  `del temario oficial: «${meta.titulo}».`;
      }
    }

    const prompt = [
      `Redacta UN supuesto práctico completo del tipo: ${tipo}.`,
      anclaje,
      "",
      "CONTEXTO CURRICULAR OBLIGATORIO",
      `Materia: ${materia}`,
      `Curso: ${curso}`,
      `Bloque de saberes básicos: ${bloque}`,
      Array.isArray(saberes) && saberes.length
        ? `Saberes básicos disponibles en ese bloque:\n- ${saberes.slice(0, 18).join("\n- ")}`
        : "",
      "",
      dificultad === "alta"
        ? "Nivel de exigencia alto: término o texto poco transitado, y un contexto de aula con dos perfiles NEAE que compliquen la respuesta didáctica."
        : "Nivel de exigencia equivalente al de una convocatoria real.",
      "",
      "FORMATO DE SALIDA (Markdown, sin vallas de código):",
      "## SUPUESTO PRÁCTICO",
      tipo === "comentario-de-texto"
        ? "### Comentario de texto\n(guion literal de cuatro apartados)\n\n> (fragmento real, entre 90 y 160 palabras)\n\n(referencia bibliográfica completa)"
        : "### Análisis histórico-semántico\n(término en mayúsculas y guion literal de cuatro apartados)",
      "",
      "### Intervención didáctica",
      "(párrafo con materia, curso, modalidad, número de estudiantes y alumnado NEAE; párrafo con el bloque de saberes y el encargo del centro; cierre con «Tiene usted que elaborar una propuesta didáctica.»)",
    ].filter(Boolean).join("\n");

    const { texto, modelo } = await deepseek(SISTEMA, prompt, 3500);
    if (!texto.trim()) return json({ error: "El modelo devolvió una respuesta vacía." }, 502);

    await admin.from("materiales_ia").insert({
      user_id: usuario.id, temario_id: temario!.id,
      tema_numero: Number.isInteger(temaNumero) ? temaNumero : null,
      tipo: "supuesto", modelo, contenido: texto,
      metadatos: { tipoSupuesto: tipo, materia, curso, bloque, dificultad: dificultad ?? "normal" },
    });
    await registrarUso(admin, usuario.id, "examen", `supuesto-${Date.now()}`);

    return json({ contenido: texto, modelo, usadasHoy: cupo.usadas + 1, limite: cupo.limite });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error inesperado" }, 500);
  }
});
