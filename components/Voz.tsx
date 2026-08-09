"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { trocearParaVoz, limpiarParaVoz, cargarPrefsVoz, guardarPrefsVoz, PrefsVoz, VOZ_POR_DEFECTO } from "@/lib/voz";

export default function Voz({
  bloques, alCambiarBloque, cerrar,
}: {
  bloques: string[];
  alCambiarBloque: (i: number) => void;
  cerrar: () => void;
}) {
  const [trozos] = useState(() => trocearParaVoz(bloques));
  const [i, setI] = useState(0);
  const [sonando, setSonando] = useState(false);
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>([]);
  const [prefs, setPrefs] = useState<PrefsVoz>(VOZ_POR_DEFECTO);
  const [ajustes, setAjustes] = useState(false);
  const iRef = useRef(0);
  const sonandoRef = useRef(false);

  useEffect(() => { setPrefs(cargarPrefsVoz()); }, []);
  useEffect(() => { iRef.current = i; }, [i]);
  useEffect(() => { sonandoRef.current = sonando; }, [sonando]);

  // Las voces del sistema llegan de forma asíncrona en algunos navegadores.
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
  }, []);

  useEffect(() => () => { window.speechSynthesis.cancel(); }, []);

  /**
   * Chrome corta la síntesis a los ~15 segundos si no se le da un toque.
   * Este latido la mantiene viva mientras haya algo sonando.
   */
  useEffect(() => {
    if (!sonando) return;
    const t = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
    return () => clearInterval(t);
  }, [sonando]);

  const decir = useCallback((idx: number) => {
    const trozo = trozos[idx];
    if (!trozo) { detener(); return; }
    const u = new SpeechSynthesisUtterance(limpiarParaVoz(trozo.texto));
    const v = voces.find((x) => x.voiceURI === prefs.vozURI);
    if (v) u.voice = v;
    u.lang = v?.lang ?? "es-ES";
    u.rate = prefs.velocidad;
    u.pitch = prefs.tono;
    u.onend = () => {
      if (!sonandoRef.current) return;
      const sig = idx + 1;
      if (sig >= trozos.length) { detener(); return; }
      setI(sig);
      alCambiarBloque(trozos[sig].bloque);
      decir(sig);
    };
    u.onerror = () => detener();
    window.speechSynthesis.speak(u);
  }, [trozos, voces, prefs, detener, alCambiarBloque]);

  const reproducir = () => {
    window.speechSynthesis.cancel();
    sonandoRef.current = true;
    setSonando(true);
    alCambiarBloque(trozos[iRef.current]?.bloque ?? 0);
    decir(iRef.current);
  };

  const saltar = (d: number) => {
    const n = Math.max(0, Math.min(trozos.length - 1, iRef.current + d));
    setI(n);
    alCambiarBloque(trozos[n].bloque);
    if (sonandoRef.current) { window.speechSynthesis.cancel(); decir(n); }
  };

  const cambiar = (p: Partial<PrefsVoz>) => {
    const n = { ...prefs, ...p };
    setPrefs(n); guardarPrefsVoz(n);
    if (sonandoRef.current) { window.speechSynthesis.cancel(); decir(iRef.current); }
  };

  const avance = trozos.length ? ((i + 1) / trozos.length) * 100 : 0;
  const restante = Math.round(
    trozos.slice(i).reduce((a, t) => a + t.texto.length, 0) / (14 * prefs.velocidad) / 60,
  );

  if (!trozos.length) return null;

  return (
    <div className="tarjeta relative p-3">
      <div className="mb-2 h-0.5 overflow-hidden rounded bg-tinta-3">
        <div className="h-full bg-jade transition-[width]" style={{ width: `${avance}%` }} />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => saltar(-1)} title="Frase anterior"
          className="rounded-lg border border-borde px-2 py-1.5 text-xs text-suave hover:text-texto">⏮</button>
        <button onClick={() => (sonando ? detener() : reproducir())}
          className="rounded-lg bg-jade px-4 py-1.5 text-sm font-medium text-tinta">
          {sonando ? "Pausar" : "Escuchar"}
        </button>
        <button onClick={() => saltar(1)} title="Frase siguiente"
          className="rounded-lg border border-borde px-2 py-1.5 text-xs text-suave hover:text-texto">⏭</button>

        <span className="ml-1 text-[11px] tabular-nums text-suave">
          {i + 1}/{trozos.length}
          {sonando && restante > 0 && ` · ~${restante} min`}
        </span>

        <button onClick={() => setAjustes((a) => !a)} title="Voz y velocidad"
          className="ml-auto rounded-lg border border-borde px-2 py-1.5 text-[11px] text-suave hover:text-texto">
          {prefs.velocidad}×
        </button>
        <button onClick={() => { detener(); cerrar(); }} title="Cerrar"
          className="rounded-lg border border-borde px-2 py-1.5 text-[11px] text-suave hover:text-texto">✕</button>
      </div>

      {ajustes && (
        <div className="mt-3 space-y-3 border-t border-borde pt-3">
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
            <p className="mb-1 text-[10px] uppercase tracking-widest text-suave">
              Voz {voces.length === 0 && "(ninguna disponible)"}
            </p>
            <select value={prefs.vozURI ?? ""} onChange={(e) => cambiar({ vozURI: e.target.value || null })}
              className="w-full rounded-lg border border-borde bg-tinta-2 px-2 py-1.5 text-xs">
              <option value="">Voz predeterminada del sistema</option>
              {voces.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {v.lang}</option>
              ))}
            </select>
          </div>
          <p className="text-[10px] leading-relaxed text-suave">
            Usa las voces instaladas en tu sistema, sin coste ni conexión. Si suena metálica,
            instala una voz de calidad en Windows: Configuración → Hora e idioma → Voz.
            La lectura se detiene si cierras la pestaña.
          </p>
        </div>
      )}
    </div>
  );
}
