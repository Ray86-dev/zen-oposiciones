"use client";
import Link from "next/link";
import { useApp } from "@/components/Proveedor";
import { hoy } from "@/lib/almacen";
import { diasEntre, formatoLargo, formatoCorto } from "@/lib/fechas";
import { fases, ritmoMinimoSemanal } from "@/lib/plan";
import { probabilidadAlMenosUno, probabilidadAlMenos, temasParaProbabilidad } from "@/lib/probabilidad";
import { ESTADOS } from "@/lib/tipos";
import { consejoDe } from "@/lib/consejos";
import Anillo from "@/components/Anillo";
import Pastilla from "@/components/Pastilla";

export default function Panel() {
  const { estado, temario, plan, resumen, listo } = useApp();
  if (!listo) return <Esqueleto />;

  const h = hoy();
  const dias = diasEntre(h, estado.fechaPrueba);
  const fs = fases(estado.fechaInicio, estado.fechaPrueba);
  const fase = fs.find((f) => diasEntre(f.desde, h) >= 0 && diasEntre(h, f.hasta) >= 0) ?? fs[0];

  const deHoy = plan.filter((s) => s.fecha === h);
  const proximas = plan.filter((s) => diasEntre(h, s.fecha) > 0).slice(0, 5);

  const progresos = Object.values(estado.progreso);
  const preparados = progresos.filter((p) => p.estado === "memorizado" || p.estado === "dominado").length;
  const tocados = progresos.filter((p) => p.estado !== "pendiente").length;
  const avance = temario.temas.reduce((a, t) => {
    const e = estado.progreso[t.numero]?.estado ?? "pendiente";
    return a + (ESTADOS.find((x) => x.id === e)?.peso ?? 0);
  }, 0) / temario.temas.length;

  // Dominados sin prueba reciente: se avisa antes de que caduquen.
  const caducando = progresos.filter((p) => {
    if (p.estado !== "dominado" || !p.ultimoRepaso) return false;
    return diasEntre(p.ultimoRepaso, h) > 45;
  }).length;

  const p1 = probabilidadAlMenosUno(preparados);
  const p2 = probabilidadAlMenos(2, preparados);
  const para90 = temasParaProbabilidad(0.9);
  const ritmoMin = ritmoMinimoSemanal(temario, estado.fechaInicio, fs[1].hasta);
  const ritmoActual = Math.round((estado.disponibilidad.porDiaSemana.reduce((a, b) => a + b, 0) / 60) * 10) / 10;

  return (
    <div className="space-y-6">
      <section className="tarjeta p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-suave">Fase {fase.id} · {fase.nombre}</p>
            <h1 className="serif mt-1 text-3xl">
              Quedan <span className="text-jade tabular-nums">{dias}</span> días
            </h1>
            <p className="mt-1 text-sm text-suave">
              Prueba estimada: {formatoLargo(estado.fechaPrueba)}
            </p>
          </div>
          <div className="text-right text-sm text-suave">
            <p>{temario.especialidad.nombre} · {temario.especialidad.cuerpo}/{temario.especialidad.codigo}</p>
            <p>{temario.especialidad.numeroTemas} temas · se sortean {temario.especialidad.temasSorteados}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="tarjeta flex flex-col items-center p-5">
          <Anillo valor={avance} etiqueta={`${Math.round(avance * 100)}%`} sub="del temario" />
          <p className="mt-3 text-center text-xs text-suave">
            {tocados} temas empezados · {preparados} consolidados
          </p>
        </div>
        <div className="tarjeta flex flex-col items-center p-5">
          <Anillo valor={p1} color="#d9a441" etiqueta={`${Math.round(p1 * 100)}%`} sub="al menos 1" />
          <p className="mt-3 text-center text-xs text-suave">
            Probabilidad de que salga alguno de tus {preparados} temas consolidados
          </p>
        </div>
        <div className="tarjeta flex flex-col items-center p-5">
          <Anillo valor={p2} color="#e0705a" etiqueta={`${Math.round(p2 * 100)}%`} sub="al menos 2" />
          <p className="mt-3 text-center text-xs text-suave">
            Poder elegir entre dos temas preparados es lo que sube la nota
          </p>
        </div>
      </section>

      {preparados < para90 && (
        <p className="rounded-lg border border-ambar/30 bg-ambar/5 px-4 py-3 text-sm text-suave">
          Con <b className="text-texto">{para90} temas</b> consolidados alcanzas el 90 % de probabilidad de que
          salga al menos uno. Te faltan <b className="text-texto">{para90 - preparados}</b>.
        </p>
      )}

      {caducando > 0 && (
        <p className="rounded-lg border border-ambar/30 bg-ambar/5 px-4 py-3 text-sm text-suave">
          <b className="text-texto">{caducando}</b>{" "}
          {caducando === 1 ? "tema dominado lleva" : "temas dominados llevan"} más de 45 días sin
          prueba. A los 60 vuelven a «memorizado»: el dominio se mantiene, no se archiva.{" "}
          <Link href="/temario" className="text-jade underline">Repasarlos</Link>
        </p>
      )}

      {!resumen.cubreTemario && (
        <p className="rounded-lg border border-coral/30 bg-coral/5 px-4 py-3 text-sm text-suave">
          Con tu disponibilidad actual (~{ritmoActual} h/semana) el plan solo llega a{" "}
          <b className="text-texto">{resumen.temasCubiertos} de {temario.especialidad.numeroTemas}</b> temas
          antes de la prueba. Para cerrar la primera vuelta en febrero harían falta unas{" "}
          <b className="text-texto">{ritmoMin} h/semana</b>.{" "}
          <Link href="/ajustes" className="text-jade underline">Ajustar disponibilidad</Link>
        </p>
      )}

      <section className="tarjeta p-6">
        <h2 className="serif text-xl">Hoy</h2>
        <p className="text-xs text-suave">{formatoLargo(h)}</p>
        {deHoy.length === 0 ? (
          <p className="mt-4 text-sm text-suave">
            Hoy no hay sesión programada. Día de descanso: también forma parte del plan.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {deHoy.map((s, i) => {
              const fila = (
                <>
                  <Pastilla tipo={s.tipo} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{s.titulo}</p>
                    <p className="text-xs text-suave">{s.motivo}</p>
                  </div>
                  <span className="shrink-0 self-center text-xs tabular-nums text-suave">{s.minutos} min</span>
                </>
              );
              const clases = "flex items-start gap-3 rounded-lg bg-tinta-3/60 px-4 py-3";
              return (
                <li key={i}>
                  {s.temaNumero ? (
                    <Link href={`/temario/${s.temaNumero}`} className={`${clases} group transition hover:bg-tinta-3`}>
                      {fila}
                      <span className="self-center text-jade opacity-0 transition group-hover:opacity-100">→</span>
                    </Link>
                  ) : s.tipo === "supuesto" ? (
                    <Link href="/supuestos" className={`${clases} group transition hover:bg-tinta-3`}>
                      {fila}
                      <span className="self-center text-jade opacity-0 transition group-hover:opacity-100">→</span>
                    </Link>
                  ) : (
                    <div className={clases}>{fila}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-5 border-l-2 border-jade/40 pl-3 text-sm italic text-suave">
          {consejoDe(fase.id, new Date().getDate())}
        </p>
      </section>

      <section className="tarjeta p-6">
        <h2 className="serif text-xl">A continuación</h2>
        <ul className="mt-3 space-y-1.5">
          {proximas.map((s, i) => (
            <li key={i}>
              {s.temaNumero ? (
                <Link href={`/temario/${s.temaNumero}`} className="flex items-center gap-3 rounded px-1 py-0.5 text-sm transition hover:bg-tinta-3/60">
                  <span className="w-14 shrink-0 text-xs tabular-nums text-suave">{formatoCorto(s.fecha)}</span>
                  <Pastilla tipo={s.tipo} />
                  <span className="min-w-0 flex-1 truncate text-suave">{s.titulo}</span>
                  <span className="shrink-0 text-xs tabular-nums text-suave">{s.minutos}′</span>
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-1 py-0.5 text-sm">
                  <span className="w-14 shrink-0 text-xs tabular-nums text-suave">{formatoCorto(s.fecha)}</span>
                  <Pastilla tipo={s.tipo} />
                  <span className="min-w-0 flex-1 truncate text-suave">{s.titulo}</span>
                  <span className="shrink-0 text-xs tabular-nums text-suave">{s.minutos}′</span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <Link href="/calendario" className="mt-4 inline-block text-sm text-jade underline">
          Ver el calendario completo
        </Link>
      </section>
    </div>
  );
}

function Esqueleto() {
  return <div className="tarjeta h-64 animate-pulse" />;
}
