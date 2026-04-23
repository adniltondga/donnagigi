import { TopProdutosTable } from "../TopProdutosTable"

export default function MenosVendidosPage() {
  return (
    <TopProdutosTable
      direction="menos"
      title="📉 Menos vendidos"
      description="Produtos que venderam menos unidades — útil pra identificar anúncios com baixa rotatividade."
    />
  )
}
