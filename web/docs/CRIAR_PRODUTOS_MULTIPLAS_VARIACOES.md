# 📝 Guia Prático - Criar Produtos com Múltiplas Variações

## 🎯 Resumo

O endpoint `POST /api/products` foi atualizado para permitir criar um produto com **múltiplas variações** em uma única requisição!

---

## 📋 Estrutura da Requisição

```json
{
  "name": "Nome do Produto",
  "description": "Descrição do produto",
  "baseImage": "URL da imagem",
  "category": "Categoria opcional",
  "supplier": "Fornecedor opcional",
  
  "attributes": [
    {
      "name": "Cor",
      "type": "color",
      "values": ["Preto", "Rosa", "Cinza"]
    },
    {
      "name": "Modelo iPhone",
      "type": "model",
      "values": ["iPhone 12 Pro Max", "iPhone 14 Pro Max"]
    }
  ],
  
  "variants": [
    {
      "sku": "CAP-IP12-PRETA-001",
      "salePrice": 59.90,
      "purchaseCost": 18.90,
      "boxCost": 2.00,
      "stock": 15,
      "attributes": {
        "Cor": "Preto",
        "Modelo iPhone": "iPhone 12 Pro Max"
      }
    },
    {
      "sku": "CAP-IP12-ROSA-001",
      "salePrice": 59.90,
      "purchaseCost": 18.90,
      "boxCost": 2.00,
      "stock": 12,
      "attributes": {
        "Cor": "Rosa",
        "Modelo iPhone": "iPhone 12 Pro Max"
      }
    },
    {
      "sku": "CAP-IP14-PRETA-001",
      "salePrice": 59.90,
      "purchaseCost": 18.90,
      "boxCost": 2.00,
      "stock": 20,
      "attributes": {
        "Cor": "Preto",
        "Modelo iPhone": "iPhone 14 Pro Max"
      }
    }
  ]
}
```

---

## 💻 Exemplos de Código

### JavaScript/TypeScript
```typescript
// Criar produto com 3 variações
const response = await fetch('http://localhost:3000/api/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: "Capinha Magnética Colorida Fosca",
    description: "Capinha com protetor de câmera",
    baseImage: "https://cdn.example.com/capinha.jpg",
    category: "Capinhas",
    supplier: "capa25",
    
    attributes: [
      {
        name: "Cor",
        type: "color",
        values: ["Preto", "Rosa", "Cinza"]
      },
      {
        name: "Modelo",
        type: "model",
        values: ["iPhone 12 Pro Max", "iPhone 14 Pro Max"]
      }
    ],
    
    variants: [
      {
        sku: "CAP-001",
        salePrice: 59.90,
        purchaseCost: 18.90,
        stock: 15,
        attributes: { "Cor": "Preto", "Modelo": "iPhone 12 Pro Max" }
      },
      {
        sku: "CAP-002",
        salePrice: 59.90,
        purchaseCost: 18.90,
        stock: 12,
        attributes: { "Cor": "Rosa", "Modelo": "iPhone 12 Pro Max" }
      },
      {
        sku: "CAP-003",
        salePrice: 59.90,
        purchaseCost: 18.90,
        stock: 20,
        attributes: { "Cor": "Preto", "Modelo": "iPhone 14 Pro Max" }
      }
    ]
  })
})

const result = await response.json()
console.log(`✅ Criadas ${result.data.variantsCount} variações`)
```

### cURL
```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Capinha Magnética",
    "description": "Capinha de qualidade",
    "baseImage": "https://via.placeholder.com/300",
    "attributes": [
      {
        "name": "Cor",
        "values": ["Preto", "Rosa"]
      },
      {
        "name": "Modelo",
        "values": ["12 PM", "14 PM"]
      }
    ],
    "variants": [
      {
        "sku": "CAP-001",
        "salePrice": 59.90,
        "stock": 15,
        "attributes": { "Cor": "Preto", "Modelo": "12 PM" }
      },
      {
        "sku": "CAP-002",
        "salePrice": 59.90,
        "stock": 12,
        "attributes": { "Cor": "Rosa", "Modelo": "12 PM" }
      }
    ]
  }'
```

---

## 📊 Exemplo Completo - Capinha com 15 Variações

```typescript
const capaProduct = {
  name: "Capinha Magnética Colorida Fosca com Kit de Película de Câmera",
  description: "Capinha magnética premium com protetor de câmera inclusos. Disponível em múltiplas cores e modelos.",
  baseImage: "https://images.unsplash.com/photo-1607936591413-dbe3df3e4aa2",
  category: "Capinhas",
  supplier: "capa25",
  
  attributes: [
    {
      name: "Cor",
      type: "color",
      values: ["Preto", "Rosa", "Cinza", "Roxo", "Marrom"]
    },
    {
      name: "Modelo iPhone",
      type: "model",
      values: ["iPhone 12 Pro Max", "iPhone 14 Pro Max", "iPhone 15 Pro Max"]
    }
  ],
  
  variants: [
    // iPhone 12 Pro Max
    { sku: "CAP-IP12-PRETO-001", salePrice: 59.90, purchaseCost: 18.90, stock: 15, attributes: { "Cor": "Preto", "Modelo iPhone": "iPhone 12 Pro Max" } },
    { sku: "CAP-IP12-ROSA-001", salePrice: 59.90, purchaseCost: 18.90, stock: 12, attributes: { "Cor": "Rosa", "Modelo iPhone": "iPhone 12 Pro Max" } },
    { sku: "CAP-IP12-CINZA-001", salePrice: 59.90, purchaseCost: 18.90, stock: 8, attributes: { "Cor": "Cinza", "Modelo iPhone": "iPhone 12 Pro Max" } },
    { sku: "CAP-IP12-ROXO-001", salePrice: 59.90, purchaseCost: 18.90, stock: 10, attributes: { "Cor": "Roxo", "Modelo iPhone": "iPhone 12 Pro Max" } },
    { sku: "CAP-IP12-MARROM-001", salePrice: 59.90, purchaseCost: 18.90, stock: 6, attributes: { "Cor": "Marrom", "Modelo iPhone": "iPhone 12 Pro Max" } },
    
    // iPhone 14 Pro Max
    { sku: "CAP-IP14-PRETO-001", salePrice: 59.90, purchaseCost: 18.90, stock: 20, attributes: { "Cor": "Preto", "Modelo iPhone": "iPhone 14 Pro Max" } },
    { sku: "CAP-IP14-ROSA-001", salePrice: 59.90, purchaseCost: 18.90, stock: 18, attributes: { "Cor": "Rosa", "Modelo iPhone": "iPhone 14 Pro Max" } },
    { sku: "CAP-IP14-CINZA-001", salePrice: 59.90, purchaseCost: 18.90, stock: 14, attributes: { "Cor": "Cinza", "Modelo iPhone": "iPhone 14 Pro Max" } },
    { sku: "CAP-IP14-ROXO-001", salePrice: 59.90, purchaseCost: 18.90, stock: 16, attributes: { "Cor": "Roxo", "Modelo iPhone": "iPhone 14 Pro Max" } },
    { sku: "CAP-IP14-MARROM-001", salePrice: 59.90, purchaseCost: 18.90, stock: 12, attributes: { "Cor": "Marrom", "Modelo iPhone": "iPhone 14 Pro Max" } },
    
    // iPhone 15 Pro Max
    { sku: "CAP-IP15-PRETO-001", salePrice: 59.90, purchaseCost: 18.90, stock: 25, attributes: { "Cor": "Preto", "Modelo iPhone": "iPhone 15 Pro Max" } },
    { sku: "CAP-IP15-ROSA-001", salePrice: 59.90, purchaseCost: 18.90, stock: 22, attributes: { "Cor": "Rosa", "Modelo iPhone": "iPhone 15 Pro Max" } },
    { sku: "CAP-IP15-CINZA-001", salePrice: 59.90, purchaseCost: 18.90, stock: 19, attributes: { "Cor": "Cinza", "Modelo iPhone": "iPhone 15 Pro Max" } },
    { sku: "CAP-IP15-ROXO-001", salePrice: 59.90, purchaseCost: 18.90, stock: 21, attributes: { "Cor": "Roxo", "Modelo iPhone": "iPhone 15 Pro Max" } },
    { sku: "CAP-IP15-MARROM-001", salePrice: 59.90, purchaseCost: 18.90, stock: 17, attributes: { "Cor": "Marrom", "Modelo iPhone": "iPhone 15 Pro Max" } }
  ]
}

// Enviar para API
const response = await fetch('/api/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(capaProduct)
})

const data = await response.json()
console.log(`✅ Produto criado: ${data.data.product.name}`)
console.log(`✅ Variações: ${data.data.variantsCount}`)
```

---

## 🎛️ Campos Explicados

### Produto (obrigatório)
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `name` | string | ✅ | Nome do produto |
| `description` | string | ✅ | Descrição do produto |
| `baseImage` | string | ✅ | URL da imagem principal |
| `category` | string | ❌ | Categoria (padrão: "Capinhas") |
| `supplier` | string | ❌ | Fornecedor |

### Atributos (opcional)
| Campo | Tipo | Descrição |
|---|---|---|
| `name` | string | Nome do atributo (ex: "Cor") |
| `type` | string | Tipo (color, model, size, etc) |
| `values` | string[] | Valores disponíveis |

### Variações (obrigatório - mínimo 1)
| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `sku` | string | ✅ | Código único da variação |
| `salePrice` | number | ✅ | Preço de venda |
| `purchaseCost` | number | ❌ | Custo de compra |
| `boxCost` | number | ❌ | Custo de embalagem |
| `stock` | number | ❌ | Quantidade em estoque |
| `image` | string | ❌ | Imagem específica da variação |
| `mlTariff` | number | ❌ | Tarifa Mercado Livre |
| `deliveryTariff` | number | ❌ | Tarifa de entrega |
| `attributes` | object | ❌ | Atributos da variação |

---

## ✅ Validações

- ✓ Nome e descrição obrigatórios
- ✓ Mínimo 1 variação
- ✓ Cada variação precisa de SKU e salePrice
- ✓ SKUs únicos (será validado no banco)
- ✓ Atributos das variações associados automaticamente

---

## 📤 Resposta de Sucesso

```json
{
  "success": true,
  "data": {
    "product": {
      "id": "prod_123",
      "name": "Capinha Magnética...",
      "description": "...",
      "baseImage": "...",
      "category": "Capinhas",
      "createdAt": "2026-03-12T10:00:00Z"
    },
    "variants": [
      {
        "id": "var_001",
        "productId": "prod_123",
        "sku": "CAP-IP14-PRETA-001",
        "salePrice": 59.90,
        "stock": 20
      },
      // ... mais variações
    ],
    "variantsCount": 15
  }
}
```

---

## 🔧 Formula para Gerar SKUs Automaticamente

Se preferir, pode gerar SKUs automaticamente:

```typescript
function generateSKU(productName: string, color: string, model: string, index: number) {
  const prefix = productName.substring(0, 3).toUpperCase() // "CAP"
  const colorCode = color.substring(0, 3).toUpperCase()   // "PRE"
  const modelCode = model.replace(/[^0-9]/g, '').substring(0, 2) // "14"
  const num = String(index).padStart(3, '0')               // "001"
  
  return `${prefix}-${modelCode}-${colorCode}-${num}`
  // Resultado: "CAP-14-PRE-001"
}
```

---

## 🚀 Próximas Ações

1. ✅ Endpoint atualizado para múltiplas variações
2. ⏳ Atualizar UI do formulário de produtos
3. ⏳ Adicionar validação no frontend
4. ⏳ Mostrar preview das variações

---

## 🐛 Troubleshooting

**"Erro: SKU já existe"**
- Verifique se o SKU já foi cadastrado
- Use SKUs únicos para cada variação

**"Erro: Mínimo 1 variação é obrigatória"**
- Adicione pelo menos uma variação no array `variants`

**"Erro: Variação 1: SKU e salePrice são obrigatórios"**
- Cada variação precisa de `sku` e `salePrice` definidos

---

**Data:** 12 de Março, 2026  
**Status:** ✅ Endpoint atualizado e pronto para usar
