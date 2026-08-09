"use client";
import { useEffect, useRef } from "react";
import { PrefsLectura, TIPOGRAFIAS, PAPELES } from "@/lib/lectura";

export default function AjustesLectura({
  prefs, cambiar, cerrar,
}: { prefs: PrefsLectura; cambiar: (p: Partial<PrefsLectura>) => void; cerrar: () => void }) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) cerrar();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [cerrar]);

  return (
    <div ref={caja}
      className="absolute right-0 top-11 z-30 w-72 rounded-xl border border-borde bg-tinta-2 p-4 shadow-2xl">
      <Grupo titulo="Tamaño del texto">
        <div className="flex items-center gap-3">
          <button onClick={() => cambiar({ tamano: Math.max(14, prefs.tamano - 1) })}
            className="rounded-lg border border-borde px-3 py-1 text-sm">A−</button>
          <input type="range" min={14} max={26} value={prefs.tamano}
            onChange={(e) => cambiar({ tamano: Number(e.target.value) })}
            className="flex-1 accent-[#2fbf94]" />
          <button onClick={() => cambiar({ tamano: Math.min(26, prefs.tamano + 1) })}
            className="rounded-lg border border-borde px-3 py-1 text-base">A+</button>
        </div>
        <p className="mt-1 text-center text-[11px] tabular-nums text-suave">{prefs.tamano} px</p>
      </Grupo>

      <Grupo titulo="Interlineado">
        <div className="flex gap-1">
          {[1.5, 1.75, 2].map((v) => (
            <Opcion key={v} activa={prefs.interlineado === v} onClick={() => cambiar({ interlineado: v })}>
              {v === 1.5 ? "Ajustado" : v === 1.75 ? "Normal" : "Amplio"}
            </Opcion>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Tipografía">
        <div className="space-y-1">
          {TIPOGRAFIAS.map((t) => (
            <button key={t.id} onClick={() => cambiar({ tipografia: t.id })}
              className={`w-full rounded-lg px-3 py-2 text-left transition ${
                prefs.tipografia === t.id ? "bg-tinta-3" : "hover:bg-tinta-3/60"}`}>
              <span className="block text-sm" style={{ fontFamily: t.css }}>{t.nombre}</span>
              <span className="block text-[10px] text-suave">{t.nota}</span>
            </button>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Papel">
        <div className="flex gap-2">
          {PAPELES.map((p) => (
            <button key={p.id} onClick={() => cambiar({ papel: p.id })} title={p.nombre}
              className={`h-9 flex-1 rounded-lg border-2 transition ${
                prefs.papel === p.id ? "border-jade" : "border-borde"}`}
              style={{ background: p.fondo }}>
              <span className="text-[10px]" style={{ color: p.texto }}>Aa</span>
            </button>
          ))}
        </div>
      </Grupo>

      <Grupo titulo="Ancho de columna" ultimo>
        <div className="flex gap-1">
          <Opcion activa={prefs.ancho === "normal"} onClick={() => cambiar({ ancho: "normal" })}>
            Normal
          </Opcion>
          <Opcion activa={prefs.ancho === "ancho"} onClick={() => cambiar({ ancho: "ancho" })}>
            Ancho
          </Opcion>
        </div>
      </Grupo>
    </div>
  );
}

function Grupo({ titulo, children, ultimo }: { titulo: string; children: React.ReactNode; ultimo?: boolean }) {
  return (
    <div className={ultimo ? "" : "mb-4 border-b border-borde pb-4"}>
      <p className="mb-2 text-[10px] uppercase tracking-widest text-suave">{titulo}</p>
      {children}
    </div>
  );
}

function Opcion({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex-1 rounded-lg px-2 py-1.5 text-xs transition ${
        activa ? "bg-jade text-tinta" : "border border-borde text-suave hover:text-texto"}`}>
      {children}
    </button>
  );
}
