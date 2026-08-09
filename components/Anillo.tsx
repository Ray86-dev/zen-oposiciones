export default function Anillo({
  valor, tamano = 120, grosor = 9, color = "#2fbf94", etiqueta, sub,
}: {
  valor: number; tamano?: number; grosor?: number; color?: string;
  etiqueta: string; sub?: string;
}) {
  const r = (tamano - grosor) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, valor));
  return (
    <div className="flex flex-col items-center">
      <svg width={tamano} height={tamano} className="-rotate-90">
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke="#262d31" strokeWidth={grosor} />
        <circle
          cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke={color}
          strokeWidth={grosor} strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
        />
      </svg>
      <div className="-mt-[calc(50%+14px)] mb-[calc(50%-14px)] text-center">
        <div className="text-xl font-semibold tabular-nums">{etiqueta}</div>
        {sub && <div className="text-[11px] text-suave">{sub}</div>}
      </div>
    </div>
  );
}
