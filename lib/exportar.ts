"use client";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from "docx";

interface Trozo { texto: string; negrita?: boolean; cursiva?: boolean }

/** Divide una línea de Markdown en trozos con formato. */
function trozos(linea: string): Trozo[] {
  const out: Trozo[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(linea)) !== null) {
    if (m.index > ultimo) out.push({ texto: linea.slice(ultimo, m.index) });
    const t = m[0];
    if (t.startsWith("**")) out.push({ texto: t.slice(2, -2), negrita: true });
    else if (t.startsWith("`")) out.push({ texto: t.slice(1, -1) });
    else out.push({ texto: t.slice(1, -1), cursiva: true });
    ultimo = m.index + t.length;
  }
  if (ultimo < linea.length) out.push({ texto: linea.slice(ultimo) });
  return out.length ? out : [{ texto: linea }];
}

const runs = (l: string) =>
  trozos(l).map((t) => new TextRun({ text: t.texto, bold: t.negrita, italics: t.cursiva }));

/** Convierte el Markdown de la IA en un .docx con estilos de Word. */
export async function aDocx(titulo: string, subtitulo: string, md: string): Promise<Blob> {
  const hijos: Paragraph[] = [
    new Paragraph({ text: titulo, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [new TextRun({ text: subtitulo, italics: true, color: "666666" })],
      spacing: { after: 300 },
    }),
  ];

  let enCodigo = false;
  for (const cruda of md.replace(/\r/g, "").split("\n")) {
    const l = cruda.trimEnd();
    if (l.trim().startsWith("```")) { enCodigo = !enCodigo; continue; }
    if (enCodigo) {
      hijos.push(new Paragraph({
        children: [new TextRun({ text: cruda, font: "Consolas", size: 18 })],
      }));
      continue;
    }
    if (!l.trim()) { hijos.push(new Paragraph({ text: "" })); continue; }

    const enc = l.match(/^(#{1,4})\s+(.*)$/);
    if (enc) {
      const niveles = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2,
                       HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];
      hijos.push(new Paragraph({
        children: runs(enc[2]),
        heading: niveles[Math.min(enc[1].length - 1, 3)],
        spacing: { before: 240, after: 120 },
      }));
      continue;
    }
    if (/^>\s?/.test(l)) {
      hijos.push(new Paragraph({
        children: runs(l.replace(/^>\s?/, "")),
        indent: { left: 567 }, spacing: { after: 120 },
        alignment: AlignmentType.JUSTIFIED,
      }));
      continue;
    }
    const vi = l.match(/^\s*[-*+]\s+(.*)$/);
    if (vi) { hijos.push(new Paragraph({ children: runs(vi[1]), bullet: { level: 0 } })); continue; }
    const num = l.match(/^\s*\d+[.)]\s+(.*)$/);
    if (num) { hijos.push(new Paragraph({ children: runs(num[1]), bullet: { level: 0 } })); continue; }

    hijos.push(new Paragraph({
      children: runs(l),
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 120 },
    }));
  }

  const doc = new Document({
    creator: "Zen · Oposiciones",
    title: titulo,
    styles: {
      default: {
        document: { run: { font: "Georgia", size: 22 }, paragraph: { spacing: { line: 300 } } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      children: hijos,
    }],
  });
  return Packer.toBlob(doc);
}

export function descargarBlob(nombre: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Abre una ventana de impresión con el contenido maquetado para guardar en PDF. */
export function imprimirComoPdf(titulo: string, subtitulo: string, htmlCuerpo: string) {
  const v = window.open("", "_blank", "width=860,height=1000");
  if (!v) { alert("El navegador ha bloqueado la ventana emergente."); return; }
  v.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${titulo}</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: Georgia, "Times New Roman", serif; font-size: 11.5pt; line-height: 1.55;
         color: #1a1a1a; max-width: 17cm; margin: 0 auto; }
  h1 { font-size: 19pt; margin: 0 0 .2em; }
  .sub { color: #666; font-style: italic; margin-bottom: 1.4em; font-size: 10pt;
         border-bottom: 1px solid #ddd; padding-bottom: .8em; }
  h2 { font-size: 14pt; margin: 1.3em 0 .35em; page-break-after: avoid; }
  h3 { font-size: 12.5pt; margin: 1.1em 0 .3em; page-break-after: avoid; }
  h4 { font-size: 11.5pt; margin: 1em 0 .3em; }
  p { margin: 0 0 .7em; text-align: justify; }
  ul, ol { margin: 0 0 .7em 1.4em; } li { margin: .2em 0; }
  blockquote { border-left: 3px solid #bbb; margin: 0 0 .8em; padding-left: 1em; color: #444; }
  pre { background: #f4f4f4; padding: .7em; border-radius: 4px; font-size: 9.5pt;
        white-space: pre-wrap; page-break-inside: avoid; }
  code { font-family: Consolas, monospace; font-size: 10pt; }
  table { border-collapse: collapse; width: 100%; margin-bottom: .8em; font-size: 10.5pt; }
  th, td { border: 1px solid #ccc; padding: .35em .5em; text-align: left; }
  .pie { margin-top: 2.5em; padding-top: .8em; border-top: 1px solid #ddd;
         font-size: 8.5pt; color: #888; }
</style></head><body>
<h1>${titulo}</h1><div class="sub">${subtitulo}</div>
${htmlCuerpo}
<div class="pie">Generado con Zen · Oposiciones de Filosofía (590/201)</div>
</body></html>`);
  v.document.close();
  v.focus();
  setTimeout(() => v.print(), 400);
}
