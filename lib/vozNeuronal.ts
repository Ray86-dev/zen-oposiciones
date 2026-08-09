"use client";

/**
 * Voz neuronal en el navegador con Piper (modelos VITS de rhasspy/piper, MIT)
 * sobre ONNX Runtime. Sin clave, sin servidor y sin cuota: el modelo se descarga
 * una vez, se guarda en OPFS y a partir de ahí funciona sin conexión.
 *
 * Se descartó kokoro-js: solo registra 28 voces, todas inglesas, y su fonemizador
 * únicamente acepta inglés americano o británico.
 */

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

export async function sintetizar(texto: string, vozId: string): Promise<Blob> {
  const m = await cargarModulo();
  return (m.predict as (c: { text: string; voiceId: string }) => Promise<Blob>)({
    text: texto, voiceId: vozId,
  });
}

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
