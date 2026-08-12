"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { useSesion } from "@/components/Sesion";
import { useEfectos } from "@/components/Efectos";

const ENLACES = [
  { href: "/", label: "Hoy" },
  { href: "/temario", label: "Temario" },
  { href: "/calendario", label: "Calendario" },
  { href: "/supuestos", label: "Supuestos" },
  { href: "/materiales", label: "Materiales" },
  { href: "/ajustes", label: "Ajustes" },
];

interface Caja { x: number; y: number; w: number; h: number }

/**
 * En producción hay basePath y trailingSlash, así que usePathname() devuelve
 * "/ajustes/" y no "/ajustes": comparar en crudo dejaba la navegación sin
 * ninguna sección marcada en todas las páginas menos la portada. Además, un
 * tema abierto (/temario/12/) tiene que iluminar «Temario».
 */
function esActiva(ruta: string, href: string) {
  const limpia = ruta !== "/" && ruta.endsWith("/") ? ruta.slice(0, -1) : ruta;
  if (href === "/") return limpia === "/" || limpia === "";
  return limpia === href || limpia.startsWith(href + "/");
}

export default function Navegacion() {
  const ruta = usePathname() ?? "/";
  const { usuario } = useSesion();
  const { activo } = useEfectos();
  const barra = useRef<HTMLElement | null>(null);
  const [caja, setCaja] = useState<Caja | null>(null);

  /**
   * El indicador no es un fondo: son dos gotas superpuestas bajo el filtro
   * gooey. La segunda llega tarde a propósito, así que al cambiar de sección
   * la mancha se estira entre las dos pestañas y vuelve a cuajar. Es el efecto
   * "liquid move" hecho con una medición y dos transiciones.
   */
  useLayoutEffect(() => {
    const medir = () => {
      const cont = barra.current;
      if (!cont) return;
      const activoEl = cont.querySelector<HTMLElement>("[data-activo='si']");
      if (!activoEl) { setCaja(null); return; }
      setCaja({
        x: activoEl.offsetLeft,
        y: activoEl.offsetTop,
        w: activoEl.offsetWidth,
        h: activoEl.offsetHeight,
      });
    };
    medir();
    // Al cargar la tipografía o girar el móvil cambian los anchos.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    if (barra.current && ro) ro.observe(barra.current);
    window.addEventListener("resize", medir);
    const t = setTimeout(medir, 260);
    return () => { ro?.disconnect(); window.removeEventListener("resize", medir); clearTimeout(t); };
  }, [ruta, usuario]);

  const estilo = caja
    ? ({
        "--x": `${caja.x}px`,
        "--y": `${caja.y}px`,
        "--w": `${caja.w}px`,
        "--h": `${caja.h}px`,
        "--o": 1,
      } as React.CSSProperties)
    : ({ "--o": 0 } as React.CSSProperties);

  const clase = (esActivo: boolean) =>
    `zen-enlace shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${
      esActivo ? `text-texto ${activo ? "" : "bg-tinta-3"}` : "text-suave hover:text-texto"
    }`;

  return (
    <header className="sticky top-0 z-20 border-b border-borde bg-tinta/85 backdrop-blur">
      <nav
        ref={barra}
        className="zen-nav mx-auto flex w-full max-w-5xl items-center gap-1 overflow-x-auto px-5 py-3"
      >
        {activo && (
          <span className="zen-nav-goo" aria-hidden>
            <span className="zen-burbuja zen-burbuja--estela" style={estilo} />
            <span className="zen-burbuja" style={estilo} />
          </span>
        )}

        <span className="serif mr-3 shrink-0 text-lg tracking-wide text-jade">Zen</span>

        {ENLACES.map((e) => {
          const esActivo = esActiva(ruta, e.href);
          return (
            <Link
              key={e.href}
              href={e.href}
              data-activo={esActivo ? "si" : undefined}
              aria-current={esActivo ? "page" : undefined}
              className={clase(esActivo)}
            >
              {e.label}
            </Link>
          );
        })}

        <Link
          href="/entrar"
          data-activo={esActiva(ruta, "/entrar") ? "si" : undefined}
          aria-current={esActiva(ruta, "/entrar") ? "page" : undefined}
          className={`ml-auto ${clase(esActiva(ruta, "/entrar"))}`}
          title={usuario?.email ?? "Sin sesión"}
        >
          {usuario ? "Mi cuenta" : "Entrar"}
        </Link>
      </nav>
    </header>
  );
}
