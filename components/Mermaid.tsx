"use client";
import { useEffect, useRef, useState } from "react";
import { useTema } from "@/components/Tema";

/** Extrae el diagrama aunque el modelo lo envuelva en vallas de código. */
export function leerDiagrama(bruto: string): string | null {
  const limpio = bruto.replace(/```mermaid/gi, "```").replace(/```/g, "").trim();
  const i = limpio.search(/\b(graph|flowchart|mindmap|classDiagram|erDiagram)\b/);
  return i === -1 ? null : limpio.slice(i).trim();
}

export default function Mermaid({ bruto }: { bruto: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { modo } = useTema();
  const [error, setError] = useState(false);
  const [svg, setSvg] = useState("");

  useEffect(() => {
    const codigo = leerDiagrama(bruto);
    if (!codigo) { setError(true); return; }
    let vivo = true;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: modo === "oscuro" ? "dark" : "neutral",
          fontFamily: "Georgia, serif",
          themeVariables: modo === "oscuro"
            ? { primaryColor: "#1b2124", primaryTextColor: "#e7ecea", lineColor: "#2fbf94",
                primaryBorderColor: "#2fbf94", secondaryColor: "#131719", tertiaryColor: "#0b0d0e" }
            : { primaryColor: "#e9e3d6", primaryTextColor: "#2b2a26", lineColor: "#1f6b52",
                primaryBorderColor: "#1f6b52", secondaryColor: "#faf7f0", tertiaryColor: "#f3efe6" },
        });
        const id = `d${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, codigo);
        if (vivo) { setSvg(svg); setError(false); }
      } catch {
        if (vivo) setError(true);
      }
    })();
    return () => { vivo = false; };
  }, [bruto, modo]);

  if (error) {
    return (
      <div>
        <p className="mb-2 text-xs text-ambar">
          El diagrama tiene un error de sintaxis. Pulsa «Regenerar» o revisa el código.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-tinta-3 p-3 text-[11px]">{bruto}</pre>
      </div>
    );
  }

  return (
    <div>
      <div ref={ref} className="overflow-x-auto rounded-lg bg-tinta-3/40 p-3 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
           dangerouslySetInnerHTML={{ __html: svg }} />
      {!svg && <div className="h-40 animate-pulse rounded-lg bg-tinta-3/40" />}
    </div>
  );
}
