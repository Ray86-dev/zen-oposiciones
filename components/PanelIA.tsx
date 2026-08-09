"use client";
import { useState } from "react";
import { llamarFuncion } from "@/lib/supabase";
import { markdownAHtml } from "@/lib/markdown";

const MATERIALES = [
  { id: "esquema", nombre: "Esquema", nota: "Índice jerárquico para memorizar", motor: "DeepSeek" },
  { id: "resumen", nombre: "Resumen", nota: "1.000 palabras, prosa continua", motor: "DeepSeek" },
  { id: "tema_examen", nombre: "Tema de examen", nota: "Lo que cabe a mano en 2 h 30", motor: "DeepSeek" },
  { id: "guia_estudio", nombre: "Guía de estudio", nota: "Glosario, autores, errores típicos", motor: "Gemini" },
  { id: "flashcards", nombre: "Flashcards", nota: "20-30 tarjetas de repaso activo", motor: "Gemini" },
  { id: "preguntas", nombre: "Autoevaluación", nota: "10 preguntas de nivel tribunal", motor: "Gemini" },
  { id: "mapa_conceptual", nombre: "Mapa conceptual", nota: "Diagrama en Mermaid", motor: "Gemini" },
];

interface Respuesta { contenido: string; modelo: string; cacheado?: boolean; usadasHoy?: number; limite?: number; }

export default function PanelIA({ numero }: { numero: number }) {
  const [tipo, setTipo] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [res, setRes] = useState<Respuesta | null>(null);
  const [error, setError] = useState("");

  const generar = async (id: string, regenerar = false) => {
    setTipo(id); setCargando(true); setError(""); setRes(null);
    try {
      setRes(await llamarFuncion<Respuesta>("generar-material", { temaNumero: numero, tipo: id, regenerar }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ha fallado la generación.");
    } finally { setCargando(false); }
  };

  const actual = MATERIALES.find((m) => m.id === tipo);

  return (
    <div className="space-y-3">
      <div className="tarjeta p-3">
        <p className="text-xs text-suave">
          Se genera a partir del texto de este tema y se guarda en tu cuenta.
        </p>
        <div className="mt-2 space-y-1">
          {MATERIALES.map((m) => (
            <button
              key={m.id} onClick={() => generar(m.id)} disabled={cargando}
              className={`w-full rounded-lg px-3 py-2 text-left transition disabled:opacity-40 ${
                tipo === m.id ? "bg-tinta-3" : "hover:bg-tinta-3/60"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm">{m.nombre}</span>
                <span className="text-[10px] uppercase tracking-wide text-suave">{m.motor}</span>
              </span>
              <span className="block text-[11px] text-suave">{m.nota}</span>
            </button>
          ))}
        </div>
      </div>

      {cargando && (
        <div className="tarjeta p-4">
          <p className="text-sm text-suave">Generando {actual?.nombre.toLowerCase()}…</p>
          <div className="mt-2 h-1 overflow-hidden rounded bg-tinta-3">
            <div className="h-full w-1/3 animate-pulse rounded bg-jade" />
          </div>
          <p className="mt-2 text-[11px] text-suave">Puede tardar entre 20 y 60 segundos.</p>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral">{error}</p>
      )}

      {res && (
        <div className="tarjeta p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-2">
            <span className="text-sm">{actual?.nombre}</span>
            <span className="text-[10px] text-suave">
              {res.modelo}{res.cacheado ? " · guardado" : ""}
            </span>
          </div>
          <div
            className="markdown mt-3 max-h-[60vh] overflow-y-auto text-sm"
            dangerouslySetInnerHTML={{ __html: markdownAHtml(res.contenido) }}
          />
          <div className="mt-3 flex flex-wrap gap-2 border-t border-borde pt-3">
            <button
              onClick={() => navigator.clipboard.writeText(res.contenido)}
              className="rounded border border-borde px-2.5 py-1 text-[11px] text-suave hover:text-texto"
            >
              Copiar
            </button>
            <button
              onClick={() => descargar(`tema-${numero}-${tipo}.md`, res.contenido)}
              className="rounded border border-borde px-2.5 py-1 text-[11px] text-suave hover:text-texto"
            >
              Descargar
            </button>
            <button
              onClick={() => tipo && generar(tipo, true)}
              className="rounded border border-borde px-2.5 py-1 text-[11px] text-suave hover:text-texto"
            >
              Regenerar
            </button>
            {res.usadasHoy != null && (
              <span className="ml-auto self-center text-[10px] text-suave">
                {res.usadasHoy}/{res.limite} hoy
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function descargar(nombre: string, contenido: string) {
  const b = new Blob([contenido], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = nombre;
  a.click();
}
