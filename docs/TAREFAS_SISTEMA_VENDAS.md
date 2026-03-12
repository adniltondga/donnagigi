# Sistema de Vendas - Tarefas Detalhadas

## Fase 1: Banco de Dados

### 1.1 - Verificar/Adicionar modelo Sale ao schema
**Arquivo:** `prisma/schema.prisma`

**Descrição:** Garantir que o modelo `Sale` está definido corretamente

**Sale model deve ter:**
```prisma
model Sale {
  id                String   @id @default(cuid())
  variantId         String
  variant           ProductVariant @relation(fields: [variantId], references: [id])
  quantity          Int
  salePrice         Float
  marketplace       String   // "ml" ou "shopee"
  unitCost          Float
  totalCost         Float
  totalRevenue      Float
  profit            Float
  profitMargin      Float
  saleDate          DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

**ProductVariant deve ter:**
```prisma
sales            Sale[]  // Relação com vendas
```

**Status:** ✅ FEITO

---

### 1.2 - Criar migration
**Arquivo:** `prisma/migrations/[timestamp]_add_sale_model/`

**Descrição:** Executar `npx prisma migrate dev --name add_sale_model`

**O que faz:**
- Cria tabela `Sale` no banco
- Adiciona constraint de chave estrangeira com `ProductVariant`
- Cria índices para performance

**Status:** ⏳ FAZER

**Comando:**
```bash
npx prisma migrate dev --name add_sale_model
```

---

## Fase 2: APIs

### 2.1 - Criar rota POST /api/sales (Registrar venda)
**Arquivo:** `src/app/api/sales/route.ts`

**Responsabilidades:**
1. Receber dados do formulário em JSON
2. Validar:
   - `variantId` existe no banco
   - `quantity > 0`
   - `salePrice > 0`
   - `marketplace` é "ml" ou "shopee"
3. Buscar variação + produto (para tarifas)
4. Calcular:
   - `unitCost` = usar função `calculateVariantCost()`
   - `totalCost` = unitCost × quantity
   - `totalRevenue` = salePrice × quantity
   - `profit` = totalRevenue - totalCost
   - `profitMargin` = (profit / totalRevenue) × 100
5. Salvar no banco usando `prisma.sale.create()`
6. Retornar a venda criada

**Exemplo de entrada:**
```json
{
  "variantId": "abc123",
  "quantity": 2,
  "salePrice": 50.00,
  "marketplace": "ml",
  "saleDate": "2026-03-12"
}
```

**Exemplo de saída:**
```json
{
  "success": true,
  "data": {
    "id": "sale123",
    "variantId": "abc123",
    "quantity": 2,
    "salePrice": 50.00,
    "marketplace": "ml",
    "unitCost": 22.43,
    "totalCost": 44.86,
    "totalRevenue": 100.00,
    "profit": 55.14,
    "profitMargin": 55.14
  }
}
```

**Status:** ⏳ FAZER

---

### 2.2 - Criar rota GET /api/sales (Listar vendas)
**Arquivo:** `src/app/api/sales/route.ts`

**Responsabilidades:**
1. Implementar método GET (mesmo arquivo que POST)
2. Suportar query params:
   - `page` (padrão: 1)
   - `limit` (padrão: 10)
   - `startDate` (filtro opcional)
   - `endDate` (filtro opcional)
   - `marketplace` (filtro opcional)
   - `variantId` (filtro opcional)
3. Contar total de vendas (para paginação)
4. Buscar vendas com filtros
5. Calcular resumo:
   - totalRevenue (soma de todas as vendas)
   - totalCost (soma de todos os custos)
   - totalProfit (totalRevenue - totalCost)
6. Retornar com paginação

**Exemplo de entrada:**
```
GET /api/sales?page=1&limit=10&marketplace=ml&startDate=2026-03-01&endDate=2026-03-31
```

**Exemplo de saída:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sale123",
      "variant": { "cod": "VAR001", "model": { "name": "iPhone 13" }, "color": { "name": "Preto" } },
      "quantity": 2,
      "salePrice": 50.00,
      "marketplace": "ml",
      "unitCost": 22.43,
      "totalCost": 44.86,
      "totalRevenue": 100.00,
      "profit": 55.14,
      "profitMargin": 55.14,
      "saleDate": "2026-03-12"
    }
  ],
  "summary": {
    "totalRevenue": 500.00,
    "totalCost": 200.00,
    "totalProfit": 300.00,
    "totalQuantity": 10
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

**Status:** ⏳ FAZER

---

### 2.3 - Criar rota PUT /api/sales/[id] (Editar venda)
**Arquivo:** `src/app/api/sales/[id]/route.ts`

**Responsabilidades:**
1. Verificar se venda existe
2. Validar campos atualizáveis (quantity, salePrice, marketplace, saleDate)
3. Recalcular custos se necessário
4. Atualizar no banco
5. Retornar venda atualizada

**Status:** ⏳ FAZER

---

### 2.4 - Criar rota DELETE /api/sales/[id] (Deletar venda)
**Arquivo:** `src/app/api/sales/[id]/route.ts`

**Responsabilidades:**
1. Verificar se venda existe
2. Deletar do banco
3. Retornar sucesso

**Status:** ⏳ FAZER

---

## Fase 3: Frontend - Página de Vendas

### 3.1 - Criar página `/admin/vendas`
**Arquivo:** `src/app/admin/vendas/page.tsx`

**Componentes:**
1. **Título** - "Registrar Venda"
2. **Formulário:**
   - Select: Produto/Variação (carrega de /api/products)
   - Input: Quantidade (número positivo)
   - Input: Preço de venda (R$)
   - Select: Marketplace (dropdown com ML e Shopee)
   - DatePicker: Data da venda
   - Botão: Registrar venda

3. **Preview em tempo real:**
   - Mostra custo estimado enquanto preenche
   - Mostra lucro estimado
   - Atualiza ao mudar marketplace ou quantidade

4. **Feedback:**
   - Mensagem de sucesso após registrar
   - Mensagem de erro se falhar
   - Loading state

**Funcionalidades:**
- Carregar produtos ao montar
- Validar formulário antes de enviar
- Enviar POST para /api/sales
- Limpar formulário após sucesso
- Opção para registrar outra venda

**Status:** ⏳ FAZER

---

## Fase 4: Frontend - Dashboard de Vendas

### 4.1 - Criar página `/admin/vendas/dashboard`
**Arquivo:** `src/app/admin/vendas/dashboard/page.tsx`

**Seções:**

#### A. Cards de Resumo (Topo)
- **Card 1: Total Faturado**
  - Valor grande em R$
  - Ícone de dinheiro
  - Cor azul

- **Card 2: Total de Custos**
  - Valor grande em R$
  - Ícone de custo
  - Cor laranja

- **Card 3: Lucro Líquido**
  - Valor grande em R$
  - Ícone de lucro
  - Cor verde (se lucro) ou vermelho (se prejuízo)

- **Card 4: Quantidade Vendida**
  - Número de vendas
  - Ícone de carrinho
  - Cor roxo

#### B. Filtros (Acima da tabela)
- DateRange: Data início - Data fim
- Select: Marketplace (Todas, ML, Shopee)
- Select: Produto (Todos, lista de produtos)
- Botão: Aplicar filtros
- Botão: Limpar filtros

#### C. Tabela de Vendas
Colunas:
- Data
- Produto (modelo - cor)
- Variação (COD)
- Quantidade
- Marketplace (com badge de cor)
- Preço Unitário
- Custo Total
- Lucro
- Margem %
- Ações (editar, deletar)

Comportamento:
- Paginação (10 itens por página)
- Ordenação por data (mais recente primeiro)
- Hover na linha mostra detalhes
- Clique em editar abre modal
- Clique em deletar pede confirmação

**Funcionalidades:**
- Carregar vendas ao montar (page=1, limit=10)
- Aplicar filtros ao enviar
- Calcular resumo automaticamente
- Recarregar lista após editar/deletar
- Loading state
- Mensagem vazio se nenhuma venda

**Status:** ⏳ FAZER

---

### 4.2 - Criar modal de edição
**Arquivo:** `src/app/admin/vendas/dashboard/page.tsx` (mesmo arquivo)

**Campos editáveis:**
- Quantidade
- Preço de venda
- Marketplace
- Data da venda

**Comportamento:**
- Envia PUT para /api/sales/[id]
- Reeja lista ao confirmar
- Mensagem de sucesso/erro

**Status:** ⏳ FAZER

---

## Fase 5: Integração

### 5.1 - Adicionar link no menu admin
**Arquivo:** `src/components/AdminSidebar.tsx`

**O quê:** Adicionar item "Vendas" no menu lateral

**Link:** `/admin/vendas`

**Status:** ⏳ FAZER

---

### 5.2 - Adicionar rota ao layout
**Arquivo:** `src/app/admin/layout.tsx` (se existir)

**O quê:** Garantir que `/admin/vendas` e `/admin/vendas/dashboard` são acessíveis

**Status:** ⏳ FAZER

---

## Resumo de Arquivos a Criar/Modificar

| Arquivo | Tipo | Status |
|---------|------|--------|
| `prisma/schema.prisma` | Modificar | ✅ FEITO |
| `prisma/migrations/[...]` | Criar | ⏳ FAZER |
| `src/app/api/sales/route.ts` | Criar | ⏳ FAZER |
| `src/app/api/sales/[id]/route.ts` | Criar | ⏳ FAZER |
| `src/app/admin/vendas/page.tsx` | Criar | ⏳ FAZER |
| `src/app/admin/vendas/dashboard/page.tsx` | Criar | ⏳ FAZER |
| `src/components/AdminSidebar.tsx` | Modificar | ⏳ FAZER |

---

## Ordem Recomendada de Implementação

1. ✅ Schema + Migration
2. → APIs (POST, GET, com filtros)
3. → Página de registrar venda
4. → Dashboard
5. → Editar/Deletar
6. → Menu integration

---

## Notas Importantes

- Use a função `calculateVariantCost()` que já existe no código
- Use `formatCurrency()` para exibir valores em R$
- Considerar timezone ao salvar datas
- Testar com dados reais do banco
- Validar entrada em ambos cliente e servidor
- Considerar soft delete para vendas (archive em vez de deletar)?

