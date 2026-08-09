"use client";
import { useVoz } from "@/components/ProveedorVoz";

/** Controles de reproducción. Se usan tanto en el panel como en la barra flotante. */
export default function Transporte({ compacto = false }: { compacto?: boolean }) {
  const { estado, neuronal, reproducir, pausar, reanudar, detener, saltar } = useVoz();
  const sonando = estado === "sonando";
  const tam = compacto ? "h-8 w-8" : "h-9 w-9";

  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => saltar(-1)} title="Frase anterior"
        className="rounded-lg border border-borde px-2 py-1.5 text-xs text-suave transition hover:text-texto">⏮</button>

      <button
        onClick={() => (sonando ? pausar() : estado === "pausado" ? reanudar() : reproducir())}
        disabled={neuronal.fase === "descargando"}
        title={sonando ? "Pausar" : estado === "pausado" ? "Continuar" : "Reproducir"}
        className={`flex ${tam} items-center justify-center rounded-full bg-jade text-tinta transition hover:opacity-90 disabled:opacity-50`}
      >
        {sonando
          ? <svg width="12" height="13" viewBox="0 0 12 13" fill="currentColor"><rect width="4" height="13" rx="1"/><rect x="8" width="4" height="13" rx="1"/></svg>
          : <svg width="12" height="13" viewBox="0 0 12 13" fill="currentColor" style={{ marginLeft: 2 }}><path d="M0 .8v11.4a.8.8 0 0 0 1.2.7l9.4-5.7a.8.8 0 0 0 0-1.4L1.2.1A.8.8 0 0 0 0 .8Z"/></svg>}
      </button>

      <button onClick={() => detener(true)} disabled={estado === "parado"} title="Detener"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-borde text-suave transition hover:text-texto disabled:opacity-30">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect width="10" height="10" rx="1.5"/></svg>
      </button>

      <button onClick={() => saltar(1)} title="Frase siguiente"
        className="rounded-lg border border-borde px-2 py-1.5 text-xs text-suave transition hover:text-texto">⏭</button>
    </div>
  );
}
