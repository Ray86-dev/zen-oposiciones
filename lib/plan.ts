import { Temario, Tema, Disponibilidad, SesionPlan, Fase, ProgresoTema } from "./tipos";
import { iso, parse, sumaDias, diasEntre, diaSemana } from "./fechas";

/**
 * Por debajo de esta duración una sesión no compensa: sacar el tema, situarse y
 * recoger se come el rato. Los restos más cortos se absorben en la sesión previa.
 */
export const MIN_SESION = 30;

export const DISPONIBILIDAD_POR_DEFECTO: Disponibilidad = {
  // dom, lun, mar, mié, jue, vie, sáb
  porDiaSemana: [90, 60, 60, 60, 60, 0, 150],
  excepciones: {},
};

/**
 * Minutos estimados para la primera vuelta de un tema: leerlo con atención,
 * esquematizarlo y darle una primera pasada de memorización.
 * Unas 22 palabras por minuto de trabajo real sobre texto académico.
 */
export function esfuerzoTema(t: Tema): number {
  const base = 40;
  return Math.min(300, Math.max(90, base + Math.round(t.palabras / 22)));
}

/**
 * Orden de estudio: round-robin entre bloques para que desde las primeras
 * semanas haya cobertura de todas las áreas (clave si el sorteo cae pronto
 * en un bloque que aún no se ha tocado), manteniendo el orden interno.
 */
export function ordenEstudio(temario: Temario): number[] {
  const idxBloque = new Map(temario.bloques.map((b, i) => [b.id, i]));
  const porBloque = new Map<string, number[]>();
  for (const t of temario.temas) {
    if (!porBloque.has(t.bloqueId)) porBloque.set(t.bloqueId, []);
    porBloque.get(t.bloqueId)!.push(t.numero);
  }
  // Stride scheduling: cada bloque reparte sus temas uniformemente en [0,1).
  // Así cada "ronda" toca todos los bloques y el estudio avanza en paralelo
  // por todas las áreas, empezando por el bloque 1.
  const items: { numero: number; pos: number; b: number }[] = [];
  for (const [bid, ns] of porBloque) {
    const b = idxBloque.get(bid) ?? 99;
    ns.forEach((numero, j) => items.push({ numero, pos: j / ns.length, b }));
  }
  items.sort((x, y) => x.pos - y.pos || x.b - y.b || x.numero - y.numero);
  return items.map((i) => i.numero);
}

export function fases(inicio: string, prueba: string): Fase[] {
  const total = diasEntre(inicio, prueba);
  const c = (f: number) => sumaDias(inicio, Math.round(total * f));
  return [
    { id: "F1", nombre: "Cimientos", desde: inicio, hasta: c(0.18),
      objetivo: "Actualizar el material a la LOMLOE, fijar método de estudio y arrancar la primera vuelta." },
    { id: "F2", nombre: "Primera vuelta", desde: sumaDias(c(0.18), 1), hasta: c(0.58),
      objetivo: "Recorrer el temario completo: leer, esquematizar y hacer el primer resumen de cada tema." },
    { id: "F3", nombre: "Programación y UD", desde: sumaDias(c(0.58), 1), hasta: c(0.80),
      objetivo: "Redactar la Unidad Didáctica / Situación de Aprendizaje y consolidar la segunda vuelta." },
    { id: "F4", nombre: "Simulacros", desde: sumaDias(c(0.80), 1), hasta: prueba,
      objetivo: "Escritura contrarreloj en 2 h 30, supuestos prácticos y repaso final de alta frecuencia." },
  ];
}

export interface OpcionesPlan {
  inicio: string;
  prueba: string;
  disponibilidad: Disponibilidad;
  temario: Temario;
  progreso?: Record<number, ProgresoTema>;
  /** Nº de temas objetivo. Por defecto, todos. */
  objetivoTemas?: number;
}

/** Minutos disponibles en una fecha concreta. */
export function minutosDisponibles(fecha: string, d: Disponibilidad): number {
  if (fecha in d.excepciones) return d.excepciones[fecha];
  return d.porDiaSemana[diaSemana(fecha)] ?? 0;
}

/**
 * Genera el calendario completo. Es determinista: mismas entradas → mismo plan.
 * Reprograma solo: si el usuario va por detrás, los temas no cubiertos vuelven
 * a la cola y el plan se recalcula desde la fecha actual.
 */
export function generarPlan(o: OpcionesPlan): SesionPlan[] {
  const { inicio, prueba, disponibilidad, temario } = o;
  const progreso = o.progreso ?? {};
  const orden = ordenEstudio(temario).slice(0, o.objetivoTemas ?? temario.temas.length);
  const porNumero = new Map(temario.temas.map((t) => [t.numero, t]));

  const pendientes = orden.filter((n) => (progreso[n]?.estado ?? "pendiente") === "pendiente");
  const fs = fases(inicio, prueba);
  const finPrimeraVuelta = fs[1].hasta;

  const sesiones: SesionPlan[] = [];
  const repasosPendientes: { fecha: string; tema: number; ronda: number }[] = [];
  const INTERVALOS = [7, 21, 60];

  let vuelta = 1;
  /** Cada vuelta sucesiva cuesta menos: el material ya está esquematizado. */
  const FACTOR_VUELTA = [1, 0.5, 0.35, 0.3];
  const factor = () => FACTOR_VUELTA[Math.min(vuelta - 1, FACTOR_VUELTA.length - 1)];
  const costeTema = (n: number) => Math.max(25, Math.round(esfuerzoTema(porNumero.get(n)!) * factor()));

  const cola = [...pendientes];
  /** minutos que le faltan al tema en cabeza de la cola */
  let restanteTemaActual = cola.length ? costeTema(cola[0]) : 0;
  let fecha = inicio;

  // Ritmo objetivo: repartir la primera vuelta hasta el final de la fase 2.
  const diasVuelta = Math.max(1, diasEntre(inicio, finPrimeraVuelta));

  while (diasEntre(fecha, prueba) >= 0) {
    let restante = minutosDisponibles(fecha, disponibilidad);
    const enFase = fs.find((f) => diasEntre(f.desde, fecha) >= 0 && diasEntre(fecha, f.hasta) >= 0);

    if (restante > 0) {
      // 1) repasos vencidos primero — son lo que consolida la memoria
      const vencidos = repasosPendientes.filter((r) => diasEntre(r.fecha, fecha) >= 0);
      for (const r of vencidos) {
        const min = r.ronda === 0 ? 30 : r.ronda === 1 ? 25 : 20;
        if (restante < min) break;
        const t = porNumero.get(r.tema)!;
        sesiones.push({
          fecha, tipo: "repaso", temaNumero: r.tema,
          titulo: `Repaso ${r.ronda + 1}.ª · Tema ${r.tema}. ${t.titulo}`,
          minutos: min,
          motivo: `Repaso espaciado a ${INTERVALOS[r.ronda]} días de la sesión anterior.`,
        });
        restante -= min;
        repasosPendientes.splice(repasosPendientes.indexOf(r), 1);
        if (r.ronda + 1 < INTERVALOS.length) {
          repasosPendientes.push({
            fecha: sumaDias(fecha, INTERVALOS[r.ronda + 1]), tema: r.tema, ronda: r.ronda + 1,
          });
        }
      }

      // 2) supuesto práctico semanal (sábados) a partir de la fase 3
      const esSabado = diaSemana(fecha) === 6;
      if (esSabado && (enFase?.id === "F3" || enFase?.id === "F4") && restante >= 90) {
        const min = enFase.id === "F4" ? 150 : 90;
        const real = Math.min(min, restante);
        sesiones.push({
          fecha, tipo: "supuesto",
          titulo: enFase.id === "F4" ? "Simulacro completo (2 h 30)" : "Supuesto práctico cronometrado",
          minutos: real,
          motivo: enFase.id === "F4"
            ? "Escritura a mano contrarreloj en las condiciones reales de la prueba."
            : "Entrenar el formato de la Parte A: comentario o análisis + intervención didáctica.",
        });
        restante -= real;
      }

      // 3) bloque de Unidad Didáctica en fase 3
      if (enFase?.id === "F3" && diaSemana(fecha) === 0 && restante >= 60) {
        const real = Math.min(90, restante);
        sesiones.push({
          fecha, tipo: "ud",
          titulo: "Unidad Didáctica / Situación de Aprendizaje",
          minutos: real,
          motivo: "La Parte B vale el 50 % de la nota: contextualización, DUA, evaluación y defensa.",
        });
        restante -= real;
      }

      // 4) temas nuevos con el tiempo que quede
      while (restante >= MIN_SESION) {
        if (!cola.length) {
          // Primera vuelta terminada: se abre una vuelta nueva sobre todo el
          // temario, más rápida, priorizando lo que hace más tiempo que no se toca.
          vuelta += 1;
          cola.push(...orden);
          restanteTemaActual = costeTema(cola[0]);
        }
        const n = cola[0];
        const t = porNumero.get(n)!;
        let asignado = Math.min(restanteTemaActual, restante);
        // Si al tema le fuera a quedar un resto ridículo, se termina hoy aunque
        // el día se pase un poco: vale más eso que una sesión de trece minutos.
        const sobraria = restanteTemaActual - asignado;
        if (sobraria > 0 && sobraria < MIN_SESION) asignado = restanteTemaActual;
        const total = costeTema(n);
        const yaHecho = total - restanteTemaActual;
        const parte = yaHecho > 0 ? " (continuación)" : "";
        sesiones.push({
          fecha, tipo: "estudio", temaNumero: n,
          titulo: `Tema ${n}. ${t.titulo}${parte}`,
          minutos: asignado,
          motivo: `${t.bloque} · ${vuelta}.ª vuelta · ${Math.round(((yaHecho + asignado) / total) * 100)} % del tema`,
        });
        restante -= asignado;
        restanteTemaActual -= asignado;
        if (restanteTemaActual <= 0) {
          cola.shift();
          if (vuelta === 1) {
            repasosPendientes.push({ fecha: sumaDias(fecha, INTERVALOS[0]), tema: n, ronda: 0 });
          }
          restanteTemaActual = cola.length ? costeTema(cola[0]) : 0;
        }
      }
    }
    fecha = sumaDias(fecha, 1);
  }

  return sesiones;
}

export interface ResumenPlan {
  totalSesiones: number;
  minutosTotales: number;
  temasCubiertos: number;
  fechaUltimoTemaNuevo: string | null;
  cubreTemario: boolean;
  minutosSemanalesMedios: number;
}

export function resumirPlan(sesiones: SesionPlan[], inicio: string, prueba: string): ResumenPlan {
  const estudio = sesiones.filter((s) => s.tipo === "estudio");
  const primeraVuelta = estudio.filter((s) => s.motivo.includes("1.ª vuelta"));
  const temas = new Set(primeraVuelta.map((s) => s.temaNumero));
  const minutos = sesiones.reduce((a, s) => a + s.minutos, 0);
  const semanas = Math.max(1, diasEntre(inicio, prueba) / 7);
  return {
    totalSesiones: sesiones.length,
    minutosTotales: minutos,
    temasCubiertos: temas.size,
    fechaUltimoTemaNuevo: primeraVuelta.length ? primeraVuelta[primeraVuelta.length - 1].fecha : null,
    cubreTemario: temas.size >= 71,
    minutosSemanalesMedios: Math.round(minutos / semanas),
  };
}

/**
 * Horas semanales mínimas para completar la primera vuelta a los 71 temas
 * antes de una fecha límite (por defecto, el final de la fase 2).
 */
export function ritmoMinimoSemanal(temario: Temario, inicio: string, limite: string): number {
  const esfuerzo = temario.temas.reduce((a, t) => a + esfuerzoTema(t), 0);
  const repasos = temario.temas.length * (30 + 25 + 20);
  const semanas = Math.max(1, diasEntre(inicio, limite) / 7);
  return Math.round(((esfuerzo + repasos) / semanas / 60) * 10) / 10;
}
