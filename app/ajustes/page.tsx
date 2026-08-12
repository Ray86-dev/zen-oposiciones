"use client";
import { useApp } from "@/components/Proveedor";
import { NOMBRE_DIA, formatoLargo, diasEntre } from "@/lib/fechas";
import { fases, ritmoMinimoSemanal } from "@/lib/plan";
import { useTema } from "@/components/Tema";
import { useEfectos, type NivelEfecto } from "@/components/Efectos";
import { useSesion } from "@/components/Sesion";
import Link from "next/link";

const ORDEN = [1, 2, 3, 4, 5, 6, 0]; // lunes → domingo

export default function PaginaAjustes() {
  const { estado, actualizar, temario, resumen, listo } = useApp();
  const { modo, fijar } = useTema();
  const { nivel, fijar: fijarEfectos } = useEfectos();
  const { usuario } = useSesion();
  if (!listo) return <div className="tarjeta h-64 animate-pulse" />;

  const d = estado.disponibilidad;
  const totalSemana = d.porDiaSemana.reduce((a, b) => a + b, 0);
  const fs = fases(estado.fechaInicio, estado.fechaPrueba);
  const minimo = ritmoMinimoSemanal(temario, estado.fechaInicio, fs[1].hasta);

  const set = (dia: number, min: number) =>
    actualizar({
      disponibilidad: {
        ...d,
        porDiaSemana: d.porDiaSemana.map((v, i) => (i === dia ? Math.max(0, min) : v)),
      },
    });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="serif text-2xl">Ajustes</h1>
        <p className="text-sm text-suave">
          El plan se recalcula solo cada vez que cambias algo aquí.
        </p>
      </div>

      <section className="tarjeta p-6">
        <h2 className="serif text-lg">Apariencia</h2>
        <p className="mt-1 text-sm text-suave">
          El modo oscuro es el predeterminado. El claro va mejor con luz de día o para imprimir.
        </p>
        <div className="mt-3 inline-flex rounded-lg border border-borde p-1">
          {([["oscuro", "Oscuro"], ["claro", "Claro"]] as const).map(([id, etiqueta]) => (
            <button
              key={id}
              onClick={() => fijar(id)}
              className={`rounded px-4 py-1.5 text-sm transition ${
                modo === id ? "bg-jade text-tinta" : "text-suave hover:text-texto"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <h3 className="mt-6 text-sm font-medium">Efectos visuales</h3>
        <p className="mt-1 text-sm text-suave">
          El fondo en movimiento, el indicador líquido de la navegación y las chispas al cerrar
          un bloque. Nada de esto toca al lector de temas. Si tu sistema pide menos animación,
          Zen arranca en «ninguno».
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {([
            ["pleno", "Pleno", "Todo encendido, con el fondo bien visible."],
            ["sutil", "Sutil", "Lo justo para que se note el cuidado. Recomendado."],
            ["ninguno", "Ninguno", "Interfaz quieta. Menos batería."],
          ] as const).map(([id, etiqueta, ayuda]) => (
            <button
              key={id}
              onClick={() => fijarEfectos(id as NivelEfecto)}
              title={ayuda}
              className={`rounded-lg border px-4 py-2 text-left text-sm transition ${
                nivel === id
                  ? "border-jade bg-jade/10 text-texto"
                  : "border-borde text-suave hover:text-texto"
              }`}
            >
              <span className="block">{etiqueta}</span>
              <span className="mt-0.5 block max-w-[15rem] text-[11px] text-suave">{ayuda}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="tarjeta p-6">
        <h2 className="serif text-lg">Cuenta</h2>
        {usuario ? (
          <p className="mt-2 text-sm text-suave">
            Sesión iniciada como <span className="text-texto">{usuario.email}</span>. Tu progreso,
            subrayados y anotaciones se guardan en la nube y te siguen a cualquier dispositivo.{" "}
            <Link href="/entrar" className="text-jade underline">Gestionar</Link>
          </p>
        ) : (
          <p className="mt-2 text-sm text-suave">
            Estás en modo local: el progreso vive solo en este navegador y no hay lector de temas
            ni generación con IA.{" "}
            <Link href="/entrar" className="text-jade underline">Crear cuenta o entrar</Link>
          </p>
        )}
      </section>

      <section className="tarjeta p-6">
        <h2 className="serif text-lg">Ritmo semanal</h2>
        <p className="mt-1 text-sm text-suave">
          Minutos que puedes dedicar cada día. Sé realista: un plan que no se cumple desmotiva más que
          uno modesto que sí se cumple.
        </p>
        <div className="mt-4 space-y-3">
          {ORDEN.map((i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm text-suave">{NOMBRE_DIA[i]}</span>
              <input
                type="range" min={0} max={360} step={15}
                value={d.porDiaSemana[i]}
                onChange={(e) => set(i, Number(e.target.value))}
                className="flex-1 accent-[#2fbf94]"
              />
              <span className="w-20 shrink-0 text-right text-sm tabular-nums">
                {Math.floor(d.porDiaSemana[i] / 60)} h {d.porDiaSemana[i] % 60 ? `${d.porDiaSemana[i] % 60}′` : ""}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-borde pt-4 text-sm">
          <span className="text-suave">
            Total: <b className="text-texto tabular-nums">{(totalSemana / 60).toFixed(1)} h/semana</b>
          </span>
          <span className={totalSemana / 60 >= minimo ? "text-jade" : "text-ambar"}>
            Mínimo para cerrar la 1.ª vuelta en febrero: {minimo} h/semana
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { n: "Ligero", v: [60, 30, 30, 30, 30, 0, 120] },
            { n: "Sostenible", v: [90, 60, 60, 60, 60, 0, 150] },
            { n: "Exigente", v: [120, 90, 90, 90, 90, 0, 180] },
            { n: "Máximo", v: [180, 150, 150, 150, 150, 120, 300] },
          ].map((p) => (
            <button
              key={p.n}
              onClick={() => actualizar({ disponibilidad: { ...d, porDiaSemana: p.v } })}
              className="rounded-lg border border-borde px-3 py-1.5 text-xs text-suave transition hover:text-texto"
            >
              {p.n} · {(p.v.reduce((a, b) => a + b, 0) / 60).toFixed(1)} h
            </button>
          ))}
        </div>
      </section>

      <section className="tarjeta p-6">
        <h2 className="serif text-lg">Fechas</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-suave">Inicio del plan</span>
            <input
              type="date" value={estado.fechaInicio}
              onChange={(e) => actualizar({ fechaInicio: e.target.value })}
              className="mt-1 w-full rounded-lg border border-borde bg-tinta-2 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-suave">Fecha de la prueba</span>
            <input
              type="date" value={estado.fechaPrueba}
              onChange={(e) => actualizar({ fechaPrueba: e.target.value })}
              className="mt-1 w-full rounded-lg border border-borde bg-tinta-2 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-suave">
          Estimación basada en convocatorias anteriores (22 jun 2024, 21 jun 2025). Ajústala en cuanto se
          publique la convocatoria de 2027. Ahora mismo: {formatoLargo(estado.fechaPrueba)} ·{" "}
          {diasEntre(estado.fechaInicio, estado.fechaPrueba)} días de plan.
        </p>
      </section>

      <section className="tarjeta p-6">
        <h2 className="serif text-lg">Resultado del plan</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Fila k="Sesiones programadas" v={String(resumen.totalSesiones)} />
          <Fila k="Horas totales" v={`${Math.round(resumen.minutosTotales / 60)} h`} />
          <Fila k="Temas en 1.ª vuelta" v={`${resumen.temasCubiertos} / ${temario.especialidad.numeroTemas}`} />
          <Fila k="Fin de la 1.ª vuelta" v={resumen.fechaUltimoTemaNuevo ?? "—"} />
        </dl>
      </section>

      <section className="tarjeta p-6">
        <h2 className="serif text-lg">Datos</h2>
        <p className="mt-1 text-sm text-suave">
          Tu progreso se guarda en este navegador. Exporta una copia de vez en cuando.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `zen-oposiciones-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
            }}
            className="rounded-lg border border-borde px-3 py-1.5 text-sm text-suave hover:text-texto"
          >
            Exportar progreso
          </button>
          <label className="cursor-pointer rounded-lg border border-borde px-3 py-1.5 text-sm text-suave hover:text-texto">
            Importar
            <input
              type="file" accept="application/json" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try { actualizar(JSON.parse(await f.text())); }
                catch { alert("El archivo no tiene el formato esperado."); }
              }}
            />
          </label>
        </div>
      </section>
    </div>
  );
}

function Fila({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-borde/60 pb-2">
      <dt className="text-suave">{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}
