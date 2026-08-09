"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/", label: "Hoy" },
  { href: "/temario", label: "Temario" },
  { href: "/calendario", label: "Calendario" },
  { href: "/supuestos", label: "Supuestos" },
  { href: "/ajustes", label: "Ajustes" },
];

export default function Navegacion() {
  const ruta = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-borde bg-tinta/85 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-5xl items-center gap-1 overflow-x-auto px-5 py-3">
        <span className="serif mr-3 shrink-0 text-lg tracking-wide text-jade">Zen</span>
        {ENLACES.map((e) => {
          const activo = ruta === e.href;
          return (
            <Link
              key={e.href}
              href={e.href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${
                activo ? "bg-tinta-3 text-texto" : "text-suave hover:text-texto"
              }`}
            >
              {e.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
