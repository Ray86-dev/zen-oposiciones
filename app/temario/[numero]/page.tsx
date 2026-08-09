import LectorCliente from "./LectorCliente";
import temario from "@/data/temario-filosofia.json";

export function generateStaticParams() {
  return temario.temas.map((t) => ({ numero: String(t.numero) }));
}

export default async function PaginaTema({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  return <LectorCliente numero={Number(numero)} />;
}
