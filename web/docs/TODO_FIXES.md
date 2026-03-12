# 🔧 Próximos Passos - Arquivos para Atualizar

## Archivos com Erros de Tipo (TypeScript)

### 1. **src/app/api/products/[id]/route.ts** ⚠️
**Erro:** Referências a campos que foram movidos para ProjectVariant
```
- calculatedMargin (agora em ProductVariant)
- purchaseCost → basePurchaseCost (em Product)
- boxCost → baseBoxCost (em Product)
- mlTariff (agora em ProductVariant)
- deliveryTariff (agora em ProductVariant)
- salePrice (agora em ProductVariant)
```

**Ação:** Atualizar o endpoint para retornar variações em vez de dados do produto

---

### 2. **src/lib/syncML.ts** ⚠️
**Erro:** Sincronização com Mercado Livre usa estrutura antiga
```
- productId agora é variantId em MLProduct
- salePrice está em ProductVariant, não em Product
- image está em ProductVariant, não em Product
- stock está em ProductVariant, não em Product
```

**Ação:** Refatorar para iterar sobre variações e sincronizar cada uma

---

### 3. **src/app/api/products/route.ts** ⚠️
**Erro:** Criação de produto usa "baseModel" que não existe mais
```
- baseModel removido do schema
```

**Ação:** Atualizar para criar produto sem baseModel

---

## Arquivos Antigos que Podem Precisar Atualizar

### 4. **src/app/api/products/[id]/route.ts**
- Precisa incluir variações na resposta
- Possibilidade de adicionar endpoint para editar produto (nome, descrição)

### 5. **src/components/ProductCard.tsx** (se existe)
- Precisa mostrar selector de variações
- Precisa exibir diferentes preços/estoques por variação

### 6. **src/app/admin/products/page.tsx** (se existe)
- Precisa mostrar variações agrupadas
- Precisa permitir gerenciar estoque de cada variação
- Interface para criar novas variações

---

## ✅ Arquivos Já Prontos

- [x] `seed-product-variants.ts` - Script para popular dados de exemplo
- [x] `src/lib/variants.ts` - Utilitários para trabalhar com variações
- [x] `src/app/api/products/[id]/variants/route.ts` - Endpoint de variações
- [x] `src/lib/mercadolivre.ts` - Integração atualizada
- [x] `prisma/schema.prisma` - Schema atualizado
- [x] Migração banco de dados - Dados migrados

---

## 📋 Lista de Tarefas

### Imediato (1-2 horas)
- [ ] Corrigir `src/app/api/products/[id]/route.ts`
- [ ] Corrigir `src/lib/syncML.ts`
- [ ] Corrigir `src/app/api/products/route.ts`
- [ ] Remover imports não utilizados

### Curto Prazo (1-2 dias)
- [ ] Atualizar componentes de produto (ProductCard, etc)
- [ ] Atualizar admin para gerenciar variações
- [ ] Testar fluxos de compra
- [ ] Testar sincronização com ML

### Médio Prazo (1-2 semanas)
- [ ] Implementar dashboard com analytics de variações
- [ ] Implementar relatórios de vendas por variação
- [ ] Integração com Shopee
- [ ] Melhorias de performance

---

## 🎓 Exemplo de Correção

### Antes (Errado)
```typescript
// src/app/api/products/[id]/route.ts
const product = await prisma.product.findUnique({
  where: { id }
})
return {
  name: product.name,
  salePrice: product.salePrice,  // ❌ Não existe mais aqui
  stock: product.stock,           // ❌ Não existe mais aqui
  purchaseCost: product.purchaseCost  // ❌ Não existe mais aqui
}
```

### Depois (Correto)
```typescript
// src/app/api/products/[id]/route.ts
const product = await prisma.product.findUnique({
  where: { id },
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

return {
  id: product.id,
  name: product.name,
  description: product.description,
  baseImage: product.baseImage,
  variants: product.variants.map(v => ({
    id: v.id,
    sku: v.sku,
    salePrice: v.salePrice,      // ✅ Vem daqui
    stock: v.stock,               // ✅ Vem daqui
    purchaseCost: v.purchaseCost  // ✅ Vem daqui
  }))
}
```

---

## 🔗 Referências

- [Guia de Migração](./MIGRATION_GUIDE.md)
- [Documentação Variações](./PRODUCT_VARIANTS.md)
- [API Example](./src/app/api/products/[id]/variants/route.ts)
- [Utilitários](./src/lib/variants.ts)

---

## 💡 Dica

Você pode usar a busca (Cmd+Shift+F) para encontrar referências aos campos antigos:
- `product.salePrice` → Mudar para `variant.salePrice`
- `product.stock` → Mudar para `variant.stock`
- `productId` em MLProduct → Mudar para `variantId`
- etc.

---

**Status Geral:** 70% Completo ✅
- ✅ Banco de dados refatorado
- ✅ Estrutura de variações criada
- ✅ Exemplos e utilitários prontos
- ⏳ Endpoints da API precisam atualizar
- ⏳ UI do admin precisa atualizar
