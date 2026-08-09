/**
 * Sube a Supabase el índice de los 71 temas y el texto completo de cada uno.
 *
 * La clave de servicio NO se escribe en ningún archivo del repositorio:
 * se pasa por variable de entorno al ejecutar.
 *
 *   $env:SUPABASE_SERVICE_ROLE_KEY="..." ; node scripts/subir-contenido.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const URL_SUPABASE = process.env.SUPABASE_URL ?? "https://hulbafouyprldwclyjsq.supabase.co";
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!CLAVE) {
  console.error("Falta SUPABASE_SERVICE_ROLE_KEY.");
  console.error("La encuentras en el panel de Supabase → Project Settings → API Keys → service_role.");
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
