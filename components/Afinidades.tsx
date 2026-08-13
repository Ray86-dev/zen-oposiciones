"use client";
import Link from "next/link";
import { useApp } from "@/components/Proveedor";
import { ESTADOS, EstadoTema } from "@/lib/tipos";
import mapa from "@/data/afinidades.json";

interface Vinculo {
  tema: number;
  peso: number | null;
  autores: string[];
  conceptos: string[];
  alimenta: boolean;
  costura: boolean;
  razon?: string;
}

const RED = (mapa as { afinidades: Record<string, Vinculo[]> }).afinidades;

export function vinculosDe(numero: number): Vinculo[] {
  return RED[String(numero)] ?? [];
}

/**
 * Los temas del 1 al 45 son sistemáticos y del 46 al 71 históricos: tratan lo
 * mismo desde dos ángulos. Un vínculo que cruza esa costura vale más que uno
 * dentro del mismo bloque, porque es el que trae autores a un tema que sin
 * ellos se queda plano —y el tribunal paga 1 punto por citarlos—.
 */
export default function Afinidades({ numero }: { numero: number }) {
  const { temario, estado } = useApp();
  const vinculos = vinculosDe(numero);
  const titulo = (n: number) => temario.temas.find((t) => t.numero === n);

  if (!vinculos.length) {
    return <p className="tarjeta p-4 text-xs text-suave">Este tema no tiene cruces registrados.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] leading-snug text-suave">
        Temas que se alimentan de la misma lectura que este. Estudiar uno adelanta parte del otro,
        y citarlos cruzados es lo que la rúbrica premia como «aspectos históricos y autores».
      </p>

      {vinculos.map((v) => {
        const t = titulo(v.tema);
        if (!t) return null;
        const est = (estado.progreso[v.tema]?.estado ?? "pendiente") as EstadoTema;
        const color = ESTADOS.find((e) => e.id === est)?.color ?? "#52525b";
        const detalle = v.razon
          ? v.razon
          : [v.autores.join(", "), v.conceptos.join(", ")].filter(Boolean).join(" · ");
        return (
          <Link
            key={v.tema}
            href={`/temario/${v.tema}`}
            className="tarjeta group block p-3 transition hover:border-jade/50"
          >
            <div className="flex items-start gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: color }}
                    title={ESTADOS.find((e) => e.id === est)?.label} />
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-snug">
                  <span className="text-suave">Tema {v.tema}.</span> {t.titulo}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-suave">{detalle}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
                  {v.costura && (
                    <span className="rounded-full border border-ambar/40 px-1.5 py-px text-ambar">
                      {v.tema > 45 ? "histórico" : "sistemático"}
                    </span>
                  )}
                  {v.alimenta && (
                    <span className="rounded-full border border-jade/40 px-1.5 py-px text-jade">
                      te lo adelanta
                    </span>
                  )}
                  {v.razon && (
                    <span className="rounded-full border border-borde px-1.5 py-px text-suave">
                      revisado a mano
                    </span>
                  )}
                </div>
              </div>
              <span className="shrink-0 self-center text-jade opacity-0 transition group-hover:opacity-100">→</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
