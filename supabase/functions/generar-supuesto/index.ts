// Genera supuestos prácticos nuevos con el formato real del tribunal de Canarias
// y anclados al currículo LOMLOE de la comunidad.

import {
  CORS, json, clienteAdmin, usuarioDe, dentroDelCupo, registrarUso, deepseek,
} from "./comun.ts";
import corpus from "../../../data/textos-comentario.json" with { type: "json" };

/**
 * El fragmento del comentario de texto NO lo escribe el modelo.
 *
 * Se le pidió por prompt que no inventara citas y las inventó igual: pegó una
 * frase de los Manuscritos de 1844 a una paráfrasis de El Capital y lo firmó
 * como «Trabajo asalariado y capital» (1849), una obra donde la palabra
 * plusvalía todavía no podía aparecer. A un modelo no se le pide que no
 * alucine; se le quita la ocasión. Aquí elegimos nosotros de un corpus
 * transcrito y verificado, y él solo redacta la intervención didáctica.
 *
 * El rango de longitud imita el de los enunciados oficiales de 2025.
 */
interface TextoCorpus {
  id: string; autor: string; obra: string; localizacion: string;
  referencia: string; periodo: string; texto: string; palabras: number;
}

const TEXTOS: TextoCorpus[] = (corpus.textos as TextoCorpus[])
  .filter((t) => t.palabras >= 70 && t.palabras <= 230);

/**
 * Solo Historia de la Filosofía tiene bloques cronológicos; en Filosofía de 4.º
 * y de 1.º son temáticos y cualquier época encaja.
 */
const PERIODOS_POR_BLOQUE: Record<string, string[]> = {
  I: ["antigua"],
  II: ["medieval", "moderna"],
  III: ["moderna", "contemporanea"],
};

/**
 * Elegir al azar entre los 46 textos daba supuestos incoherentes: un fragmento
 * de Althusser dentro del bloque «Del origen de la Filosofía en Grecia hasta el
 * fin de la Antigüedad». El azar acertaba a veces, y eso es peor que fallar
 * siempre, porque esconde el fallo.
 *
 * Se estrecha el pozo en dos pasos, y cada uno solo se aplica si deja algo
 * dentro: primero la época que corresponde al bloque, después el autor del tema
 * anclado («La Naturaleza en Aristóteles» pide a Aristóteles).
 */
const ADJETIVOS: [RegExp, string][] = [
  [/cartesian/i, "descartes"],
  [/kantian/i, "kant"],
  [/aristot(é|e)lic/i, "aristóteles"],
  [/plat(ó|o)nic/i, "platón"],
  [/tomist/i, "tomás"],
  [/marxist/i, "marx"],
  [/nietzschean/i, "nietzsche"],
  [/humean/i, "hume"],
  [/spinozist|espinos/i, "spinoza"],
];

function elegirTexto(materia: string, bloque: string, tituloTema: string): TextoCorpus {
  let pozo = TEXTOS;

  if (/historia de la filosof/i.test(materia)) {
    const romano = (bloque.match(/^\s*(I{1,3})\b/) ?? [])[1];
    const permitidos = romano ? PERIODOS_POR_BLOQUE[romano] : undefined;
    if (permitidos) {
      const porEpoca = pozo.filter((t) => permitidos.includes(t.periodo));
      if (porEpoca.length) pozo = porEpoca;
    }
  }

  if (tituloTema) {
    const titulo = tituloTema.toLowerCase();
    // Varios temas nombran al autor en adjetivo: «El método cartesiano» no
    // contiene la palabra Descartes.
    const porAdjetivo = ADJETIVOS.filter(([re]) => re.test(titulo)).map(([, a]) => a);
    const delAutor = pozo.filter((t) => {
      // "Tomás de Aquino" -> "tomás"; "José Ortega y Gasset" -> "gasset".
      const apellido = t.autor.split(" de ")[0].split(" ").pop()!.toLowerCase();
      if (apellido.length <= 3) return false;
      return titulo.includes(apellido) || porAdjetivo.includes(apellido);
    });
    if (delAutor.length) pozo = delAutor;
  }

  return pozo[Math.floor(Math.random() * pozo.length)];
}

function citar(t: TextoCorpus) {
  const partes = [t.autor, t.obra, t.localizacion].filter(Boolean).join(", ");
  return t.referencia ? `${partes}. ${t.referencia}` : partes;
}

const SISTEMA = `
Eres miembro de la Comisión de Coordinación de Filosofía de los procedimientos
selectivos de la Consejería de Educación del Gobierno de Canarias. Tu tarea es
redactar enunciados de supuestos prácticos para la Parte A de la primera prueba
del Cuerpo 590, especialidad 201.

Formato real de la convocatoria de 2025, que debes reproducir con exactitud:

0. El enunciado ABRE SIEMPRE con la frase marco del tribunal, en imperativo:
   - «Realice el siguiente análisis histórico-semántico y a continuación desarrolle la
     intervención didáctica propuesta:»
   - «Realice el siguiente comentario de texto y a continuación desarrolle la intervención
     didáctica propuesta:»
   Y la consigna del ejercicio va también en imperativo y en segunda persona de cortesía:
   - «Realice un análisis histórico-semántico del término TÉRMINO teniendo en cuenta las
     siguientes indicaciones:»
   - «Realice un comentario de texto teniendo en cuenta las siguientes indicaciones:»
   No uses nunca fórmulas impersonales del tipo «A continuación se presenta el término…».

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

2. Una INTERVENCIÓN DIDÁCTICA, redactada con esta plantilla literal, en segunda persona
   de cortesía y en presente:

   «Imparte usted clase de la materia de {MATERIA} de {CURSO} a un grupo de {N}
   estudiantes de la modalidad de {MODALIDAD}. El grupo cuenta con {ALUMNADO NEAE}.
   Está usted abordando una situación de aprendizaje relacionada con los saberes básicos
   del bloque {ROMANO}, «{NOMBRE DEL BLOQUE}». {ENCARGO DEL CENTRO}. Tiene usted que
   elaborar una propuesta didáctica.»

   El curso se escribe SIEMPRE con la preposición, como en el documento oficial:
   «2.º de Bachillerato», «1.º de Bachillerato», «4.º de ESO». Nunca «2.º Bachillerato».

   El encargo del centro es una efeméride, una petición de la vicedirección, una
   aportación a un eje temático o a un proyecto de centro.
   Si usas una efeméride, tiene que EXISTIR de verdad. No inventes celebraciones
   con nombre plausible. Ejemplos reales utilizables: Día Mundial de la Filosofía
   (UNESCO, tercer jueves de noviembre), Día Escolar de la No Violencia y la Paz
   (30 de enero), Día Internacional de la Mujer (8 de marzo), Día de los Derechos
   Humanos (10 de diciembre), Día Internacional de los Trabajadores (1 de mayo).
   No existe ningún «Día Escolar de la Filosofía».
   La expresión «situación de aprendizaje» es terminología LOMLOE y no se sustituye.

Reglas innegociables:
- Siglas NEAE de Canarias. Si desarrollas una sigla, usa EXACTAMENTE esta denominación;
  jamás inventes el desarrollo:
    NEE     Necesidades Educativas Especiales
    TEA     Trastorno del Espectro del Autismo
    TDAH    Trastorno por Déficit de Atención e Hiperactividad
    DEA     Dificultades Específicas de Aprendizaje
    ECOPHE  Especiales Condiciones Personales o de Historia Escolar
    ALCAIN  Altas Capacidades Intelectuales
    INTARSE Incorporación Tardía al Sistema Educativo
    DM      Discapacidad Motora
  Lo habitual en el documento oficial es citarlas en seco («un alumno TEA», «1 alumno
  DEA (dislexia)»), sin desplegarlas.
- Densidad de NEAE realista: UNO O DOS casos por grupo. Los tres supuestos oficiales de
  2025 tenían exactamente dos cada uno, sobre grupos de 16, 27 y 30 estudiantes. Nunca
  más de tres: un aula con siete perfiles no es una convocatoria real, es otra prueba.
- El bloque de saberes básicos debe ser exactamente uno de los que se te faciliten, y se
  nombra como BLOQUE (número romano y título), no como un saber básico suelto. Los
  saberes concretos orientan el contenido, pero lo que se cita en el enunciado es el
  bloque al que pertenecen.
- En el comentario de texto, el fragmento y su referencia TE LOS DAMOS NOSOTROS, ya
  verificados contra la fuente. Tu única obligación con ellos es copiarlos palabra por
  palabra. No elijas otro texto, no lo abrevies, no lo modernices, no corrijas sus
  erratas ni cambies su puntuación. Jamás cites de memoria.
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
    let tituloTema = "";
    if (Number.isInteger(temaNumero)) {
      const { data: meta } = await admin
        .from("temas").select("numero, titulo")
        .eq("temario_id", temario!.id).eq("numero", temaNumero).maybeSingle();
      if (meta) {
        tituloTema = meta.titulo ?? "";
        anclaje = `El ejercicio de análisis debe poder resolverse con el tema ${meta.numero} ` +
                  `del temario oficial: «${meta.titulo}».`;
      }
    }

    const elegido = tipo === "comentario-de-texto"
      ? elegirTexto(materia, bloque, tituloTema)
      : null;

    const prompt = [
      `Redacta UN supuesto práctico completo del tipo: ${tipo}.`,
      anclaje,
      elegido
        ? [
            "",
            "EL FRAGMENTO YA ESTÁ ELEGIDO. No lo sustituyas, no lo recortes, no lo",
            "reescribas y no lo 'mejores': cópialo palabra por palabra tal y como",
            "aparece aquí, y debajo la referencia exacta. Está verificado contra su",
            "fuente; cualquier retoque tuyo lo convertiría en una cita falsa.",
            "",
            "TEXTO:",
            elegido.texto,
            "",
            `REFERENCIA (cópiala tal cual): ${citar(elegido)}`,
          ].join("\n")
        : "",
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
        ? "(frase marco: «Realice el siguiente comentario de texto y a continuación desarrolle la intervención didáctica propuesta:»)\n\n### Comentario de texto\n«Realice un comentario de texto teniendo en cuenta las siguientes indicaciones:» + guion literal de cuatro apartados\n\n> (el fragmento que se te ha dado, copiado literalmente)\n\n(la referencia que se te ha dado, copiada literalmente)"
        : "(frase marco: «Realice el siguiente análisis histórico-semántico y a continuación desarrolle la intervención didáctica propuesta:»)\n\n### Análisis histórico-semántico\n«Realice un análisis histórico-semántico del término TÉRMINO teniendo en cuenta las siguientes indicaciones:» (término en mayúsculas) + guion literal de cuatro apartados",
      "",
      "### Intervención didáctica",
      "(un solo bloque siguiendo la plantilla literal: «Imparte usted clase de la materia de … a un grupo de N estudiantes de la modalidad de … El grupo cuenta con … Está usted abordando una situación de aprendizaje relacionada con los saberes básicos del bloque …, «…». <encargo del centro>. Tiene usted que elaborar una propuesta didáctica.»)",
    ].filter(Boolean).join("\n");

    // Sin cadena de pensamiento (es el valor por defecto de deepseek()): esto es
    // redactar un enunciado con un formato fijo, no resolverlo. 6000 tokens son
    // de sobra para el enunciado más largo.
    const { texto, modelo } = await deepseek(SISTEMA, prompt, 6000, "no");
    if (!texto.trim()) return json({ error: "El modelo devolvió una respuesta vacía." }, 502);

    await admin.from("materiales_ia").insert({
      user_id: usuario.id, temario_id: temario!.id,
      tema_numero: Number.isInteger(temaNumero) ? temaNumero : null,
      tipo: "supuesto", modelo, contenido: texto,
      metadatos: {
        tipoSupuesto: tipo, materia, curso, bloque,
        dificultad: dificultad ?? "normal",
        textoId: elegido?.id ?? null,
      },
    });
    await registrarUso(admin, usuario.id, "examen", `supuesto-${Date.now()}`);

    return json({ contenido: texto, modelo, usadasHoy: cupo.usadas + 1, limite: cupo.limite });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error inesperado" }, 500);
  }
});
