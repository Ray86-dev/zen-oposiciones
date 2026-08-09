"use client";
import {
  createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode,
} from "react";
import {
  trocearParaVoz, limpiarParaVoz, cargarPrefsVoz, guardarPrefsVoz, PrefsVoz, VOZ_POR_DEFECTO,
} from "@/lib/voz";
import { EstadoVoz, sintetizar, descargarVoz, vocesDescargadas } from "@/lib/vozNeuronal";

export type EstadoReproduccion = "parado" | "sonando" | "pausado";

interface Fuente { tema: number; titulo: string; trozos: { bloque: number; texto: string }[] }

interface Ctx {
  fuente: Fuente | null;
  estado: EstadoReproduccion;
  indice: number;
  prefs: PrefsVoz;
  neuronal: EstadoVoz;
  descargadas: string[];
  vocesSistema: SpeechSynthesisVoice[];
  cargarTema: (tema: number, titulo: string, bloques: string[]) => void;
  fijarResaltado: (fn: ((bloque: number) => void) | null) => void;
  reproducir: () => void;
  pausar: () => void;
  reanudar: () => void;
  detener: (volverAlInicio?: boolean) => void;
  saltar: (d: number) => void;
  cambiar: (p: Partial<PrefsVoz>) => void;
  bajarVoz: (id: string) => Promise<void>;
}

const C = createContext<Ctx | null>(null);

/** No todos los navegadores traen síntesis de voz; hay que poder vivir sin ella. */
function sintesis(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis : null;
}

/**
 * La reproducción vive aquí, por encima de las páginas. Antes estaba dentro del
 * panel: al cerrarlo se desmontaba el componente, se perdía el estado y el audio
 * seguía sonando sin nadie que pudiera pararlo.
 */
export function ProveedorVoz({ children }: { children: ReactNode }) {
  const [fuente, setFuente] = useState<Fuente | null>(null);
  const [estado, setEstado] = useState<EstadoReproduccion>("parado");
  const [indice, setIndice] = useState(0);
  const [prefs, setPrefs] = useState<PrefsVoz>(VOZ_POR_DEFECTO);
  const [neuronal, setNeuronal] = useState<EstadoVoz>({ fase: "apagado", pct: 0, mensaje: "" });
  const [descargadas, setDescargadas] = useState<string[]>([]);
  const [vocesSistema, setVocesSistema] = useState<SpeechSynthesisVoice[]>([]);

  const iRef = useRef(0);
  const sonandoRef = useRef(false);
  const epoca = useRef(0);
  const prefsRef = useRef(VOZ_POR_DEFECTO);
  const fuenteRef = useRef<Fuente | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const cache = useRef<Map<string, Blob>>(new Map());
  const resaltar = useRef<((b: number) => void) | null>(null);

  useEffect(() => { prefsRef.current = prefs; }, [prefs]);
  useEffect(() => { fuenteRef.current = fuente; }, [fuente]);
  useEffect(() => { iRef.current = indice; }, [indice]);
  useEffect(() => { sonandoRef.current = estado === "sonando"; }, [estado]);

  useEffect(() => { setPrefs(cargarPrefsVoz()); void vocesDescargadas().then(setDescargadas); }, []);

  useEffect(() => {
    const s = sintesis();
    if (!s) return;
    const leer = () => {
      const v = s.getVoices().filter((x) => x.lang.toLowerCase().startsWith("es"));
      setVocesSistema(v.length ? v : s.getVoices());
    };
    leer();
    s.addEventListener("voiceschanged", leer);
    return () => s.removeEventListener("voiceschanged", leer);
  }, []);

  /**
   * Chrome corta la síntesis del sistema a los ~15 s si nadie la toca.
   * Este latido la mantiene viva mientras haya algo sonando.
   */
  useEffect(() => {
    if (estado !== "sonando" || prefs.motor !== "sistema") return;
    const t = setInterval(() => {
      const s = sintesis();
      if (s?.speaking && !s.paused) { s.pause(); s.resume(); }
    }, 10000);
    return () => clearInterval(t);
  }, [estado, prefs.motor]);

  const detener = useCallback((volverAlInicio = false) => {
    epoca.current += 1;
    sonandoRef.current = false;
    setEstado("parado");
    if (volverAlInicio) { iRef.current = 0; setIndice(0); }
    sintesis()?.cancel();
    if (audio.current) { audio.current.pause(); audio.current.removeAttribute("src"); }
  }, []);

  const pausar = useCallback(() => {
    sonandoRef.current = false;
    setEstado("pausado");
    if (prefsRef.current.motor === "neuronal") audio.current?.pause();
    else sintesis()?.pause();
  }, []);

  const claveCache = (idx: number, p: PrefsVoz) =>
    `${fuenteRef.current?.tema ?? 0}|${p.vozNeuronal}|${idx}`;

  const pedirAudio = useCallback(async (idx: number, p: PrefsVoz): Promise<Blob> => {
    const k = claveCache(idx, p);
    const guardado = cache.current.get(k);
    if (guardado) return guardado;
    const trozo = fuenteRef.current!.trozos[idx];
    const b = await sintetizar(limpiarParaVoz(trozo.texto), p.vozNeuronal);
    cache.current.set(k, b);
    if (cache.current.size > 40) {
      const primera = cache.current.keys().next().value;
      if (primera !== undefined) cache.current.delete(primera);
    }
    return b;
  }, []);

  const sonarNeuronal = useCallback(async (idx: number, p: PrefsVoz, mi: number) => {
    const f = fuenteRef.current;
    if (!f || idx >= f.trozos.length) { detener(); return; }
    let blob: Blob;
    try {
      blob = await pedirAudio(idx, p);
    } catch (e) {
      if (epoca.current !== mi) return;
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
      if (sig >= f.trozos.length) { detener(true); return; }
      setIndice(sig); iRef.current = sig;
      resaltar.current?.(f.trozos[sig].bloque);
      void sonarNeuronal(sig, p, mi);
    };
    try { await el.play(); }
    catch {
      if (epoca.current !== mi) return;
      setNeuronal({ fase: "error", pct: 0, mensaje: "El navegador ha bloqueado la reproducción. Vuelve a pulsar reproducir." });
      detener();
      return;
    }
    void pedirAudio(idx + 1, p).catch(() => {});
    void pedirAudio(idx + 2, p).catch(() => {});
  }, [pedirAudio, detener]);

  const sonarSistema = useCallback((idx: number, p: PrefsVoz, mi: number) => {
    const f = fuenteRef.current;
    const s = sintesis();
    if (!f || !s || idx >= f.trozos.length) { detener(true); return; }
    const u = new SpeechSynthesisUtterance(limpiarParaVoz(f.trozos[idx].texto));
    const v = vocesSistema.find((x) => x.voiceURI === p.vozURI);
    if (v) u.voice = v;
    u.lang = v?.lang ?? "es-ES";
    u.rate = p.velocidad;
    u.onend = () => {
      if (epoca.current !== mi || !sonandoRef.current) return;
      const sig = idx + 1;
      if (sig >= f.trozos.length) { detener(true); return; }
      setIndice(sig); iRef.current = sig;
      resaltar.current?.(f.trozos[sig].bloque);
      sonarSistema(sig, p, mi);
    };
    u.onerror = () => detener();
    s.speak(u);
  }, [vocesSistema, detener]);

  const reproducir = useCallback((p = prefsRef.current) => {
    const f = fuenteRef.current;
    if (!f) return;
    sintesis()?.cancel();
    audio.current?.pause();
    const mi = ++epoca.current;
    sonandoRef.current = true;
    setEstado("sonando");
    setNeuronal((v) => (v.fase === "error" ? { fase: "apagado", pct: 0, mensaje: "" } : v));
    resaltar.current?.(f.trozos[iRef.current]?.bloque ?? 0);
    if (p.motor === "neuronal") void sonarNeuronal(iRef.current, p, mi);
    else sonarSistema(iRef.current, p, mi);
  }, [sonarNeuronal, sonarSistema]);

  const reanudar = useCallback(() => {
    sonandoRef.current = true;
    setEstado("sonando");
    if (prefsRef.current.motor === "neuronal") {
      const el = audio.current;
      if (el?.src) void el.play().catch(() => reproducir());
      else reproducir();
    } else {
      const s = sintesis();
      if (s?.paused) s.resume();
      else reproducir();
    }
  }, [reproducir]);

  const saltar = useCallback((d: number) => {
    const f = fuenteRef.current;
    if (!f) return;
    const n = Math.max(0, Math.min(f.trozos.length - 1, iRef.current + d));
    iRef.current = n; setIndice(n);
    resaltar.current?.(f.trozos[n].bloque);
    if (sonandoRef.current || estado === "pausado") {
      sintesis()?.cancel();
      audio.current?.pause();
      const mi = ++epoca.current;
      sonandoRef.current = true;
      setEstado("sonando");
      const p = prefsRef.current;
      if (p.motor === "neuronal") void sonarNeuronal(n, p, mi);
      else sonarSistema(n, p, mi);
    }
  }, [estado, sonarNeuronal, sonarSistema]);

  const cambiar = useCallback((cambios: Partial<PrefsVoz>) => {
    const n = { ...prefsRef.current, ...cambios };
    setPrefs(n); prefsRef.current = n; guardarPrefsVoz(n);
    if (cambios.motor || cambios.vozNeuronal) cache.current.clear();
    const estaba = sonandoRef.current;
    detener();
    if (estaba) setTimeout(() => reproducir(n), 80);
  }, [detener, reproducir]);

  const bajarVoz = useCallback(async (vozId: string) => {
    setNeuronal({ fase: "descargando", pct: 0, mensaje: "" });
    try {
      await descargarVoz(vozId, (pct) => setNeuronal({ fase: "descargando", pct, mensaje: "" }));
      setNeuronal({ fase: "listo", pct: 100, mensaje: "" });
      setDescargadas(await vocesDescargadas());
      cambiar({ motor: "neuronal", vozNeuronal: vozId });
    } catch (e) {
      setNeuronal({ fase: "error", pct: 0, mensaje: e instanceof Error ? e.message : "Fallo al descargar." });
    }
  }, [cambiar]);

  const cargarTema = useCallback((tema: number, titulo: string, bloques: string[]) => {
    if (fuenteRef.current?.tema === tema) return;   // ya cargado: no cortar
    detener(true);
    cache.current.clear();
    setFuente({ tema, titulo, trozos: trocearParaVoz(bloques) });
  }, [detener]);

  const fijarResaltado = useCallback((fn: ((b: number) => void) | null) => {
    resaltar.current = fn;
  }, []);

  const valor: Ctx = {
    fuente, estado, indice, prefs, neuronal, descargadas, vocesSistema,
    cargarTema, fijarResaltado,
    reproducir: () => reproducir(), pausar, reanudar, detener, saltar, cambiar, bajarVoz,
  };
  return <C.Provider value={valor}>{children}</C.Provider>;
}

export function useVoz() {
  const c = useContext(C);
  if (!c) throw new Error("useVoz fuera del ProveedorVoz");
  return c;
}
