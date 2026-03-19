# 🚀 Guia Prático: Enriquecimento Rápido de Produtos

## Teste Rápido com 1 Produto

### 1️⃣ Ver o que seria mapeado
```bash
curl "http://localhost:3000/api/ml/enrich/test?mlListingId=MLB0000000025"
```

**Output esperado:**
```json
{
  "preview_atualizacao": {
    "seria_atualizado": {
      "nome": "Transformador 12V 5A - Produto teste",
      "descricao": "Transformador 12V 5A com alta eficiência...",
      "baseSalePrice": 199.9,
      "minStock": 12,
      "active": true
    },
    "avisos_validacao": []
  }
}
```

### 2️⃣ Aplicar no produto
```bash
curl -X POST "http://localhost:3000/api/ml/enrich/apply" \
  -H "Content-Type: application/json" \
  -d '{
    "mlListingId": "MLB0000000025",
    "mapping": {
      "mapping": {
        "name": "Transformador 12V 5A - Produto teste",
        "description": "Transformador 12V 5A com alta eficiência...",
        "baseSalePrice": 199.90,
        "minStock": 12,
        "active": true,
        "currency": "BRL",
        "imageUrl": null,
        "categoryId": null
      }
    }
  }'
```

---

## Enriquecer Todos os 25 Produtos

### ⚡ Executar em Batch (one-liner)
```bash
curl http://localhost:3000/api/ml/enrich/batch | jq '.resumo'
```

**Output esperado:**
```json
{
  "total_processados": 50,
  "atualizados": 50,
  "erros": 0,
  "taxa_sucesso": "100.0%"
}
```

---

## Tabela Rápida: O que é Mapeado

| De (ML) | Para (App) | Exemplo |
|---------|-----------|---------|
| `id` | `mlListingId` | `MLB4518332721` |
| `title` | `name` | `Transformador 12V 5A` |
| `description.plain_text` | `description` | `Transformador com alta...` |
| `price` | `baseSalePrice` | `199.90` |
| `price` | `baseMLPrice` | `199.90` |
| `inventory.quantity` | `minStock` | `5` |
| `status: "active"` | `active: true` | `true` |

---

## Fluxo Visual

```
┌─────────────────────────────────────────────────────┐
│ MERCADO LIVRE (API)                                  │
│ ├─ id: "MLB4518332721"                              │
│ ├─ title: "Transformador 12V 5A"                   │
│ ├─ price: 199.90                                    │
│ ├─ inventory.quantity: 5                            │
│ └─ status: "active"                                 │
└───────────────────────┬─────────────────────────────┘
                        │ MAPEAR
                        ▼
     ┌──────────────────────────────────┐
     │ /api/ml/enrich/test (PREVIEW)    │
     │ Mostra o que seria atualizado    │
     └───────┬──────────────────────────┘
             │ VALIDADO? SIM
             ▼
     ┌──────────────────────────────────┐
     │ /api/ml/enrich/apply (SAVE)      │
     │ Salva no banco                   │
     └───────┬──────────────────────────┘
             │
             ▼
     ┌──────────────────────────────────┐
     │ BANCO DE DADOS                   │
     │ ├─ mlListingId: "MLB4518..."     │
     │ ├─ name: "Transformador 12V..."  │
     │ ├─ baseSalePrice: 199.90         │
     │ ├─ minStock: 5                   │
     │ └─ active: true                  │
     └──────────────────────────────────┘
```

---

## Comandos de Verificação

### Ver produto ANTES de enriquecer
```bash
curl "http://localhost:3000/api/products" | jq '.data[0] | {nome: .name, preco: .baseSalePrice, estoque: .minStock}'
```

### Ver produto DEPOIS de enriquecer
```bash
curl "http://localhost:3000/api/products" | jq '.data[0] | {nome: .name, preco: .baseSalePrice, precoML: .baseMLPrice, estoque: .minStock, ativo: .active}'
```

### Ver detalhes de um produto específico
```bash
curl "http://localhost:3000/api/products?limit=100" | jq '.data[] | select(.mlListingId == "MLB0000000025")'
```

---

## Status Atual

✅ **50 produtos enriquecidos**
- 50 atualizados
- 0 erros
- Taxa de sucesso: 100%

---

## Próximos Passos

1. **Integrar no `/api/ml/sync`** principal
   - Após sincronizar 25 produtos, rodar batch automaticamente

2. **Adicionar imagens**
   - Download de `pictures[0].url`
   - Armazenar em storage

3. **Criar variações**
   - Extrair cor, tamanho, modelo
   - Criar ProductVariant automaticamente

---

## Troubleshooting

### Erro: "Produto não encontrado no banco"
**Causa**: mlListingId não existe em produto

**Solução**: 
```bash
# Sincronize primeiro
curl http://localhost:3000/api/ml/sync

# Depois enriqueça
curl http://localhost:3000/api/ml/enrich/batch
```

### Erro: "Parâmetro mlListingId obrigatório"
**Causa**: Falta parâmetro na URL

**Solução**:
```bash
# ❌ Errado
curl "http://localhost:3000/api/ml/enrich/test"

# ✅ Correto
curl "http://localhost:3000/api/ml/enrich/test?mlListingId=MLB0000000025"
```

---

## Integração no UI (Futuro)

```tsx
// Botão no admin
<Button onClick={() => fetch('/api/ml/enrich/batch')}>
  Enriquecer Todos os Produtos
</Button>
```

---

**Documentação**: Veja `/docs/ML_DEPARA_CAMPOS.md` para detalhes técnicos completos.
