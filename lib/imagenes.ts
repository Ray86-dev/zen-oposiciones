"use client";

/**
 * Prepara una foto de un folio manuscrito para enviarla a transcribir.
 * Se reduce y se pasa a escala de grises: la letra se lee igual y el envío
 * baja de varios megas a unos cientos de kilobytes, que es lo que aguanta
 * la petición sin problemas.
 */
export async function prepararFoto(
  archivo: File, anchoMax = 1600, calidad = 0.72,
): Promise<{ mime: string; datos: string; kb: number }> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, anchoMax / bitmap.width);
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = w; lienzo.height = h;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("El navegador no permite procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, w, h);

  // Gris con algo más de contraste: la tinta azul sobre folio blanco gana nitidez.
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const c = Math.max(0, Math.min(255, (g - 128) * 1.25 + 128));
    d[i] = d[i + 1] = d[i + 2] = c;
  }
  ctx.putImageData(img, 0, 0);
  bitmap.close();

  const url = lienzo.toDataURL("image/jpeg", calidad);
  const datos = url.split(",")[1];
  return { mime: "image/jpeg", datos, kb: Math.round((datos.length * 3) / 4 / 1024) };
}

export const MAX_PAGINAS = 8;
