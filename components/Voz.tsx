"use client";
import { useState } from "react";
import { useVoz } from "@/components/ProveedorVoz";
import { VOCES_ES } from "@/lib/vozNeuronal";
import Transporte from "@/components/Transporte";
import Volumen from "@/components/Volumen";

/** Panel de lectura en voz alta. Es solo interfaz: la reproducción vive en el proveedor. */
export default function Voz({ cerrar }: { cerrar: () => void }) {
  const {
    fuente, estado, indice, prefs, neuronal, descargadas, vocesSistema,
    detener, cambiar, bajarVoz,
  } = useVoz();
  const [ajustes, setAjustes] = useState(false);

  if (!fuente) return null;

  const total = fuente.trozos.length;
  const avance = total ? ((indice + 1) / total) * 100 : 0;
  const restante = Math.round(
    fuente.trozos.slice(indice).reduce((a, t) => a + t.texto.length, 0) / (14 * prefs.velocidad) / 60,
  );
  const usandoNeuronal = prefs.motor === "neuronal";
  const vozActual = VOCES_ES.find((v) => v.id === prefs.vozNeuronal);

  return (
    <div className="tarjeta p-3">
      <div className="mb-2 h-0.5 overflow-hidden rounded bg-tinta-3">
        <div className="h-full bg-jade transition-[width]" style={{ width: `${avance}%` }} />
      </div>

      <div className="flex items-center gap-2">
        <Transporte />
        <span className="ml-1 text-[11px] tabular-nums text-suave">
          {indice + 1}/{total}
          {estado !== "parado" && restante > 0 && ` · ~${restante} min`}
          {estado === "pausado" && " · en pausa"}
        </span>
        <div className="ml-auto hidden sm:flex"><Volumen /></div>
        <button onClick={() => setAjustes((a) => !a)}
          className="ml-auto rounded-lg border border-borde px-2 py-1.5 text-[11px] text-suave hover:text-texto sm:ml-0">
          {usandoNeuronal ? (vozActual?.nombre ?? "Neuronal") : "Sistema"} · {prefs.velocidad}×
        </button>
        <button onClick={() => { detener(); cerrar(); }} title="Cerrar el reproductor"
          className="rounded-lg border border-borde px-2 py-1.5 text-[11px] text-suave hover:text-texto">✕</button>
      </div>

      {neuronal.fase === "descargando" && (
        <div className="mt-2">
          <div className="h-1 overflow-hidden rounded bg-tinta-3">
            <div className="h-full bg-jade transition-[width]" style={{ width: `${neuronal.pct}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-suave">Descargando la voz una sola vez · {neuronal.pct}%</p>
        </div>
      )}
      {neuronal.fase === "error" && (
        <p className="mt-2 rounded border border-coral/40 bg-coral/10 px-2 py-1.5 text-[11px] text-coral">
          {neuronal.mensaje}
        </p>
      )}

      {ajustes && (
        <div className="mt-3 space-y-3 border-t border-borde pt-3">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-suave">Voz</p>
            <div className="space-y-1">
              <Opcion activa={!usandoNeuronal} onClick={() => cambiar({ motor: "sistema" })}
                titulo="Voz del sistema" nota="Instantánea. Es la voz de Windows." derecha="sin descarga" />
              {VOCES_ES.map((v) => {
                const yaEsta = descargadas.includes(v.id);
                return (
                  <Opcion key={v.id}
                    activa={usandoNeuronal && prefs.vozNeuronal === v.id}
                    onClick={() => (yaEsta ? cambiar({ motor: "neuronal", vozNeuronal: v.id }) : bajarVoz(v.id))}
                    desactivada={neuronal.fase === "descargando"}
                    titulo={v.nombre} nota={v.nota}
                    derecha={yaEsta ? "descargada" : `${v.mb} MB`} />
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-suave">Velocidad</p>
            <div className="flex gap-1">
              {[0.8, 1, 1.2, 1.5, 1.8].map((v) => (
                <button key={v} onClick={() => cambiar({ velocidad: v })}
                  className={`flex-1 rounded px-2 py-1 text-[11px] transition ${
                    prefs.velocidad === v ? "bg-jade text-tinta" : "border border-borde text-suave hover:text-texto"}`}>
                  {v}×
                </button>
              ))}
            </div>
          </div>

          {/* En pantalla estrecha no cabe junto al transporte: vive aquí. */}
          <div className="sm:hidden">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-suave">Volumen</p>
            <Volumen />
          </div>

          {!usandoNeuronal && (
            <select value={prefs.vozURI ?? ""} onChange={(e) => cambiar({ vozURI: e.target.value || null })}
              className="w-full rounded-lg border border-borde bg-tinta-2 px-2 py-1.5 text-xs">
              <option value="">Voz predeterminada de Windows</option>
              {vocesSistema.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

function Opcion({ activa, onClick, titulo, nota, derecha, desactivada }: {
  activa: boolean; onClick: () => void; titulo: string; nota: string;
  derecha: string; desactivada?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={desactivada}
      className={`w-full rounded-lg px-3 py-2 text-left transition disabled:opacity-50 ${
        activa ? "bg-tinta-3" : "hover:bg-tinta-3/60"}`}>
      <span className="flex items-center gap-2 text-xs">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${activa ? "bg-jade" : "bg-borde"}`} />
        {titulo}
        <span className="ml-auto text-[10px] text-suave">{derecha}</span>
      </span>
      <span className="mt-0.5 block pl-3.5 text-[10px] text-suave">{nota}</span>
    </button>
  );
}
