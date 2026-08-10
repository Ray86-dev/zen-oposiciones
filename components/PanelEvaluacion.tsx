"use client";
import { useCallback, useEffect, useState } from "react";
import { llamarFuncion, db, temarioId } from "@/lib/supabase";
import { useSesion } from "@/components/Sesion";
import { useApp } from "@/components/Proveedor";
import SubirManuscrito from "@/components/SubirManuscrito";
import TestRapido from "@/components/TestRapido";

interface Resultado {
  nota: number; aprobada: boolean; umbral: number;
  detalle: Record<string, unknown>; estado?: string; recuerdos?: number;
}
interface Prueba {
  id: string; tipo: string; nota: number | null; aprobada: boolean;
  created_at: string; origen: string;
}

type Vista = "inicio" | "indice" | "epigrafe" | "test";

export default function PanelEvaluacion({ numero, titulo }: { numero: number; titulo: string }) {
  const { usuario } = useSesion();
  const { recargarProgreso } = useApp();
  const [vista, setVista] = useState<Vista>("inicio");
  const [historial, setHistorial] = useState<Prueba[]>([]);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const c = db(); const tid = await temarioId();
    if (!c || !tid) return;
    const { data } = await c.from("pruebas")
      .select("id, tipo, nota, aprobada, created_at, origen")
      .eq("temario_id", tid).eq("tema_numero", numero)
      .order("created_at", { ascending: false }).limit(20);
    setHistorial((data ?? []) as Prueba[]);
  }, [numero]);

  useEffect(() => { void cargar(); }, [cargar]);

  const evaluar = async (tipo: string, texto: string, origen: string, minutos = 0) => {
    setCargando(true); setError(""); setResultado(null);
    try {
      const r = await llamarFuncion<Resultado>("evaluar", {
        modo: "evaluar", temaNumero: numero, tipo, texto, origen, minutos,
      });
      setResultado(r);
      void cargar();
      if (r.aprobada) void recargarProgreso();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo corregir.");
    } finally { setCargando(false); }
  };

  const indicesOk = historial.filter((p) => p.tipo === "indice" && p.aprobada).length;
  const escritosOk = historial.filter((p) => ["epigrafe", "tema_completo"].includes(p.tipo) && p.aprobada).length;
  const fechas = historial.filter((p) => p.aprobada).map((p) => p.created_at.slice(0, 10));
  const separacion = fechas.length >= 2
    ? Math.round((Date.parse(fechas[0]) - Date.parse(fechas[fechas.length - 1])) / 86400000) : 0;

  if (!usuario) {
    return <p className="tarjeta p-4 text-xs text-suave">Necesitas iniciar sesión para evaluarte.</p>;
  }

  if (resultado) return <Correccion r={resultado} volver={() => { setResultado(null); setVista("inicio"); }} />;

  if (cargando) {
    return (
      <div className="tarjeta p-4">
        <p className="text-sm text-suave">Corrigiendo con la plantilla del tribunal…</p>
        <div className="mt-2 h-1 overflow-hidden rounded bg-tinta-3">
          <div className="h-full w-1/3 animate-pulse rounded bg-jade" />
        </div>
      </div>
    );
  }

  if (vista === "indice") {
    return <PruebaIndice numero={numero} volver={() => setVista("inicio")}
      evaluar={(t, o) => evaluar("indice", t, o)} />;
  }
  if (vista === "epigrafe") {
    return <PruebaEpigrafe numero={numero} volver={() => setVista("inicio")}
      evaluar={(t, o, m) => evaluar("epigrafe", t, o, m)} />;
  }
  if (vista === "test") {
    return <TestRapido numero={numero} volver={() => { setVista("inicio"); void cargar(); }} />;
  }

  return (
    <div className="space-y-3">
      <div className="tarjeta p-4">
        <p className="text-xs uppercase tracking-widest text-suave">Camino a dominado</p>
        <div className="mt-3 space-y-2">
          <Requisito hecho={indicesOk > 0} texto="Reconstruir el índice de memoria"
            detalle={indicesOk > 0 ? `superada ${indicesOk} ${indicesOk > 1 ? "veces" : "vez"}` : "pendiente"} />
          <Requisito hecho={escritosOk > 0} texto="Escribir un epígrafe con nota ≥ 7"
            detalle={escritosOk > 0 ? `superada ${escritosOk} ${escritosOk > 1 ? "veces" : "vez"}` : "pendiente"} />
          <Requisito hecho={separacion >= 7} texto="Dos pruebas separadas 7 días"
            detalle={separacion >= 7 ? `${separacion} días entre la primera y la última` : `llevas ${separacion} de 7`} />
        </div>
        <p className="mt-3 border-t border-borde pt-3 text-[11px] leading-relaxed text-suave">
          El dominio es una meseta, no un pico: por eso hacen falta dos recuerdos separados
          en el tiempo. Un tema dominado que pasa 60 días sin prueba vuelve a memorizado.
        </p>
      </div>

      <div className="space-y-1">
        <Accion titulo="Reconstruir el índice" nota="De memoria, en papel o a teclado. Es lo primero que escribes en el examen."
          onClick={() => setVista("indice")} />
        <Accion titulo="Escribir un epígrafe" nota="Cronometrado y corregido con la rúbrica oficial del tribunal."
          onClick={() => setVista("epigrafe")} />
        <Accion titulo="Test rápido" nota="Diez preguntas para comprobar. No cuenta para dominado."
          onClick={() => setVista("test")} />
      </div>

      {error && <p className="rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral">{error}</p>}

      {historial.length > 0 && (
        <div className="tarjeta p-3">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-suave">Intentos</p>
          <ul className="space-y-1">
            {historial.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${p.aprobada ? "bg-jade" : "bg-coral"}`} />
                <span className="w-20 text-suave">{NOMBRE_TIPO[p.tipo] ?? p.tipo}</span>
                <span className="flex-1 text-suave">
                  {new Date(p.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  {p.origen === "manuscrito" && " · a mano"}
                </span>
                <span className="tabular-nums">{p.nota != null ? p.nota.toFixed(1) : "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const NOMBRE_TIPO: Record<string, string> = {
  indice: "Índice", epigrafe: "Epígrafe", test: "Test", tema_completo: "Tema",
};

function Requisito({ hecho, texto, detalle }: { hecho: boolean; texto: string; detalle: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
        hecho ? "border-jade bg-jade text-tinta" : "border-borde text-suave"}`}>
        {hecho ? "✓" : ""}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-xs ${hecho ? "" : "text-suave"}`}>{texto}</span>
        <span className="block text-[10px] text-suave">{detalle}</span>
      </span>
    </div>
  );
}

function Accion({ titulo, nota, onClick }: { titulo: string; nota: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-tinta-3/60">
      <span className="text-sm">{titulo}</span>
      <span className="block text-[11px] text-suave">{nota}</span>
    </button>
  );
}

// ---------------------------------------------------------------- índice
function PruebaIndice({ numero, volver, evaluar }: {
  numero: number; volver: () => void; evaluar: (texto: string, origen: string) => void;
}) {
  const [modo, setModo] = useState<"teclado" | "foto">("teclado");
  const [texto, setTexto] = useState("");
  return (
    <div className="space-y-3">
      <button onClick={volver} className="text-xs text-suave hover:text-texto">← Evaluación</button>
      <div className="tarjeta p-4">
        <p className="text-sm">Reconstruye el índice</p>
        <p className="mt-1 text-xs text-suave">
          Sin mirar el tema. Escribe los apartados en el orden en que van, como los pondrías
          en el folio. No hace falta que las palabras sean idénticas.
        </p>
        <div className="mt-3 flex gap-1">
          <Pestaña activa={modo === "teclado"} onClick={() => setModo("teclado")}>A teclado</Pestaña>
          <Pestaña activa={modo === "foto"} onClick={() => setModo("foto")}>Foto del papel</Pestaña>
        </div>
      </div>
      {modo === "teclado" ? (
        <div className="space-y-2">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={10}
            placeholder={"1. Introducción\n2. …"}
            className="w-full rounded-lg border border-borde bg-tinta-2 px-3 py-2 text-sm" />
          <button onClick={() => evaluar(texto, "teclado")} disabled={texto.trim().length < 20}
            className="rounded-lg bg-jade px-4 py-2 text-sm font-medium text-tinta disabled:opacity-40">
            Corregir
          </button>
        </div>
      ) : (
        <SubirManuscrito temaNumero={numero} cancelar={() => setModo("teclado")}
          alConfirmar={(t) => evaluar(t, "manuscrito")} />
      )}
    </div>
  );
}

// -------------------------------------------------------------- epígrafe
function PruebaEpigrafe({ numero, volver, evaluar }: {
  numero: number; volver: () => void; evaluar: (texto: string, origen: string, minutos: number) => void;
}) {
  const [modo, setModo] = useState<"teclado" | "foto">("foto");
  const [texto, setTexto] = useState("");
  const [seg, setSeg] = useState(0);
  const [corriendo, setCorriendo] = useState(false);

  useEffect(() => {
    if (!corriendo) return;
    const t = setInterval(() => setSeg((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [corriendo]);

  const mm = String(Math.floor(seg / 60)).padStart(2, "0");
  const ss = String(seg % 60).padStart(2, "0");

  return (
    <div className="space-y-3">
      <button onClick={volver} className="text-xs text-suave hover:text-texto">← Evaluación</button>
      <div className="tarjeta p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm">Escribe un epígrafe</p>
            <p className="mt-1 text-xs text-suave">
              Elige un apartado del tema y desarróllalo como en el examen. A mano, si puedes:
              es lo que vas a hacer en junio.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="serif text-2xl tabular-nums text-jade">{mm}:{ss}</p>
            <button onClick={() => setCorriendo((c) => !c)}
              className="mt-1 rounded border border-borde px-2 py-0.5 text-[10px] text-suave hover:text-texto">
              {corriendo ? "Pausar" : seg ? "Seguir" : "Empezar"}
            </button>
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          <Pestaña activa={modo === "foto"} onClick={() => setModo("foto")}>Foto del papel</Pestaña>
          <Pestaña activa={modo === "teclado"} onClick={() => setModo("teclado")}>A teclado</Pestaña>
        </div>
      </div>
      {modo === "teclado" ? (
        <div className="space-y-2">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={16}
            placeholder="## 3. El apartado que estés desarrollando…"
            className="w-full rounded-lg border border-borde bg-tinta-2 px-3 py-2 text-sm" />
          <div className="flex items-center gap-2">
            <button onClick={() => { setCorriendo(false); evaluar(texto, "teclado", Math.round(seg / 60)); }}
              disabled={texto.trim().length < 200}
              className="rounded-lg bg-jade px-4 py-2 text-sm font-medium text-tinta disabled:opacity-40">
              Corregir con la rúbrica
            </button>
            <span className="text-[11px] tabular-nums text-suave">
              {texto.split(/\s+/).filter(Boolean).length} palabras
            </span>
          </div>
        </div>
      ) : (
        <SubirManuscrito temaNumero={numero} cancelar={() => setModo("teclado")}
          alConfirmar={(t) => { setCorriendo(false); evaluar(t, "manuscrito", Math.round(seg / 60)); }} />
      )}
    </div>
  );
}

function Pestaña({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded px-3 py-1 text-[11px] transition ${
        activa ? "bg-jade text-tinta" : "border border-borde text-suave hover:text-texto"}`}>
      {children}
    </button>
  );
}

// ------------------------------------------------------------ corrección
function Correccion({ r, volver }: { r: Resultado; volver: () => void }) {
  const d = r.detalle as {
    bloques?: { id: string; nombre: string; max: number; obtenido: number; comentario: string }[];
    aciertos?: string[]; olvidos?: string[]; sobrantes?: string[]; comentario?: string;
    fuerte?: string[]; flojo?: string[]; siguiente_paso?: string; orden_correcto?: boolean;
  };
  return (
    <div className="space-y-3">
      <button onClick={volver} className="text-xs text-suave hover:text-texto">← Evaluación</button>

      <div className="tarjeta p-5 text-center">
        <p className="serif text-5xl tabular-nums" style={{ color: r.aprobada ? "#2fbf94" : "#e0705a" }}>
          {r.nota.toFixed(1)}
        </p>
        <p className="mt-1 text-xs text-suave">sobre 10 · se aprueba con {r.umbral}</p>
        {r.aprobada
          ? <p className="mt-2 text-sm text-jade">Prueba superada{r.estado ? ` · ahora estás en «${r.estado}»` : ""}</p>
          : <p className="mt-2 text-sm text-coral">No llega al umbral. Repasa y vuelve a intentarlo.</p>}
      </div>

      {d.bloques && (
        <div className="tarjeta p-4">
          <p className="mb-3 text-[10px] uppercase tracking-widest text-suave">Desglose de la rúbrica</p>
          <div className="space-y-3">
            {d.bloques.map((b) => (
              <div key={b.id}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span>{b.nombre}</span>
                  <span className="tabular-nums text-suave">{b.obtenido} / {b.max}</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded bg-tinta-3">
                  <div className="h-full rounded bg-jade"
                    style={{ width: `${Math.min(100, (b.obtenido / b.max) * 100)}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-suave">{b.comentario}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.comentario && <p className="tarjeta p-4 text-sm">{d.comentario}</p>}

      <Lista titulo="Bien" items={d.fuerte ?? d.aciertos} color="#2fbf94" />
      <Lista titulo="Te ha restado" items={d.flojo} color="#e0705a" />
      <Lista titulo="Se te olvidó" items={d.olvidos} color="#d9a441" />
      <Lista titulo="Sobraba" items={d.sobrantes} color="#d9a441" />

      {d.siguiente_paso && (
        <p className="rounded-lg border border-jade/30 bg-jade/5 px-4 py-3 text-sm">
          <span className="text-[10px] uppercase tracking-widest text-jade">Siguiente paso</span>
          <span className="mt-1 block">{d.siguiente_paso}</span>
        </p>
      )}
    </div>
  );
}

function Lista({ titulo, items, color }: { titulo: string; items?: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <div className="tarjeta p-4">
      <p className="mb-2 text-[10px] uppercase tracking-widest" style={{ color }}>{titulo}</p>
      <ul className="space-y-1">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-xs">
            <span style={{ color }}>·</span><span className="flex-1">{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
