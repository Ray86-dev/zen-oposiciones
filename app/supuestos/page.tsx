"use client";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/Proveedor";
import supuestosJson from "@/data/supuestos.json";
import rubricasJson from "@/data/rubricas.json";
import GeneradorSupuestos from "@/components/GeneradorSupuestos";
import Aparece from "@/components/efectos/Aparece";

type Supuesto = (typeof supuestosJson)["supuestos"][number];
const RUBRICA_A = rubricasJson.partes.find((p) => p.id === "A")!;

export default function PaginaSupuestos() {
  const { listo } = useApp();
  const [activo, setActivo] = useState<Supuesto | null>(null);
  if (!listo) return <div className="tarjeta h-64 animate-pulse" />;
  if (activo) return <Entrenador s={activo} salir={() => setActivo(null)} />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="serif text-2xl">Supuestos prácticos</h1>
        <p className="text-sm text-suave">
          Enunciados reales del tribunal. La Parte A dura 2 h 30 y se escribe a mano.
        </p>
      </div>

      <p className="rounded-lg border border-ambar/30 bg-ambar/5 px-4 py-3 text-xs text-suave">
        {supuestosJson.fuente} — {rubricasJson.aviso}
      </p>

      <GeneradorSupuestos />

      <h2 className="serif pt-2 text-lg">Supuestos oficiales</h2>
      <ul className="space-y-3">
        {supuestosJson.supuestos.map((s, i) => (
          <Aparece as="li" key={s.id} className="tarjeta p-5" retardo={Math.min(i, 6) * 55}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-suave">
              <span className="rounded bg-coral/15 px-2 py-0.5 uppercase tracking-wide text-coral">
                {s.tipo === "comentario-de-texto" ? "Comentario de texto" : "Análisis histórico-semántico"}
              </span>
              <span>{s.anio}</span>
              {s.oficial && <span className="text-jade">oficial</span>}
            </div>
            <h2 className="serif mt-2 text-lg">
              {"autor" in s && s.autor ? `${s.autor} · ${s.obra}` : `Término: ${(s as { termino?: string }).termino}`}
            </h2>
            <p className="mt-2 text-sm text-suave">
              {s.intervencion.materia} · {s.intervencion.curso} · {s.intervencion.numEstudiantes} estudiantes ·{" "}
              {s.intervencion.neae.join(", ")}
            </p>
            <p className="mt-1 text-xs text-suave">{s.intervencion.bloque}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setActivo(s)}
                className="rounded-lg bg-jade px-4 py-2 text-sm font-medium text-tinta transition hover:opacity-90"
              >
                Empezar cronometrado
              </button>
              <span className="text-xs text-suave">
                Temas relacionados: {s.temasRelacionados.join(", ")}
              </span>
            </div>
          </Aparece>
        ))}
      </ul>
    </div>
  );
}

function Entrenador({ s, salir }: { s: Supuesto; salir: () => void }) {
  const { registrarSesion } = useApp();
  const TOTAL = 150 * 60;
  const [seg, setSeg] = useState(TOTAL);
  const [corriendo, setCorriendo] = useState(false);
  const [fase, setFase] = useState<"trabajo" | "correccion">("trabajo");
  const [marcados, setMarcados] = useState<Record<string, number>>({});
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (corriendo && seg > 0) {
      ref.current = setInterval(() => setSeg((x) => Math.max(0, x - 1)), 1000);
      return () => { if (ref.current) clearInterval(ref.current); };
    }
  }, [corriendo, seg]);

  const mm = String(Math.floor(seg / 60)).padStart(2, "0");
  const ss = String(seg % 60).padStart(2, "0");
  const guion = supuestosJson.guionesOficiales[s.tipo as keyof typeof supuestosJson.guionesOficiales];

  const nota = Object.values(marcados).reduce((a, b) => a + b, 0);
  const maximo = RUBRICA_A.apartados.reduce((a, ap) => a + ap.puntos, 0);

  return (
    <div className="space-y-5">
      <button onClick={salir} className="text-sm text-suave underline">← Volver al banco</button>

      <div className="tarjeta sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="serif text-4xl tabular-nums" style={{ color: seg < 900 ? "#e0705a" : "#e7ecea" }}>
          {mm}:{ss}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCorriendo((c) => !c)}
            className="rounded-lg bg-jade px-4 py-2 text-sm font-medium text-tinta"
          >
            {corriendo ? "Pausar" : "Iniciar"}
          </button>
          <button
            onClick={() => { setCorriendo(false); setSeg(TOTAL); }}
            className="rounded-lg border border-borde px-4 py-2 text-sm text-suave"
          >
            Reiniciar
          </button>
          <button
            onClick={() => {
              setCorriendo(false);
              setFase(fase === "trabajo" ? "correccion" : "trabajo");
              if (fase === "trabajo") registrarSesion(Math.round((TOTAL - seg) / 60), "supuesto");
            }}
            className="rounded-lg border border-jade px-4 py-2 text-sm text-jade"
          >
            {fase === "trabajo" ? "Terminar y corregir" : "Volver al enunciado"}
          </button>
        </div>
      </div>

      {fase === "trabajo" ? (
        <>
          <section className="tarjeta p-6">
            <h2 className="serif text-xl">
              {"autor" in s && s.autor ? "Comentario de texto" : `Análisis histórico-semántico: ${(s as { termino?: string }).termino}`}
            </h2>
            {"texto" in s && s.texto && (
              <blockquote className="serif mt-4 border-l-2 border-jade/40 pl-4 text-[15px] leading-relaxed text-texto/90">
                {s.texto}
                <footer className="mt-2 text-xs not-italic text-suave">{s.autor}, {s.obra}</footer>
              </blockquote>
            )}
            <ol className="mt-5 list-inside list-[lower-alpha] space-y-1.5 text-sm text-suave">
              {guion.map((g, i) => <li key={i}>{g}</li>)}
            </ol>
          </section>

          <section className="tarjeta p-6">
            <h2 className="serif text-xl">Intervención didáctica</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Dato k="Materia" v={s.intervencion.materia} />
              <Dato k="Curso" v={`${s.intervencion.curso} · ${s.intervencion.modalidad}`} />
              <Dato k="Grupo" v={`${s.intervencion.numEstudiantes} estudiantes`} />
              <Dato k="NEAE" v={s.intervencion.neae.join(" · ")} />
              <Dato k="Saberes básicos" v={s.intervencion.bloque} />
              <Dato k="Encargo" v={s.intervencion.encargo} />
            </dl>
            <p className="mt-4 text-xs text-suave">
              Escribe a mano, en folios por ambas caras, bolígrafo azul. Numera los apartados y pagina abajo
              a la derecha. Sin marcas que rompan el anonimato.
            </p>
          </section>
        </>
      ) : (
        <section className="tarjeta p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="serif text-xl">Autocorrección con la plantilla del tribunal</h2>
            <div className="text-right">
              <div className="serif text-3xl tabular-nums text-jade">{nota.toFixed(2)}</div>
              <div className="text-xs text-suave">sobre {maximo}</div>
            </div>
          </div>
          <p className="mt-2 text-xs text-suave">
            Marca cada ítem que hayas cumplido de verdad. Ser generoso aquí solo te engaña a ti.
          </p>
          <div className="mt-5 space-y-5">
            {RUBRICA_A.apartados.map((ap) => (
              <div key={ap.id}>
                <h3 className="text-sm font-medium">
                  {ap.nombre} <span className="text-suave">({ap.puntos} p.)</span>
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {ap.items.map((it, i) => {
                    const clave = `${ap.id}-${i}`;
                    const on = marcados[clave] != null;
                    return (
                      <li key={clave}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-tinta-3/50 px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) =>
                              setMarcados((m) => {
                                const n = { ...m };
                                if (e.target.checked) n[clave] = it.puntos;
                                else delete n[clave];
                                return n;
                              })
                            }
                            className="mt-1 accent-[#2fbf94]"
                          />
                          <span className={`flex-1 ${on ? "text-texto" : "text-suave"}`}>{it.texto}</span>
                          <span className="shrink-0 text-xs tabular-nums text-suave">{it.puntos}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-suave">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}
