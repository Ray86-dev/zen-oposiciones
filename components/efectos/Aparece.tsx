"use client";
import { useEffect, useRef, useState, ReactNode } from "react";

/**
 * Revelado al entrar en pantalla: opacidad, un dedo de desplazamiento y un
 * desenfoque que se disipa. Es el ritmo común de toda la app — el mismo gesto
 * en el panel, en el temario y en el calendario — para que los efectos parezcan
 * un sistema y no una colección de trucos.
 *
 * El estado oculto vive en CSS bajo [data-fx], que solo existe cuando el
 * proveedor ha montado: sin JavaScript el contenido se ve igual.
 */
export default function Aparece({
  children, retardo = 0, className = "", as: Etiqueta = "div",
}: {
  children: ReactNode;
  /** Milisegundos de espera, para escalonar listas. */
  retardo?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.04 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Etiqueta
      // @ts-expect-error la etiqueta es dinámica pero siempre es un elemento HTML
      ref={ref}
      className={`zen-aparece ${visible ? "es-visible" : ""} ${className}`}
      style={retardo ? { transitionDelay: `${retardo}ms` } : undefined}
    >
      {children}
    </Etiqueta>
  );
}
