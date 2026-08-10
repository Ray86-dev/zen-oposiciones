"use client";
import { useEffect, useState } from "react";
import { llamarFuncion, db, temarioId } from "@/lib/supabase";
import { useSesion } from "@/components/Sesion";

interface Pregunta { pregunta: string; opciones: string[]; correcta: number; porque: string }

/**
 * Comprobación rápida y barata. Se corrige en el navegador —las respuestas
 * correctas ya vienen— y se registra como prueba de tipo «test», que NO cuenta
 * para dominado: reconocer una opción no es lo mismo que escribir un tema.
 */
export default function TestRapido({ numero, volver }: { numero: number; volver: () => void }) {
  const { usuario } = useSesion();
  const [preguntas, setPreguntas] = useState<Pregunta[] | null>(null);
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});
  const [corregido, setCorregido] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await llamarFuncion<{ preguntas: Pregunta[] }>("evaluar",
          { modo: "test", temaNumero: numero });
        if (vivo) setPreguntas(r.preguntas);
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : "No se pudo generar el test.");
      } finally { if (vivo) setCargando(false); }
    })();
    return () => { vivo = false; };
  }, [numero]);

  const aciertos = preguntas
    ? preguntas.filter((p, i) => respuestas[i] === p.correcta).length : 0;

  const corregir = async () => {
    setCorregido(true);
    if (!usuario || !preguntas) return;
    const c = db(); const tid = await temarioId();
    if (!c || !tid) return;
    const nota = (aciertos / preguntas.length) * 10;
    await c.from("pruebas").insert({
      user_id: usuario.id, temario_id: tid, tema_numero: numero,
      tipo: "test", origen: "teclado", nota,
      detalle: { aciertos, total: preguntas.length },
      // El test no promociona a dominado: se registra como no aprobada a efectos
      // de estado, y sirve solo como termómetro.
      aprobada: false,
    });
  };

  if (cargando) {
    return (
      <div className="tarjeta p-4">
        <p className="text-sm text-suave">Preparando diez preguntas…</p>
        <div className="mt-2 h-1 overflow-hidden rounded bg-tinta-3">
          <div className="h-full w-1/3 animate-pulse rounded bg-jade" />
        </div>
      </div>
    );
  }
  if (error || !preguntas) {
    return (
      <div className="space-y-3">
        <button onClick={volver} className="text-xs text-suave hover:text-texto">← Evaluación</button>
        <p className="rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={volver} className="text-xs text-suave hover:text-texto">← Evaluación</button>
        {corregido && (
          <span className="text-sm tabular-nums" style={{ color: aciertos >= 8 ? "#2fbf94" : "#d9a441" }}>
            {aciertos} de {preguntas.length}
          </span>
        )}
      </div>

      <ol className="space-y-3">
        {preguntas.map((p, i) => {
          const elegida = respuestas[i];
          return (
            <li key={i} className="tarjeta p-4">
              <p className="text-sm"><span className="text-suave">{i + 1}.</span> {p.pregunta}</p>
              <div className="mt-2 space-y-1">
                {p.opciones.map((o, k) => {
                  const esCorrecta = k === p.correcta;
                  const seleccionada = elegida === k;
                  let clase = "border-borde text-suave hover:text-texto";
                  if (corregido && esCorrecta) clase = "border-jade text-jade";
                  else if (corregido && seleccionada) clase = "border-coral text-coral";
                  else if (seleccionada) clase = "border-jade text-texto";
                  return (
                    <button key={k} disabled={corregido}
                      onClick={() => setRespuestas((v) => ({ ...v, [i]: k }))}
                      className={`w-full rounded-lg border px-3 py-1.5 text-left text-xs transition ${clase}`}>
                      {o}
                    </button>
                  );
                })}
              </div>
              {corregido && (
                <p className="mt-2 border-l-2 border-jade/40 pl-2 text-[11px] text-suave">{p.porque}</p>
              )}
            </li>
          );
        })}
      </ol>

      {!corregido ? (
        <button onClick={corregir} disabled={Object.keys(respuestas).length < preguntas.length}
          className="w-full rounded-lg bg-jade py-2.5 text-sm font-medium text-tinta disabled:opacity-40">
          Corregir ({Object.keys(respuestas).length}/{preguntas.length} contestadas)
        </button>
      ) : (
        <p className="rounded-lg border border-borde px-4 py-3 text-xs text-suave">
          {aciertos >= 8
            ? "Buen resultado. Ahora la prueba que cuenta: reconstruye el índice de memoria."
            : "Vuelve al tema antes de seguir. Aquí solo estás reconociendo respuestas, y en el examen partes de un folio en blanco."}
        </p>
      )}
    </div>
  );
}
