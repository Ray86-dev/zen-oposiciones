"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSesion } from "@/components/Sesion";
import { db, temarioId } from "@/lib/supabase";
import { useEfectos } from "@/components/Efectos";

type Fase = "enfoque" | "corto" | "largo";

const DURACION: Record<Fase, number> = { enfoque: 25 * 60, corto: 5 * 60, largo: 15 * 60 };
const ETIQUETA: Record<Fase, string> = { enfoque: "Enfoque", corto: "Descanso", largo: "Descanso largo" };
const CLAVE = "zen-pomodoro";

interface Guardado {
  fase: Fase; restante: number; corriendo: boolean; desde: number | null;
  completados: number; minimizado: boolean; x: number; y: number; visible: boolean;
}

const INICIAL: Guardado = {
  fase: "enfoque", restante: DURACION.enfoque, corriendo: false, desde: null,
  completados: 0, minimizado: false, x: 0, y: 0, visible: false,
};

/** Un tono suave generado al vuelo: ni assets ni peticiones. */
function campana(agudo = false) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notas = agudo ? [880, 1174] : [523, 659, 784];
    notas.forEach((f, k) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + k * 0.18;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.start(t); o.stop(t + 1);
    });
    setTimeout(() => ctx.close(), 2500);
  } catch { /* sin audio disponible */ }
}

export default function Pomodoro() {
  const { usuario } = useSesion();
  const { celebrar, activo } = useEfectos();
  const [e, setE] = useState<Guardado>(INICIAL);
  const [listo, setListo] = useState(false);
  const arrastre = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const tituloOriginal = useRef("");
  const caja = useRef<HTMLDivElement | null>(null);
  const bloquesPrevios = useRef<number | null>(null);

  useEffect(() => {
    tituloOriginal.current = document.title;
    try {
      const raw = window.localStorage.getItem(CLAVE);
      if (raw) {
        const g = { ...INICIAL, ...JSON.parse(raw) } as Guardado;
        // Descuenta el tiempo transcurrido con la pestaña cerrada.
        if (g.corriendo && g.desde) {
          const ido = Math.floor((Date.now() - g.desde) / 1000);
          g.restante = Math.max(0, g.restante - ido);
          g.desde = Date.now();
          if (g.restante === 0) g.corriendo = false;
        }
        setE(g);
      }
    } catch { /* estado inicial */ }
    setListo(true);
  }, []);

  useEffect(() => {
    if (listo) { try { window.localStorage.setItem(CLAVE, JSON.stringify(e)); } catch { /* cuota */ } }
  }, [e, listo]);

  const registrar = useCallback(async (minutos: number) => {
    if (!usuario || minutos < 1) return;
    const c = db(); const tid = await temarioId();
    if (!c || !tid) return;
    await c.from("sesiones_estudio").insert({
      user_id: usuario.id, temario_id: tid,
      fecha: new Date().toISOString().slice(0, 10),
      tipo: "estudio", minutos, completada: true,
    });
  }, [usuario]);

  const terminar = useCallback(() => {
    setE((v) => {
      const eraEnfoque = v.fase === "enfoque";
      campana(!eraEnfoque);
      if (eraEnfoque) void registrar(Math.round(DURACION.enfoque / 60));
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(eraEnfoque ? "Bloque terminado" : "Se acabó el descanso", {
          body: eraEnfoque ? "25 minutos. Levántate y descansa cinco." : "Vuelve al tema.",
        });
      }
      const completados = eraEnfoque ? v.completados + 1 : v.completados;
      const siguiente: Fase = eraEnfoque ? (completados % 4 === 0 ? "largo" : "corto") : "enfoque";
      return { ...v, fase: siguiente, restante: DURACION[siguiente], corriendo: false, desde: null, completados };
    });
  }, [registrar]);

  useEffect(() => {
    if (!e.corriendo) return;
    const t = setInterval(() => {
      setE((v) => {
        if (!v.corriendo) return v;
        if (v.restante <= 1) return { ...v, restante: 0 };
        return { ...v, restante: v.restante - 1 };
      });
    }, 1000);
    return () => clearInterval(t);
  }, [e.corriendo]);

  useEffect(() => { if (e.corriendo && e.restante === 0) terminar(); }, [e.corriendo, e.restante, terminar]);

  // El título de la pestaña hace de reloj cuando estás en otra ventana.
  useEffect(() => {
    if (!listo) return;
    document.title = e.corriendo
      ? `${fmt(e.restante)} · ${ETIQUETA[e.fase]}`
      : tituloOriginal.current;
    return () => { document.title = tituloOriginal.current; };
  }, [e.corriendo, e.restante, e.fase, listo]);

  // Cerrar un bloque de enfoque merece algo más que una campana: las chispas
  // salen del propio temporizador, allá donde el usuario lo haya arrastrado.
  useEffect(() => {
    if (!listo) return;
    if (bloquesPrevios.current === null) { bloquesPrevios.current = e.completados; return; }
    if (e.completados > bloquesPrevios.current) {
      const r = caja.current?.getBoundingClientRect();
      if (r) celebrar(r.left + r.width / 2, r.top + r.height / 2, "#2fbf94");
    }
    bloquesPrevios.current = e.completados;
  }, [e.completados, listo, celebrar]);

  const arrancar = () => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    setE((v) => ({ ...v, corriendo: true, desde: Date.now() }));
  };

  const bajar = (ev: React.MouseEvent) => {
    arrastre.current = { x: ev.clientX, y: ev.clientY, px: e.x, py: e.y };
    const mover = (m: MouseEvent) => {
      const a = arrastre.current; if (!a) return;
      setE((v) => ({ ...v, x: a.px + (m.clientX - a.x), y: a.py + (m.clientY - a.y) }));
    };
    const soltar = () => {
      arrastre.current = null;
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
    };
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  };

  if (!listo) return null;

  if (!e.visible) {
    return (
      <button
        onClick={() => setE((v) => ({ ...v, visible: true }))}
        title="Temporizador de estudio"
        className="fixed bottom-4 right-4 z-40 rounded-full border border-borde bg-tinta-2/95 px-4 py-2.5 text-xs text-suave shadow-xl backdrop-blur transition hover:text-texto"
      >
        {e.corriendo
          ? <span className="tabular-nums text-jade">
              {activo && <span className="zen-respira mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-jade align-middle" />}
              {fmt(e.restante)}
            </span>
          : "Temporizador"}
      </button>
    );
  }

  const total = DURACION[e.fase];
  const pct = ((total - e.restante) / total) * 100;
  const color = e.fase === "enfoque" ? "#2fbf94" : "#d9a441";

  return (
    <div
      ref={caja}
      className="fixed bottom-4 right-4 z-40 select-none rounded-xl border border-borde bg-tinta-2/95 shadow-2xl backdrop-blur"
      style={{ transform: `translate(${e.x}px, ${e.y}px)`, width: e.minimizado ? 168 : 232 }}
    >
      <div onMouseDown={bajar}
        className="flex cursor-grab items-center justify-between gap-2 border-b border-borde px-3 py-1.5 active:cursor-grabbing">
        <span className="text-[10px] uppercase tracking-widest" style={{ color }}>
          {ETIQUETA[e.fase]}
        </span>
        <span className="flex items-center gap-1">
          <button onClick={() => setE((v) => ({ ...v, minimizado: !v.minimizado }))}
            className="px-1 text-[11px] text-suave hover:text-texto" title="Compactar">
            {e.minimizado ? "▢" : "▁"}
          </button>
          <button onClick={() => setE((v) => ({ ...v, visible: false }))}
            className="px-1 text-[11px] text-suave hover:text-texto" title="Ocultar">✕</button>
        </span>
      </div>

      <div className="px-3 py-3">
        <p className="serif text-center tabular-nums" style={{ fontSize: e.minimizado ? 26 : 38, color }}>
          {fmt(e.restante)}
        </p>

        <div className="zen-barra mt-2 h-1 overflow-hidden rounded bg-tinta-3">
          <span className="transition-[width]" style={{ width: `${pct}%`, background: color }} />
        </div>

        <div className="mt-3 flex gap-1.5">
          <button onClick={() => (e.corriendo ? setE((v) => ({ ...v, corriendo: false, desde: null })) : arrancar())}
            className="zen-lustre flex-1 rounded-lg py-1.5 text-xs font-medium text-tinta" style={{ background: color }}>
            {e.corriendo ? "Pausar" : e.restante === DURACION[e.fase] ? "Empezar" : "Seguir"}
          </button>
          <button onClick={() => setE((v) => ({ ...v, restante: DURACION[v.fase], corriendo: false, desde: null }))}
            title="Reiniciar el bloque"
            className="rounded-lg border border-borde px-2.5 py-1.5 text-xs text-suave hover:text-texto">⟲</button>
          <button
            onClick={() => setE((v) => {
              const sig: Fase = v.fase === "enfoque" ? "corto" : "enfoque";
              return { ...v, fase: sig, restante: DURACION[sig], corriendo: false, desde: null };
            })}
            title="Cambiar a enfoque o descanso"
            className="rounded-lg border border-borde px-2.5 py-1.5 text-xs text-suave hover:text-texto">⇄</button>
        </div>

        {!e.minimizado && (
          <div className="mt-2.5 flex items-center justify-between text-[10px] text-suave">
            <span className="flex gap-1" title={`${e.completados} bloques hoy`}>
              {[0, 1, 2, 3].map((k) => {
                const hecho = e.completados % 4 > k || (e.completados > 0 && e.completados % 4 === 0);
                const enCurso = !hecho && e.completados % 4 === k && e.corriendo && e.fase === "enfoque";
                return (
                  <span key={k}
                    className={`h-1.5 w-1.5 rounded-full ${enCurso ? "zen-respira" : ""}`}
                    style={{ background: hecho || enCurso ? "#2fbf94" : "var(--borde)" }} />
                );
              })}
            </span>
            <span className="tabular-nums">
              {e.completados} · {Math.round((e.completados * 25) / 60 * 10) / 10} h
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
