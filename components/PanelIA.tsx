"use client";
import { useCallback, useEffect, useState } from "react";
import { llamarFuncion, db, temarioId } from "@/lib/supabase";
import VisorMaterial, { NOMBRES } from "@/components/VisorMaterial";

const MATERIALES = [
  { id: "esquema", nota: "Índice jerárquico para memorizar" },
  { id: "resumen", nota: "1.000 palabras, prosa continua" },
  { id: "tema_examen", nota: "Lo que cabe a mano en 2 h 30" },
  { id: "guia_estudio", nota: "Glosario, autores, errores típicos" },
  { id: "flashcards", nota: "20-30 tarjetas de repaso activo" },
  { id: "preguntas", nota: "10 preguntas de nivel tribunal" },
  { id: "mapa_conceptual", nota: "Diagrama de conceptos" },
];

interface Respuesta { contenido: string; modelo: string; cacheado?: boolean; usadasHoy?: number; limite?: number; }

export default function PanelIA({ numero, titulo }: { numero: number; titulo: string }) {
  const [tipo, setTipo] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [res, setRes] = useState<Respuesta | null>(null);
  const [error, setError] = useState("");
  const [guardados, setGuardados] = useState<Set<string>>(new Set());

  const cargarGuardados = useCallback(async () => {
    const c = db(); const tid = await temarioId();
    if (!c || !tid) return;
    const { data } = await c.from("materiales_ia").select("tipo")
      .eq("temario_id", tid).eq("tema_numero", numero);
    setGuardados(new Set((data ?? []).map((d: { tipo: string }) => d.tipo)));
  }, [numero]);

  useEffect(() => { void cargarGuardados(); }, [cargarGuardados]);

  const generar = async (id: string, regenerar = false) => {
    setTipo(id); setCargando(true); setError(""); setRes(null);
    try {
      const r = await llamarFuncion<Respuesta>("generar-material",
        { temaNumero: numero, tipo: id, regenerar });
      setRes(r);
      void cargarGuardados();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ha fallado la generación.");
    } finally { setCargando(false); }
  };

  return (
    <div className="space-y-3">
      <div className="tarjeta p-3">
        <p className="text-xs text-suave">A partir del texto de este tema. Se guarda en tus materiales.</p>
        <div className="mt-2 space-y-1">
          {MATERIALES.map((m) => (
            <button
              key={m.id} onClick={() => generar(m.id)} disabled={cargando}
              className={`w-full rounded-lg px-3 py-2 text-left transition disabled:opacity-40 ${
                tipo === m.id ? "bg-tinta-3" : "hover:bg-tinta-3/60"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-sm">{NOMBRES[m.id]}</span>
                {guardados.has(m.id) && (
                  <span className="rounded bg-jade/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-jade">
                    guardado
                  </span>
                )}
              </span>
              <span className="block text-[11px] text-suave">{m.nota}</span>
            </button>
          ))}
        </div>
      </div>

      {cargando && (
        <div className="tarjeta p-4">
          <p className="text-sm text-suave">Generando {NOMBRES[tipo ?? ""]?.toLowerCase()}…</p>
          <div className="mt-2 h-1 overflow-hidden rounded bg-tinta-3">
            <div className="h-full w-1/3 animate-pulse rounded bg-jade" />
          </div>
          <p className="mt-2 text-[11px] text-suave">Puede tardar entre 20 y 60 segundos.</p>
        </div>
      )}

      {error && <p className="rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral">{error}</p>}

      {res && tipo && (
        <div className="tarjeta p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borde pb-2">
            <span className="text-sm">{NOMBRES[tipo]}</span>
            <span className="text-[10px] text-suave">{res.cacheado ? "guardado" : "recién generado"}</span>
          </div>
          <div className="mt-3">
            <VisorMaterial
              tipo={tipo} contenido={res.contenido}
              titulo={`Tema ${numero}. ${titulo}`} subtitulo={NOMBRES[tipo]}
              extras={
                <>
                  <button onClick={() => generar(tipo, true)}
                    className="rounded border border-borde px-2.5 py-1 text-[11px] text-suave hover:text-texto">
                    Regenerar
                  </button>
                  {res.usadasHoy != null && (
                    <span className="ml-auto text-[10px] text-suave">{res.usadasHoy}/{res.limite} hoy</span>
                  )}
                </>
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
