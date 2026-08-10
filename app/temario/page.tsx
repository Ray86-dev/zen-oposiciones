"use client";
import { useMemo, useState } from "react";
import { useApp } from "@/components/Proveedor";
import { ESTADOS, EstadoTema } from "@/lib/tipos";
import Link from "next/link";

export default function PaginaTemario() {
  const { temario, estado, fijarEstadoTema, listo } = useApp();
  const [bloque, setBloque] = useState<string>("todos");
  const [filtro, setFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const temas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return temario.temas.filter((t) => {
      if (bloque !== "todos" && t.bloqueId !== bloque) return false;
      const e = estado.progreso[t.numero]?.estado ?? "pendiente";
      if (filtro !== "todos" && e !== filtro) return false;
      if (q && !`${t.numero} ${t.titulo}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [temario, estado.progreso, bloque, filtro, busca]);

  if (!listo) return <div className="tarjeta h-64 animate-pulse" />;

  const conteo = ESTADOS.map((e) => ({
    ...e,
    n: temario.temas.filter((t) => (estado.progreso[t.numero]?.estado ?? "pendiente") === e.id).length,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="serif text-2xl">Temario</h1>
        <p className="text-sm text-suave">
          {temario.especialidad.numeroTemas} temas · {temario.especialidad.normaTemario}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {conteo.map((c) => (
          <button
            key={c.id}
            onClick={() => setFiltro(filtro === c.id ? "todos" : c.id)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              filtro === c.id ? "border-jade text-texto" : "border-borde text-suave hover:text-texto"
            }`}
          >
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: c.color }} />
            {c.label} <span className="tabular-nums">{c.n}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={bloque}
          onChange={(e) => setBloque(e.target.value)}
          className="rounded-lg border border-borde bg-tinta-2 px-3 py-1.5 text-sm"
        >
          <option value="todos">Todos los bloques</option>
          {temario.bloques.map((b) => (
            <option key={b.id} value={b.id}>{b.nombre} ({b.numTemas})</option>
          ))}
        </select>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar tema…"
          className="min-w-[180px] flex-1 rounded-lg border border-borde bg-tinta-2 px-3 py-1.5 text-sm placeholder:text-suave/60"
        />
      </div>

      <ul className="space-y-2">
        {temas.map((t) => {
          const e = (estado.progreso[t.numero]?.estado ?? "pendiente") as EstadoTema;
          const color = ESTADOS.find((x) => x.id === e)!.color;
          return (
            <li key={t.numero} className="tarjeta p-4">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                <div className="min-w-0 flex-1">
                  <Link href={`/temario/${t.numero}`} className="group block">
                    <p className="text-sm group-hover:text-jade">
                      <span className="tabular-nums text-suave">Tema {t.numero}.</span> {t.titulo}
                    </p>
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-suave">
                    <span>{t.bloque}</span>
                    <Link href={`/temario/${t.numero}`} className="text-jade underline">Leer y anotar</Link>
                    {t.palabras > 0 && (
                      <span className="tabular-nums">{t.palabras.toLocaleString("es-ES")} palabras</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {ESTADOS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => fijarEstadoTema(t.numero, s.id)}
                    className={`rounded px-2 py-1 text-[11px] transition ${
                      e === s.id ? "text-tinta" : "bg-tinta-3 text-suave hover:text-texto"
                    }`}
                    style={e === s.id ? { background: s.color } : undefined}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {temas.length === 0 && <p className="text-sm text-suave">Ningún tema con ese filtro.</p>}
    </div>
  );
}
