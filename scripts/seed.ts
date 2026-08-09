/**
 * Carga el catálogo (temas, rúbricas, supuestos) en Supabase.
 * Solo hace falta cuando quieras pasar de uso personal a multiusuario.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed.ts
 */
import { createClient } from "@supabase/supabase-js";
import temario from "../data/temario-filosofia.json";
import rubricas from "../data/rubricas.json";
import supuestos from "../data/supuestos.json";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const SLUG = "filosofia-secundaria";

async function main() {
  const { data: t, error: e1 } = await db
    .from("temarios").select("id").eq("slug", SLUG).single();
  if (e1 || !t) throw e1 ?? new Error(`No existe el temario ${SLUG}`);
  const temarioId = t.id;

  const filas = temario.temas.map((x) => ({
    temario_id: temarioId,
    numero: x.numero,
    titulo: x.titulo,
    bloque_id: x.bloqueId,
    bloque_nombre: x.bloque,
    // Los enlaces a Drive son privados y no viven en el repositorio.
    recurso_url: null as string | null,
    bytes_texto: x.bytesTexto,
    actualizado: x.ultimaActualizacion,
  }));
  const { error: e2 } = await db
    .from("temas").upsert(filas, { onConflict: "temario_id,numero" });
  if (e2) throw e2;
  console.log(`✓ ${filas.length} temas`);

  const { error: e3 } = await db.from("rubricas").upsert(
    [{ temario_id: temarioId, anio: 2024, contenido: rubricas, vigente: true }],
    { onConflict: "temario_id,anio" }
  );
  if (e3) throw e3;
  console.log("✓ rúbrica 2024");

  const sup = supuestos.supuestos.map((s) => ({
    temario_id: temarioId,
    codigo: s.id,
    anio: s.anio,
    oficial: s.oficial,
    tipo: s.tipo,
    contenido: s,
  }));
  const { error: e4 } = await db
    .from("supuestos").upsert(sup, { onConflict: "temario_id,codigo" });
  if (e4) throw e4;
  console.log(`✓ ${sup.length} supuestos`);
}

main().catch((e) => { console.error(e); process.exit(1); });
