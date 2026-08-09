"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTema } from "@/components/Tema";

/** Extrae el diagrama aunque el modelo lo envuelva en vallas de código. */
export function leerDiagrama(bruto: string): string | null {
  const limpio = bruto.replace(/```mermaid/gi, "```").replace(/```/g, "").trim();
  const i = limpio.search(/\b(graph|flowchart|mindmap|classDiagram|erDiagram|stateDiagram)\b/);
  return i === -1 ? null : limpio.slice(i).trim();
}

export default function Mermaid({ bruto }: { bruto: string }) {
  const { modo } = useTema();
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [pantalla, setPantalla] = useState(false);
  const arrastre = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const marco = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const codigo = leerDiagrama(bruto);
    if (!codigo) { setError(true); return; }
    let vivo = true;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false, securityLevel: "strict",
          theme: modo === "oscuro" ? "dark" : "neutral",
          fontFamily: "Georgia, serif",
          flowchart: { curve: "basis", padding: 16 },
          themeVariables: modo === "oscuro"
            ? { primaryColor: "#1b2124", primaryTextColor: "#e7ecea", lineColor: "#2fbf94",
                primaryBorderColor: "#2fbf94", secondaryColor: "#131719", tertiaryColor: "#0b0d0e" }
            : { primaryColor: "#e9e3d6", primaryTextColor: "#2b2a26", lineColor: "#1f6b52",
                primaryBorderColor: "#1f6b52", secondaryColor: "#faf7f0", tertiaryColor: "#f3efe6" },
        });
        const { svg } = await mermaid.render(`d${Math.random().toString(36).slice(2)}`, codigo);
        if (vivo) { setSvg(svg); setError(false); }
      } catch { if (vivo) setError(true); }
    })();
    return () => { vivo = false; };
  }, [bruto, modo]);

  useEffect(() => {
    if (!pantalla) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPantalla(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [pantalla]);

  const reiniciar = useCallback(() => { setZoom(1); setPos({ x: 0, y: 0 }); }, []);

  const rueda = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(4, Math.max(0.3, z * (e.deltaY < 0 ? 1.12 : 0.89))));
  };
  const bajar = (e: React.MouseEvent) => {
    arrastre.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  };
  const mover = (e: React.MouseEvent) => {
    const a = arrastre.current;
    if (!a) return;
    setPos({ x: a.px + (e.clientX - a.x), y: a.py + (e.clientY - a.y) });
  };
  const soltar = () => { arrastre.current = null; };

  if (error) {
    return (
      <div>
        <p className="mb-2 text-xs text-ambar">
          El diagrama tiene un error de sintaxis. Pulsa «Regenerar» o revisa el código.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-tinta-3 p-3 text-[11px]">{bruto}</pre>
      </div>
    );
  }

  const lienzo = (
    <div
      ref={marco}
      onWheel={rueda} onMouseDown={bajar} onMouseMove={mover}
      onMouseUp={soltar} onMouseLeave={soltar} onDoubleClick={reiniciar}
      className={`relative overflow-hidden rounded-lg bg-tinta-3/40 ${
        arrastre.current ? "cursor-grabbing" : "cursor-grab"} ${pantalla ? "flex-1" : "h-[340px]"}`}
    >
      {svg ? (
        <div
          className="absolute left-1/2 top-1/2 origin-center select-none [&_svg]:h-auto [&_svg]:max-w-none"
          style={{ transform: `translate(-50%,-50%) translate(${pos.x}px, ${pos.y}px) scale(${zoom})` }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-tinta-3/40" />
      )}

      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg border border-borde bg-tinta-2/95 p-1 backdrop-blur">
        <Boton onClick={() => setZoom((z) => Math.max(0.3, z * 0.85))} titulo="Alejar">−</Boton>
        <span className="w-11 text-center text-[10px] tabular-nums text-suave">{Math.round(zoom * 100)}%</span>
        <Boton onClick={() => setZoom((z) => Math.min(4, z * 1.18))} titulo="Acercar">+</Boton>
        <Boton onClick={reiniciar} titulo="Restablecer">⟲</Boton>
        <Boton onClick={() => { setPantalla((p) => !p); reiniciar(); }} titulo="Pantalla completa">
          {pantalla ? "✕" : "⤢"}
        </Boton>
      </div>

      <p className="pointer-events-none absolute left-2 top-2 text-[10px] text-suave opacity-70">
        Arrastra para mover · rueda para el zoom · doble clic para restablecer
      </p>
    </div>
  );

  if (pantalla) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col gap-2 bg-tinta p-3">
        <p className="shrink-0 text-xs text-suave">Mapa conceptual · Escape para salir</p>
        {lienzo}
      </div>
    );
  }
  return lienzo;
}

function Boton({ onClick, titulo, children }: { onClick: () => void; titulo: string; children: React.ReactNode }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} title={titulo}
      onMouseDown={(e) => e.stopPropagation()}
      className="h-6 w-6 rounded text-xs text-suave transition hover:bg-tinta-3 hover:text-texto">
      {children}
    </button>
  );
}
