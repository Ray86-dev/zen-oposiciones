"use client";
import { useEffect, useMemo, useState } from "react";
import { llamarFuncion } from "@/lib/supabase";
import VisorMaterial from "@/components/VisorMaterial";
import { useSesion } from "@/components/Sesion";
import curriculo from "@/data/curriculo-canarias.json";
import temarioJson from "@/data/temario-filosofia.json";

interface Respuesta { contenido: string; modelo: string; usadasHoy?: number; limite?: number; }

export default function GeneradorSupuestos() {
  const { usuario } = useSesion();
  const [iMateria, setIMateria] = useState(0);
  const [iBloque, setIBloque] = useState(0);
  const [tipo, setTipo] = useState("comentario-de-texto");
  const [tema, setTema] = useState<number | "">("");
  const [dificultad, setDificultad] = useState("normal");
  const [cargando, setCargando] = useState(false);
  const [res, setRes] = useState<Respuesta | null>(null);
  const [error, setError] = useState("");
  const [segundos, setSegundos] = useState(0);

  const materia = curriculo.materias[iMateria];
  const bloque = useMemo(() => materia.bloques[Math.min(iBloque, materia.bloques.length - 1)], [materia, iBloque]);

  // Un contador honesto vale mas que una barra que finge saber el porcentaje:
  // la generacion tarda lo que tarde y el usuario merece verlo avanzar.
  useEffect(() => {
    if (!cargando) return;
    const t = setInterval(() => setSegundos((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [cargando]);

  const generar = async () => {
    setCargando(true); setError(""); setRes(null); setSegundos(0);
    try {
      setRes(await llamarFuncion<Respuesta>("generar-supuesto", {
        tipo,
        materia: materia.materia,
        curso: materia.curso,
        bloque: `${bloque.romano}. ${bloque.nombre}`,
        saberes: bloque.saberes,
        temaNumero: tema === "" ? undefined : Number(tema),
        dificultad,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ha fallado la generación.");
    } finally { setCargando(false); }
  };

  return (
    <section className="tarjeta p-6">
      <h2 className="serif text-xl">Generar un supuesto nuevo</h2>
      <p className="mt-1 text-sm text-suave">
        Con el formato real del tribunal y anclado al currículo LOMLOE de Canarias.
      </p>

      {!usuario ? (
        <p className="mt-4 text-sm text-suave">
          Necesitas <a href="/entrar" className="text-jade underline">iniciar sesión</a> para generar supuestos.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Selector etiqueta="Materia y curso" valor={String(iMateria)}
              cambiar={(v) => { setIMateria(Number(v)); setIBloque(0); }}
              opciones={curriculo.materias.map((m, i) => [String(i), `${m.materia} · ${m.curso}`])} />
            <Selector etiqueta="Bloque de saberes" valor={String(iBloque)}
              cambiar={(v) => setIBloque(Number(v))}
              opciones={materia.bloques.map((b, i) => [String(i), `${b.romano}. ${b.nombre}`])} />
            <Selector etiqueta="Tipo de ejercicio" valor={tipo} cambiar={setTipo}
              opciones={[["comentario-de-texto", "Comentario de texto"],
                         ["analisis-historico-semantico", "Análisis histórico-semántico"]]} />
            <Selector etiqueta="Exigencia" valor={dificultad} cambiar={setDificultad}
              opciones={[["normal", "Como una convocatoria real"], ["alta", "Alta"]]} />
            <label className="block sm:col-span-2">
              <span className="text-xs uppercase tracking-wide text-suave">Anclar a un tema del temario (opcional)</span>
              <select
                value={tema} onChange={(e) => setTema(e.target.value === "" ? "" : Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-borde bg-tinta-2 px-3 py-2 text-sm"
              >
                <option value="">Cualquiera</option>
                {temarioJson.temas.map((t) => (
                  <option key={t.numero} value={t.numero}>Tema {t.numero}. {t.titulo.slice(0, 70)}</option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-2 text-[11px] text-suave">
            {bloque.saberes.length} saberes básicos de este bloque se pasarán al modelo.
          </p>

          <button
            onClick={generar} disabled={cargando}
            aria-busy={cargando}
            className="zen-lustre mt-4 inline-flex items-center gap-2 rounded-lg bg-jade px-4 py-2 text-sm font-medium text-tinta disabled:opacity-60"
          >
            {cargando && (
              <svg className="zen-girando" width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeOpacity=".25" />
                <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            {cargando ? "Redactando el supuesto…" : "Generar supuesto"}
          </button>

          {cargando && (
            <div className="mt-4" role="status" aria-live="polite">
              <div className="zen-indeterminada h-1 overflow-hidden rounded bg-tinta-3" />
              <p className="mt-2 text-xs text-suave">
                Escribiendo el enunciado con el formato del tribunal ·{" "}
                <span className="tabular-nums">{segundos}s</span>
                {segundos > 45 && " · está tardando más de lo normal, pero sigue en marcha"}
              </p>
              <div className="mt-4 space-y-2.5" aria-hidden>
                <div className="zen-esqueleto h-4 w-1/3" />
                <div className="zen-esqueleto h-3 w-full" />
                <div className="zen-esqueleto h-3 w-11/12" />
                <div className="zen-esqueleto h-3 w-4/5" />
                <div className="zen-esqueleto mt-4 h-4 w-2/5" />
                <div className="zen-esqueleto h-3 w-full" />
                <div className="zen-esqueleto h-3 w-3/4" />
              </div>
            </div>
          )}

          {error && <p className="mt-3 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}

          {res && (
            <div className="mt-5 border-t border-borde pt-4">
              <VisorMaterial
                tipo="supuesto" contenido={res.contenido}
                titulo={`Supuesto práctico · ${materia.materia} ${materia.curso}`}
                subtitulo={`${bloque.romano}. ${bloque.nombre}`}
                alto="none"
              />
              <p className="mt-3 rounded-lg border border-ambar/30 bg-ambar/5 px-3 py-2 text-[11px] text-suave">
                Verifica siempre las citas textuales antes de darlas por buenas: los modelos de lenguaje
                tienden a reconstruirlas de memoria y suenan plausibles estando mal.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Selector({ etiqueta, valor, cambiar, opciones }: {
  etiqueta: string; valor: string; cambiar: (v: string) => void; opciones: [string, string][];
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-suave">{etiqueta}</span>
      <select
        value={valor} onChange={(e) => cambiar(e.target.value)}
        className="mt-1 w-full rounded-lg border border-borde bg-tinta-2 px-3 py-2 text-sm"
      >
        {opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );
}
