"use client";
import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
import { EstadoApp, cargar, guardar, estadoInicial, progresoDe } from "@/lib/almacen";
import { EstadoTema, Temario, SesionPlan } from "@/lib/tipos";
import { generarPlan, resumirPlan } from "@/lib/plan";
import temarioJson from "@/data/temario-filosofia.json";

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
  registrarSesion: (minutos: number, tipo: string, tema?: number) => void;
}

const C = createContext<Ctx | null>(null);

export function Proveedor({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoApp>(estadoInicial);
  const [listo, setListo] = useState(false);

  useEffect(() => { setEstado(cargar()); setListo(true); }, []);
  useEffect(() => { if (listo) guardar(estado); }, [estado, listo]);

  const plan = useMemo(
    () => generarPlan({
      inicio: estado.fechaInicio,
      prueba: estado.fechaPrueba,
      disponibilidad: estado.disponibilidad,
      temario,
      progreso: estado.progreso,
    }),
    [estado.fechaInicio, estado.fechaPrueba, estado.disponibilidad, estado.progreso]
  );

  const resumen = useMemo(
    () => resumirPlan(plan, estado.fechaInicio, estado.fechaPrueba),
    [plan, estado.fechaInicio, estado.fechaPrueba]
  );

  const valor: Ctx = {
    estado, temario, plan, resumen, listo,
    actualizar: (parcial) => setEstado((e) => ({ ...e, ...parcial })),
    fijarEstadoTema: (numero, nuevo) =>
      setEstado((e) => {
        const p = progresoDe(e, numero);
        return {
          ...e,
          progreso: {
            ...e.progreso,
            [numero]: {
              ...p, estado: nuevo,
              vueltas: nuevo === "dominado" ? Math.max(1, p.vueltas) : p.vueltas,
            },
          },
        };
      }),
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
