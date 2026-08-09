import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente opcional. La app funciona sin Supabase (el progreso vive en el
 * navegador). En cuanto se rellenan las variables de entorno, este cliente
 * habilita el guardado en la nube y el multiusuario.
 */
export const supabaseConfigurado =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function crearCliente() {
  if (!supabaseConfigurado) return null;
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
