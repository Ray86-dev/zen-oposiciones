"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSesion } from "@/components/Sesion";
import { db, temarioId } from "@/lib/supabase";
import VisorMaterial, { NOMBRES } from "@/components/VisorMaterial";
import Aparece from "@/components/efectos/Aparece";
import temarioJson from "@/data/temario-filosofia.json";

interface Material {
  id: string; tema_numero: number | null; tipo: string;
  modelo: string; contenido: string; created_at: string;
  metadatos: Record<string, unknown> | null;
}

const TITULOS = new Map(temarioJson.temas.map((t) => [t.numero, t.titulo]));

export default function PaginaMateriales() {
  const { usuario, cargando: cargandoSesion } = useSesion();
  const [items, setItems] = useState<Material[]>([]);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<Material | null>(null);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!usuario) { setCargando(false); return; }
    let vivo = true;
    (async () => {
      const c = db(); const tid = await temarioId();
      if (!c || !tid) { setCargando(false); return; }
      const { data } = await c.from("materiales_ia")
        .select("id, tema_numero, tipo, modelo, contenido, created_at, metadatos")
        .eq("temario_id", tid).order("created_at", { ascending: false });
      if (!vivo) return;
      setItems((data ?? []) as Material[]);
      setCargando(false);
    })();
    return () => { vivo = false; };
  }, [usuario]);

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return items.filter((m) => {
      if (filtro !== "todos" && m.tipo !== filtro) return false;
      if (!q) return true;
      const t = `${m.tema_numero ?? ""} ${TITULOS.get(m.tema_numero ?? 0) ?? ""} ${NOMBRES[m.tipo] ?? m.tipo}`;
      return t.toLowerCase().includes(q);
    });
  }, [items, filtro, busca]);

  const tipos = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.tipo, (m.get(i.tipo) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  if (cargandoSesion || cargando) return <div className="tarjeta h-64 animate-pulse" />;

  if (!usuario) {
    return (
      <div className="tarjeta p-6">
        <h1 className="serif text-xl">Materiales</h1>
        <p className="mt-2 text-sm text-suave">
          Aquí se guarda todo lo que generas. Necesitas{" "}
          <Link href="/entrar" className="text-jade underline">iniciar sesión</Link>.
        </p>
      </div>
    );
  }

  if (abierto) {
    const titulo = abierto.tema_numero
      ? `Tema ${abierto.tema_numero}. ${TITULOS.get(abierto.tema_numero) ?? ""}`
      : (NOMBRES[abierto.tipo] ?? abierto.tipo);
    return (
      <div className="space-y-4">
        <button onClick={() => setAbierto(null)} className="text-sm text-suave hover:text-texto">
          ← Todos los materiales
        </button>
        <div>
          <h1 className="serif text-2xl">{NOMBRES[abierto.tipo] ?? abierto.tipo}</h1>
          <p className="text-sm text-suave">
            {titulo} · {new Date(abierto.created_at).toLocaleDateString("es-ES", {
              day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="tarjeta p-6">
          <VisorMaterial
            tipo={abierto.tipo} contenido={abierto.contenido}
            titulo={titulo} subtitulo={NOMBRES[abierto.tipo] ?? abierto.tipo}
            alto="none"
            extras={
              <button
                onClick={async () => {
                  const c = db(); if (!c) return;
                  await c.from("materiales_ia").delete().eq("id", abierto.id);
                  setItems((v) => v.filter((x) => x.id !== abierto.id));
                  setAbierto(null);
                }}
                className="ml-auto rounded border border-borde px-2.5 py-1 text-[11px] text-suave hover:text-coral"
              >
                Borrar
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="serif text-2xl">Materiales</h1>
        <p className="text-sm text-suave">
          {items.length === 0
            ? "Todavía no has generado nada."
            : `${items.length} materiales guardados. Se conservan en tu cuenta.`}
        </p>
      </div>

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFiltro("todos")}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                filtro === "todos" ? "border-jade text-texto" : "border-borde text-suave hover:text-texto"}`}>
              Todos <span className="tabular-nums">{items.length}</span>
            </button>
            {tipos.map(([t, n]) => (
              <button key={t} onClick={() => setFiltro(t)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  filtro === t ? "border-jade text-texto" : "border-borde text-suave hover:text-texto"}`}>
                {NOMBRES[t] ?? t} <span className="tabular-nums">{n}</span>
              </button>
            ))}
          </div>

          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por tema o tipo…"
            className="w-full rounded-lg border border-borde bg-tinta-2 px-3 py-2 text-sm placeholder:text-suave/60" />

          <ul className="space-y-2">
            {visibles.map((m, i) => (
              <Aparece as="li" key={m.id} retardo={Math.min(i, 8) * 45}>
                <button onClick={() => setAbierto(m)}
                  className="tarjeta flex w-full items-center gap-3 p-4 text-left transition hover:border-jade/40">
                  <span className="shrink-0 rounded bg-jade/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-jade">
                    {NOMBRES[m.tipo] ?? m.tipo}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {m.tema_numero
                        ? `Tema ${m.tema_numero}. ${TITULOS.get(m.tema_numero) ?? ""}`
                        : String((m.metadatos as { materia?: string })?.materia ?? "Supuesto generado")}
                    </span>
                    <span className="text-[11px] text-suave">
                      {new Date(m.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                      {" · "}{m.contenido.split(/\s+/).length} palabras
                    </span>
                  </span>
                  <span className="shrink-0 text-suave">→</span>
                </button>
              </Aparece>
            ))}
          </ul>
          {visibles.length === 0 && <p className="text-sm text-suave">Nada con ese filtro.</p>}
        </>
      )}
    </div>
  );
}
