"use client";
import { useEffect, useState, useCallback } from "react";

export interface PrefsLectura {
  tamano: number;        // px
  interlineado: number;  // multiplicador
  tipografia: "serif" | "sans" | "amplia";
  papel: "sepia" | "crema" | "gris" | "noche" | "negro";
  ancho: "normal" | "ancho";
}

export const POR_DEFECTO: PrefsLectura = {
  tamano: 17, interlineado: 1.75, tipografia: "serif", papel: "crema", ancho: "normal",
};

export const TIPOGRAFIAS = [
  { id: "serif", nombre: "Serif", css: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
    nota: "La de siempre para leer en papel" },
  { id: "sans", nombre: "Sans", css: '"Segoe UI", system-ui, -apple-system, sans-serif',
    nota: "Más limpia en pantalla" },
  { id: "amplia", nombre: "Amplia", css: 'Verdana, Tahoma, "DejaVu Sans", sans-serif',
    nota: "Letras separadas, recomendada con dislexia" },
] as const;

/** Cada papel define su propio fondo y color de texto, como en un lector de libros. */
export const PAPELES = [
  { id: "crema",  nombre: "Crema",  fondo: "#f6f2e8", texto: "#26251f", marca: "#efe9da", oscuro: false },
  { id: "sepia",  nombre: "Sepia",  fondo: "#efe0c8", texto: "#3a2f1f", marca: "#e6d3b3", oscuro: false },
  { id: "gris",   nombre: "Gris",   fondo: "#d9d9d6", texto: "#22221f", marca: "#cbcbc7", oscuro: false },
  { id: "noche",  nombre: "Noche",  fondo: "#15191b", texto: "#dfe5e2", marca: "#1f2528", oscuro: true },
  { id: "negro",  nombre: "Negro",  fondo: "#000000", texto: "#c9d1ce", marca: "#141414", oscuro: true },
] as const;

const CLAVE = "zen-lectura";

export function useLectura() {
  const [prefs, setPrefs] = useState<PrefsLectura>(POR_DEFECTO);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CLAVE);
      if (raw) setPrefs({ ...POR_DEFECTO, ...JSON.parse(raw) });
    } catch { /* preferencias por defecto */ }
    setListo(true);
  }, []);

  const cambiar = useCallback((p: Partial<PrefsLectura>) => {
    setPrefs((v) => {
      const n = { ...v, ...p };
      try { window.localStorage.setItem(CLAVE, JSON.stringify(n)); } catch { /* cuota llena */ }
      return n;
    });
  }, []);

  return { prefs, cambiar, listo };
}

export function papelDe(id: PrefsLectura["papel"]) {
  return PAPELES.find((p) => p.id === id) ?? PAPELES[0];
}
export function fuenteDe(id: PrefsLectura["tipografia"]) {
  return TIPOGRAFIAS.find((t) => t.id === id)?.css ?? TIPOGRAFIAS[0].css;
}

/** Variables CSS que aplica el contenedor de lectura. */
export function estiloLectura(p: PrefsLectura): React.CSSProperties {
  const papel = papelDe(p.papel);
  return {
    background: papel.fondo,
    color: papel.texto,
    fontFamily: fuenteDe(p.tipografia),
    fontSize: `${p.tamano}px`,
    lineHeight: p.interlineado,
    ["--marca-fondo" as string]: papel.marca,
    ["--papel-texto" as string]: papel.texto,
  };
}
