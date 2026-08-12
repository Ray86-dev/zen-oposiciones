"use client";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode,
} from "react";

/**
 * Capa de efectos de Zen.
 *
 * Tres niveles, porque una app de estudio no puede imponer su propia
 * escenografía: "pleno" para enseñarla, "sutil" para el día a día y "ninguno"
 * para quien lea seis horas seguidas o venga de un portátil con la batería
 * justa. Si el sistema pide menos movimiento y el usuario no ha elegido nada,
 * se respeta el sistema.
 */
export type NivelEfecto = "pleno" | "sutil" | "ninguno";

const CLAVE = "zen-efectos";

interface Ctx {
  nivel: NivelEfecto;
  fijar: (n: NivelEfecto) => void;
  /** true en "pleno" y "sutil": hay algo que dibujar. */
  activo: boolean;
  /** true solo en "pleno": efectos que cuestan GPU o roban atención. */
  pleno: boolean;
  /** Estallido de partículas en un punto de la pantalla. */
  celebrar: (x: number, y: number, color?: string) => void;
}

const C = createContext<Ctx | null>(null);

export function ProveedorEfectos({ children }: { children: ReactNode }) {
  const [nivel, setNivel] = useState<NivelEfecto>("sutil");
  const [montado, setMontado] = useState(false);
  const lienzo = useRef<HTMLCanvasElement | null>(null);
  const particulas = useRef<Particula[]>([]);
  const bucle = useRef<number | null>(null);

  useEffect(() => {
    let inicial: NivelEfecto = "sutil";
    try {
      const g = window.localStorage.getItem(CLAVE) as NivelEfecto | null;
      if (g === "pleno" || g === "sutil" || g === "ninguno") inicial = g;
      else if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) inicial = "ninguno";
    } catch { /* almacenamiento bloqueado */ }
    setNivel(inicial);
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!montado) return;
    document.documentElement.setAttribute("data-fx", nivel);
    try { window.localStorage.setItem(CLAVE, nivel); } catch { /* cuota */ }
  }, [nivel, montado]);

  // --------------------------- Chispas de logro ---------------------------
  const pintar = useCallback(() => {
    const cv = lienzo.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) { bucle.current = null; return; }

    ctx.clearRect(0, 0, cv.width, cv.height);
    const vivas: Particula[] = [];
    for (const p of particulas.current) {
      p.vida -= 0.016;
      if (p.vida <= 0) continue;
      p.vx *= 0.97;
      p.vy = p.vy * 0.97 + 12;
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.vida / p.total)) * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      vivas.push(p);
    }
    ctx.globalAlpha = 1;
    particulas.current = vivas;

    if (vivas.length) bucle.current = requestAnimationFrame(pintar);
    else { bucle.current = null; ctx.clearRect(0, 0, cv.width, cv.height); }
  }, []);

  const celebrar = useCallback((x: number, y: number, color = "#2fbf94") => {
    if (nivel === "ninguno") return;
    const cv = lienzo.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(window.innerWidth * dpr)) {
      cv.width = Math.round(window.innerWidth * dpr);
      cv.height = Math.round(window.innerHeight * dpr);
      const ctx = cv.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const n = nivel === "pleno" ? 34 : 18;
    const tonos = [color, "#d9a441", "#e7ecea"];
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const v = 90 + Math.random() * 150;
      const total = 0.55 + Math.random() * 0.5;
      particulas.current.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 60,
        r: 1.4 + Math.random() * 2.2,
        color: tonos[i % tonos.length],
        vida: total, total,
      });
    }
    if (bucle.current === null) bucle.current = requestAnimationFrame(pintar);
  }, [nivel, pintar]);

  useEffect(() => () => { if (bucle.current !== null) cancelAnimationFrame(bucle.current); }, []);

  const valor = useMemo<Ctx>(() => ({
    nivel,
    fijar: setNivel,
    activo: montado && nivel !== "ninguno",
    pleno: montado && nivel === "pleno",
    celebrar,
  }), [nivel, montado, celebrar]);

  return (
    <C.Provider value={valor}>
      {children}
      <canvas ref={lienzo} className="zen-chispas" aria-hidden />
    </C.Provider>
  );
}

interface Particula {
  x: number; y: number; vx: number; vy: number;
  r: number; color: string; vida: number; total: number;
}

export function useEfectos() {
  const c = useContext(C);
  if (!c) throw new Error("useEfectos fuera del ProveedorEfectos");
  return c;
}

/** Celebra centrado en el elemento que se le pase (o en el evento). */
export function centroDe(el: Element | null) {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
