/** Conversor de Markdown a HTML, mínimo y suficiente para lo que devuelve la IA. */
export function markdownAHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const enLinea = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

  const salida: string[] = [];
  let lista: "ul" | "ol" | null = null;
  let enCodigo = false;

  const cerrarLista = () => { if (lista) { salida.push(`</${lista}>`); lista = null; } };

  for (const cruda of md.replace(/\r/g, "").split("\n")) {
    const l = cruda.trimEnd();

    if (l.trim().startsWith("```")) {
      cerrarLista();
      salida.push(enCodigo ? "</code></pre>" : "<pre><code>");
      enCodigo = !enCodigo;
      continue;
    }
    if (enCodigo) { salida.push(esc(cruda)); continue; }

    if (!l.trim()) { cerrarLista(); continue; }

    const enc = l.match(/^(#{1,4})\s+(.*)$/);
    if (enc) {
      cerrarLista();
      const n = Math.min(enc[1].length + 1, 4);
      salida.push(`<h${n}>${enLinea(enc[2])}</h${n}>`);
      continue;
    }
    if (/^>\s?/.test(l)) {
      cerrarLista();
      salida.push(`<blockquote>${enLinea(l.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }
    const vi = l.match(/^\s*[-*+]\s+(.*)$/);
    if (vi) {
      if (lista !== "ul") { cerrarLista(); salida.push("<ul>"); lista = "ul"; }
      salida.push(`<li>${enLinea(vi[1])}</li>`);
      continue;
    }
    const num = l.match(/^\s*\d+[.)]\s+(.*)$/);
    if (num) {
      if (lista !== "ol") { cerrarLista(); salida.push("<ol>"); lista = "ol"; }
      salida.push(`<li>${enLinea(num[1])}</li>`);
      continue;
    }
    if (/^[-–—]{3,}$/.test(l.trim())) { cerrarLista(); salida.push("<hr />"); continue; }

    cerrarLista();
    salida.push(`<p>${enLinea(l)}</p>`);
  }
  cerrarLista();
  if (enCodigo) salida.push("</code></pre>");
  return salida.join("\n");
}
