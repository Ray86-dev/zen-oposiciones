"use client";
import { useVoz } from "@/components/ProveedorVoz";

/**
 * Volumen del reproductor. Con el motor neuronal el cambio es inmediato —se
 * aplica sobre el elemento de audio que ya está sonando—; con la voz del
 * sistema entra en la frase siguiente, porque la API del navegador no permite
 * modificar una locución ya lanzada.
 */
export default function Volumen({ compacto = false }: { compacto?: boolean }) {
  const { prefs, cambiar, alternarSilencio } = useVoz();
  const v = prefs.volumen;
  const mudo = v === 0;
  const pct = Math.round(v * 100);

  return (
    <div className="flex items-center gap-1.5" title={mudo ? "Silenciado" : `Volumen ${pct} %`}>
      <button
        onClick={alternarSilencio}
        title={mudo ? "Quitar el silencio" : "Silenciar"}
        aria-label={mudo ? "Quitar el silencio" : "Silenciar"}
        className="shrink-0 rounded-lg border border-borde px-1.5 py-1 text-suave transition hover:text-texto"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M7.3 1.8 4 4.6H1.6a.6.6 0 0 0-.6.6v5.6c0 .3.3.6.6.6H4l3.3 2.8a.6.6 0 0 0 1-.5V2.3a.6.6 0 0 0-1-.5Z" />
          {mudo ? (
            <path d="M15.2 6.1a.7.7 0 0 0-1-1L12.6 6.7 11 5.1a.7.7 0 0 0-1 1l1.6 1.6L10 9.3a.7.7 0 0 0 1 1l1.6-1.6 1.6 1.6a.7.7 0 0 0 1-1l-1.6-1.6 1.6-1.6Z" />
          ) : (
            <>
              <path d="M10.9 5.2a.7.7 0 0 0-.9 1 2.4 2.4 0 0 1 0 3.6.7.7 0 0 0 .9 1 3.8 3.8 0 0 0 0-5.6Z" />
              {v > 0.5 && (
                <path d="M12.8 3a.7.7 0 0 0-.9 1 5.3 5.3 0 0 1 0 8 .7.7 0 0 0 .9 1 6.7 6.7 0 0 0 0-10Z" />
              )}
            </>
          )}
        </svg>
      </button>

      <input
        type="range" min={0} max={1} step={0.05} value={v}
        onChange={(e) => cambiar({ volumen: Number(e.target.value) })}
        aria-label="Volumen"
        className={`zen-vol h-1 cursor-pointer rounded-full bg-tinta-3 ${
          compacto ? "w-14" : "w-24"
        }`}
        style={{
          // El relleno hasta el pulgar: sin esto la barra se ve igual al 10 % que al 90 %.
          background: `linear-gradient(to right, var(--jade) ${pct}%, var(--fondo-3) ${pct}%)`,
        }}
      />

      {!compacto && (
        <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-suave">{pct} %</span>
      )}
    </div>
  );
}
