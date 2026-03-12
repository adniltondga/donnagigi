# Sistema de Variações de Produtos

## 📋 Visão Geral

O sistema foi refatorado para suportar **variações de produtos** como nos grandes marketplaces (Mercado Livre, Shopee). Isso elimina a duplicação de dados e permite melhor organização de SKUs.

### Antes (Estrutura Antiga) ❌
```
Capinha Magnética Colorida - iPhone 12 Pro Max - Preta - SKU: CAP-001
Capinha Magnética Colorida - iPhone 12 Pro Max - Rosa - SKU: CAP-002
Capinha Magnética Colorida - iPhone 14 Pro Max - Preta - SKU: CAP-003
Capinha Magnética Colorida - iPhone 14 Pro Max - Rosa - SKU: CAP-004
```
**Problema:** Mesmo nome repetido, dados duplicados.

### Depois (Estrutura Nova) ✅
```
Capinha Magnética Colorida Fosca com Kit de Película
├── Variação: iPhone 12 Pro Max - Preta (SKU: CAP-001)
├── Variação: iPhone 12 Pro Max - Rosa (SKU: CAP-002)
├── Variação: iPhone 14 Pro Max - Preta (SKU: CAP-003)
└── Variação: iPhone 14 Pro Max - Rosa (SKU: CAP-004)
```
**Benefício:** Um único produto pai com múltiplas variações organizadas.

---

## 🏗️ Estrutura de Dados

### Modelos do Banco de Dados

```
Product (Produto Pai)
├── name: String              # "Capinha Magnética Colorida Fosca com Kit de Película"
├── description: Text         # Descrição completa do produto
├── baseImage: String         # Imagem padrão
├── category: String          # Categoria (ex: "Capinhas")
├── supplier: String?         # Fornecedor (ex: "capa25")
├── baseSalePrice: Float?     # Preço padrão (pode variar por variante)
├── active: Boolean           # Ativo/Inativo
└── createdAt/updatedAt

ProductAttribute (Tipo de Variação)
├── productId: String         # Referência ao Product
├── name: String              # "Cor" ou "Modelo iPhone"
├── type: String              # "color", "model", etc
└── attributeValues: ProductAttributeValue[]

ProductAttributeValue (Valores dos Atributos)
├── attributeId: String       # Referência ao atributo
├── value: String             # "Preto", "Rosa", "iPhone 14 Pro Max"
└── variants: VariantAttributeValue[]

ProductVariant (Variação Específica)
├── productId: String         # Referência ao Product
├── sku: String!              # "CAP-IP12PM-PRETA-001"
├── image: String?            # Imagem específica (se diferente)
├── purchaseCost: Float?      # Custo de compra
├── boxCost: Float?           # Custo de embalagem
├── salePrice: Float!         # Preço de venda
├── calculatedMargin: Float?  # Margem calculada
├── stock: Int                # Quantidade em estoque
├── mlListed: Boolean         # Listado no Mercado Livre?
├── mlListingId: String?      # ID do anúncio no ML
├── active: Boolean           # Ativa/Inativa
└── attributes: VariantAttributeValue[]

VariantAttributeValue (Associação)
├── variantId: String         # Referência à variante
└── attributeValueId: String  # Referência ao valor do atributo
```

---

## 💻 Exemplos de Uso na API

### 1. Criar um Novo Produto com Variações

```typescript
// POST /api/products
{
  "name": "Capinha Magnética Colorida Fosca com Kit de Película",
  "description": "Capinha magnética de alta qualidade com protetor de câmera...",
  "baseImage": "https://cdn.example.com/capinha-base.jpg",
  "category": "Capinhas",
  "supplier": "capa25",
  "baseSalePrice": 59.90,
  
  // Atributos que variam
  "attributes": [
    {
      "name": "Cor",
      "type": "color",
      "values": ["Preta", "Rosa", "Cinza", "Roxo"]
    },
    {
      "name": "Modelo iPhone",
      "type": "model",
      "values": ["iPhone 12 Pro Max", "iPhone 14 Pro Max", "iPhone 15 Pro Max"]
    }
  ],
  
  // Variações específicas
  "variants": [
    {
      "sku": "CAP-IP12PM-PRETA-001",
      "attributes": {
        "Cor": "Preta",
        "Modelo iPhone": "iPhone 12 Pro Max"
      },
      "salePrice": 59.90,
      "purchaseCost": 18.90,
      "boxCost": 2.00,
      "stock": 15,
      "image": null  // Usa baseImage se null
    },
    {
      "sku": "CAP-IP12PM-ROSA-001",
      "attributes": {
        "Cor": "Rosa",
        "Modelo iPhone": "iPhone 12 Pro Max"
      },
      "salePrice": 59.90,
      "purchaseCost": 18.90,
      "boxCost": 2.00,
      "stock": 12
    }
    // ... mais variações
  ]
}
```

### 2. Buscar um Produto com Todas as Variações

```typescript
// GET /api/products/[id]
const product = await prisma.product.findUnique({
  where: { id: "prod_123" },
  include: {
    variants: {
      include: {
        attributes: {
          include: {
            attributeValue: true
          }
        }
      }
    },
    attributes: {
      include: {
        attributeValues: true
      }
    }
  }
});

// Resposta
{
  id: "prod_123",
  name: "Capinha Magnética Colorida...",
  variants: [
    {
      id: "var_001",
      sku: "CAP-IP12PM-PRETA-001",
      salePrice: 59.90,
      stock: 15,
      attributes: [
        { attributeValue: { value: "Preta" } },
        { attributeValue: { value: "iPhone 12 Pro Max" } }
      ]
    }
    // ... mais variações
  ]
}
```

### 3. Atualizar Estoque de uma Variação

```typescript
// PATCH /api/products/variants/[variantId]
{
  "stock": 20
}

// Backend
await prisma.productVariant.update({
  where: { id: "var_001" },
  data: { stock: 20 }
});
```

### 4. Buscar Variações Filtradas

```typescript
// GET /api/products/[id]/variants?modelo=iPhone14ProMax&cor=Preta
const variants = await prisma.productVariant.findMany({
  where: {
    productId: "prod_123",
    attributes: {
      some: {
        attributeValue: {
          value: {
            in: ["iPhone 14 Pro Max", "Preta"]
          }
        }
      }
    },
    active: true
  },
  include: {
    attributes: {
      include: { attributeValue: true }
    }
  }
});
```

---

## 🔄 Integração com Mercado Livre

Agora cada **variação** é listada como um SKU no Mercado Livre:

```typescript
// Ao sincronizar uma variação com ML
const mlListing = await mlAPI.createListing({
  title: `${product.name} - ${variantAttributes}`, // "Capinha... - iPhone 14 - Preto"
  sku: variant.sku,  // "CAP-IP14PM-PRETA-001"
  price: variant.salePrice,
  quantity: variant.stock,
  // ... outros dados
});

// Atualizar referência em MLProduct
await prisma.mLProduct.upsert({
  where: { variant Id_mlIntegrationId: { variantId: variant.id, mlIntegrationId } },
  create: {
    variantId: variant.id,
    mlListingID: mlListing.id,
    mlIntegrationId,
    syncStatus: "synced"
  },
  update: {
    mlListingID: mlListing.id,
    syncStatus: "synced"
  }
});
```

---

## 📊 Dashboard - Visualizando Variações

Ao exibir produtos no admin:

```tsx
// Antes (confuso)
| Produto | Modelo | Cor | Estoque |
|---------|--------|-----|---------|
| Capinha | 12PM   | P   | 15      |
| Capinha | 12PM   | R   | 12      |
| Capinha | 14PM   | P   | 8       |

// Depois (agrupado e claro)
| Produto: Capinha Magnética Colorida |
| ├ iPhone 12 Pro Max - Preta: 15   |
| ├ iPhone 12 Pro Max - Rosa: 12    |
| ├ iPhone 14 Pro Max - Preta: 8    |
| └ iPhone 14 Pro Max - Rosa: 20    |
```

---

## 🔑 Chaves Primárias e Índices

| Tabela | Chave Única |
|--------|-------------|
| ProductVariant | `sku` |
| ProductAttribute | `(productId, name)` |
| ProductAttributeValue | `(attributeId, value)` |
| VariantAttributeValue | `(variantId, attributeValueId)` |
| MLProduct | `(variantId, mlIntegrationId)` |
| OrderItem | `(orderId, variantId)` |

---

## 🚀 Próximas Etapas

1. ✅ Migração do banco de dados concluída
2. ⏳ Atualizar endpoints da API para variações
3. ⏳ Atualizar UI do admin para exibir variações
4. ⏳ Atualizar sincronização com Mercado Livre
5. ⏳ Adicionar relatórios de vendas por variação

