/*
 * Worker de sintesis Piper (modelos VITS sobre ONNX Runtime).
 *
 * Por que existe este fichero: `predict()` de @diffusionstudio/vits-web crea una
 * InferenceSession NUEVA en cada llamada (lee los ~60 MB del modelo desde OPFS y
 * los copia al heap de WebAssembly) y nunca la libera. El heap de wasm crece pero
 * no se encoge, asi que tras 40-45 frases la reserva falla con
 *   "Can't create a session. failed to allocate a buffer of size 63201294"
 * y la lectura se detiene en seco.
 *
 * Aqui la sesion se crea UNA sola vez por voz y se reutiliza para todas las
 * frases: la memoria se queda plana y cada trozo tarda una fraccion de lo que
 * tardaba. Ademas va en un worker, asi que la sintesis no bloquea la interfaz.
 */

const ORT_ESM = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/+esm";
const ORT_WASM = "https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/";
// Fonemizador de espeak-ng compilado a wasm; lo publica el propio vits-web.
const FONEMIZADOR = "https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/dist/piper-DeOu3H9E.js";
const PIPER_WASM = "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize";

const PAUSA_ENTRE_FRASES = 0.14;   // segundos de silencio al unir frases

let ort = null;
let crearFonemizador = null;
let sesion = null;
let sesionVoz = null;
const configs = new Map();

let cola = Promise.resolve();
let epoca = 0;

async function moduloOrt() {
  if (!ort) {
    const m = await import(ORT_ESM);
    m.env.allowLocalModels = false;
    m.env.wasm.wasmPaths = ORT_WASM;
    // Sin cross-origin isolation no hay SharedArrayBuffer: pedir mas hilos solo
    // genera avisos y un camino de codigo que no se va a usar.
    m.env.wasm.numThreads = 1;
    ort = m;
  }
  return ort;
}

async function moduloFonemizador() {
  if (!crearFonemizador) {
    const m = await import(FONEMIZADOR);
    crearFonemizador = m.createPiperPhonemize;
  }
  return crearFonemizador;
}

async function ficheroOpfs(nombre) {
  const raiz = await navigator.storage.getDirectory();
  const dir = await raiz.getDirectoryHandle("piper", { create: true });
  return (await dir.getFileHandle(nombre)).getFile();
}

async function configDe(vozId) {
  let c = configs.get(vozId);
  if (!c) {
    c = JSON.parse(await (await ficheroOpfs(vozId + ".onnx.json")).text());
    configs.set(vozId, c);
  }
  return c;
}

async function liberarSesion() {
  const s = sesion;
  sesion = null;
  sesionVoz = null;
  if (s) { try { await s.release(); } catch { /* ya estaba fuera */ } }
}

/** La sesion se crea una vez por voz. Cambiar de voz libera la anterior. */
async function sesionDe(vozId) {
  if (sesion && sesionVoz === vozId) return sesion;
  await liberarSesion();
  const o = await moduloOrt();
  const datos = await (await ficheroOpfs(vozId + ".onnx")).arrayBuffer();
  sesion = await o.InferenceSession.create(datos);
  sesionVoz = vozId;
  return sesion;
}

/**
 * Devuelve una lista de secuencias de fonemas: una por frase que detecte espeak.
 * vits-web se quedaba solo con la primera linea impresa, asi que un trozo con dos
 * frases ("Kant nacio en 1724. 1804 fue su muerte.") perdia la segunda sin avisar.
 */
async function fonemizar(texto, cfg) {
  const crear = await moduloFonemizador();
  const grupos = [];
  const errores = [];
  const modulo = await crear({
    print: (linea) => {
      try {
        const ids = JSON.parse(linea).phoneme_ids;
        if (ids && ids.length) grupos.push(ids);
      } catch { /* linea que no es json: se ignora */ }
    },
    printErr: (linea) => { errores.push(String(linea)); },
    locateFile: (f) =>
      f.endsWith(".wasm") ? PIPER_WASM + ".wasm"
      : f.endsWith(".data") ? PIPER_WASM + ".data"
      : f,
  });
  try {
    modulo.callMain([
      "-l", cfg.espeak.voice,
      "--input", JSON.stringify([{ text: texto.trim() }]),
      "--espeak_data", "/espeak-ng-data",
    ]);
  } catch (e) {
    // Emscripten lanza ExitStatus al terminar main. Solo es un problema real
    // si ademas no hemos recogido ningun fonema.
    if (!grupos.length) throw e;
  }
  if (!grupos.length) {
    throw new Error(errores.join(" ").trim() || "El fonemizador no devolvio nada.");
  }
  return grupos;
}

/** Une varios tramos de audio (float -1..1) en un WAV PCM de 16 bits. */
function aWav(tramos, frecuencia) {
  const silencio = Math.round(frecuencia * PAUSA_ENTRE_FRASES);
  let muestras = 0;
  for (let i = 0; i < tramos.length; i++) {
    muestras += tramos[i].length + (i < tramos.length - 1 ? silencio : 0);
  }
  const cabecera = 44;
  const vista = new DataView(new ArrayBuffer(cabecera + muestras * 2));
  vista.setUint32(0, 0x46464952, true);                 // "RIFF"
  vista.setUint32(4, vista.buffer.byteLength - 8, true);
  vista.setUint32(8, 0x45564157, true);                 // "WAVE"
  vista.setUint32(12, 0x20746d66, true);                // "fmt "
  vista.setUint32(16, 16, true);
  vista.setUint16(20, 1, true);                         // PCM
  vista.setUint16(22, 1, true);                         // mono
  vista.setUint32(24, frecuencia, true);
  vista.setUint32(28, frecuencia * 2, true);
  vista.setUint16(32, 2, true);
  vista.setUint16(34, 16, true);
  vista.setUint32(36, 0x61746164, true);                // "data"
  vista.setUint32(40, muestras * 2, true);
  let pos = cabecera;
  for (let i = 0; i < tramos.length; i++) {
    const t = tramos[i];
    for (let j = 0; j < t.length; j++) {
      const v = t[j];
      vista.setInt16(pos, v >= 1 ? 32767 : v <= -1 ? -32768 : (v * 32768) | 0, true);
      pos += 2;
    }
    if (i < tramos.length - 1) pos += silencio * 2;     // el buffer ya viene a cero
  }
  return vista.buffer;
}

async function sintetizar(texto, vozId) {
  const cfg = await configDe(vozId);
  const ses = await sesionDe(vozId);
  const o = await moduloOrt();
  const grupos = await fonemizar(texto, cfg);
  const conLocutor = Object.keys(cfg.speaker_id_map ?? {}).length > 0;
  const tramos = [];
  for (const ids of grupos) {
    const entradas = {
      input: new o.Tensor("int64", ids, [1, ids.length]),
      input_lengths: new o.Tensor("int64", [ids.length]),
      scales: new o.Tensor("float32", [
        cfg.inference.noise_scale, cfg.inference.length_scale, cfg.inference.noise_w,
      ]),
    };
    if (conLocutor) entradas.sid = new o.Tensor("int64", [0]);
    const salida = await ses.run(entradas);
    tramos.push(salida.output.data);
  }
  return aWav(tramos, cfg.audio.sample_rate);
}

function esFalloDeMemoria(e) {
  const m = String((e && e.message) || e).toLowerCase();
  return m.includes("allocate") || m.includes("memory") || m.includes("buffer");
}

self.onmessage = (ev) => {
  const m = ev.data || {};

  if (m.tipo === "cancelar") { epoca += 1; return; }
  if (m.tipo === "liberar") {
    epoca += 1;
    cola = cola.then(liberarSesion).catch(() => {});
    return;
  }
  if (m.tipo !== "sintetizar") return;

  const mia = epoca;
  cola = cola.then(async () => {
    if (mia !== epoca) { self.postMessage({ tipo: "cancelado", id: m.id }); return; }
    try {
      const wav = await sintetizar(m.texto, m.vozId);
      self.postMessage({ tipo: "ok", id: m.id, wav }, [wav]);
    } catch (e) {
      // Si el fallo huele a memoria, tiramos la sesion para que el siguiente
      // intento empiece limpio en vez de arrastrar el problema.
      if (esFalloDeMemoria(e)) await liberarSesion();
      self.postMessage({
        tipo: "error", id: m.id,
        mensaje: String((e && e.message) || e),
      });
    }
  });
};
