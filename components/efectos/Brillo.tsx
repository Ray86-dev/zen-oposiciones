"use client";
import { useEffect } from "react";
import { useEfectos } from "@/components/Efectos";

/**
 * Un reflejo tenue que sigue al puntero por encima de la tarjeta que tiene
 * debajo. No hay un componente por tarjeta: un único oyente delegado escribe
 * dos variables CSS en la tarjeta señalada, y el resto lo hace un ::before.
 * Así el efecto llega a las 200 tarjetas de la app sin montar 200 listeners.
 */
export default function Brillo() {
  const { activo } = useEfectos();

  useEffect(() => {
    if (!activo) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    let anterior: HTMLElement | null = null;
    let pendiente = false;
    let ex = 0, ey = 0, destino: HTMLElement | null = null;

    const aplicar = () => {
      pendiente = false;
      if (anterior && anterior !== destino) anterior.removeAttribute("data-brillo");
      if (!destino) { anterior = null; return; }
      const r = destino.getBoundingClientRect();
      destino.style.setProperty("--bx", `${ex - r.left}px`);
      destino.style.setProperty("--by", `${ey - r.top}px`);
      destino.setAttribute("data-brillo", "si");
      anterior = destino;
    };

    const mover = (ev: PointerEvent) => {
      const t = ev.target as HTMLElement | null;
      destino = t?.closest?.(".tarjeta") as HTMLElement | null;
      ex = ev.clientX; ey = ev.clientY;
      if (!pendiente) { pendiente = true; requestAnimationFrame(aplicar); }
    };

    const salir = () => { destino = null; if (!pendiente) { pendiente = true; requestAnimationFrame(aplicar); } };

    window.addEventListener("pointermove", mover, { passive: true });
    window.addEventListener("pointerleave", salir, { passive: true });
    return () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerleave", salir);
      anterior?.removeAttribute("data-brillo");
    };
  }, [activo]);

  return null;
}
