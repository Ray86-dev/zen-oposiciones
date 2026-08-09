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
  const [sonando, setSonando] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [prefs, setPrefs] = useState<PrefsVoz>(VOZ_POR_DEFECTO);
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);
  const [neuronal, setNeuronal] = useState<EstadoVoz>({ fase: "apagado", pct: 0, mensaje: "" });
  const [descargadas, setDescargadas] = useState<string[]>([]);

  const iRef = useRef(0);
  const sonandoRef = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const cache = useRef<Map<number, Blob>>(new Map());

  useEffect(() => { setPrefs(cargarPrefsVoz()); }, []);
  useEffect(() => { iRef.current = i; }, [i]);
  useEffect(() => { sonandoRef.current = sonando; }, [sonando]);
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

  const detener = useCallback(() => {
    sonandoRef.current = false;
    setSonando(false);
    window.speechSynthesis.cancel();
    if (audio.current) { audio.current.pause(); audio.current.src = ""; }
  }, []);

  useEffect(() => () => { window.speechSynthesis.cancel(); }, []);

  useEffect(() => {
    if (!sonando || prefs.motor !== "sistema") return;
    const t = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
    return () => clearInterval(t);
  }, [sonando, prefs.motor]);

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

  const sonarNeuronal = useCallback(async (idx: number, p: PrefsVoz) => {
    if (idx >= trozos.length) { detener(); return; }
    let blob: Blob;
    try {
      blob = await pedirAudio(idx, p);
    } catch (e) {
      // Nunca fallar en silencio: fue el error que dejó a Kokoro mudo.
      setNeuronal({ fase: "error", pct: 0, mensaje: e instanceof Error ? e.message : "No se pudo sintetizar." });
      detener();
      return;
    }
    if (!sonandoRef.current) return;

    if (!audio.current) audio.current = new Audio();
    const el = audio.current;
    el.src = URL.createObjectURL(blob);
    el.playbackRate = p.velocidad;
    el.onended = () => {
      if (!sonandoRef.current) return;
      const sig = idx + 1;
      if (sig >= trozos.length) { detener(); return; }
      setI(sig);
      alCambiarBloque(trozos[sig].bloque);
      void sonarNeuronal(sig, p);
    };
    try {
      await el.play();
    } catch (e) {
      setNeuronal({
        fase: "error", pct: 0,
        mensaje: "El navegador ha bloqueado la reproducción. Vuelve a pulsar Escuchar.",
      });
      detener();
      return;
    }
    // Adelanta las siguientes para que no haya silencios entre frases.
    void pedirAudio(idx + 1, p).catch(() => {});
    void pedirAudio(idx + 2, p).catch(() => {});
  }, [pedirAudio, trozos, alCambiarBloque, detener]);

  // -------------------------------------------------------------- sistema
  const sonarSistema = useCallback((idx: number, p: PrefsVoz) => {
    const trozo = trozos[idx];
    if (!trozo) { detener(); return; }
    const u = new SpeechSynthesisUtterance(limpiarParaVoz(trozo.texto));
    const v = voces.find((x) => x.voiceURI === p.vozURI);
    if (v) u.voice = v;
    u.lang = v?.lang ?? "es-ES";
    u.rate = p.velocidad;
    u.onend = () => {
      if (!sonandoRef.current) return;
      const sig = idx + 1;
      if (sig >= trozos.length) { detener(); return; }
      setI(sig);
      alCambiarBloque(trozos[sig].bloque);
      sonarSistema(sig, p);
    };
    u.onerror = () => detener();
    window.speechSynthesis.speak(u);
  }, [trozos, voces, detener, alCambiarBloque]);

  const reproducir = useCallback((p = prefs) => {
    window.speechSynthesis.cancel();
    sonandoRef.current = true;
    setSonando(true);
    setNeuronal((v) => (v.fase === "error" ? { fase: "apagado", pct: 0, mensaje: "" } : v));
    alCambiarBloque(trozos[iRef.current]?.bloque ?? 0);
    if (p.motor === "neuronal") void sonarNeuronal(iRef.current, p);
    else sonarSistema(iRef.current, p);
  }, [prefs, trozos, alCambiarBloque, sonarNeuronal, sonarSistema]);

  const cambiar = (p: Partial<PrefsVoz>) => {
    const n = { ...prefs, ...p };
    setPrefs(n); guardarPrefsVoz(n);
    if (p.motor || p.vozNeuronal) cache.current.clear();
    if (sonandoRef.current) { detener(); setTimeout(() => reproducir(n), 60); }
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
    if (sonandoRef.current) {
      window.speechSynthesis.cancel();
      audio.current?.pause();
      if (prefs.motor === "neuronal") void sonarNeuronal(n, prefs);
      else sonarSistema(n, prefs);
    }
  };

  const avance = trozos.length ? ((i + 1) / trozos.length) * 100 : 0;
  const restante = Math.round(
    trozos.slice(i).reduce((a, t) => a + t.texto.length, 0) / (14 * prefs.velocidad) / 60,
  );
  const usandoNeuronal = prefs.motor === "neuronal";
  const vozActual = VOCES_ES.find((v) => v.id === prefs.vozNeuronal);

  if (!trozos.length) return null;

  return (
    <div className="tarjeta p-3">
      <div className="mb-2 h-0.5 overflow-hidden rounded bg-tinta-3">
        <div className="h-full bg-jade transition-[width]" style={{ width: `${avance}%` }} />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => saltar(-1)} title="Frase anterior"
          className="rounded-lg border border-borde px-2 py-1.5 text-xs text-suave hover:text-texto">⏮</button>
        <button onClick={() => (sonando ? detener() : reproducir())}
          disabled={neuronal.fase === "descargando"}
          className="rounded-lg bg-jade px-4 py-1.5 text-sm font-medium text-tinta disabled:opacity-50">
          {sonando ? "Pausar" : "Escuchar"}
        </button>
        <button onClick={() => saltar(1)} title="Frase siguiente"
          className="rounded-lg border border-borde px-2 py-1.5 text-xs text-suave hover:text-texto">⏭</button>

        <span className="ml-1 text-[11px] tabular-nums text-suave">
          {i + 1}/{trozos.length}{sonando && restante > 0 && ` · ~${restante} min`}
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
