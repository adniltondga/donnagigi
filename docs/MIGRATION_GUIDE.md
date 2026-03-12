# 📚 Guia de Migração - De Produtos Simples para Variações

## 📌 Mudanças Estruturais

### Antes: Modelo Simples
```typescript
// Cada cor/modelo era um produto separado
const product = await prisma.product.findUnique({
  where: { id: "prod_123" }
})
// {
//   id: "prod_123",
//   name: "Capinha Magnética - iPhone 12 PM - Preta",
//   sku: "CAP-001",
//   stock: 15,
//   salePrice: 59.90,
//   purchaseCost: 18.90,
//   // ... muitos outros campos
// }
```

### Depois: Modelo com Variações
```typescript
// Agora é hierárquico
const product = await prisma.product.findUnique({
  where: { id: "prod_123" },
  include: { variants: true, attributes: true }
})
// {
//   id: "prod_123",
//   name: "Capinha Magnética Colorida Fosca",
//   description: "...",
//   variants: [
//     { sku: "CAP-IP12PM-PRETA-001", stock: 15, salePrice: 59.90, ... },
//     { sku: "CAP-IP12PM-ROSA-001", stock: 12, salePrice: 59.90, ... },
//     { sku: "CAP-IP14PM-PRETA-001", stock: 8, salePrice: 59.90, ... },
//   ],
//   attributes: [
//     { name: "Cor", type: "color", values: ["Preto", "Rosa", ...] },
//     { name: "Modelo iPhone", type: "model", values: ["iPhone 12 PM", ...] }
//   ]
// }
```

---

## 🔄 Migrando OrderItem

### Antes
```typescript
// OrderItem referenciava Product diretamente
await prisma.orderItem.create({
  data: {
    orderId: "order_123",
    productId: "prod_123",  // ❌ Isso não exatamente qual variação
    quantity: 2,
    price: 59.90
  }
})
```

### Depois
```typescript
// OrderItem agora referencia ProductVariant
await prisma.orderItem.create({
  data: {
    orderId: "order_123",
    variantId: "var_001",  // ✅ Exatamente qual variação
    quantity: 2,
    price: 59.90
  }
})
```

### Como Atualizar seu Código
```typescript
// Ao criar pedido, encontre a variação específica
const variant = await prisma.productVariant.findUnique({
  where: { sku: "CAP-IP14PM-PRETA-001" }
})

await prisma.orderItem.create({
  data: {
    orderId: orderId,
    variantId: variant.id,  // Use a variação
    quantity: quantity,
    price: variant.salePrice
  }
})
```

---

## 🌐 Migrando MLProduct

### Antes
```typescript
// MLProduct referenciava Product
await prisma.mLProduct.create({
  data: {
    productId: "prod_123",
    mlListingID: "ML-123456",
    mlIntegrationId: "int_123"
  }
})
```

### Depois
```typescript
// MLProduct agora referencia ProductVariant
await prisma.mLProduct.create({
  data: {
    variantId: "var_001",  // ✅ Cada variação é um listing separado
    mlListingID: "ML-123456", // ID específico para esta variação
    mlIntegrationId: "int_123"
  }
})
```

### Padrão Recomendado
```typescript
// Sincronizar toda uma produto (todas as variações)
async function syncProductToML(productId: string) {
  const variants = await prisma.productVariant.findMany({
    where: { productId, active: true },
    include: {
      product: true,
      attributes: {
        include: { attributeValue: true }
      }
    }
  })

  for (const variant of variants) {
    // Cada variação vira um listing
    const attributeText = variant.attributes
      .map(a => a.attributeValue.value)
      .join(" - ")
    
    const mlListingTitle = `${variant.product.name} - ${attributeText}`
    
    const mlListing = await mlAPI.createVariantListing({
      title: mlListingTitle,
      sku: variant.sku,
      salePrice: variant.salePrice,
      quantity: variant.stock,
      // ...
    })

    await prisma.mLProduct.create({
      data: {
        variantId: variant.id,
        mlListingID: mlListing.id,
        mlIntegrationId: integrationId
      }
    })
  }
}
```

---

## 📊 Migrando Queries de Produtos

### Buscar um Produto
```typescript
// Antes
const product = await prisma.product.findUnique({
  where: { id: "prod_123" }
})

// Depois - com variações
const product = await prisma.product.findUnique({
  where: { id: "prod_123" },
  include: {
    variants: {
      include: {
        attributes: {
          include: { attributeValue: true }
        }
      }
    },
    attributes: {
      include: { attributeValues: true }
    }
  }
})
```

### Buscar Estoque de um SKU
```typescript
// Antes
const product = await prisma.product.findUnique({
  where: { sku: "CAP-001" }
})
console.log(product.stock)

// Depois
const variant = await prisma.productVariant.findUnique({
  where: { sku: "CAP-001" }
})
console.log(variant.stock)
```

### Atualizar Estoque
```typescript
// Antes
await prisma.product.update({
  where: { id: "prod_123" },
  data: { stock: 10 }
})

// Depois - por variação
await prisma.productVariant.update({
  where: { sku: "CAP-IP14PM-PRETA-001" },
  data: { stock: 10 }
})
```

### Buscar Produto por ID de Pedido
```typescript
// Antes
const orderItem = await prisma.orderItem.findUnique({
  where: { id: "oi_123" },
  include: { product: true }
})

// Depois
const orderItem = await prisma.orderItem.findUnique({
  where: { id: "oi_123" },
  include: {
    variant: {
      include: { product: true }
    }
  }
})
```

---

## 🛠️ Migrando Endpoints da API

### GET /api/products/:id

**Antes:**
```typescript
export async function GET(req, { params }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id }
  })
  return Response.json(product)
}
```

**Depois:**
```typescript
export async function GET(req, { params }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      variants: {
        include: {
          attributes: {
            include: { attributeValue: true }
          }
        }
      }
    }
  })
  return Response.json(product)
}
```

### POST /api/cart/add

**Antes:**
```typescript
export async function POST(req) {
  const { productId, quantity, price } = await req.json()
  
  await prisma.orderItem.create({
    data: { orderId, productId, quantity, price }
  })
}
```

**Depois:**
```typescript
export async function POST(req) {
  const { variantId, quantity, price } = await req.json()
  
  // Validar que variação existe
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId }
  })
  
  await prisma.orderItem.create({
    data: { orderId, variantId, quantity, price }
  })
}
```

---

## 🎛️ Migrando Componentes React

### Card de Produto - Antes
```tsx
function ProductCard({ product }) {
  return (
    <div>
      <h3>{product.name}</h3>
      <p>R$ {product.salePrice.toFixed(2)}</p>
      <p>Estoque: {product.stock}</p>
      <button onClick={() => addToCart(product.id)}>Adicionar</button>
    </div>
  )
}
```

### Card de Produto - Depois
```tsx
function ProductCard({ product }) {
  return (
    <div>
      <h3>{product.name}</h3>
      
      {/* Seletor de variações */}
      <select onChange={(e) => selectedVariant = e.target.value}>
        {product.variants.map(v => (
          <option key={v.id} value={v.id}>
            {v.attributes.map(a => a.attributeValue.value).join(" - ")} 
            - R$ {v.salePrice.toFixed(2)} 
            ({v.stock} em estoque)
          </option>
        ))}
      </select>
      
      <button onClick={() => addToCart(selectedVariant)}>
        Adicionar ao Carrinho
      </button>
    </div>
  )
}
```

---

## 📋 Checklist de Migração

- [ ] Atualizar schema do banco (migração já aplicada ✅)
- [ ] Regenerar Prisma Client ✅
- [ ] Atualizar queries que buscam produtos
- [ ] Atualizar endpoints que criam OrderItem
- [ ] Atualizar sincronização com Mercado Livre
- [ ] Atualizar componentes de produto/carrinho
- [ ] Atualizar admin para gerenciar variações
- [ ] Testar fluxos de pedido
- [ ] Atualizar documentação da API interna

---

## ⚠️ Cuidados Importantes

1. **SKU é único por variação** - Não pode haver duplicatas
2. **Estoque está em ProductVariant** - Não em Product
3. **Preço pode variar** - Cada variação pode ter preço diferente
4. **Atributos são flexíveis** - Adicione quantos precisar
5. **Integridade referencial** - MLProduct e OrderItem apontam para variantes

---

## 🔗 Recursos Úteis

- [PRODUCT_VARIANTS.md](./PRODUCT_VARIANTS.md) - Documentação completa
- [src/lib/variants.ts](./src/lib/variants.ts) - Utilitários prontos
- [API Example](./src/app/api/products/[id]/variants/route.ts) - Exemplo de endpoint
- [Seed Example](./seed-product-variants.ts) - Script de população
