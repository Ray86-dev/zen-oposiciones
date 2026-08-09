"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  trocearParaVoz, limpiarParaVoz, cargarPrefsVoz, guardarPrefsVoz, PrefsVoz, VOZ_POR_DEFECTO,
} from "@/lib/voz";
import { MotorKokoro, VOCES_KOKORO, EstadoKokoro, hayWebGPU } from "@/lib/kokoro";

const ESTADO_INICIAL: EstadoKokoro = { fase: "apagado", pct: 0, mb: 0, device: "", mensaje: "" };

export default function Voz({
  bloques, alCambiarBloque, cerrar,
}: { bloques: string[]; alCambiarBloque: (i: number) => void; cerrar: () => void }) {
  const [trozos] = useState(() => trocearParaVoz(bloques));
  const [i, setI] = useState(0);
  const [sonando, setSonando] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [prefs, setPrefs] = useState<PrefsVoz>(VOZ_POR_DEFECTO);
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);
  const [kokoro, setKokoro] = useState<EstadoKokoro>(ESTADO_INICIAL);

  const iRef = useRef(0);
  const sonandoRef = useRef(false);
  const motor = useRef<MotorKokoro | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const cache = useRef<Map<number, Blob>>(new Map());

  useEffect(() => { setPrefs(cargarPrefsVoz()); }, []);
  useEffect(() => { iRef.current = i; }, [i]);
  useEffect(() => { sonandoRef.current = sonando; }, [sonando]);

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

  useEffect(() => () => {
    window.speechSynthesis.cancel();
    motor.current?.destruir();
    cache.current.forEach(() => {});
  }, []);

  // Chrome corta la síntesis del sistema a los ~15 s si nadie la toca.
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

  const cambiar = (p: Partial<PrefsVoz>) => {
    const n = { ...prefs, ...p };
    setPrefs(n); guardarPrefsVoz(n);
    if (p.motor || p.vozKokoro) cache.current.clear();
    if (sonandoRef.current) { detener(); setTimeout(() => reproducir(n), 60); }
  };

  // ---------------------------------------------------------------- Kokoro
  const motorKokoro = useCallback(() => {
    if (!motor.current) motor.current = new MotorKokoro((e) => setKokoro((v) => ({ ...v, ...e })));
    return motor.current;
  }, []);

  const pedirAudio = useCallback(async (idx: number, p: PrefsVoz): Promise<Blob | null> => {
    if (idx >= trozos.length) return null;
    const guardado = cache.current.get(idx);
    if (guardado) return guardado;
    try {
      const b = await motorKokoro().generar(
        limpiarParaVoz(trozos[idx].texto), p.vozKokoro, p.velocidad, p.calidad,
      );
      cache.current.set(idx, b);
      // No dejamos crecer la caché sin límite.
      if (cache.current.size > 40) {
        const primera = cache.current.keys().next().value;
        if (primera !== undefined) cache.current.delete(primera);
      }
      return b;
    } catch { return null; }
  }, [trozos, motorKokoro]);

  const sonarKokoro = useCallback(async (idx: number, p: PrefsVoz) => {
    const blob = await pedirAudio(idx, p);
    if (!sonandoRef.current) return;
    if (!blob) { detener(); return; }

    if (!audio.current) audio.current = new Audio();
    const el = audio.current;
    el.src = URL.createObjectURL(blob);
    el.onended = () => {
      if (!sonandoRef.current) return;
      const sig = idx + 1;
      if (sig >= trozos.length) { detener(); return; }
      setI(sig);
      alCambiarBloque(trozos[sig].bloque);
      void sonarKokoro(sig, p);
    };
    await el.play().catch(() => detener());
    // Adelanta la siguiente frase mientras suena esta: así no hay silencios.
    void pedirAudio(idx + 1, p);
    void pedirAudio(idx + 2, p);
  }, [pedirAudio, trozos, alCambiarBloque, detener]);

  // --------------------------------------------------------------- Sistema
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
    alCambiarBloque(trozos[iRef.current]?.bloque ?? 0);
    if (p.motor === "kokoro") void sonarKokoro(iRef.current, p);
    else sonarSistema(iRef.current, p);
  }, [prefs, trozos, alCambiarBloque, sonarKokoro, sonarSistema]);

  const saltar = (d: number) => {
    const n = Math.max(0, Math.min(trozos.length - 1, iRef.current + d));
    setI(n);
    alCambiarBloque(trozos[n].bloque);
    if (sonandoRef.current) {
      window.speechSynthesis.cancel();
      audio.current?.pause();
      if (prefs.motor === "kokoro") void sonarKokoro(n, prefs);
      else sonarSistema(n, prefs);
    }
  };

  const avance = trozos.length ? ((i + 1) / trozos.length) * 100 : 0;
  const restante = Math.round(
    trozos.slice(i).reduce((a, t) => a + t.texto.length, 0) / (14 * prefs.velocidad) / 60,
  );
  const kokoroListo = kokoro.fase === "listo";
  const usandoKokoro = prefs.motor === "kokoro";

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
          disabled={usandoKokoro && kokoro.fase === "cargando"}
          className="rounded-lg bg-jade px-4 py-1.5 text-sm font-medium text-tinta disabled:opacity-50">
          {sonando ? "Pausar" : usandoKokoro && kokoro.fase === "cargando" ? "Preparando…" : "Escuchar"}
        </button>
        <button onClick={() => saltar(1)} title="Frase siguiente"
          className="rounded-lg border border-borde px-2 py-1.5 text-xs text-suave hover:text-texto">⏭</button>

        <span className="ml-1 text-[11px] tabular-nums text-suave">
          {i + 1}/{trozos.length}{sonando && restante > 0 && ` · ~${restante} min`}
        </span>

        <button onClick={() => setAjustes((a) => !a)}
          className="ml-auto rounded-lg border border-borde px-2 py-1.5 text-[11px] text-suave hover:text-texto">
          {usandoKokoro ? (kokoroListo ? "Kokoro" : "Voz") : "Sistema"} · {prefs.velocidad}×
        </button>
        <button onClick={() => { detener(); cerrar(); }}
          className="rounded-lg border border-borde px-2 py-1.5 text-[11px] text-suave hover:text-texto">✕</button>
      </div>

      {usandoKokoro && kokoro.fase === "cargando" && (
        <div className="mt-2">
          <div className="h-1 overflow-hidden rounded bg-tinta-3">
            <div className="h-full bg-jade transition-[width]" style={{ width: `${kokoro.pct}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-suave">
            Descargando el modelo de voz una sola vez · {kokoro.pct}% de {kokoro.mb} MB
          </p>
        </div>
      )}
      {usandoKokoro && kokoro.fase === "error" && (
        <p className="mt-2 rounded border border-coral/40 bg-coral/10 px-2 py-1.5 text-[11px] text-coral">
          {kokoro.mensaje} Cambia a la voz del sistema para seguir escuchando.
        </p>
      )}

      {ajustes && (
        <div className="mt-3 space-y-3 border-t border-borde pt-3">
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-suave">Motor de voz</p>
            <div className="space-y-1">
              <BotonMotor activo={!usandoKokoro} onClick={() => cambiar({ motor: "sistema" })}
                titulo="Voz del sistema" nota="Instantánea. Suena a robot de Windows." />
              <BotonMotor activo={usandoKokoro} onClick={() => {
                cambiar({ motor: "kokoro" });
                if (kokoro.fase === "apagado") motorKokoro().cargar(prefs.calidad);
              }}
                titulo="Kokoro" nota={`Voz neuronal, mucho más natural. Se descarga una vez (~86 MB) y funciona sin conexión.${hayWebGPU() ? "" : " Tu navegador no tiene WebGPU: irá más lento."}`} />
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

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-suave">Voz</p>
            {usandoKokoro ? (
              <div className="space-y-1">
                {VOCES_KOKORO.map((v) => (
                  <button key={v.id} onClick={() => cambiar({ vozKokoro: v.id })}
                    className={`w-full rounded-lg px-3 py-1.5 text-left transition ${
                      prefs.vozKokoro === v.id ? "bg-tinta-3" : "hover:bg-tinta-3/60"}`}>
                    <span className="text-xs">{v.nombre}</span>
                    <span className="block text-[10px] text-suave">{v.nota}</span>
                  </button>
                ))}
              </div>
            ) : (
              <select value={prefs.vozURI ?? ""} onChange={(e) => cambiar({ vozURI: e.target.value || null })}
                className="w-full rounded-lg border border-borde bg-tinta-2 px-2 py-1.5 text-xs">
                <option value="">Voz predeterminada del sistema</option>
                {voces.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>)}
              </select>
            )}
          </div>

          <p className="text-[10px] leading-relaxed text-suave">
            {usandoKokoro
              ? "Kokoro corre entero en tu navegador: sin claves, sin coste y sin límite de uso. La primera frase tarda unos segundos mientras carga el modelo; después va generando por delante para que no haya cortes."
              : "Usa las voces instaladas en tu sistema. La lectura se detiene si cierras la pestaña."}
          </p>
        </div>
      )}
    </div>
  );
}

function BotonMotor({ activo, onClick, titulo, nota }: {
  activo: boolean; onClick: () => void; titulo: string; nota: string;
}) {
  return (
    <button onClick={onClick}
      className={`w-full rounded-lg px-3 py-2 text-left transition ${activo ? "bg-tinta-3" : "hover:bg-tinta-3/60"}`}>
      <span className="flex items-center gap-2 text-xs">
        <span className={`h-1.5 w-1.5 rounded-full ${activo ? "bg-jade" : "bg-borde"}`} />
        {titulo}
      </span>
      <span className="mt-0.5 block pl-3.5 text-[10px] leading-relaxed text-suave">{nota}</span>
    </button>
  );
}
