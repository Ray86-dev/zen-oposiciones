"use client";
import { useVoz } from "@/components/ProveedorVoz";
import Transporte from "@/components/Transporte";

/**
 * Barra flotante que aparece en cuanto algo suena, en cualquier página.
 * Garantiza que siempre haya un botón de pausa a mano, aunque el panel de
 * lectura esté cerrado o hayas navegado a otra sección.
 */
export default function MiniVoz() {
  const { fuente, estado, indice } = useVoz();
  if (!fuente || estado === "parado") return null;

  const total = fuente.trozos.length;
  const pct = total ? ((indice + 1) / total) * 100 : 0;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[min(94vw,430px)] -translate-x-1/2 overflow-hidden rounded-xl border border-borde bg-tinta-2/95 shadow-2xl backdrop-blur">
      <div className="zen-barra h-0.5 bg-tinta-3">
        <span className="bg-jade transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-3 px-3 py-2">
        <Transporte compacto />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px]">Tema {fuente.tema}. {fuente.titulo}</p>
          <p className="text-[10px] tabular-nums text-suave">
            {indice + 1} de {total}{estado === "pausado" && " · en pausa"}
          </p>
        </div>
      </div>
    </div>
  );
}
