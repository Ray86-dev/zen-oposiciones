"use client";
import { useEffect, useState } from "react";
import { useEfectos } from "@/components/Efectos";

/**
 * El anillo de progreso, con la gota en la punta.
 *
 * El arco y la gota van dentro del mismo filtro gooey: cuando la gota alcanza
 * el final del trazo, las dos formas se funden y el remate deja de parecer un
 * "stroke-linecap" para parecer líquido acumulándose. Debajo, un halo del mismo
 * color desenfocado da el brillo.
 */
export default function Anillo({
  valor, tamano = 120, grosor = 9, color = "#2fbf94", etiqueta, sub,
}: {
  valor: number; tamano?: number; grosor?: number; color?: string;
  etiqueta: string; sub?: string;
}) {
  const { activo } = useEfectos();
  const r = (tamano - grosor) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, valor));

  // Arranca en cero y se llena al entrar: el progreso se lee mejor en
  // movimiento que como una cifra que ya estaba ahí.
  const [dibujado, setDibujado] = useState(0);
  useEffect(() => {
    if (!activo) { setDibujado(v); return; }
    const t = requestAnimationFrame(() => setDibujado(v));
    return () => cancelAnimationFrame(t);
  }, [v, activo]);

  const mostrado = activo ? dibujado : v;
  // Con dasharray 0 y linecap redondo, SVG dibuja igualmente un punto suelto:
  // al 0 % se veía una mota flotando (y su halo) en lo alto del anillo.
  const vacio = mostrado <= 0.0005;
  const ang = mostrado * 360;
  const cx = tamano / 2;
  const gota = grosor * 0.72;

  return (
    <div className="flex flex-col items-center">
      {/* overflow visible: si no, el lienzo del svg recorta el halo y deja
          un rectángulo a la vista alrededor del anillo. */}
      <svg width={tamano} height={tamano} className="-rotate-90" style={{ overflow: "visible" }} aria-hidden>
        {activo && (
          <circle
            className="zen-anillo-halo"
            cx={cx} cy={cx} r={r}
            fill="none" stroke={color} strokeWidth={grosor}
            strokeDasharray={`${c * mostrado} ${c}`}
            strokeOpacity={vacio ? 0 : 1}
            filter="url(#zen-halo)"
          />
        )}

        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--borde)" strokeWidth={grosor} />

        <g filter={activo ? "url(#zen-goo-fino)" : undefined}>
          <circle
            className="zen-anillo-arco"
            cx={cx} cy={cx} r={r}
            fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round"
            strokeDasharray={`${c * mostrado} ${c}`}
            strokeOpacity={vacio ? 0 : 1}
          />
          {activo && mostrado > 0.012 && (
            <g
              className="zen-anillo-gota"
              style={{ transform: `rotate(${ang}deg)`, transformOrigin: `${cx}px ${cx}px` }}
            >
              <circle cx={cx + r} cy={cx} r={gota} fill={color} />
            </g>
          )}
        </g>
      </svg>

      <div className="-mt-[calc(50%+14px)] mb-[calc(50%-14px)] text-center">
        <div className="text-xl font-semibold tabular-nums">{etiqueta}</div>
        {sub && <div className="text-[11px] text-suave">{sub}</div>}
      </div>
    </div>
  );
}
