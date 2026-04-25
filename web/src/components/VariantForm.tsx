'use client'

interface VariantFormProps {
  variants: any[]
  attributes: any[]
  onVariantsChange: (variants: any[]) => void
  onAttributesChange: (attributes: any[]) => void
  baseSalePrice?: number
}

export default function VariantForm({}: VariantFormProps) {
  // Placeholder component - variações serão editadas em tela separada
  return (
    <div className="border rounded-lg p-4 bg-muted">
      <h3 className="font-semibold text-foreground mb-3">📦 Variações</h3>
      <p className="text-sm text-muted-foreground">
        As variações deste produto serão gerenciadas na tela de produtos.
      </p>
    </div>
  )
}
