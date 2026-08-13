"use client";
import { textoPlano } from "./marcas";

/** Trocea el tema en unidades pronunciables: una frase o un encabezado. */
export function trocearParaVoz(bloques: string[]): { bloque: number; texto: string }[] {
  const trozos: { bloque: number; texto: string }[] = [];
  bloques.forEach((b, i) => {
    const plano = textoPlano(b).replace(/\s+/g, " ").trim();
    if (!plano) return;
    const esEncabezado = /^<h[1-5]/i.test(b);
    if (esEncabezado) { trozos.push({ bloque: i, texto: plano }); return; }
    // Corta por punto, interrogación o exclamación seguidos de mayúscula.
    const frases = plano.split(/(?<=[.!?…])\s+(?=[«"A-ZÁÉÍÓÚÑ¿¡])/);
    for (const f of frases) {
      const t = f.trim();
      if (t.length < 2) continue;
      // Las frases larguísimas se parten para poder pausar con precisión.
      if (t.length > 320) {
        for (const sub of t.split(/(?<=[;:])\s+/)) {
          if (sub.trim()) trozos.push({ bloque: i, texto: sub.trim() });
        }
      } else trozos.push({ bloque: i, texto: t });
    }
  });
  return trozos;
}

/** Prepara el texto para que la síntesis no lea cosas raras. */
export function limpiarParaVoz(t: string): string {
  return t
    .replace(/\(([^)]{1,40})\)/g, ", $1,")     // paréntesis cortos como inciso
    .replace(/[«»"“”]/g, "")
    .replace(/\s*[-–—]\s*/g, ", ")
    .replace(/\.{3,}/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

export interface PrefsVoz {
  motor: "sistema" | "neuronal";
  vozURI: string | null;      // voz del sistema
  vozNeuronal: string;        // modelo Piper descargado
  velocidad: number;
  tono: number;
  /** 0 a 1. Se aplica en caliente, sin cortar la frase que esté sonando. */
  volumen: number;
}
export const VOZ_POR_DEFECTO: PrefsVoz = {
  motor: "sistema", vozURI: null,
  vozNeuronal: "es_ES-sharvard-medium", velocidad: 1, tono: 1, volumen: 1,
};
const CLAVE = "zen-voz";

export function cargarPrefsVoz(): PrefsVoz {
  if (typeof window === "undefined") return VOZ_POR_DEFECTO;
  try {
    const raw = window.localStorage.getItem(CLAVE);
    if (!raw) return VOZ_POR_DEFECTO;
    const p = { ...VOZ_POR_DEFECTO, ...JSON.parse(raw) } as PrefsVoz;
    // Un volumen fuera de rango hace que el <audio> lance y se corte la lectura.
    p.volumen = Number.isFinite(p.volumen) ? Math.min(1, Math.max(0, p.volumen)) : 1;
    return p;
  } catch { return VOZ_POR_DEFECTO; }
}
export function guardarPrefsVoz(p: PrefsVoz) {
  try { window.localStorage.setItem(CLAVE, JSON.stringify(p)); } catch { /* cuota */ }
}
