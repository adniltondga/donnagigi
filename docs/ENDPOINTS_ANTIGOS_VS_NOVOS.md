# 📌 Endpoints ML - Antes vs Depois

## Estratégia Anterior ❌ 
**Sincronizar FROM ML → Sistema**
- Dados vinham do ML
- Sistema recebia alterações
- Não tinha controle total sobre produtos

---

## Estratégia Nova ✅
**Publicar TO ML ← Sistema é Fonte de Verdade**
- Dados criados no sistema
- Sistema controla tudo
- ML recebe atualizações

---

## 📋 Tabela Comparativa

| Endpoint | Método | Antiga | Status | Motivo |
|----------|--------|--------|--------|--------|
| `/api/ml/sync` | POST | ✅ Sim | ✅ Manter | Sincronizar produtos iniciais do ML (uma única vez) |
| `/api/ml/debug/variations-structure` | GET | ✅ Sim | ⚠️ Deprecado | Mapeamento FROM ML - não mais necessário |
| `/api/ml/debug/token-info` | GET | ✅ Sim | ✅ Manter | Verificar validade do token |
| `/api/ml/debug/process-variants` | POST | ✅ Sim | ⚠️ Deprecado | Processamento FROM ML - integrado no sync |
| `/api/ml/enrich/test` | POST | ✅ Sim | ❌ Remover | Preview de mapeamento (estratégia antiga) |
| `/api/ml/enrich/apply` | POST | ✅ Sim | ❌ Remover | Aplicar mapeamento (estratégia antiga) |
| `/api/ml/enrich/batch` | POST | ✅ Sim | ❌ Remover | Batch enrichment (estratégia antiga) |
| `/api/ml/map-attributes` | POST | ✅ Sim | ❌ Remover | Mapeamento de cores (estratégia antiga) |
| **`/api/ml/publish`** | **POST** | ❌ Novo | ✅ **Novo** | **🆕 Publicar produtos TO ML** |
| **`/api/ml/sync-inventory`** | **POST** | ❌ Novo | ✅ **Novo** | **🆕 Sincronizar estoque TO ML** |
| **`/api/ml/sync-price`** | **POST** | ❌ Novo | ✅ **Novo** | **🆕 Sincronizar preço TO ML** |

---

## 🆕 NOVOS ENDPOINTS - Como Usar

### 1️⃣ **Publicar Produto no ML**
```
POST /api/ml/publish
{
  "productId": "...",
  "variantIds": ["...", "..."],
  "titulo": "Chinelo Donna Gigi Rosa",
  "categoria_ml": "246427"
}
```

**Retorna**:
```json
{
  "mlListingId": "MLB123456789",
  "mlUrl": "https://produto.mercadolivre.com.br/MLB-123456789",
  "variantes_publicadas": 2
}
```

---

### 2️⃣ **Sincronizar Estoque**
```
POST /api/ml/sync-inventory

// Opção 1: Uma variante
{
  "variantId": "...",
  "newStock": 45
}

// Opção 2: Todas as publicadas
{
  "batch": true
}
```

**Retorna**:
```json
{
  "sincronizadas": 25,
  "erros": 0,
  "taxa": "100%"
}
```

---

### 3️⃣ **Sincronizar Preço**
```
POST /api/ml/sync-price

// Opção 1: Uma variante
{
  "variantId": "...",
  "newPrice": 199.90
}

// Opção 2: Todas as publicadas
{
  "batch": true
}
```

**Retorna**:
```json
{
  "sincronizadas": 25,
  "erros": 0,
  "taxa": "100%"
}
```

---

## 🔄 FLUXO DO NOVO SISTEMA

```
┌─────────────────────────┐
│  Admin Cria Produto     │
│  (no Sistema)           │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Define Variantes       │
│  (cores, tamanhos)      │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Clica "Publicar no ML" │
│  POST /api/ml/publish   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  Produto vai ao AR      │
│  no Mercado Livre       │
└────────────┬────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌──────────┐   ┌──────────────┐
│ Venda?   │   │ Atualizações │
│          │   │ (preço/estoque)
└────┬─────┘   │ POST endpoints
     │         └──────────────┘
     ▼
┌─────────────────────────┐
│ Pedido entra no Sistema │
│ (webhook/integração)    │
└─────────────────────────┘
```

---

## ✅ Status de Implementação

- ✅ `/api/ml/publish` - Pronto para testar
- ✅ `/api/ml/sync-inventory` - Pronto para testar
- ✅ `/api/ml/sync-price` - Acabado de criar
- ⏳ Teste end-to-end
- ⏳ UI: Botão "Publicar no ML"
- ⏳ Documentação admin

---

## 📝 Próximos Passos

1. **Testar Endpoints**
   ```bash
   curl -X POST http://localhost:3000/api/ml/publish \
     -H "Content-Type: application/json" \
     -d '{"productId":"...","variantIds":["..."]}'
   ```

2. **Integrar UI**
   - Adicionar botão "Publicar no ML" ao painel de admin
   - Mostrar status: "Publicado", "Não publicado", "Erro"
   - Exibir mlListingId quando publicado

3. **Deprecar Endpoints Antigos**
   - Remover `/api/ml/enrich/*`
   - Remover `/api/ml/map-attributes`
   - Marcar debug como "uso interno"

4. **Adicionar Webhooks**
   - Receber atualizações de vendas do ML
   - Atualizar números de pedido
   - Sincronizar feedback/ratings

---

**Última atualização**: 2024-12
**Estratégia**: Sistema é Fonte de Verdade 🎯
