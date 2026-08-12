"use client";

/**
 * Voz neuronal en el navegador con Piper (modelos VITS de rhasspy/piper, MIT)
 * sobre ONNX Runtime. Sin clave, sin servidor y sin cuota: el modelo se descarga
 * una vez, se guarda en OPFS y a partir de ahí funciona sin conexión.
 *
 * Se descartó kokoro-js: solo registra 28 voces, todas inglesas, y su fonemizador
 * únicamente acepta inglés americano o británico.
 *
 * La descarga y el inventario los sigue haciendo @diffusionstudio/vits-web, pero
 * la síntesis NO usa su `predict()`: esa función crea una sesión ONNX nueva por
 * cada frase y no la libera, así que el heap de WebAssembly crece unos 60 MB por
 * trozo y hacia el 44 revienta con «failed to allocate a buffer of size ...».
 * En su lugar hablamos con voz-worker.js, que mantiene una única sesión viva.
 */

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const VOCES_ES = [
  { id: "es_ES-sharvard-medium", nombre: "Sharvard", nota: "Femenina · España", mb: 73 },
  { id: "es_ES-davefx-medium",   nombre: "Dave",     nota: "Masculina · España", mb: 60 },
  { id: "es_ES-carlfm-x_low",    nombre: "Carl",     nota: "Masculina · España, ligera y rápida", mb: 27 },
  { id: "es_MX-ald-medium",      nombre: "Ald",      nota: "Masculina · México", mb: 60 },
] as const;

export type VozId = (typeof VOCES_ES)[number]["id"];

export interface EstadoVoz {
  fase: "apagado" | "descargando" | "listo" | "error";
  pct: number;
  mensaje: string;
}

/** Se lanza cuando se descarta una petición porque el usuario cambió de sitio. */
export class SintesisCancelada extends Error {
  constructor() { super("Síntesis cancelada."); this.name = "SintesisCancelada"; }
}

/* ------------------------------------------------------------------ */
/* Descarga e inventario (vits-web, importado del CDN en tiempo de uso) */
/* ------------------------------------------------------------------ */

/** Import desde CDN en tiempo de ejecución: evita empaquetar ONNX y WebAssembly. */
const CDN = "https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm";
let modulo: Promise<Record<string, (...a: never[]) => unknown>> | null = null;

function cargarModulo() {
  if (!modulo) {
    const importarDinamico = new Function("u", "return import(u)") as (u: string) => Promise<never>;
    modulo = importarDinamico(CDN);
  }
  return modulo;
}

export async function vocesDescargadas(): Promise<string[]> {
  try {
    const m = await cargarModulo();
    return (await (m.stored as () => Promise<string[]>)()) ?? [];
  } catch { return []; }
}

export async function descargarVoz(
  vozId: string, alProgreso: (pct: number) => void,
): Promise<void> {
  const m = await cargarModulo();
  await (m.download as (v: string, cb: (p: { loaded: number; total: number }) => void) => Promise<void>)(
    vozId,
    (p) => { if (p?.total) alProgreso(Math.round((p.loaded / p.total) * 100)); },
  );
}

/* ------------------------------------------------------------------ */
/* Síntesis: worker con sesión persistente                             */
/* ------------------------------------------------------------------ */

const ESPERA_MAXIMA = 120_000;   // ms por frase; si se pasa, algo va mal

type Pendiente = {
  ok: (b: Blob) => void;
  ko: (e: Error) => void;
  reloj: ReturnType<typeof setTimeout>;
};

let worker: Worker | null = null;
let workerInservible = false;
let siguienteId = 0;
const pendientes = new Map<number, Pendiente>();

function fallarTodas(e: Error) {
  for (const p of pendientes.values()) { clearTimeout(p.reloj); p.ko(e); }
  pendientes.clear();
}

function obtenerWorker(): Worker | null {
  if (workerInservible) return null;
  if (worker) return worker;
  try {
    const w = new Worker(`${BASE_PATH}/voz-worker.js`, { type: "module" });
    w.onmessage = (ev: MessageEvent) => {
      const m = ev.data as { tipo: string; id: number; wav?: ArrayBuffer; mensaje?: string };
      const p = pendientes.get(m.id);
      if (!p) return;
      pendientes.delete(m.id);
      clearTimeout(p.reloj);
      if (m.tipo === "ok" && m.wav) p.ok(new Blob([m.wav], { type: "audio/wav" }));
      else if (m.tipo === "cancelado") p.ko(new SintesisCancelada());
      else p.ko(new Error(m.mensaje || "No se pudo sintetizar la voz."));
    };
    // Si el worker no arranca (navegador sin módulos en workers, CDN caído...)
    // lo damos por perdido y seguimos con el camino antiguo.
    w.onerror = () => {
      workerInservible = true;
      worker = null;
      fallarTodas(new Error("El motor de voz no pudo arrancar."));
      try { w.terminate(); } catch { /* daba igual */ }
    };
    worker = w;
    return w;
  } catch {
    workerInservible = true;
    return null;
  }
}

/** Camino de respaldo: el `predict` de vits-web, en el hilo principal. */
async function sintetizarConVitsWeb(texto: string, vozId: string): Promise<Blob> {
  const m = await cargarModulo();
  return (m.predict as (c: { text: string; voiceId: string }) => Promise<Blob>)({
    text: texto, voiceId: vozId,
  });
}

export async function sintetizar(texto: string, vozId: string): Promise<Blob> {
  const w = obtenerWorker();
  if (!w) return sintetizarConVitsWeb(texto, vozId);

  const id = ++siguienteId;
  try {
    return await new Promise<Blob>((ok, ko) => {
      const reloj = setTimeout(() => {
        pendientes.delete(id);
        ko(new Error("La síntesis ha tardado demasiado."));
      }, ESPERA_MAXIMA);
      pendientes.set(id, { ok, ko, reloj });
      w.postMessage({ tipo: "sintetizar", id, texto, vozId });
    });
  } catch (e) {
    if (e instanceof SintesisCancelada) throw e;
    // Un fallo aislado no invalida el worker; solo si ya está marcado como roto
    // reintentamos por el camino antiguo para no dejar al usuario sin voz.
    if (workerInservible) return sintetizarConVitsWeb(texto, vozId);
    throw e;
  }
}

/** Descarta lo que quede en cola: el usuario ha saltado, parado o cambiado de voz. */
export function cancelarSintesis() {
  worker?.postMessage({ tipo: "cancelar" });
}

/** Suelta los ~60 MB de la sesión ONNX. Se vuelve a crear sola al reproducir. */
export function liberarMotorVoz() {
  worker?.postMessage({ tipo: "liberar" });
}

/** Cierra el worker del todo (al desmontar el proveedor). */
export function apagarMotorVoz() {
  if (!worker) return;
  fallarTodas(new SintesisCancelada());
  try { worker.terminate(); } catch { /* ya estaba cerrado */ }
  worker = null;
}
