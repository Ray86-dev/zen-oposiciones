"use client";

/** Voces en español que trae Kokoro v1.0. */
export const VOCES_KOKORO = [
  { id: "ef_dora", nombre: "Dora", nota: "Femenina, española" },
  { id: "em_alex", nombre: "Alex", nota: "Masculina, española" },
  { id: "em_santa", nombre: "Santa", nota: "Masculina, más grave" },
] as const;

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export interface EstadoKokoro {
  fase: "apagado" | "cargando" | "listo" | "error";
  pct: number;
  mb: number;
  device: string;
  mensaje: string;
}

/**
 * Envuelve el worker: expone cargar() y generar() con promesas,
 * y avisa del progreso de descarga del modelo.
 */
export class MotorKokoro {
  private worker: Worker | null = null;
  private pendientes = new Map<number, { ok: (b: Blob) => void; mal: (e: Error) => void }>();
  private siguienteId = 1;
  private alEstado: (e: Partial<EstadoKokoro>) => void;

  constructor(alEstado: (e: Partial<EstadoKokoro>) => void) {
    this.alEstado = alEstado;
  }

  private arrancar() {
    if (this.worker) return this.worker;
    this.worker = new Worker(`${BASE_PATH}/kokoro.worker.js`, { type: "module" });
    this.worker.onmessage = (ev: MessageEvent) => {
      const d = ev.data;
      if (d.tipo === "progreso") {
        this.alEstado({ fase: "cargando", pct: d.pct, mb: d.mb });
      } else if (d.tipo === "listo") {
        this.alEstado({ fase: "listo", pct: 100, device: d.device });
      } else if (d.tipo === "audio") {
        this.pendientes.get(d.id)?.ok(d.blob);
        this.pendientes.delete(d.id);
      } else if (d.tipo === "error") {
        if (d.id != null) {
          this.pendientes.get(d.id)?.mal(new Error(d.mensaje));
          this.pendientes.delete(d.id);
        } else {
          this.alEstado({ fase: "error", mensaje: d.mensaje });
        }
      }
    };
    this.worker.onerror = () => {
      this.alEstado({ fase: "error", mensaje: "No se ha podido cargar el motor de voz." });
    };
    return this.worker;
  }

  cargar(calidad: "normal" | "alta" = "normal") {
    this.alEstado({ fase: "cargando", pct: 0 });
    this.arrancar().postMessage({ tipo: "cargar", calidad });
  }

  generar(texto: string, voz: string, velocidad: number, calidad: "normal" | "alta" = "normal"): Promise<Blob> {
    const id = this.siguienteId++;
    return new Promise((ok, mal) => {
      this.pendientes.set(id, { ok, mal });
      this.arrancar().postMessage({ tipo: "generar", id, texto, voz, velocidad, calidad });
    });
  }

  destruir() {
    this.worker?.terminate();
    this.worker = null;
    this.pendientes.clear();
  }
}

/** ¿Tiene el navegador aceleración por GPU? Sin ella la síntesis va lenta. */
export function hayWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}
