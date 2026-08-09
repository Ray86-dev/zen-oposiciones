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
import { ProveedorVoz } from "./components/ProveedorVoz";
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
          React.createElement(Proveedor, null,
            React.createElement(ProveedorVoz, null, React.createElement(C))))),
    );
  });
  const txt = el.textContent || "";
  const faltan = ESPERADO[nombre].filter((s) => !txt.includes(s));
  const nodos = el.querySelectorAll("*").length;
  console.log(`${nombre.padEnd(11)} ${nodos.toString().padStart(5)} nodos  ${faltan.length ? "FALTA: " + faltan.join(", ") : "OK"}`);
  if (faltan.length) fallos++;
  act(() => root.unmount());
}

// --- Lectura de la salida del modelo, que es lo que más se rompe ---
import { leerTarjetas } from "./components/Flashcards";
import { leerDiagrama } from "./components/Mermaid";
import { trocearParaVoz, limpiarParaVoz } from "./lib/voz";

const casos: [string, boolean][] = [
  ['[{"anverso":"a","reverso":"b"}]', true],
  ['```json\n[{"anverso":"a","reverso":"b","tipo":"concepto"}]\n```', true],
  ['Aquí tienes:\n[{"anverso":"a","reverso":"b"}]\nEspero que sirva.', true],
  ['no es json', false],
  ['[]', false],
];
let fp = 0;
for (const [entrada, esperado] of casos) {
  const ok = leerTarjetas(entrada) !== null;
  if (ok !== esperado) { console.log("FALLO flashcards:", entrada.slice(0, 30)); fp++; }
}
const diagramas: [string, boolean][] = [
  ["graph TD\n A-->B", true],
  ["```mermaid\ngraph TD\n A-->B\n```", true],
  ["Este es el mapa:\n```mermaid\nflowchart TD\n A-->B\n```", true],
  ["texto sin diagrama", false],
];
for (const [entrada, esperado] of diagramas) {
  const ok = leerDiagrama(entrada) !== null;
  if (ok !== esperado) { console.log("FALLO mermaid:", entrada.slice(0, 30)); fp++; }
}
console.log(fp === 0
  ? `Parseo de la salida del modelo: ${casos.length + diagramas.length}/${casos.length + diagramas.length} casos OK`
  : `${fp} casos de parseo fallan`);


// --- Troceo del tema para la lectura en voz alta ---
const bloquesPrueba = [
  "<h2>1. El termino filosofia</h2>",
  "<p>La significacion etimologica es <strong>amor a la sabiduria</strong>. A veces se traduce por amor al saber. Pero los griegos distinguian entre saber y sabiduria.</p>",
  "<ul><li>Primer punto</li><li>Segundo punto</li></ul>",
  "<p></p>",
];
const trozos = trocearParaVoz(bloquesPrueba);
const compruebo: [string, boolean][] = [
  ["trocea en frases", trozos.length >= 4],
  ["el encabezado va suelto", trozos[0].texto.startsWith("1. El termino")],
  ["no cuela HTML en la voz", trozos.every((t) => !t.texto.includes("<"))],
  ["descarta los bloques vacios", trozos.every((t) => t.texto.trim().length > 1)],
  ["cada trozo sabe su bloque", trozos.every((t) => t.bloque >= 0 && t.bloque < bloquesPrueba.length)],
  ["limpia guiones y comillas", !limpiarParaVoz('texto - con «comillas»').includes("«")],
];
for (const [nombre, ok] of compruebo) {
  if (!ok) { console.log("FALLO voz:", nombre); fp++; }
}
console.log(`Troceo para voz: ${compruebo.filter(([, o]) => o).length}/${compruebo.length} comprobaciones OK`);

console.log(fallos + fp === 0 ? "\nTODO CORRECTO" : `\n${fallos + fp} PROBLEMAS`);
process.exit(fallos + fp ? 1 : 0);
