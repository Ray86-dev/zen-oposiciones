/**
 * Sube a Supabase el índice de los 71 temas y el texto completo de cada uno.
 *
 *   npm run subir-contenido
 *
 * La clave se pide por teclado y no se muestra. Deliberadamente NO se lee de una
 * variable de entorno puesta en la línea de comandos: PowerShell guarda cada
 * orden en el historial de PSReadLine, que es un archivo de texto plano.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const aqui = dirname(fileURLToPath(import.meta.url));
const URL_SUPABASE = process.env.SUPABASE_URL ?? "https://hulbafouyprldwclyjsq.supabase.co";

/** Pide la clave sin dejar rastro en pantalla ni en el historial del shell. */
async function pedirClave() {
  if (process.env.SUPABASE_SECRET_KEY) return process.env.SUPABASE_SECRET_KEY;

  console.log("Clave de servicio de Supabase (Project Settings → API Keys).");
  console.log("Se pega y no se ve. Enter para continuar.\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const escribir = rl._writeToOutput?.bind(rl);
  rl._writeToOutput = function (s) {
    if (s.includes("\n") || s.includes("\r")) escribir?.(s);
  };
  const clave = await new Promise((res) => rl.question("clave: ", (r) => { rl.close(); res(r.trim()); }));
  console.log();
  return clave;
}

const CLAVE = await pedirClave();
if (!CLAVE) { console.error("No has introducido ninguna clave."); process.exit(1); }
if (!/^(sb_secret_|eyJ)/.test(CLAVE)) {
  console.error("Eso no parece una clave de servicio de Supabase.");
  process.exit(1);
}

const RUTA_HTML = process.env.RUTA_TEMAS
  ?? resolve(aqui, "../../_fuentes/temas-html.json");

const db = createClient(URL_SUPABASE, CLAVE, { auth: { persistSession: false } });
const SLUG = "filosofia-secundaria";

const temario = JSON.parse(readFileSync(resolve(aqui, "../data/temario-filosofia.json"), "utf8"));
const contenidos = JSON.parse(readFileSync(RUTA_HTML, "utf8"));

const { data: t, error: e0 } = await db.from("temarios").select("id").eq("slug", SLUG).single();
if (e0 || !t) { console.error("No existe el temario:", e0?.message); process.exit(1); }
const temarioId = t.id;

// 1) Índice de temas
const filas = temario.temas.map((x) => ({
  temario_id: temarioId,
  numero: x.numero,
  titulo: x.titulo,
  bloque_id: x.bloqueId,
  bloque_nombre: x.bloque,
  recurso_url: null,
  bytes_texto: x.bytesTexto,
  actualizado: x.ultimaActualizacion,
}));
const { error: e1 } = await db.from("temas").upsert(filas, { onConflict: "temario_id,numero" });
if (e1) { console.error("Error subiendo el índice:", e1.message); process.exit(1); }
console.log(`✓ índice de ${filas.length} temas`);

// 2) Contenido, de uno en uno para no superar el límite de la petición
let subidos = 0;
for (const c of contenidos) {
  const { error } = await db.from("tema_contenido").upsert({
    temario_id: temarioId,
    numero: c.numero,
    html: c.html,
    palabras: c.palabras,
    actualizado: new Date().toISOString(),
  }, { onConflict: "temario_id,numero" });
  if (error) { console.error(`  tema ${c.numero}: ${error.message}`); continue; }
  subidos++;
  process.stdout.write(`\r  contenido: ${subidos}/${contenidos.length}`);
}
console.log(`\n✓ contenido de ${subidos} temas`);

// 3) Rúbricas y supuestos oficiales
const rubricas = JSON.parse(readFileSync(resolve(aqui, "../data/rubricas.json"), "utf8"));
await db.from("rubricas").upsert(
  [{ temario_id: temarioId, anio: 2024, contenido: rubricas, vigente: true }],
  { onConflict: "temario_id,anio" });
console.log("✓ rúbrica oficial");

const sup = JSON.parse(readFileSync(resolve(aqui, "../data/supuestos.json"), "utf8"));
await db.from("supuestos").upsert(
  sup.supuestos.map((s) => ({
    temario_id: temarioId, codigo: s.id, anio: s.anio,
    oficial: s.oficial, tipo: s.tipo, contenido: s,
  })), { onConflict: "temario_id,codigo" });
console.log(`✓ ${sup.supuestos.length} supuestos oficiales`);

console.log("\nListo.");
