"use client";
import { useEffect, useState } from "react";
import { MaterialTema } from "./tipos";

/** Prefijo de ruta cuando la app vive en un subdirectorio (GitHub Pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Los enlaces a Google Drive no viven en el repositorio: son privados.
 * Se cargan en tiempo de ejecución desde `public/enlaces.local.json`, que está
 * en .gitignore. Si el archivo no existe (sitio público), la app funciona igual
 * pero sin los botones de «Abrir en Drive».
 */
export function useEnlaces(): Record<string, MaterialTema[]> {
  const [enlaces, setEnlaces] = useState<Record<string, MaterialTema[]>>({});
  useEffect(() => {
    let vivo = true;
    fetch(`${BASE_PATH}/enlaces.local.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (vivo && j?.enlaces) setEnlaces(j.enlaces); })
      .catch(() => { /* sin enlaces: comportamiento esperado en público */ });
    return () => { vivo = false; };
  }, []);
  return enlaces;
}
