'use client'

interface VariantFormProps {
  variants: any[]
  attributes: any[]
  onVariantsChange: (variants: any[]) => void
  onAttributesChange: (attributes: any[]) => void
  baseSalePrice?: number
}

export default function VariantForm({
  variants,
  attributes,
  onVariantsChange,
  onAttributesChange,
  baseSalePrice,
}: VariantFormProps) {
  // Placeholder component - variações serão editadas em tela separada
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <h3 className="font-semibold text-gray-900 mb-3">📦 Variações</h3>
      <p className="text-sm text-gray-600">
        As variações deste produto serão gerenciadas na tela de produtos.
      </p>
    </div>
  )
}
