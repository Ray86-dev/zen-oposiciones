"use client";
import { useMemo, useState } from "react";
import { llamarFuncion } from "@/lib/supabase";
import { markdownAHtml } from "@/lib/markdown";
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

  const materia = curriculo.materias[iMateria];
  const bloque = useMemo(() => materia.bloques[Math.min(iBloque, materia.bloques.length - 1)], [materia, iBloque]);

  const generar = async () => {
    setCargando(true); setError(""); setRes(null);
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
            className="mt-4 rounded-lg bg-jade px-4 py-2 text-sm font-medium text-tinta disabled:opacity-50"
          >
            {cargando ? "Redactando el supuesto…" : "Generar supuesto"}
          </button>

          {error && <p className="mt-3 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}

          {res && (
            <div className="mt-5 border-t border-borde pt-4">
              <div className="markdown text-sm" dangerouslySetInnerHTML={{ __html: markdownAHtml(res.contenido) }} />
              <p className="mt-3 rounded-lg border border-ambar/30 bg-ambar/5 px-3 py-2 text-[11px] text-suave">
                Generado con {res.modelo}. Verifica siempre las citas textuales antes de darlas por buenas:
                los modelos de lenguaje son propensos a reconstruirlas de memoria.
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
