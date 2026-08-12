import type { Metadata } from "next";
import "./globals.css";
import { Proveedor } from "@/components/Proveedor";
import Navegacion from "@/components/Navegacion";
import { ProveedorSesion } from "@/components/Sesion";
import { ProveedorTema } from "@/components/Tema";
import Pomodoro from "@/components/Pomodoro";
import { ProveedorVoz } from "@/components/ProveedorVoz";
import MiniVoz from "@/components/MiniVoz";
import { ProveedorEfectos } from "@/components/Efectos";
import Gooey from "@/components/efectos/Gooey";
import Aurora from "@/components/efectos/Aurora";
import Brillo from "@/components/efectos/Brillo";

export const metadata: Metadata = {
  title: "Zen · Oposiciones de Filosofía",
  description: "Plan de estudio guiado para el procedimiento selectivo de Filosofía (590/201), Canarias.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-tema="oscuro" suppressHydrationWarning>
      <body className="min-h-screen">
        <ProveedorTema>
          <ProveedorEfectos>
            <Gooey />
            <Aurora />
            <Brillo />
            <ProveedorSesion>
              <Proveedor>
                <ProveedorVoz>
                  <Navegacion />
                  <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-6">{children}</main>
                  <MiniVoz />
                  <Pomodoro />
                </ProveedorVoz>
              </Proveedor>
            </ProveedorSesion>
          </ProveedorEfectos>
        </ProveedorTema>
      </body>
    </html>
  );
}
