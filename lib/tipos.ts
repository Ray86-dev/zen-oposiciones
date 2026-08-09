export type EstadoTema =
  | "pendiente" | "leido" | "esquematizado" | "memorizado" | "dominado";

export const ESTADOS: { id: EstadoTema; label: string; peso: number; color: string }[] = [
  { id: "pendiente",     label: "Pendiente",     peso: 0,    color: "#52525b" },
  { id: "leido",         label: "Leído",         peso: 0.2,  color: "#a16207" },
  { id: "esquematizado", label: "Esquematizado", peso: 0.45, color: "#ca8a04" },
  { id: "memorizado",    label: "Memorizado",    peso: 0.75, color: "#16a34a" },
  { id: "dominado",      label: "Dominado",      peso: 1,    color: "#059669" },
];

export interface MaterialTema {
  driveId: string; titulo: string; bytes: number; modificado: string; url: string;
}
export interface Tema {
  numero: number; titulo: string; bloqueId: string; bloque: string;
  tieneMaterial: boolean; material: MaterialTema[];
  bytesTexto: number; ultimaActualizacion: string | null;
}
export interface Bloque {
  id: string; nombre: string; desde: number; hasta: number; numTemas: number;
}
export interface Temario {
  especialidad: {
    codigo: string; nombre: string; cuerpo: string; cuerpoNombre: string;
    comunidad: string; normaTemario: string;
    numeroTemas: number; temasSorteados: number;
  };
  bloques: Bloque[];
  temas: Tema[];
}

export interface ProgresoTema {
  numero: number;
  estado: EstadoTema;
  vueltas: number;
  ultimoRepaso: string | null;
  minutosInvertidos: number;
  confianza: number;
  notas: string;
}

export interface Disponibilidad {
  /** minutos por día de la semana (índice 0 = domingo) */
  porDiaSemana: number[];
  /** ajustes puntuales por fecha ISO (sobrescriben el día de la semana) */
  excepciones: Record<string, number>;
}

export type TipoSesion = "estudio" | "repaso" | "supuesto" | "ud" | "hito";

export interface SesionPlan {
  fecha: string;
  tipo: TipoSesion;
  temaNumero?: number;
  titulo: string;
  minutos: number;
  motivo: string;
}

export interface Fase {
  id: string; nombre: string; desde: string; hasta: string; objetivo: string;
}
