/**
 * En Filosofía (cuerpo 590, especialidad 201) el tribunal extrae 5 bolas de 71.
 * P(al menos uno de tus `preparados` salga) = 1 - C(N-p, k) / C(N, k)
 */
export function combinaciones(n: number, k: number): number {
  if (k < 0 || k > n || n < 0) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

export function probabilidadAlMenosUno(preparados: number, total = 71, extraidos = 5): number {
  if (preparados <= 0) return 0;
  if (preparados >= total) return 1;
  return 1 - combinaciones(total - preparados, extraidos) / combinaciones(total, extraidos);
}

/** Nº de temas necesarios para alcanzar una probabilidad objetivo (0-1). */
export function temasParaProbabilidad(objetivo: number, total = 71, extraidos = 5): number {
  for (let p = 1; p <= total; p++) {
    if (probabilidadAlMenosUno(p, total, extraidos) >= objetivo) return p;
  }
  return total;
}

/** P(tener al menos `m` temas preparados entre los 5 extraídos). */
export function probabilidadAlMenos(m: number, preparados: number, total = 71, extraidos = 5): number {
  const denom = combinaciones(total, extraidos);
  if (denom === 0) return 0;
  let acum = 0;
  for (let i = m; i <= Math.min(extraidos, preparados); i++) {
    acum += combinaciones(preparados, i) * combinaciones(total - preparados, extraidos - i);
  }
  return acum / denom;
}
