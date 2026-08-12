"use client";
import { useMemo, useState } from "react";
import { useApp } from "@/components/Proveedor";
import Pastilla from "@/components/Pastilla";
import Aparece from "@/components/efectos/Aparece";
import { hoy } from "@/lib/almacen";
import { iso, diasEntre, NOMBRE_MES, formatoLargo } from "@/lib/fechas";
import { fases } from "@/lib/plan";
import { SesionPlan } from "@/lib/tipos";

export default function PaginaCalendario() {
  const { plan, estado, listo } = useApp();
  const h = hoy();
  const [mes, setMes] = useState(() => h.slice(0, 7));
  const [sel, setSel] = useState<string | null>(h);

  const porFecha = useMemo(() => {
    const m = new Map<string, SesionPlan[]>();
    for (const s of plan) {
      if (!m.has(s.fecha)) m.set(s.fecha, []);
      m.get(s.fecha)!.push(s);
    }
    return m;
  }, [plan]);

  const [anio, m0] = mes.split("-").map(Number);
  const fs = useMemo(() => fases(estado.fechaInicio, estado.fechaPrueba), [estado.fechaInicio, estado.fechaPrueba]);

  if (!listo) return <div className="tarjeta h-64 animate-pulse" />;

  const primero = new Date(Date.UTC(anio, m0 - 1, 1));
  const diasMes = new Date(Date.UTC(anio, m0, 0)).getUTCDate();
  const offset = (primero.getUTCDay() + 6) % 7;

  const celdas: (string | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasMes }, (_, i) => iso(new Date(Date.UTC(anio, m0 - 1, i + 1)))),
  ];

  const cambiar = (delta: number) => {
    const d = new Date(Date.UTC(anio, m0 - 1 + delta, 1));
    setMes(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const sesionesSel = sel ? porFecha.get(sel) ?? [] : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="serif text-2xl">
          {NOMBRE_MES[m0 - 1]} <span className="text-suave">{anio}</span>
        </h1>
        <div className="flex gap-2">
          <Boton onClick={() => cambiar(-1)}>←</Boton>
          <Boton onClick={() => setMes(h.slice(0, 7))}>Hoy</Boton>
          <Boton onClick={() => cambiar(1)}>→</Boton>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
        {fs.map((f) => (
          <span key={f.id}>
            <b className="text-texto">{f.id}</b> {f.nombre} · hasta {f.hasta.slice(8)}/{f.hasta.slice(5, 7)}
          </span>
        ))}
      </div>

      <Aparece className="tarjeta p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-suave">
          {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => <div key={i} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((f, i) => {
            if (!f) return <div key={`v${i}`} className="aspect-square" />;
            const ss = porFecha.get(f) ?? [];
            const total = ss.reduce((a, s) => a + s.minutos, 0);
            const esHoy = f === h;
            const esPrueba = f === estado.fechaPrueba;
            return (
              <button
                key={f}
                onClick={() => setSel(f)}
                className={`aspect-square rounded-lg border p-1 text-left transition ${
                  sel === f ? "border-jade" : "border-transparent"
                } ${esHoy ? "bg-jade/10" : ss.length ? "bg-tinta-3/70" : "bg-tinta-2/40"} hover:border-borde`}
              >
                <div className="flex items-start justify-between">
                  <span className={`text-[11px] tabular-nums ${esHoy ? "text-jade" : "text-suave"}`}>
                    {Number(f.slice(8))}
                  </span>
                  {esPrueba && <span className="text-[9px] text-coral">★</span>}
                </div>
                {total > 0 && (
                  <>
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {ss.slice(0, 4).map((s, k) => (
                        <span key={k} className="h-1 w-1 rounded-full" style={{ background: colorTipo(s.tipo) }} />
                      ))}
                    </div>
                    <div className="mt-0.5 text-[9px] tabular-nums text-suave">
                      {Math.round((total / 60) * 10) / 10}h
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </Aparece>

      {sel && (
        <Aparece as="section" className="tarjeta p-5">
          <h2 className="text-sm text-suave">{formatoLargo(sel)}</h2>
          {sesionesSel.length === 0 ? (
            <p className="mt-3 text-sm text-suave">Sin sesiones programadas.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sesionesSel.map((s, i) => (
                <li key={i} className="flex items-start gap-3 rounded-lg bg-tinta-3/60 px-4 py-3">
                  <Pastilla tipo={s.tipo} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{s.titulo}</p>
                    <p className="text-xs text-suave">{s.motivo}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-suave">{s.minutos} min</span>
                </li>
              ))}
            </ul>
          )}
          {diasEntre(sel, estado.fechaPrueba) >= 0 && (
            <p className="mt-3 text-xs text-suave">
              Faltan {diasEntre(sel, estado.fechaPrueba)} días para la prueba.
            </p>
          )}
        </Aparece>
      )}
    </div>
  );
}

function colorTipo(t: string) {
  return ({ estudio: "#2fbf94", repaso: "#d9a441", supuesto: "#e0705a", ud: "#7dd3fc", hito: "#e7ecea" } as Record<string, string>)[t] ?? "#94a3a0";
}

function Boton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-borde bg-tinta-2 px-3 py-1 text-sm text-suave transition hover:text-texto"
    >
      {children}
    </button>
  );
}
