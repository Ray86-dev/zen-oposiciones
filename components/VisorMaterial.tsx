"use client";
import { useState } from "react";
import { markdownAHtml } from "@/lib/markdown";
import { aDocx, descargarBlob, imprimirComoPdf } from "@/lib/exportar";
import Flashcards from "@/components/Flashcards";
import Mermaid from "@/components/Mermaid";

export const NOMBRES: Record<string, string> = {
  esquema: "Esquema",
  resumen: "Resumen",
  tema_examen: "Tema de examen",
  guia_estudio: "Guía de estudio",
  flashcards: "Flashcards",
  preguntas: "Autoevaluación",
  mapa_conceptual: "Mapa conceptual",
  supuesto: "Supuesto práctico",
};

export default function VisorMaterial({
  tipo, contenido, titulo, subtitulo, extras, alto = "60vh",
}: {
  tipo: string; contenido: string; titulo: string; subtitulo: string;
  extras?: React.ReactNode; alto?: string;
}) {
  const [ocupado, setOcupado] = useState(false);

  const descargarDocx = async () => {
    setOcupado(true);
    try {
      const blob = await aDocx(titulo, subtitulo, contenido);
      descargarBlob(`${nombreArchivo(titulo)}.docx`, blob);
    } finally { setOcupado(false); }
  };

  const guardarPdf = () => {
    const cuerpo = tipo === "mapa_conceptual" || tipo === "flashcards"
      ? `<pre>${contenido.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</pre>`
      : markdownAHtml(contenido);
    imprimirComoPdf(titulo, subtitulo, cuerpo);
  };

  return (
    <div>
      <div className="overflow-y-auto" style={{ maxHeight: alto }}>
        {tipo === "flashcards" ? (
          <Flashcards bruto={contenido} />
        ) : tipo === "mapa_conceptual" ? (
          <Mermaid bruto={contenido} />
        ) : (
          <div className="markdown text-sm" dangerouslySetInnerHTML={{ __html: markdownAHtml(contenido) }} />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borde pt-3">
        <button onClick={descargarDocx} disabled={ocupado}
          className="rounded border border-borde px-2.5 py-1 text-[11px] text-suave transition hover:text-texto disabled:opacity-40">
          {ocupado ? "Generando…" : "Word"}
        </button>
        <button onClick={guardarPdf}
          className="rounded border border-borde px-2.5 py-1 text-[11px] text-suave transition hover:text-texto">
          PDF
        </button>
        <button onClick={() => navigator.clipboard.writeText(contenido)}
          className="rounded border border-borde px-2.5 py-1 text-[11px] text-suave transition hover:text-texto">
          Copiar
        </button>
        {extras}
      </div>
    </div>
  );
}

export function nombreArchivo(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 70);
}
