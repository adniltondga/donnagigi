# Sistema de Vendas - Planejamento

## Objetivo
Registrar vendas manuais de produtos e acompanhar saldo/lucro por venda e total.

## Fluxo

1. **Registrar Venda**
   - Usuário vai em `/admin/vendas`
   - Preenche formulário com:
     - Produto/Variação (select dropdown)
     - Quantidade vendida
     - Preço de venda (R$)
     - Marketplace (ML ou Shopee)
     - Data da venda
   - Sistema calcula automaticamente:
     - Custo total da variação
     - Lucro bruto por unidade
     - Lucro total

2. **Dashboard de Vendas**
   - Mostra resumo:
     - Total faturado (R$)
     - Total de custos (R$)
     - Lucro líquido (R$)
     - Quantidade vendida
   - Lista todas as vendas registradas
   - Filtros: por data, marketplace, produto

## Estrutura de Dados

### Modelo `Sale` (Prisma)
```prisma
model Sale {
  id                String   @id @default(cuid())
  variantId         String
  variant           ProductVariant @relation(fields: [variantId], references: [id])
  
  quantity          Int      // Quantidade vendida
  salePrice         Float    // Preço de venda (unitário ou total?)
  marketplace       String   // "ml" ou "shopee"
  
  // Custos calculados no momento da venda
  unitCost          Float    // Custo total por unidade (custo+emb+tarifas)
  totalCost         Float    // unitCost × quantity
  totalRevenue      Float    // salePrice × quantity (se unitário) ou salePrice (se total)
  profit            Float    // totalRevenue - totalCost
  profitMargin      Float    // (profit / totalRevenue) * 100
  
  saleDate          DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

## Páginas

### 1. `/admin/vendas` - Registrar Venda
- **Formulário:**
  - Select: Produto (carrega do banco)
  - Input: Quantidade
  - Input: Preço de venda
  - Select: Marketplace (ML ou Shopee)
  - DatePicker: Data da venda
  - Botão: Registrar venda

- **Preview de custos:**
  - Mostra em tempo real enquanto preenche:
    - Custo da variação (por marketplace)
    - Margem estimada
    - Lucro total se vender

### 2. `/admin/vendas/dashboard` - Dashboard
- **Card de Resumo:**
  - Total Faturado
  - Total Custos
  - Lucro Líquido
  - Quantidade de Vendas

- **Tabela de Vendas:**
  - Coluna: Data
  - Coluna: Produto
  - Coluna: Variação
  - Coluna: Quantidade
  - Coluna: Marketplace
  - Coluna: Preço Unitário
  - Coluna: Custo Total
  - Coluna: Lucro
  - Coluna: Margem %
  - Coluna: Ações (editar, deletar)

- **Filtros:**
  - Por data (início e fim)
  - Por marketplace
  - Por produto

## APIs Necessárias

### 1. `POST /api/sales`
- Cria uma nova venda
- Valida:
  - variantId existe
  - quantity > 0
  - salePrice > 0
  - marketplace é válido
- Calcula e salva:
  - unitCost (baseado na variação e marketplace)
  - totalCost
  - totalRevenue
  - profit
  - profitMargin

### 2. `GET /api/sales`
- Lista todas as vendas
- Query params:
  - `page` - paginação
  - `limit` - itens por página
  - `startDate` - filtrar por data início
  - `endDate` - filtrar por data fim
  - `marketplace` - filtrar por marketplace
  - `variantId` - filtrar por variação
- Retorna:
  - Array de vendas
  - Resumo: totalRevenue, totalCost, totalProfit

### 3. `GET /api/sales/[id]`
- Busca uma venda específica

### 4. `PUT /api/sales/[id]`
- Edita uma venda

### 5. `DELETE /api/sales/[id]`
- Deleta uma venda

## Próximos Passos

1. ✅ Adicionar modelo `Sale` ao schema.prisma
2. ⏳ Criar migration
3. ⏳ Criar APIs
4. ⏳ Criar página `/admin/vendas` (formulário)
5. ⏳ Criar dashboard de vendas
6. ⏳ Testar fluxo completo

## Notas

- Considerar se `salePrice` é unitário ou total da venda
- Definir se pode editar/deletar vendas depois
- Considerar relatórios futuros por período, produto, etc.
