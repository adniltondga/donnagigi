# Integração de Faturamento Mercado Livre → Financeiro

## ✅ Implementação Concluída (20/03/2026)

### 1. Schema Prisma
**Arquivo:** `prisma/schema.prisma`

Adicionados dois novos modelos:

#### Model Supplier
```prisma
model Supplier {
  id        String   @id @default(cuid())
  name      String
  bills     Bill[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### Model Bill
```prisma
model Bill {
  id          String   @id @default(cuid())
  type        String   // "payable" | "receivable"
  description String
  amount      Float
  dueDate     DateTime
  paidDate    DateTime?
  status      String   @default("pending") // pending | paid | overdue | cancelled
  category    String   @default("outro") // fornecedor | marketplace_fee | venda | outro
  supplierId  String?
  supplier    Supplier? @relation(...)
  notes       String?  @db.Text
  mlOrderId   String?  @unique  // evita duplicatas
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 2. APIs de Bills

#### `POST/GET /api/bills` — Lista e cria contas
- **GET:** Retorna lista paginada (10 itens/página) com:
  - Bills com informações do fornecedor
  - Summary com totais (a pagar, a receber, vencidas)
  - Cálculo de saldo (receita - despesa)

- **POST:** Cria nova conta com:
  - Validação de campos obrigatórios
  - Proteção contra duplicatas (mlOrderId único)
  - Retorna a bill criada com fornecedor

#### `GET/PUT/DELETE /api/bills/[id]`
- **GET:** Retorna uma bill específica
- **PUT:** Atualiza campos (descrição, valor, vencimento, categoria, fornecedor, notas)
- **DELETE:** Remove a bill

#### `PATCH /api/bills/[id]/pay`
- Marca a bill como paga
- Define paidDate automaticamente
- Muda status para "paid"

### 3. API de Suppliers

#### `GET /api/suppliers` — Lista fornecedores
- Retorna array de fornecedores ordenados por nome
- Usado pela página de financeiro

#### `POST /api/suppliers` — Cria fornecedor
- Cria novo fornecedor
- Validação de nome obrigatório

### 4. Sincronização de Pedidos ML

**Arquivo:** `src/app/api/ml/sync-orders/route.ts`

#### Fluxo:
1. Busca integração ML ativa no banco
2. Valida token (não expirado)
3. Chama API do ML: `GET /orders/search?seller={id}&order.status=paid`
4. Para cada pedido novo (sem mlOrderId):
   - Cria **Bill Receivable** (venda):
     - tipo: receivable
     - categoria: venda
     - descrição: "Venda ML - {título produto}"
     - valor: total_amount do pedido
     - status: paid (já foi pago no ML)
     - paidDate: data do pedido
     - mlOrderId: `order_{id}`

   - Cria **Bill Payable** (taxa):
     - tipo: payable
     - categoria: marketplace_fee
     - descrição: "Taxa ML - {título produto}"
     - valor: 13% do total (taxa média)
     - status: paid
     - mlOrderId: `fee_{id}`

5. Retorna stats (total, criados, pulados)

### 5. Cron Automático Diário

**Arquivo:** `vercel.json`

```json
{
  "crons": [{
    "path": "/api/ml/sync-orders",
    "schedule": "0 6 * * *"
  }]
}
```

Executa automaticamente às 6h da manhã todos os dias (UTC).

### 6. Botão de Sincronização Manual

**Arquivo:** `src/app/admin/integracao/integracao-content.tsx`

Adicionado botão "Sincronizar Vendas para Financeiro" que:
- Dispara `/api/ml/sync-orders` manualmente
- Mostra status de sincronização
- Exibe resultado com estatísticas
- Estados: idle, loading, success, error

### 7. Integração com Página Financeira

A página em `/admin/financeiro` já estava preparada para usar:
- `GET /api/bills?page={n}&limit=10` ✓
- `GET /api/suppliers` ✓
- Todos os endpoints necessários estão implementados

## 📊 Verificação

### Database
- [x] Tables `Bill` e `Supplier` criadas com `npx prisma db push`
- [x] Schema válido (verificado com `npx prisma generate`)

### APIs
- [x] `/api/bills` (GET/POST)
- [x] `/api/bills/[id]` (GET/PUT/DELETE)
- [x] `/api/bills/[id]/pay` (PATCH)
- [x] `/api/suppliers` (GET/POST)
- [x] `/api/ml/sync-orders` (GET)

### UI
- [x] Botão de sincronização adicionado à página de integrações
- [x] Integração com página de financeiro existente

### Cron
- [x] `vercel.json` configurado com cron job

## 🚀 Próximos Passos

1. **Teste Manual:**
   ```bash
   # 1. Verificar que ML está conectado
   # 2. Clicar "Sincronizar Vendas para Financeiro" em /admin/integracao
   # 3. Verificar que bills aparecem em /admin/financeiro
   # 4. Conferir que saldos estão corretos
   ```

2. **Monitoramento:**
   - Verificar logs do cron em vercel.com
   - Acompanhar sincronizações automáticas

3. **Refinamentos Futuros:**
   - Ajustar taxa do ML (atualmente 13%, pode variar por tipo de produto)
   - Adicionar tratamento de estornos/devoluções
   - Criar relatórios de reconciliação ML ↔ Financeiro

## 📝 Notas

- Bills de vendas (receivable) e taxas (payable) são criadas em pares
- mlOrderId único garante que pedidos não sejam duplicados
- Status "paid" é automático para pedidos do ML (já foram pagos lá)
- Datas são preservadas do pedido original no ML
- Notas incluem ID do comprador e número do pedido para rastreabilidade
