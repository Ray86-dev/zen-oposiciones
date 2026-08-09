import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).Element = dom.window.Element;
(globalThis as any).Node = dom.window.Node;
(globalThis as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
(globalThis as any).self = dom.window;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
const Module = require("module");
const _resolve = Module._resolveFilename;
Module._resolveFilename = function (req: string, ...rest: any[]) {
  if (req === "next/link") return require.resolve("./test-stubs/link.js");
  if (req === "next/navigation") return require.resolve("./test-stubs/navigation.js");
  return _resolve.call(this, req, ...rest);
};

import { Proveedor } from "./components/Proveedor";
import { ProveedorSesion } from "./components/Sesion";
import { ProveedorTema } from "./components/Tema";
import Panel from "./app/page";
import PaginaTemario from "./app/temario/page";
import PaginaCalendario from "./app/calendario/page";
import PaginaSupuestos from "./app/supuestos/page";
import PaginaMateriales from "./app/materiales/page";
import LectorCliente from "./app/temario/[numero]/LectorCliente";
import PaginaAjustes from "./app/ajustes/page";

const PAGINAS: [string, any][] = [
  ["Panel", Panel], ["Temario", PaginaTemario], ["Calendario", PaginaCalendario],
  ["Supuestos", PaginaSupuestos], ["Ajustes", PaginaAjustes],
  ["Materiales", PaginaMateriales],
  ["Lector", () => React.createElement(LectorCliente, { numero: 1 })],
];

const ESPERADO: Record<string, string[]> = {
  Panel: ["Quedan", "días", "Fase", "Hoy", "Probabilidad"],
  Temario: ["Orden de 9 de septiembre de 1993", "Tema 71", "Historia de la filosofía", "Leer y anotar"],
  Calendario: ["Cimientos", "Simulacros"],
  Supuestos: ["Leviatán", "Hobbes", "Ortega", "Empezar cronometrado"],
  Ajustes: ["Ritmo semanal", "Mínimo para cerrar", "Fecha de la prueba", "Apariencia", "Cuenta"],
  Materiales: ["Materiales"],
  Lector: ["Tema 1", "La experiencia filosófica"],
};

let fallos = 0;
for (const [nombre, C] of PAGINAS) {
  const el = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(el);
  const root = createRoot(el);
  act(() => {
    root.render(
      React.createElement(ProveedorTema, null,
        React.createElement(ProveedorSesion, null,
          React.createElement(Proveedor, null, React.createElement(C)))),
    );
  });
  const txt = el.textContent || "";
  const faltan = ESPERADO[nombre].filter((s) => !txt.includes(s));
  const nodos = el.querySelectorAll("*").length;
  console.log(`${nombre.padEnd(11)} ${nodos.toString().padStart(5)} nodos  ${faltan.length ? "FALTA: " + faltan.join(", ") : "OK"}`);
  if (faltan.length) fallos++;
  act(() => root.unmount());
}
console.log(fallos === 0 ? "\nTODAS LAS PÁGINAS RENDERIZAN CORRECTAMENTE" : `\n${fallos} PÁGINAS CON PROBLEMAS`);
process.exit(fallos ? 1 : 0);
