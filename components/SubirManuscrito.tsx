"use client";
import { useRef, useState } from "react";
import { prepararFoto, MAX_PAGINAS } from "@/lib/imagenes";
import { llamarFuncion } from "@/lib/supabase";

interface Pagina { nombre: string; mime: string; datos: string; kb: number }

/**
 * Fotografías del folio → transcripción → confirmación del usuario.
 * La confirmación no es un adorno: si el OCR lee mal y encima puntúa por ello,
 * la nota no significa nada.
 */
export default function SubirManuscrito({
  temaNumero, alConfirmar, cancelar,
}: {
  temaNumero: number;
  alConfirmar: (texto: string) => void;
  cancelar: () => void;
}) {
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [transcripcion, setTranscripcion] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const entrada = useRef<HTMLInputElement>(null);

  const añadir = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const nuevas: Pagina[] = [];
    for (const f of Array.from(files).slice(0, MAX_PAGINAS - paginas.length)) {
      try {
        const p = await prepararFoto(f);
        nuevas.push({ nombre: f.name, ...p });
      } catch {
        setError(`No se pudo leer ${f.name}.`);
      }
    }
    setPaginas((v) => [...v, ...nuevas]);
  };

  const transcribir = async () => {
    setCargando(true); setError("");
    try {
      const r = await llamarFuncion<{ transcripcion: string }>("evaluar", {
        modo: "transcribir", temaNumero,
        imagenes: paginas.map((p) => ({ mime: p.mime, datos: p.datos })),
      });
      setTranscripcion(r.transcripcion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo transcribir.");
    } finally { setCargando(false); }
  };

  if (transcripcion !== null) {
    const ilegibles = (transcripcion.match(/\[ilegible\]/g) ?? []).length;
    return (
      <div className="space-y-3">
        <div>
          <p className="text-sm">Revisa la transcripción antes de corregir</p>
          <p className="text-xs text-suave">
            Corrige aquí lo que el lector haya interpretado mal. Se evalúa este texto, no la foto.
            {ilegibles > 0 && (
              <span className="text-ambar"> Hay {ilegibles} fragmento{ilegibles > 1 ? "s" : ""} ilegible{ilegibles > 1 ? "s" : ""}.</span>
            )}
          </p>
        </div>
        <textarea
          value={transcripcion} onChange={(e) => setTranscripcion(e.target.value)}
          rows={14}
          className="w-full rounded-lg border border-borde bg-tinta-2 px-3 py-2 font-mono text-xs leading-relaxed"
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={() => alConfirmar(transcripcion)}
            className="rounded-lg bg-jade px-4 py-2 text-sm font-medium text-tinta">
            Es correcto, corrige
          </button>
          <button onClick={() => { setTranscripcion(null); setPaginas([]); }}
            className="rounded-lg border border-borde px-3 py-2 text-sm text-suave hover:text-texto">
            Volver a fotografiar
          </button>
          <span className="ml-auto self-center text-[11px] tabular-nums text-suave">
            {transcripcion.split(/\s+/).length} palabras
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input ref={entrada} type="file" accept="image/*" multiple capture="environment"
        className="hidden" onChange={(e) => añadir(e.target.files)} />

      {paginas.length === 0 ? (
        <button onClick={() => entrada.current?.click()}
          className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-borde py-8 text-sm text-suave transition hover:border-jade/50 hover:text-texto">
          <span className="text-2xl">📄</span>
          Fotografía tus folios o selecciona las imágenes
          <span className="text-[11px]">Hasta {MAX_PAGINAS} páginas · se reducen antes de enviarse</span>
        </button>
      ) : (
        <>
          <ul className="space-y-1">
            {paginas.map((p, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-tinta-3/60 px-3 py-2 text-xs">
                <span className="text-suave">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                <span className="tabular-nums text-suave">{p.kb} KB</span>
                <button onClick={() => setPaginas((v) => v.filter((_, k) => k !== i))}
                  className="text-suave hover:text-coral">✕</button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button onClick={transcribir} disabled={cargando}
              className="rounded-lg bg-jade px-4 py-2 text-sm font-medium text-tinta disabled:opacity-50">
              {cargando ? "Leyendo tu letra…" : "Transcribir"}
            </button>
            {paginas.length < MAX_PAGINAS && (
              <button onClick={() => entrada.current?.click()}
                className="rounded-lg border border-borde px-3 py-2 text-sm text-suave hover:text-texto">
                Añadir página
              </button>
            )}
            <button onClick={cancelar}
              className="rounded-lg border border-borde px-3 py-2 text-sm text-suave hover:text-texto">
              Cancelar
            </button>
          </div>
        </>
      )}

      {error && <p className="rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral">{error}</p>}
      <p className="text-[11px] leading-relaxed text-suave">
        Escribe con bolígrafo azul sobre folio blanco y fotografía de frente, con buena luz.
        Es la misma letra que verá el tribunal.
      </p>
    </div>
  );
}
