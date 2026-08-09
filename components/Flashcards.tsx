"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

interface Tarjeta { anverso: string; reverso: string; tipo?: string }

/** El modelo a veces envuelve el JSON en vallas de código o añade texto alrededor. */
export function leerTarjetas(bruto: string): Tarjeta[] | null {
  const limpio = bruto.replace(/```(?:json)?/g, "").trim();
  const a = limpio.indexOf("[");
  const b = limpio.lastIndexOf("]");
  if (a === -1 || b === -1) return null;
  try {
    const j = JSON.parse(limpio.slice(a, b + 1));
    if (!Array.isArray(j) || !j.length) return null;
    const t = j.filter((x) => x && x.anverso && x.reverso);
    return t.length ? t : null;
  } catch { return null; }
}

const COLOR_TIPO: Record<string, string> = {
  concepto: "#2fbf94", autor: "#d9a441", fecha: "#7dd3fc", argumento: "#e0705a",
};

export default function Flashcards({ bruto }: { bruto: string }) {
  const tarjetas = useMemo(() => leerTarjetas(bruto), [bruto]);
  const [i, setI] = useState(0);
  const [girada, setGirada] = useState(false);
  const [sabidas, setSabidas] = useState<Set<number>>(new Set());
  const [repasar, setRepasar] = useState<Set<number>>(new Set());

  const total = tarjetas?.length ?? 0;

  const ir = useCallback((d: number) => {
    setGirada(false);
    setI((v) => (v + d + total) % total);
  }, [total]);

  const marcar = useCallback((bien: boolean) => {
    setSabidas((s) => { const n = new Set(s); bien ? n.add(i) : n.delete(i); return n; });
    setRepasar((s) => { const n = new Set(s); bien ? n.delete(i) : n.add(i); return n; });
    ir(1);
  }, [i, ir]);

  useEffect(() => {
    if (!total) return;
    const tecla = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === " ") { e.preventDefault(); setGirada((g) => !g); }
      else if (e.key === "ArrowRight") ir(1);
      else if (e.key === "ArrowLeft") ir(-1);
      else if (girada && (e.key === "1" || e.key.toLowerCase() === "s")) marcar(true);
      else if (girada && (e.key === "2" || e.key.toLowerCase() === "n")) marcar(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [girada, ir, marcar, total]);

  if (!tarjetas) return <pre className="whitespace-pre-wrap text-xs text-suave">{bruto}</pre>;

  const t = tarjetas[i];
  const completado = sabidas.size / total;
  const color = COLOR_TIPO[t.tipo ?? ""] ?? "#2fbf94";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-suave">
        <span className="tabular-nums">{i + 1} de {total}</span>
        <span className="flex items-center gap-3 tabular-nums">
          <span className="text-jade">{sabidas.size} sabidas</span>
          {repasar.size > 0 && <span className="text-coral">{repasar.size} a repasar</span>}
        </span>
      </div>

      <div className="mb-3 flex gap-0.5">
        {tarjetas.map((_, k) => (
          <button key={k} onClick={() => { setI(k); setGirada(false); }}
            className="h-1 flex-1 rounded-full transition"
            style={{ background: sabidas.has(k) ? "#2fbf94" : repasar.has(k) ? "#e0705a"
                     : k === i ? "var(--suave)" : "var(--borde)" }} />
        ))}
      </div>

      <div className="[perspective:1400px]">
        <div
          onClick={() => setGirada((g) => !g)}
          className="relative min-h-[240px] w-full cursor-pointer transition-transform duration-500 [transform-style:preserve-3d]"
          style={{ transform: girada ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          <Cara visible>
            <span className="mb-3 self-start rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-widest"
                  style={{ background: `${color}22`, color }}>
              {t.tipo ?? "pregunta"}
            </span>
            <p className="serif text-xl leading-snug">{t.anverso}</p>
            <span className="mt-auto pt-4 text-[11px] text-suave">Pulsa o barra espaciadora para girar</span>
          </Cara>
          <Cara>
            <span className="mb-3 self-start text-[10px] uppercase tracking-widest text-suave">Respuesta</span>
            <p className="text-[15px] leading-relaxed">{t.reverso}</p>
            <span className="mt-auto pt-4 text-[11px] text-suave">1 la sabía · 2 repasar</span>
          </Cara>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button onClick={() => ir(-1)} title="Anterior"
          className="rounded-lg border border-borde px-3 py-2 text-sm text-suave transition hover:text-texto">←</button>
        {girada ? (
          <>
            <button onClick={() => marcar(false)}
              className="flex-1 rounded-lg border border-coral/50 py-2 text-sm text-coral transition hover:bg-coral/10">
              Repasar
            </button>
            <button onClick={() => marcar(true)}
              className="flex-1 rounded-lg bg-jade py-2 text-sm font-medium text-tinta transition hover:opacity-90">
              La sabía
            </button>
          </>
        ) : (
          <button onClick={() => setGirada(true)}
            className="flex-1 rounded-lg border border-borde py-2 text-sm text-suave transition hover:text-texto">
            Ver respuesta
          </button>
        )}
        <button onClick={() => ir(1)} title="Siguiente"
          className="rounded-lg border border-borde px-3 py-2 text-sm text-suave transition hover:text-texto">→</button>
      </div>

      {completado === 1 && (
        <p className="mt-3 rounded-lg border border-jade/40 bg-jade/10 px-3 py-2 text-center text-xs text-jade">
          Las {total} tarjetas dominadas. Vuelve mañana: el repaso espaciado es lo que fija la memoria.
        </p>
      )}
    </div>
  );
}

function Cara({ children, visible }: { children: React.ReactNode; visible?: boolean }) {
  return (
    <div
      className="absolute inset-0 flex flex-col rounded-xl border border-borde bg-tinta-3/50 p-6 [backface-visibility:hidden]"
      style={visible ? undefined : { transform: "rotateY(180deg)" }}
    >
      {children}
    </div>
  );
}
