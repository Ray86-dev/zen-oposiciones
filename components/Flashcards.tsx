"use client";
import { useMemo, useState } from "react";

interface Tarjeta { anverso: string; reverso: string; tipo?: string }

/** El modelo a veces envuelve el JSON en vallas de código o añade texto. */
export function leerTarjetas(bruto: string): Tarjeta[] | null {
  const limpio = bruto.replace(/```(?:json)?/g, "").trim();
  const a = limpio.indexOf("[");
  const b = limpio.lastIndexOf("]");
  if (a === -1 || b === -1) return null;
  try {
    const j = JSON.parse(limpio.slice(a, b + 1));
    if (!Array.isArray(j) || !j.length) return null;
    return j.filter((t) => t && t.anverso && t.reverso);
  } catch { return null; }
}

export default function Flashcards({ bruto }: { bruto: string }) {
  const tarjetas = useMemo(() => leerTarjetas(bruto), [bruto]);
  const [i, setI] = useState(0);
  const [girada, setGirada] = useState(false);
  const [sabidas, setSabidas] = useState<Set<number>>(new Set());

  if (!tarjetas) {
    return <pre className="whitespace-pre-wrap text-xs text-suave">{bruto}</pre>;
  }

  const t = tarjetas[i];
  const ir = (d: number) => {
    setI((v) => (v + d + tarjetas.length) % tarjetas.length);
    setGirada(false);
  };
  const marcar = (bien: boolean) => {
    setSabidas((s) => {
      const n = new Set(s);
      if (bien) n.add(i); else n.delete(i);
      return n;
    });
    ir(1);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-suave">
        <span className="tabular-nums">{i + 1} / {tarjetas.length}</span>
        <span className="tabular-nums">{sabidas.size} dominadas</span>
      </div>
      <div className="mb-2 h-1 overflow-hidden rounded bg-tinta-3">
        <div className="h-full rounded bg-jade transition-all"
             style={{ width: `${(sabidas.size / tarjetas.length) * 100}%` }} />
      </div>

      <button
        onClick={() => setGirada((g) => !g)}
        className="flex min-h-[190px] w-full flex-col justify-center rounded-xl border border-borde bg-tinta-3/50 p-5 text-left transition hover:border-jade/50"
      >
        {t.tipo && !girada && (
          <span className="mb-2 self-start rounded bg-jade/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-jade">
            {t.tipo}
          </span>
        )}
        <p className={girada ? "text-sm leading-relaxed" : "serif text-lg leading-snug"}>
          {girada ? t.reverso : t.anverso}
        </p>
        <span className="mt-3 text-[11px] text-suave">
          {girada ? "Pulsa para volver a la pregunta" : "Pulsa para ver la respuesta"}
        </span>
      </button>

      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => ir(-1)} className="rounded-lg border border-borde px-3 py-1.5 text-sm text-suave hover:text-texto">←</button>
        {girada ? (
          <>
            <button onClick={() => marcar(false)} className="flex-1 rounded-lg border border-coral/40 px-3 py-1.5 text-sm text-coral">
              Repasar
            </button>
            <button onClick={() => marcar(true)} className="flex-1 rounded-lg bg-jade px-3 py-1.5 text-sm font-medium text-tinta">
              La sabía
            </button>
          </>
        ) : (
          <button onClick={() => setGirada(true)} className="flex-1 rounded-lg border border-borde px-3 py-1.5 text-sm text-suave hover:text-texto">
            Ver respuesta
          </button>
        )}
        <button onClick={() => ir(1)} className="rounded-lg border border-borde px-3 py-1.5 text-sm text-suave hover:text-texto">→</button>
      </div>
    </div>
  );
}
