import { TopProdutosTable } from "../TopProdutosTable"

export default function MaisVendidosPage() {
  return (
    <TopProdutosTable
      direction="mais"
      title="🏆 Mais vendidos"
      description="Ranking dos produtos (com variação) que mais vendem em unidades, considerando vendas não canceladas."
    />
  )
}
