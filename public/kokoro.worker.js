/**
 * Sintetiza voz con Kokoro (82M parámetros, Apache 2.0) dentro del navegador.
 * Ni servidor, ni clave, ni cuota: el modelo se descarga una vez y se queda
 * en la caché del navegador.
 *
 * Va en un worker porque la inferencia bloquearía la interfaz.
 * Importa desde CDN para no arrastrar ONNX y WebAssembly al empaquetado.
 */
import { KokoroTTS } from "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm";

const MODELO = "onnx-community/Kokoro-82M-v1.0-ONNX";
let tts = null;
let cargando = null;

async function cargar(calidad) {
  if (tts) return tts;
  if (cargando) return cargando;

  const hayWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
  const device = hayWebGPU ? "webgpu" : "wasm";
  const dtype = calidad === "alta" ? (hayWebGPU ? "fp32" : "q8") : "q8";

  cargando = KokoroTTS.from_pretrained(MODELO, {
    dtype,
    device,
    progress_callback: (p) => {
      if (p?.status === "progress" && p.total) {
        self.postMessage({
          tipo: "progreso",
          archivo: p.file,
          pct: Math.round((p.loaded / p.total) * 100),
          mb: Math.round(p.total / 1048576),
        });
      }
    },
  }).then((m) => {
    tts = m;
    cargando = null;
    self.postMessage({ tipo: "listo", device, dtype, voces: Object.keys(m.voices ?? {}) });
    return m;
  }).catch((e) => {
    cargando = null;
    self.postMessage({ tipo: "error", mensaje: String(e?.message ?? e) });
    throw e;
  });

  return cargando;
}

self.onmessage = async (ev) => {
  const { tipo } = ev.data;
  try {
    if (tipo === "cargar") {
      await cargar(ev.data.calidad);
      return;
    }
    if (tipo === "generar") {
      const { id, texto, voz, velocidad } = ev.data;
      const modelo = await cargar(ev.data.calidad);
      const audio = await modelo.generate(texto, { voice: voz, speed: velocidad ?? 1 });
      const blob = audio.toBlob();
      self.postMessage({ tipo: "audio", id, blob });
      return;
    }
  } catch (e) {
    self.postMessage({ tipo: "error", id: ev.data?.id, mensaje: String(e?.message ?? e) });
  }
};
