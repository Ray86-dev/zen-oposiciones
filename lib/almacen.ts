"use client";
import { EstadoTema, ProgresoTema, Disponibilidad } from "./tipos";
import { DISPONIBILIDAD_POR_DEFECTO } from "./plan";
import { sabadoPrueba } from "./fechas";

export interface EstadoApp {
  fechaInicio: string;
  fechaPrueba: string;
  disponibilidad: Disponibilidad;
  progreso: Record<number, ProgresoTema>;
  /**
   * Temas que van por delante del orden automático, en este orden. Es lo que
   * escribes cuando eliges tú qué estudiar hoy; se vacía solo al consolidar
   * el tema.
   */
  prioridad: number[];
  sesionesHechas: { fecha: string; minutos: number; tipo: string; tema?: number }[];
  intentos: { id: string; supuesto: string; fecha: string; minutos: number; nota: number | null; marcados: string[] }[];
}

const CLAVE = "zen-oposiciones-v1";

export function estadoInicial(): EstadoApp {
  return {
    fechaInicio: hoy(),
    fechaPrueba: sabadoPrueba(2027),
    disponibilidad: DISPONIBILIDAD_POR_DEFECTO,
    progreso: {},
    prioridad: [],
    sesionesHechas: [],
    intentos: [],
  };
}

export function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function cargar(): EstadoApp {
  if (typeof window === "undefined") return estadoInicial();
  try {
    const raw = window.localStorage.getItem(CLAVE);
    if (!raw) return estadoInicial();
    return { ...estadoInicial(), ...JSON.parse(raw) };
  } catch {
    return estadoInicial();
  }
}

export function guardar(e: EstadoApp) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(e));
  } catch {
    /* cuota llena: el plan se sigue calculando en memoria */
  }
}

export function progresoDe(e: EstadoApp, numero: number): ProgresoTema {
  return (
    e.progreso[numero] ?? {
      numero, estado: "pendiente" as EstadoTema, vueltas: 0,
      ultimoRepaso: null, minutosInvertidos: 0, confianza: 0, notas: "",
    }
  );
}
