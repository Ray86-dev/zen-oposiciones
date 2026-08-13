"use client";
import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
import { EstadoApp, cargar, guardar, estadoInicial, progresoDe, hoy } from "@/lib/almacen";
import { EstadoTema, Temario, SesionPlan } from "@/lib/tipos";
import { generarPlan, resumirPlan, CONSOLIDADOS } from "@/lib/plan";
import temarioJson from "@/data/temario-filosofia.json";
import { useSesion } from "@/components/Sesion";
import { db, temarioId } from "@/lib/supabase";

const temario = temarioJson as unknown as Temario;

interface Ctx {
  estado: EstadoApp;
  temario: Temario;
  plan: SesionPlan[];
  resumen: ReturnType<typeof resumirPlan>;
  listo: boolean;
  actualizar: (parcial: Partial<EstadoApp>) => void;
  fijarEstadoTema: (numero: number, estado: EstadoTema) => void;
  fijarConfianza: (numero: number, confianza: number) => void;
  /** Pone un tema a la cabeza de la cola y recalcula el plan desde hoy. */
  elegirTema: (numero: number) => void;
  /** Lo devuelve al orden automático. */
  soltarTema: (numero: number) => void;
  registrarSesion: (minutos: number, tipo: string, tema?: number) => void;
  recargarProgreso: () => Promise<void>;
}

const C = createContext<Ctx | null>(null);

export function Proveedor({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoApp>(estadoInicial);
  const [listo, setListo] = useState(false);
  const { usuario } = useSesion();

  useEffect(() => { setEstado(cargar()); setListo(true); }, []);
  useEffect(() => { if (listo) guardar(estado); }, [estado, listo]);

  // Al iniciar sesión, el progreso guardado en la nube manda sobre el local.
  useEffect(() => {
    if (!usuario || !listo) return;
    let vivo = true;
    (async () => {
      const c = db(); const tid = await temarioId();
      if (!c || !tid) return;
      const [{ data: filas }, { data: plan }] = await Promise.all([
        c.from("progreso_temas").select("*").eq("temario_id", tid),
        c.from("planes").select("*").eq("temario_id", tid).maybeSingle(),
      ]);
      if (!vivo) return;
      setEstado((e) => {
        const progreso = { ...e.progreso };
        for (const f of filas ?? []) {
          progreso[f.tema_numero] = {
            numero: f.tema_numero, estado: f.estado, vueltas: f.vueltas,
            ultimoRepaso: f.ultimo_repaso, minutosInvertidos: f.minutos_invertidos,
            confianza: f.confianza ?? 0, notas: f.notas ?? "",
          };
        }
        return {
          ...e, progreso,
          fechaInicio: plan?.fecha_inicio ?? e.fechaInicio,
          fechaPrueba: plan?.fecha_prueba ?? e.fechaPrueba,
          disponibilidad: plan?.disponibilidad ?? e.disponibilidad,
        };
      });
    })();
    return () => { vivo = false; };
  }, [usuario, listo]);

  /**
   * El plan se simula desde hoy, no desde la fecha de inicio. Los días que
   * pasan sin estudiar ya no consumen cola: lo pendiente sigue pendiente y lo
   * que se mueve es la fecha de fin, que es lo único que puede moverse.
   * Antes de la hidratación se ancla al inicio para que servidor y cliente
   * rendericen lo mismo.
   */
  const ancla = listo ? hoy() : estado.fechaInicio;

  const plan = useMemo(
    () => generarPlan({
      inicio: estado.fechaInicio,
      prueba: estado.fechaPrueba,
      disponibilidad: estado.disponibilidad,
      temario,
      progreso: estado.progreso,
      ancla,
      prioridad: estado.prioridad,
    }),
    [estado.fechaInicio, estado.fechaPrueba, estado.disponibilidad, estado.progreso, estado.prioridad, ancla]
  );

  const resumen = useMemo(
    () => resumirPlan(plan, ancla, estado.fechaPrueba),
    [plan, ancla, estado.fechaPrueba]
  );

  /** Envía un tema a la nube. Si no hay sesión, no hace nada: queda en local. */
  const sincronizarTema = async (numero: number, p: ReturnType<typeof progresoDe>) => {
    if (!usuario) return;
    const c = db(); const tid = await temarioId();
    if (!c || !tid) return;
    await c.from("progreso_temas").upsert({
      user_id: usuario.id, temario_id: tid, tema_numero: numero,
      estado: p.estado, vueltas: p.vueltas, ultimo_repaso: p.ultimoRepaso,
      minutos_invertidos: p.minutosInvertidos,
      confianza: p.confianza || null, notas: p.notas,
    }, { onConflict: "user_id,temario_id,tema_numero" });
  };

  const sincronizarPlan = async (e: EstadoApp) => {
    if (!usuario) return;
    const c = db(); const tid = await temarioId();
    if (!c || !tid) return;
    await c.from("planes").upsert({
      user_id: usuario.id, temario_id: tid,
      fecha_inicio: e.fechaInicio, fecha_prueba: e.fechaPrueba,
      disponibilidad: e.disponibilidad,
    }, { onConflict: "user_id,temario_id" });
  };

  const valor: Ctx = {
    estado, temario, plan, resumen, listo,
    recargarProgreso: async () => {
      if (!usuario) return;
      const c = db(); const tid = await temarioId();
      if (!c || !tid) return;
      const { data } = await c.from("progreso_temas").select("*").eq("temario_id", tid);
      setEstado((e) => {
        const progreso = { ...e.progreso };
        for (const f of data ?? []) {
          progreso[f.tema_numero] = {
            numero: f.tema_numero, estado: f.estado, vueltas: f.vueltas,
            ultimoRepaso: f.ultimo_repaso, minutosInvertidos: f.minutos_invertidos,
            confianza: f.confianza ?? 0, notas: f.notas ?? "",
          };
        }
        return { ...e, progreso };
      });
    },
    actualizar: (parcial) => setEstado((e) => {
      const nuevo = { ...e, ...parcial };
      if (parcial.fechaInicio || parcial.fechaPrueba || parcial.disponibilidad) {
        void sincronizarPlan(nuevo);
      }
      return nuevo;
    }),
    fijarEstadoTema: (numero, nuevo) =>
      setEstado((e) => {
        const p = progresoDe(e, numero);
        const actualizado = {
          ...p, estado: nuevo,
          vueltas: nuevo === "dominado" ? Math.max(1, p.vueltas) : p.vueltas,
        };
        void sincronizarTema(numero, actualizado);
        // Un tema consolidado ya no necesita ir por delante: sale de la cola manual.
        const prioridad = CONSOLIDADOS.includes(nuevo)
          ? e.prioridad.filter((n) => n !== numero)
          : e.prioridad;
        return { ...e, prioridad, progreso: { ...e.progreso, [numero]: actualizado } };
      }),
    elegirTema: (numero) =>
      setEstado((e) => ({
        ...e,
        prioridad: [numero, ...e.prioridad.filter((n) => n !== numero)].slice(0, 8),
      })),
    soltarTema: (numero) =>
      setEstado((e) => ({ ...e, prioridad: e.prioridad.filter((n) => n !== numero) })),
    fijarConfianza: (numero, confianza) =>
      setEstado((e) => ({
        ...e,
        progreso: { ...e.progreso, [numero]: { ...progresoDe(e, numero), confianza } },
      })),
    registrarSesion: (minutos, tipo, tema) =>
      setEstado((e) => {
        const fecha = new Date().toISOString().slice(0, 10);
        const progreso = { ...e.progreso };
        if (tema != null) {
          const p = progresoDe(e, tema);
          progreso[tema] = {
            ...p,
            minutosInvertidos: p.minutosInvertidos + minutos,
            ultimoRepaso: fecha,
          };
        }
        return { ...e, progreso, sesionesHechas: [...e.sesionesHechas, { fecha, minutos, tipo, tema }] };
      }),
  };

  return <C.Provider value={valor}>{children}</C.Provider>;
}

export function useApp() {
  const c = useContext(C);
  if (!c) throw new Error("useApp fuera del Proveedor");
  return c;
}
