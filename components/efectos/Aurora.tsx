"use client";
import { useEffect, useRef } from "react";
import { useEfectos } from "@/components/Efectos";

/**
 * El fondo. Tres masas de color (jade, ámbar, coral) que se desplazan muy
 * despacio detrás de todo, dibujadas en WebGL con un ruido de valor de tres
 * octavas. La opacidad es deliberadamente baja: tiene que notarse cuando
 * levantas la vista, no mientras lees.
 *
 * Se detiene sola cuando la pestaña está oculta y cae a un degradado CSS si el
 * navegador no da contexto WebGL.
 */
const VERTICE = `
attribute vec2 pos;
void main() { gl_Position = vec4(pos, 0.0, 1.0); }
`;

const FRAGMENTO = `
precision mediump float;
uniform vec2 res;
uniform float t;
uniform vec3 c1;
uniform vec3 c2;
uniform vec3 c3;
uniform float fuerza;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * ruido(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = uv * vec2(res.x / res.y, 1.0);

  float q = fbm(p * 1.6 + vec2(t * 0.035, t * 0.02));
  vec2 d = vec2(fbm(p * 1.9 + q + t * 0.018), fbm(p * 1.7 - q - t * 0.014));
  float f = fbm(p * 2.2 + d * 1.4);

  float m1 = smoothstep(0.28, 0.78, f);
  float m2 = smoothstep(0.42, 0.92, 1.0 - f);
  float m3 = smoothstep(0.50, 0.98, fbm(p * 1.2 - t * 0.01));

  vec3 col = c1 * m1 * 0.85 + c2 * m2 * 0.55 + c3 * m3 * 0.35;

  // Se apaga hacia el centro para no competir nunca con el texto.
  float centro = distance(uv, vec2(0.5, 0.42));
  float vineta = smoothstep(0.16, 0.78, centro);

  gl_FragColor = vec4(col, 1.0) * fuerza * vineta;
}
`;

function compilar(gl: WebGLRenderingContext, tipo: number, src: string) {
  const s = gl.createShader(tipo);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
  return s;
}

export default function Aurora() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const { activo, pleno } = useEfectos();

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !activo) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = (cv.getContext("webgl", { alpha: true, antialias: false, depth: false, powerPreference: "low-power" })
        ?? cv.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    } catch { gl = null; }

    if (!gl) { cv.classList.add("zen-aurora--css"); return; }

    const vs = compilar(gl, gl.VERTEX_SHADER, VERTICE);
    const fs = compilar(gl, gl.FRAGMENT_SHADER, FRAGMENTO);
    if (!vs || !fs) { cv.classList.add("zen-aurora--css"); return; }

    const prog = gl.createProgram();
    if (!prog) { cv.classList.add("zen-aurora--css"); return; }
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { cv.classList.add("zen-aurora--css"); return; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "res");
    const uT = gl.getUniformLocation(prog, "t");
    const uC1 = gl.getUniformLocation(prog, "c1");
    const uC2 = gl.getUniformLocation(prog, "c2");
    const uC3 = gl.getUniformLocation(prog, "c3");
    const uF = gl.getUniformLocation(prog, "fuerza");

    // El tema claro es papel: el color tiene que ser mucho más tenue.
    const paleta = () => {
      const claro = document.documentElement.getAttribute("data-tema") === "claro";
      const base = pleno ? 1 : 0.72;
      return {
        c1: claro ? [0.12, 0.42, 0.33] : [0.18, 0.75, 0.58],
        c2: claro ? [0.54, 0.37, 0.08] : [0.85, 0.64, 0.26],
        c3: claro ? [0.64, 0.25, 0.16] : [0.88, 0.44, 0.35],
        fuerza: (claro ? 0.19 : 0.38) * base,
      };
    };

    let dims = { w: 0, h: 0 };
    const medir = () => {
      // Media resolución: es una mancha desenfocada, nadie va a contar píxeles.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * 0.5;
      const w = Math.max(1, Math.round(window.innerWidth * dpr));
      const h = Math.max(1, Math.round(window.innerHeight * dpr));
      if (w === dims.w && h === dims.h) return;
      dims = { w, h };
      cv.width = w; cv.height = h;
      gl!.viewport(0, 0, w, h);
      gl!.uniform2f(uRes, w, h);
    };

    let raf = 0;
    let t0 = performance.now();
    let ultimo = 0;
    const paso = (ahora: number) => {
      raf = requestAnimationFrame(paso);
      // 30 fps bastan de sobra para algo que se mueve así de despacio.
      if (ahora - ultimo < 33) return;
      ultimo = ahora;
      if (document.hidden) return;
      medir();
      const p = paleta();
      gl!.uniform3fv(uC1, p.c1);
      gl!.uniform3fv(uC2, p.c2);
      gl!.uniform3fv(uC3, p.c3);
      gl!.uniform1f(uF, p.fuerza);
      gl!.uniform1f(uT, (ahora - t0) / 1000);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(paso);

    return () => {
      cancelAnimationFrame(raf);
      gl?.deleteProgram(prog);
      gl?.deleteShader(vs);
      gl?.deleteShader(fs);
      gl?.deleteBuffer(buf);
    };
  }, [activo, pleno]);

  if (!activo) return null;
  return <canvas ref={ref} className="zen-aurora" aria-hidden />;
}
