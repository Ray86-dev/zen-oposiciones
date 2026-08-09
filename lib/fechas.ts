export const DIA_MS = 86_400_000;

export function iso(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
export function parse(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function sumaDias(s: string, n: number): string {
  return iso(new Date(parse(s).getTime() + n * DIA_MS));
}
export function diasEntre(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / DIA_MS);
}
export function diaSemana(s: string): number {
  return parse(s).getUTCDay();
}
export const NOMBRE_DIA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const NOMBRE_MES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

export function formatoLargo(s: string): string {
  const d = parse(s);
  return `${NOMBRE_DIA[d.getUTCDay()]} ${d.getUTCDate()} de ${NOMBRE_MES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}
export function formatoCorto(s: string): string {
  const d = parse(s);
  return `${d.getUTCDate()} ${NOMBRE_MES[d.getUTCMonth()].slice(0, 3)}`;
}
/**
 * Fechas reales de la primera prueba en Canarias: 22-jun-2024 (4.º sábado),
 * 21-jun-2025 (3.er sábado). La convocatoria de 2027 aún no está publicada:
 * usamos el 3.er sábado de junio como estimación ajustable por el usuario.
 */
export const FECHAS_PRUEBA_HISTORICAS: Record<number, string> = {
  2024: "2024-06-22",
  2025: "2025-06-21",
};

export function sabadoPrueba(anio: number): string {
  if (FECHAS_PRUEBA_HISTORICAS[anio]) return FECHAS_PRUEBA_HISTORICAS[anio];
  const d = new Date(Date.UTC(anio, 5, 1));
  const primerSabado = 1 + ((6 - d.getUTCDay() + 7) % 7);
  return iso(new Date(Date.UTC(anio, 5, primerSabado + 14)));
}
