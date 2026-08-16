/**
 * Regresión: el volumen elegido con el deslizador debe sobrevivir a los saltos
 * de fragmento. Historial: se reseteaba al valor que había al pulsar reproducir.
 * Se ejecuta con `npm run prueba-volumen`.
 */
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).Element = dom.window.Element;
(globalThis as any).Node = dom.window.Node;
(globalThis as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
(globalThis as any).self = dom.window;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// --- Audio falso: el proveedor reutiliza UN solo elemento ---
class AudioFalso {
  static instancias: AudioFalso[] = [];
  volume = 1; playbackRate = 1; src = ""; onended: (() => void) | null = null;
  constructor() { AudioFalso.instancias.push(this); }
  play() { return Promise.resolve(); }
  pause() {}
  removeAttribute() { this.src = ""; }
}
(globalThis as any).Audio = AudioFalso;
(URL as any).createObjectURL = () => "blob:falso";
(URL as any).revokeObjectURL = () => {};

// --- Sintesis del sistema falsa ---
const habladas: any[] = [];
class UtteranceFalsa {
  volume = 1; rate = 1; lang = ""; voice: any = null;
  onend: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(public text: string) {}
}
(globalThis as any).SpeechSynthesisUtterance = UtteranceFalsa;
(dom.window as any).SpeechSynthesisUtterance = UtteranceFalsa;
(dom.window as any).speechSynthesis = {
  speaking: false, paused: false,
  speak(u: any) { habladas.push(u); },
  cancel() {}, pause() {}, resume() {},
  getVoices() { return []; },
  addEventListener() {}, removeEventListener() {},
};

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

const Module = require("module");
const _resolve = Module._resolveFilename;
Module._resolveFilename = function (req: string, ...rest: any[]) {
  if (req === "@/lib/vozNeuronal") return require.resolve("./test-stubs/vozNeuronal.js");
  return _resolve.call(this, req, ...rest);
};

const { ProveedorVoz, useVoz } = require("./components/ProveedorVoz");

let ctx: any = null;
function Espia() { ctx = useVoz(); return null; }

const BLOQUES = [
  "<p>Primera frase del tema. Segunda frase del tema. Tercera frase del tema.</p>",
  "<p>Cuarta frase del tema. Quinta frase del tema. Sexta frase del tema.</p>",
];

async function flush() {
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
}

let fallos = 0;
function comprobar(nombre: string, real: number, esperado: number) {
  const ok = Math.abs(real - esperado) < 1e-6;
  console.log(`  ${ok ? "OK  " : "FALLO"} ${nombre.padEnd(46)} volumen=${real} (esperado ${esperado})`);
  if (!ok) fallos++;
}

async function montar() {
  const el = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => {
    root.render(React.createElement(ProveedorVoz, null, React.createElement(Espia)));
  });
  return root;
}

(async () => {
  // ================= MOTOR NEURONAL =================
  console.log("\nMotor neuronal (elemento <audio>)");
  let root = await montar();
  await act(async () => { ctx.cambiar({ motor: "neuronal", vozNeuronal: "es_ES-sharvard-medium" }); });
  await act(async () => { ctx.cargarTema(1, "Tema de prueba", BLOQUES); });
  await act(async () => { ctx.cambiar({ volumen: 0.05 }); });
  await act(async () => { ctx.reproducir(); });
  await flush();

  const a = AudioFalso.instancias[0];
  if (!a) { console.log("  FALLO: no se creo ningun elemento de audio"); fallos++; }
  else {
    comprobar("fragmento 1 arranca al 5%", a.volume, 0.05);
    await act(async () => { ctx.cambiar({ volumen: 0.30 }); });
    comprobar("subir a 30% se aplica en caliente", a.volume, 0.30);
    await act(async () => { a.onended?.(); });
    await flush();
    comprobar("fragmento 2 mantiene el 30%", a.volume, 0.30);
    await act(async () => { a.onended?.(); });
    await flush();
    comprobar("fragmento 3 mantiene el 30%", a.volume, 0.30);
    await act(async () => { ctx.saltar(1); });
    await flush();
    comprobar("tras saltar mantiene el 30%", a.volume, 0.30);
  }
  await act(async () => { root.unmount(); });

  // ================= VOZ DEL SISTEMA =================
  console.log("\nVoz del sistema (SpeechSynthesisUtterance)");
  habladas.length = 0;
  dom.window.localStorage.clear();   // el test anterior dejo motor:neuronal guardado
  root = await montar();
  await act(async () => { ctx.cargarTema(2, "Tema de prueba", BLOQUES); });
  await act(async () => { ctx.cambiar({ volumen: 0.05 }); });
  await act(async () => { ctx.reproducir(); });
  await flush();

  if (!habladas[0]) { console.log("  FALLO: no se lanzo ninguna locucion"); fallos++; }
  else {
    comprobar("locucion 1 arranca al 5%", habladas[0].volume, 0.05);
    await act(async () => { ctx.cambiar({ volumen: 0.30 }); });
    await act(async () => { habladas[0].onend?.(); });
    await flush();
    comprobar("locucion 2 usa el 30%", habladas[1]?.volume ?? -1, 0.30);
    await act(async () => { habladas[1].onend?.(); });
    await flush();
    comprobar("locucion 3 usa el 30%", habladas[2]?.volume ?? -1, 0.30);
  }
  await act(async () => { root.unmount(); });

  console.log(fallos === 0 ? "\nVOLUMEN CORRECTO" : `\n${fallos} COMPROBACIONES FALLAN`);
  process.exit(fallos ? 1 : 0);
})();
