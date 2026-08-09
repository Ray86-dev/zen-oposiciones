export default function Pastilla({ tipo }: { tipo: string }) {
  const m: Record<string, [string, string]> = {
    estudio: ["Estudio", "bg-jade/15 text-jade"],
    repaso: ["Repaso", "bg-ambar/15 text-ambar"],
    supuesto: ["Supuesto", "bg-coral/15 text-coral"],
    ud: ["UD", "bg-sky-400/15 text-sky-300"],
    hito: ["Hito", "bg-white/10 text-texto"],
  };
  const [txt, cls] = m[tipo] ?? m.hito;
  return <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${cls}`}>{txt}</span>;
}
