import type { Metadata } from "next";
import "./globals.css";
import { Proveedor } from "@/components/Proveedor";
import Navegacion from "@/components/Navegacion";

export const metadata: Metadata = {
  title: "Zen · Oposiciones de Filosofía",
  description: "Plan de estudio guiado para el procedimiento selectivo de Filosofía (590/201), Canarias.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <Proveedor>
          <Navegacion />
          <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-6">{children}</main>
        </Proveedor>
      </body>
    </html>
  );
}
