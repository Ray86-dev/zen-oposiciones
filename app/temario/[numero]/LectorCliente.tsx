"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSesion } from "@/components/Sesion";
import { useApp } from "@/components/Proveedor";
import { db, temarioId } from "@/lib/supabase";
import { partirEnBloques, aplicarMarcas, leerSeleccion, COLORES, Marca } from "@/lib/marcas";
import { ESTADOS, EstadoTema } from "@/lib/tipos";
import { useLectura, estiloLectura, papelDe } from "@/lib/lectura";
import AjustesLectura from "@/components/AjustesLectura";
import PanelIA from "@/components/PanelIA";
import Voz from "@/components/Voz";

interface Subrayado { id: string; bloque: number; inicio: number; fin: number; texto: string; color: string }
interface Anotacion { id: string; bloque: number; inicio: number | null; fin: number | null; texto_ancla: string | null; nota: string }

export default function LectorCliente({ numero }: { numero: number }) {
  const { usuario, cargando: cargandoSesion } = useSesion();
  const { temario, estado, fijarEstadoTema } = useApp();
  const { prefs, cambiar } = useLectura();
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
  const [zen, setZen] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [avance, setAvance] = useState(0);
  const [voz, setVoz] = useState(false);
  const [bloqueSonando, setBloqueSonando] = useState<number | null>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

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

  // Salir del modo zen con Escape
  useEffect(() => {
    if (!zen) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setZen(false); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [zen]);

  const seguirVoz = useCallback((idx: number) => {
    setBloqueSonando(idx);
    const el = scroller.current?.querySelector(`[data-bloque="${idx}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const alScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const total = el.scrollHeight - el.clientHeight;
    setAvance(total > 0 ? Math.min(100, (el.scrollTop / total) * 100) : 0);
  }, []);

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
      setNotaAbierta(data as Anotacion); setBorrador(""); setPanel("notas"); setZen(false);
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
  const papel = papelDe(prefs.papel);
  // En modo ancho el panel ocupa toda la fila y la columna de texto se estira;
  // en normal se conserva el tope de 68 caracteres, que es lo cómodo de leer.
  const modoAncho = prefs.ancho === "ancho";
  const anchoTexto = modoAncho ? "max-w-[92ch]" : "max-w-[68ch]";

  const barra = (
    <div className="relative flex items-center gap-1">
      <button onClick={() => setAjustes((a) => !a)} title="Tamaño, tipografía y papel"
        className="rounded-lg border border-borde bg-tinta-2/80 px-2.5 py-1 text-suave transition hover:text-texto">
        <span className="text-[11px]">A</span><span className="text-[15px]">A</span>
      </button>
      <button onClick={() => cambiar({ ancho: prefs.ancho === "normal" ? "ancho" : "normal" })}
        title={prefs.ancho === "normal" ? "Ensanchar: oculta el panel lateral" : "Volver a dos columnas"}
        className={`rounded-lg border bg-tinta-2/80 px-2.5 py-1 text-[11px] transition ${
          prefs.ancho === "ancho" ? "border-jade text-jade" : "border-borde text-suave hover:text-texto"}`}>
        {prefs.ancho === "ancho" ? "Normal" : "Ancho"}
      </button>
      <button onClick={() => setVoz((v) => !v)} title="Escuchar el tema en voz alta"
        className={`rounded-lg border bg-tinta-2/80 px-2.5 py-1 text-[11px] transition ${
          voz ? "border-jade text-jade" : "border-borde text-suave hover:text-texto"}`}>
        Escuchar
      </button>
      <button onClick={() => setZen((z) => !z)} title="Modo zen (Escape para salir)"
        className={`rounded-lg border bg-tinta-2/80 px-2.5 py-1 text-[11px] transition ${
          zen ? "border-jade text-jade" : "border-borde text-suave hover:text-texto"}`}>
        Zen
      </button>
      {ajustes && <AjustesLectura prefs={prefs} cambiar={cambiar} cerrar={() => setAjustes(false)} />}
    </div>
  );

  const lectura = (
    <div
      ref={contenedor}
      className="relative flex h-full flex-col rounded-xl border border-borde"
      style={{ background: papel.fondo }}
    >
      <div className="h-0.5 shrink-0 overflow-hidden rounded-t-xl bg-black/10">
        <div className="h-full bg-jade transition-[width] duration-150" style={{ width: `${avance}%` }} />
      </div>

      <div
        ref={scroller}
        onScroll={alScroll}
        onMouseUp={alSoltar}
        className="flex-1 overflow-y-auto overscroll-contain rounded-b-xl px-6 py-8 sm:px-10"
        style={estiloLectura(prefs)}
      >
        {!html && !error && <div className="h-96 animate-pulse rounded bg-black/5" />}
        {html && (
          <div className={`lectura mx-auto ${anchoTexto}`}>
            {bloques.map((b, i) => (
              <div key={i} data-bloque={i}
                   className={bloqueSonando === i ? "rounded-md ring-2 ring-jade/45 transition" : undefined}
                   style={bloqueSonando === i ? { background: "rgba(47,191,148,.09)", margin: "0 -.4em", padding: "0 .4em" } : undefined}
                   dangerouslySetInnerHTML={{ __html: aplicarMarcas(b, marcasPorBloque.get(i) ?? []) }} />
            ))}
            <p className="mt-16 border-t pt-6 text-center text-xs opacity-50"
               style={{ borderColor: "currentColor" }}>
              Fin del tema {numero}
            </p>
          </div>
        )}
      </div>

      {menu && seleccion && (
        <div className="absolute z-30 flex items-center gap-1 rounded-lg border border-borde bg-tinta-2 p-1 shadow-2xl"
             style={{ left: Math.max(4, Math.min(menu.x - 90, (contenedor.current?.clientWidth ?? 400) - 210)), top: Math.max(4, menu.y) }}>
          {COLORES.map((c) => (
            <button key={c.id} title={c.nombre} onClick={() => subrayar(c.id)}
              className="h-6 w-6 rounded border border-borde transition hover:scale-110"
              style={{ background: c.css }} />
          ))}
          <button onClick={anotar} className="rounded px-2 py-1 text-xs text-jade hover:underline">Nota</button>
          <button onClick={limpiar} className="rounded px-1.5 py-1 text-xs text-suave">✕</button>
        </div>
      )}
    </div>
  );

  if (zen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col p-3 sm:p-6" style={{ background: papel.fondo }}>
        <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
          <p className="truncate text-xs" style={{ color: papel.texto, opacity: 0.6 }}>
            Tema {numero}. {tema.titulo}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums" style={{ color: papel.texto, opacity: 0.5 }}>
              {Math.round(avance)}%
            </span>
            {barra}
            <button onClick={() => setZen(false)}
              className="rounded-lg border border-borde px-3 py-1.5 text-xs text-suave hover:text-texto">
              Salir
            </button>
          </div>
        </div>
        {voz && html && (
          <div className="mb-2 shrink-0">
            <Voz bloques={bloques} alCambiarBloque={seguirVoz}
                 cerrar={() => { setVoz(false); setBloqueSonando(null); }} />
          </div>
        )}
        <div className="min-h-0 flex-1">{lectura}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Cabecera tema={tema} />

      <div className="flex flex-wrap items-center gap-1">
        {ESTADOS.map((e) => (
          <button key={e.id} onClick={() => fijarEstadoTema(numero, e.id)}
            className={`rounded px-2.5 py-1 text-[11px] transition ${
              estadoActual === e.id ? "text-tinta" : "bg-tinta-3 text-suave hover:text-texto"}`}
            style={estadoActual === e.id ? { background: e.color } : undefined}>
            {e.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral">{error}</p>}

      <div className={`grid gap-5 ${modoAncho ? "" : "lg:grid-cols-[1fr_320px]"}`}>
        {/* La barra va justo encima del panel y alineada con su borde derecho:
            cerca del texto que gobierna, sin invadir el margen de lectura. */}
        <div className="flex h-[calc(100vh-210px)] min-h-[440px] flex-col">
          <div className="mb-2 flex shrink-0 justify-end">{barra}</div>
          {voz && html && (
            <div className="mb-2 shrink-0">
              <Voz bloques={bloques} alCambiarBloque={seguirVoz}
                   cerrar={() => { setVoz(false); setBloqueSonando(null); }} />
            </div>
          )}
          <div className="min-h-0 flex-1">{lectura}</div>
        </div>

        <aside className={`flex flex-col gap-3 ${
          modoAncho ? "max-h-[60vh]" : "h-[calc(100vh-210px)] min-h-[440px]"}`}>
          <div className="flex shrink-0 gap-1 rounded-lg border border-borde p-1">
            {(["notas", "ia"] as const).map((p) => (
              <button key={p} onClick={() => setPanel(p)}
                className={`flex-1 rounded px-3 py-1.5 text-xs transition ${
                  panel === p ? "bg-tinta-3 text-texto" : "text-suave hover:text-texto"}`}>
                {p === "notas" ? `Marcas (${subrayados.length + anotaciones.length})` : "Generar"}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            {panel === "ia" ? (
              <PanelIA numero={numero} titulo={tema.titulo} />
            ) : (
              <div className="space-y-2">
                {notaAbierta && (
                  <div className="tarjeta p-3">
                    <p className="text-xs text-suave">Nota sobre:</p>
                    <p className="mt-1 border-l-2 border-jade pl-2 text-xs italic">
                      {(notaAbierta.texto_ancla ?? "").slice(0, 120)}
                    </p>
                    <textarea value={borrador} onChange={(e) => setBorrador(e.target.value)}
                      rows={4} autoFocus placeholder="Escribe tu anotación…"
                      className="mt-2 w-full rounded-lg border border-borde bg-tinta-2 px-2 py-1.5 text-sm" />
                    <div className="mt-2 flex gap-2">
                      <button onClick={guardarNota} className="rounded bg-jade px-3 py-1 text-xs font-medium text-tinta">Guardar</button>
                      <button onClick={() => setNotaAbierta(null)} className="rounded border border-borde px-3 py-1 text-xs text-suave">Cancelar</button>
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
          </div>
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
