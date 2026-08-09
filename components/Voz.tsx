"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  trocearParaVoz, limpiarParaVoz, cargarPrefsVoz, guardarPrefsVoz, PrefsVoz, VOZ_POR_DEFECTO,
} from "@/lib/voz";
import { VOCES_ES, EstadoVoz, sintetizar, descargarVoz, vocesDescargadas } from "@/lib/vozNeuronal";

export default function Voz({
  bloques, alCambiarBloque, cerrar,
}: { bloques: string[]; alCambiarBloque: (i: number) => void; cerrar: () => void }) {
  const [trozos] = useState(() => trocearParaVoz(bloques));
  const [i, setI] = useState(0);
  /** parado | sonando | pausado. Derivado de lo que realmente suena. */
  const [estado, setEstado] = useState<"parado" | "sonando" | "pausado">("parado");
  const [ajustes, setAjustes] = useState(false);
  const [prefs, setPrefs] = useState<PrefsVoz>(VOZ_POR_DEFECTO);
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);
  const [neuronal, setNeuronal] = useState<EstadoVoz>({ fase: "apagado", pct: 0, mensaje: "" });
  const [descargadas, setDescargadas] = useState<string[]>([]);

  const iRef = useRef(0);
  const sonandoRef = useRef(false);
  /**
   * Cada arranque, parada o salto incrementa la epoca. Las cadenas asincronas
   * capturan la suya y se abortan si ha cambiado: sin esto, cambiar de voz
   * mientras se sintetiza una frase dejaba dos reproducciones vivas a la vez.
   */
  const epoca = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const cache = useRef<Map<number, Blob>>(new Map());

  const prefsRef = useRef<PrefsVoz>(VOZ_POR_DEFECTO);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);
  useEffect(() => { setPrefs(cargarPrefsVoz()); }, []);
  useEffect(() => { iRef.current = i; }, [i]);
  useEffect(() => { sonandoRef.current = estado === "sonando"; }, [estado]);
  useEffect(() => { void vocesDescargadas().then(setDescargadas); }, []);

  useEffect(() => {
    const leer = () => {
      const v = window.speechSynthesis.getVoices().filter((x) => x.lang.toLowerCase().startsWith("es"));
      setVoces(v.length ? v : window.speechSynthesis.getVoices());
    };
    leer();
    window.speechSynthesis.addEventListener("voiceschanged", leer);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", leer);
  }, []);

  const detener = useCallback((volverAlInicio = false) => {
    epoca.current += 1;               // invalida cualquier cadena en vuelo
    if (volverAlInicio) { iRef.current = 0; setI(0); }
    sonandoRef.current = false;
    setEstado("parado");
    window.speechSynthesis.cancel();
    if (audio.current) { audio.current.pause(); audio.current.removeAttribute("src"); }
  }, []);

  /** Pausa sin perder el sitio. */
  const pausar = useCallback(() => {
    sonandoRef.current = false;
    setEstado("pausado");
    if (prefsRef.current.motor === "neuronal") audio.current?.pause();
    else window.speechSynthesis.pause();
  }, []);

  useEffect(() => () => { window.speechSynthesis.cancel(); }, []);

  useEffect(() => {
    if (estado !== "sonando" || prefs.motor !== "sistema") return;
    const t = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
    return () => clearInterval(t);
  }, [estado, prefs.motor]);

  // ------------------------------------------------------------- neuronal
  const pedirAudio = useCallback(async (idx: number, p: PrefsVoz): Promise<Blob> => {
    const guardado = cache.current.get(idx);
    if (guardado) return guardado;
    const b = await sintetizar(limpiarParaVoz(trozos[idx].texto), p.vozNeuronal);
    cache.current.set(idx, b);
    if (cache.current.size > 40) {
      const primera = cache.current.keys().next().value;
      if (primera !== undefined) cache.current.delete(primera);
    }
    return b;
  }, [trozos]);

  const sonarNeuronal = useCallback(async (idx: number, p: PrefsVoz, mi: number) => {
    if (idx >= trozos.length) { detener(); return; }
    let blob: Blob;
    try {
      blob = await pedirAudio(idx, p);
    } catch (e) {
      if (epoca.current !== mi) return;
      // Nunca fallar en silencio: fue el error que dejó a Kokoro mudo.
      setNeuronal({ fase: "error", pct: 0, mensaje: e instanceof Error ? e.message : "No se pudo sintetizar." });
      detener();
      return;
    }
    if (epoca.current !== mi || !sonandoRef.current) return;

    if (!audio.current) audio.current = new Audio();
    const el = audio.current;
    el.src = URL.createObjectURL(blob);
    el.playbackRate = p.velocidad;
    el.onended = () => {
      if (epoca.current !== mi || !sonandoRef.current) return;
      const sig = idx + 1;
      if (sig >= trozos.length) { detener(); return; }
      setI(sig);
      alCambiarBloque(trozos[sig].bloque);
      void sonarNeuronal(sig, p, mi);
    };
    try {
      await el.play();
    } catch {
      if (epoca.current !== mi) return;
      setNeuronal({
        fase: "error", pct: 0,
        mensaje: "El navegador ha bloqueado la reproducción. Vuelve a pulsar el botón de reproducir.",
      });
      detener();
      return;
    }
    // Adelanta las siguientes para que no haya silencios entre frases.
    void pedirAudio(idx + 1, p).catch(() => {});
    void pedirAudio(idx + 2, p).catch(() => {});
  }, [pedirAudio, trozos, alCambiarBloque, detener]);

  // -------------------------------------------------------------- sistema
  const sonarSistema = useCallback((idx: number, p: PrefsVoz, mi: number) => {
    const trozo = trozos[idx];
    if (!trozo) { detener(); return; }
    const u = new SpeechSynthesisUtterance(limpiarParaVoz(trozo.texto));
    const v = voces.find((x) => x.voiceURI === p.vozURI);
    if (v) u.voice = v;
    u.lang = v?.lang ?? "es-ES";
    u.rate = p.velocidad;
    u.onend = () => {
      if (epoca.current !== mi || !sonandoRef.current) return;
      const sig = idx + 1;
      if (sig >= trozos.length) { detener(); return; }
      setI(sig);
      alCambiarBloque(trozos[sig].bloque);
      sonarSistema(sig, p, mi);
    };
    u.onerror = () => detener();
    window.speechSynthesis.speak(u);
  }, [trozos, voces, detener, alCambiarBloque]);

  const reproducir = useCallback((p = prefsRef.current) => {
    // Corta lo anterior antes de nada: nunca dos voces a la vez.
    window.speechSynthesis.cancel();
    audio.current?.pause();
    const mi = ++epoca.current;
    sonandoRef.current = true;
    setEstado("sonando");
    setNeuronal((v) => (v.fase === "error" ? { fase: "apagado", pct: 0, mensaje: "" } : v));
    alCambiarBloque(trozos[iRef.current]?.bloque ?? 0);
    if (p.motor === "neuronal") void sonarNeuronal(iRef.current, p, mi);
    else sonarSistema(iRef.current, p, mi);
  }, [trozos, alCambiarBloque, sonarNeuronal, sonarSistema]);

  /** Reanuda desde donde se pausó, sin volver a sintetizar. */
  const reanudar = useCallback(() => {
    sonandoRef.current = true;
    setEstado("sonando");
    if (prefsRef.current.motor === "neuronal") {
      const el = audio.current;
      if (el && el.src) { void el.play().catch(() => reproducir()); }
      else reproducir();
    } else {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      else reproducir();
    }
  }, [reproducir]);

  const cambiar = (p: Partial<PrefsVoz>) => {
    const n = { ...prefs, ...p };
    setPrefs(n); guardarPrefsVoz(n);
    if (p.motor || p.vozNeuronal) cache.current.clear();
    const estabaSonando = sonandoRef.current;
    detener();
    if (estabaSonando) setTimeout(() => reproducir(n), 80);
  };

  const bajarVoz = async (vozId: string) => {
    setNeuronal({ fase: "descargando", pct: 0, mensaje: "" });
    try {
      await descargarVoz(vozId, (pct) => setNeuronal({ fase: "descargando", pct, mensaje: "" }));
      setNeuronal({ fase: "listo", pct: 100, mensaje: "" });
      setDescargadas(await vocesDescargadas());
      cambiar({ motor: "neuronal", vozNeuronal: vozId });
    } catch (e) {
      setNeuronal({ fase: "error", pct: 0, mensaje: e instanceof Error ? e.message : "Fallo al descargar." });
    }
  };

  const saltar = (d: number) => {
    const n = Math.max(0, Math.min(trozos.length - 1, iRef.current + d));
    setI(n);
    alCambiarBloque(trozos[n].bloque);
    if (sonandoRef.current || estado === "pausado") {
      window.speechSynthesis.cancel();
      audio.current?.pause();
      const mi = ++epoca.current;
      sonandoRef.current = true;
      setEstado("sonando");
      iRef.current = n;
      if (prefs.motor === "neuronal") void sonarNeuronal(n, prefs, mi);
      else sonarSistema(n, prefs, mi);
    }
  };

  const avance = trozos.length ? ((i + 1) / trozos.length) * 100 : 0;
  const restante = Math.round(
    trozos.slice(i).reduce((a, t) => a + t.texto.length, 0) / (14 * prefs.velocidad) / 60,
  );
  const usandoNeuronal = prefs.motor === "neuronal";
  const sonando = estado === "sonando";
  const vozActual = VOCES_ES.find((v) => v.id === prefs.vozNeuronal);

  if (!trozos.length) return null;

  return (
    <div className="tarjeta p-3">
      <div className="mb-2 h-0.5 overflow-hidden rounded bg-tinta-3">
        <div className="h-full bg-jade transition-[width]" style={{ width: `${avance}%` }} />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => saltar(-1)} title="Frase anterior"
          className="rounded-lg border border-borde px-2 py-1.5 text-xs text-suave transition hover:text-texto">⏮</button>

        <button
          onClick={() => (sonando ? pausar() : estado === "pausado" ? reanudar() : reproducir())}
          disabled={neuronal.fase === "descargando"}
          title={sonando ? "Pausar" : estado === "pausado" ? "Continuar" : "Reproducir"}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-jade text-tinta transition hover:opacity-90 disabled:opacity-50"
        >
          {sonando
            ? <svg width="12" height="13" viewBox="0 0 12 13" fill="currentColor"><rect x="0" y="0" width="4" height="13" rx="1"/><rect x="8" y="0" width="4" height="13" rx="1"/></svg>
            : <svg width="12" height="13" viewBox="0 0 12 13" fill="currentColor" style={{ marginLeft: 2 }}><path d="M0 .8v11.4a.8.8 0 0 0 1.2.7l9.4-5.7a.8.8 0 0 0 0-1.4L1.2.1A.8.8 0 0 0 0 .8Z"/></svg>}
        </button>

        <button onClick={() => detener(true)} disabled={estado === "parado"} title="Detener y volver al principio"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-borde text-suave transition hover:text-texto disabled:opacity-30">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect width="10" height="10" rx="1.5"/></svg>
        </button>

        <button onClick={() => saltar(1)} title="Frase siguiente"
          className="rounded-lg border border-borde px-2 py-1.5 text-xs text-suave transition hover:text-texto">⏭</button>

        <span className="ml-1 text-[11px] tabular-nums text-suave">
          {i + 1}/{trozos.length}
          {estado !== "parado" && restante > 0 && ` · ~${restante} min`}
          {estado === "pausado" && " · en pausa"}
        </span>

        <button onClick={() => setAjustes((a) => !a)}
          className="ml-auto rounded-lg border border-borde px-2 py-1.5 text-[11px] text-suave hover:text-texto">
          {usandoNeuronal ? (vozActual?.nombre ?? "Neuronal") : "Sistema"} · {prefs.velocidad}×
        </button>
        <button onClick={() => { detener(); cerrar(); }}
          className="rounded-lg border border-borde px-2 py-1.5 text-[11px] text-suave hover:text-texto">✕</button>
      </div>

      {neuronal.fase === "descargando" && (
        <div className="mt-2">
          <div className="h-1 overflow-hidden rounded bg-tinta-3">
            <div className="h-full bg-jade transition-[width]" style={{ width: `${neuronal.pct}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-suave">Descargando la voz una sola vez · {neuronal.pct}%</p>
        </div>
      )}
      {neuronal.fase === "error" && (
        <p className="mt-2 rounded border border-coral/40 bg-coral/10 px-2 py-1.5 text-[11px] text-coral">
          {neuronal.mensaje}
        </p>
      )}

      {ajustes && (
        <div className="mt-3 space-y-3 border-t border-borde pt-3">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-suave">Motor de voz</p>
            <button onClick={() => cambiar({ motor: "sistema" })}
              className={`w-full rounded-lg px-3 py-2 text-left transition ${
                !usandoNeuronal ? "bg-tinta-3" : "hover:bg-tinta-3/60"}`}>
              <span className="flex items-center gap-2 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${!usandoNeuronal ? "bg-jade" : "bg-borde"}`} />
                Voz del sistema
              </span>
              <span className="mt-0.5 block pl-3.5 text-[10px] text-suave">
                Instantánea. Es la voz de Windows.
              </span>
            </button>
          </div>

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-suave">
              {usandoNeuronal ? "Voz neuronal" : "Voces neuronales · se descargan una vez"}
            </p>
            <div className="space-y-1">
              {VOCES_ES.map((v) => {
                const yaEsta = descargadas.includes(v.id);
                const activa = usandoNeuronal && prefs.vozNeuronal === v.id;
                return (
                  <button key={v.id}
                    onClick={() => (yaEsta ? cambiar({ motor: "neuronal", vozNeuronal: v.id }) : bajarVoz(v.id))}
                    disabled={neuronal.fase === "descargando"}
                    className={`w-full rounded-lg px-3 py-2 text-left transition disabled:opacity-50 ${
                      activa ? "bg-tinta-3" : "hover:bg-tinta-3/60"}`}>
                    <span className="flex items-center gap-2 text-xs">
                      <span className={`h-1.5 w-1.5 rounded-full ${activa ? "bg-jade" : "bg-borde"}`} />
                      {v.nombre}
                      <span className="ml-auto text-[10px] text-suave">
                        {yaEsta ? "descargada" : `${v.mb} MB`}
                      </span>
                    </span>
                    <span className="mt-0.5 block pl-3.5 text-[10px] text-suave">{v.nota}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-suave">Velocidad</p>
            <div className="flex gap-1">
              {[0.8, 1, 1.2, 1.5, 1.8].map((v) => (
                <button key={v} onClick={() => cambiar({ velocidad: v })}
                  className={`flex-1 rounded px-2 py-1 text-[11px] transition ${
                    prefs.velocidad === v ? "bg-jade text-tinta" : "border border-borde text-suave hover:text-texto"}`}>
                  {v}×
                </button>
              ))}
            </div>
          </div>

          {!usandoNeuronal && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-widest text-suave">Voz del sistema</p>
              <select value={prefs.vozURI ?? ""} onChange={(e) => cambiar({ vozURI: e.target.value || null })}
                className="w-full rounded-lg border border-borde bg-tinta-2 px-2 py-1.5 text-xs">
                <option value="">Predeterminada</option>
                {voces.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
