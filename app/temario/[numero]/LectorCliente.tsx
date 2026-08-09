"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSesion } from "@/components/Sesion";
import { useApp } from "@/components/Proveedor";
import { db, temarioId } from "@/lib/supabase";
import { partirEnBloques, aplicarMarcas, leerSeleccion, COLORES, Marca } from "@/lib/marcas";
import { ESTADOS, EstadoTema } from "@/lib/tipos";
import PanelIA from "@/components/PanelIA";

interface Subrayado { id: string; bloque: number; inicio: number; fin: number; texto: string; color: string; }
interface Anotacion { id: string; bloque: number; inicio: number | null; fin: number | null; texto_ancla: string | null; nota: string; }

export default function LectorCliente({ numero }: { numero: number }) {
  const { usuario, cargando: cargandoSesion } = useSesion();
  const { temario, estado, fijarEstadoTema } = useApp();
  const tema = temario.temas.find((t) => t.numero === numero);

  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [subrayados, setSubrayados] = useState<Subrayado[]>([]);
  const [anotaciones, setAnotaciones] = useState<Anotacion[]>([]);
  const [seleccion, setSeleccion] = useState<{ bloque: number; inicio: number; fin: number; texto: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [notaAbierta, setNotaAbierta] = useState<Anotacion | null>(null);
  const [borrador, setBorrador] = useState("");
  const [panel, setPanel] = useState<"notas" | "ia">("notas");
  const contenedor = useRef<HTMLDivElement>(null);

  // --- carga de contenido y marcas ---
  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    (async () => {
      const c = db(); if (!c) return;
      const tid = await temarioId();
      if (!tid) { setError("No se encuentra el temario."); return; }

      const [{ data: cont, error: e1 }, { data: subs }, { data: anos }] = await Promise.all([
        c.from("tema_contenido").select("html").eq("temario_id", tid).eq("numero", numero).maybeSingle(),
        c.from("subrayados").select("*").eq("temario_id", tid).eq("tema_numero", numero),
        c.from("anotaciones").select("*").eq("temario_id", tid).eq("tema_numero", numero),
      ]);
      if (!vivo) return;
      if (e1) { setError(e1.message); return; }
      if (!cont) { setError("Este tema todavía no tiene el contenido cargado."); return; }
      setHtml(cont.html);
      setSubrayados((subs ?? []) as Subrayado[]);
      setAnotaciones((anos ?? []) as Anotacion[]);
    })();
    return () => { vivo = false; };
  }, [usuario, numero]);

  const bloques = useMemo(() => (html ? partirEnBloques(html) : []), [html]);

  const marcasPorBloque = useMemo(() => {
    const m = new Map<number, Marca[]>();
    for (const s of subrayados) {
      if (!m.has(s.bloque)) m.set(s.bloque, []);
      m.get(s.bloque)!.push({ id: s.id, bloque: s.bloque, inicio: s.inicio, fin: s.fin, texto: s.texto, color: s.color });
    }
    for (const a of anotaciones) {
      if (a.inicio == null || a.fin == null) continue;
      if (!m.has(a.bloque)) m.set(a.bloque, []);
      m.get(a.bloque)!.push({ id: a.id, bloque: a.bloque, inicio: a.inicio, fin: a.fin, texto: a.texto_ancla ?? "", esNota: true, color: "verde" });
    }
    return m;
  }, [subrayados, anotaciones]);

  // --- selección de texto ---
  const alSoltar = useCallback((e: React.MouseEvent) => {
    const s = leerSeleccion();
    if (!s) { setMenu(null); setSeleccion(null); return; }
    setSeleccion(s);
    const caja = contenedor.current?.getBoundingClientRect();
    setMenu({ x: e.clientX - (caja?.left ?? 0), y: e.clientY - (caja?.top ?? 0) - 8 });
  }, []);

  const subrayar = async (color: string) => {
    if (!seleccion || !usuario) return;
    const c = db(); const tid = await temarioId();
    if (!c || !tid) return;
    const { data, error: err } = await c.from("subrayados").insert({
      user_id: usuario.id, temario_id: tid, tema_numero: numero,
      bloque: seleccion.bloque, inicio: seleccion.inicio, fin: seleccion.fin,
      texto: seleccion.texto, color,
    }).select().single();
    if (!err && data) setSubrayados((v) => [...v, data as Subrayado]);
    limpiar();
  };

  const anotar = async () => {
    if (!seleccion || !usuario) return;
    const c = db(); const tid = await temarioId();
    if (!c || !tid) return;
    const { data, error: err } = await c.from("anotaciones").insert({
      user_id: usuario.id, temario_id: tid, tema_numero: numero,
      bloque: seleccion.bloque, inicio: seleccion.inicio, fin: seleccion.fin,
      texto_ancla: seleccion.texto, nota: "",
    }).select().single();
    if (!err && data) {
      setAnotaciones((v) => [...v, data as Anotacion]);
      setNotaAbierta(data as Anotacion);
      setBorrador("");
      setPanel("notas");
    }
    limpiar();
  };

  const limpiar = () => { setMenu(null); setSeleccion(null); window.getSelection()?.removeAllRanges(); };

  const guardarNota = async () => {
    if (!notaAbierta) return;
    const c = db(); if (!c) return;
    await c.from("anotaciones").update({ nota: borrador }).eq("id", notaAbierta.id);
    setAnotaciones((v) => v.map((a) => (a.id === notaAbierta.id ? { ...a, nota: borrador } : a)));
    setNotaAbierta(null);
  };

  const borrarSubrayado = async (id: string) => {
    const c = db(); if (!c) return;
    await c.from("subrayados").delete().eq("id", id);
    setSubrayados((v) => v.filter((s) => s.id !== id));
  };
  const borrarNota = async (id: string) => {
    const c = db(); if (!c) return;
    await c.from("anotaciones").delete().eq("id", id);
    setAnotaciones((v) => v.filter((a) => a.id !== id));
    if (notaAbierta?.id === id) setNotaAbierta(null);
  };

  if (!tema) return <p className="text-sm text-suave">No existe el tema {numero}.</p>;

  if (cargandoSesion) return <div className="tarjeta h-64 animate-pulse" />;

  if (!usuario) {
    return (
      <div className="space-y-4">
        <Cabecera tema={tema} />
        <div className="tarjeta p-6">
          <p className="text-sm text-suave">
            Para leer el tema, subrayarlo y anotarlo necesitas una cuenta: es donde se guarda todo.
          </p>
          <Link href="/entrar" className="mt-4 inline-block rounded-lg bg-jade px-4 py-2 text-sm font-medium text-tinta">
            Entrar o crear cuenta
          </Link>
        </div>
      </div>
    );
  }

  const estadoActual = (estado.progreso[numero]?.estado ?? "pendiente") as EstadoTema;

  return (
    <div className="space-y-5">
      <Cabecera tema={tema} />

      <div className="flex flex-wrap items-center gap-1">
        {ESTADOS.map((s) => (
          <button
            key={s.id}
            onClick={() => fijarEstadoTema(numero, s.id)}
            className={`rounded px-2.5 py-1 text-[11px] transition ${
              estadoActual === s.id ? "text-tinta" : "bg-tinta-3 text-suave hover:text-texto"
            }`}
            style={estadoActual === s.id ? { background: s.color } : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <article className="tarjeta relative p-6" ref={contenedor} onMouseUp={alSoltar}>
          {!html && !error && <div className="h-96 animate-pulse rounded bg-tinta-3/40" />}
          {html && (
            <div className="lectura">
              {bloques.map((b, i) => (
                <div
                  key={i}
                  data-bloque={i}
                  dangerouslySetInnerHTML={{ __html: aplicarMarcas(b, marcasPorBloque.get(i) ?? []) }}
                />
              ))}
            </div>
          )}

          {menu && seleccion && (
            <div
              className="absolute z-20 flex items-center gap-1 rounded-lg border border-borde bg-tinta-2 p-1 shadow-xl"
              style={{ left: Math.max(4, menu.x - 90), top: Math.max(4, menu.y) }}
            >
              {COLORES.map((c) => (
                <button
                  key={c.id} title={c.nombre} onClick={() => subrayar(c.id)}
                  className="h-6 w-6 rounded border border-borde"
                  style={{ background: c.css }}
                />
              ))}
              <button onClick={anotar} className="rounded px-2 py-1 text-xs text-jade hover:underline">
                Nota
              </button>
              <button onClick={limpiar} className="rounded px-1.5 py-1 text-xs text-suave">✕</button>
            </div>
          )}
        </article>

        <aside className="space-y-3">
          <div className="flex gap-1 rounded-lg border border-borde p-1">
            {(["notas", "ia"] as const).map((p) => (
              <button
                key={p} onClick={() => setPanel(p)}
                className={`flex-1 rounded px-3 py-1.5 text-xs transition ${
                  panel === p ? "bg-tinta-3 text-texto" : "text-suave hover:text-texto"
                }`}
              >
                {p === "notas" ? `Marcas (${subrayados.length + anotaciones.length})` : "Generar con IA"}
              </button>
            ))}
          </div>

          {panel === "ia" ? (
            <PanelIA numero={numero} />
          ) : (
            <div className="space-y-2">
              {notaAbierta && (
                <div className="tarjeta p-3">
                  <p className="text-xs text-suave">Nota sobre:</p>
                  <p className="mt-1 border-l-2 border-jade pl-2 text-xs italic">
                    {(notaAbierta.texto_ancla ?? "").slice(0, 120)}
                  </p>
                  <textarea
                    value={borrador} onChange={(e) => setBorrador(e.target.value)}
                    rows={4} autoFocus placeholder="Escribe tu anotación…"
                    className="mt-2 w-full rounded-lg border border-borde bg-tinta-2 px-2 py-1.5 text-sm"
                  />
                  <div className="mt-2 flex gap-2">
                    <button onClick={guardarNota} className="rounded bg-jade px-3 py-1 text-xs font-medium text-tinta">
                      Guardar
                    </button>
                    <button onClick={() => setNotaAbierta(null)} className="rounded border border-borde px-3 py-1 text-xs text-suave">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {anotaciones.filter((a) => a.nota).map((a) => (
                <div key={a.id} className="tarjeta p-3">
                  <p className="border-l-2 border-jade pl-2 text-[11px] italic text-suave">
                    {(a.texto_ancla ?? "").slice(0, 90)}
                  </p>
                  <p className="mt-1.5 text-sm">{a.nota}</p>
                  <div className="mt-1.5 flex gap-3 text-[11px]">
                    <button onClick={() => { setNotaAbierta(a); setBorrador(a.nota); }} className="text-suave hover:text-texto">Editar</button>
                    <button onClick={() => borrarNota(a.id)} className="text-suave hover:text-coral">Borrar</button>
                  </div>
                </div>
              ))}

              {subrayados.map((s) => (
                <div key={s.id} className="tarjeta flex items-start gap-2 p-3">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                        style={{ background: COLORES.find((c) => c.id === s.color)?.css }} />
                  <p className="flex-1 text-xs">{s.texto.slice(0, 130)}</p>
                  <button onClick={() => borrarSubrayado(s.id)} className="text-[11px] text-suave hover:text-coral">✕</button>
                </div>
              ))}

              {!subrayados.length && !anotaciones.length && (
                <p className="tarjeta p-4 text-xs text-suave">
                  Selecciona texto en el tema para subrayarlo con cuatro colores o añadirle una nota.
                  Todo queda guardado en tu cuenta.
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Cabecera({ tema }: { tema: { numero: number; titulo: string; bloque: string } }) {
  return (
    <div>
      <Link href="/temario" className="text-sm text-suave hover:text-texto">← Temario</Link>
      <h1 className="serif mt-1 text-2xl">
        <span className="text-suave">Tema {tema.numero}.</span> {tema.titulo}
      </h1>
      <p className="text-sm text-suave">{tema.bloque}</p>
    </div>
  );
}
