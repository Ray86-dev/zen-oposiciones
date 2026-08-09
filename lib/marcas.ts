/**
 * Anclaje de subrayados y notas sobre HTML.
 *
 * El contenido se parte en bloques (los elementos de primer nivel). Cada marca
 * guarda { bloque, inicio, fin } en desplazamientos de TEXTO PLANO dentro de su
 * bloque, más el texto exacto para poder detectar desfases si el contenido cambia.
 */

export interface Marca {
  id: string;
  bloque: number;
  inicio: number;
  fin: number;
  texto: string;
  color?: string;
  esNota?: boolean;
}

/** Parte el HTML del tema en bloques de primer nivel. */
export function partirEnBloques(html: string): string[] {
  const bloques: string[] = [];
  const re = /<(h[1-5]|p|ul|ol|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) bloques.push(m[0]);
  return bloques.length ? bloques : [html];
}

/** Texto plano de un fragmento HTML, con las entidades ya resueltas. */
export function textoPlano(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
}

function escapar(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Inserta <mark> en el HTML de un bloque según los desplazamientos de texto.
 * Recorre los nodos de texto llevando la cuenta del desplazamiento, de modo que
 * una marca que cruce una etiqueta se parte en varios <mark> contiguos.
 */
export function aplicarMarcas(htmlBloque: string, marcas: Marca[]): string {
  if (!marcas.length) return htmlBloque;
  const ordenadas = [...marcas].sort((a, b) => a.inicio - b.inicio);

  const partes = htmlBloque.split(/(<[^>]+>)/g);
  let desplazamiento = 0;
  const salida: string[] = [];

  for (const parte of partes) {
    if (!parte) continue;
    if (parte.startsWith("<")) { salida.push(parte); continue; }

    const plano = textoPlano(parte);
    const inicioNodo = desplazamiento;
    const finNodo = desplazamiento + plano.length;

    const solapan = ordenadas.filter((m) => m.inicio < finNodo && m.fin > inicioNodo);
    if (!solapan.length) {
      salida.push(parte);
      desplazamiento = finNodo;
      continue;
    }

    let cursor = 0;
    let trozo = "";
    for (const m of solapan) {
      const a = Math.max(0, m.inicio - inicioNodo);
      const b = Math.min(plano.length, m.fin - inicioNodo);
      if (b <= cursor) continue;
      if (a > cursor) trozo += escapar(plano.slice(cursor, a));
      const atributos = [
        `data-color="${m.color ?? "amarillo"}"`,
        `data-id="${m.id}"`,
        m.esNota ? 'data-nota="si"' : "",
      ].filter(Boolean).join(" ");
      trozo += `<mark ${atributos}>${escapar(plano.slice(a, b))}</mark>`;
      cursor = b;
    }
    if (cursor < plano.length) trozo += escapar(plano.slice(cursor));
    salida.push(trozo);
    desplazamiento = finNodo;
  }
  return salida.join("");
}

/** Desplazamiento en texto plano de un punto (nodo, offset) dentro de un elemento. */
export function desplazamientoEn(raiz: Node, nodo: Node, offset: number): number {
  const paseador = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  let total = 0;
  let actual: Node | null;
  while ((actual = paseador.nextNode())) {
    if (actual === nodo) return total + offset;
    total += (actual.textContent ?? "").length;
  }
  return total;
}

/** Lee la selección del usuario y la traduce a { bloque, inicio, fin, texto }. */
export function leerSeleccion(): Omit<Marca, "id" | "color"> | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const rango = sel.getRangeAt(0);
  const texto = sel.toString().trim();
  if (texto.length < 2) return null;

  let el: Node | null = rango.commonAncestorContainer;
  while (el && !(el instanceof HTMLElement && el.dataset.bloque)) el = el.parentNode;
  if (!el || !(el instanceof HTMLElement)) return null;

  const bloque = Number(el.dataset.bloque);
  const inicio = desplazamientoEn(el, rango.startContainer, rango.startOffset);
  const fin = desplazamientoEn(el, rango.endContainer, rango.endOffset);
  if (fin <= inicio) return null;
  return { bloque, inicio, fin, texto };
}

export const COLORES = [
  { id: "amarillo", nombre: "Idea clave", css: "var(--sub-amarillo)" },
  { id: "verde", nombre: "Definición", css: "var(--sub-verde)" },
  { id: "rosa", nombre: "Autor o cita", css: "var(--sub-rosa)" },
  { id: "azul", nombre: "Dudoso", css: "var(--sub-azul)" },
];
