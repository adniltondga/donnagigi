# 🚀 Nova Estratégia de Sincronismo - Resumo Executivo

**Status**: ✅ APROVADA
**Data**: 19 de março de 2026
**Decisão**: Sistema → Source of Truth (não ML)

---

## 📊 O que Muda

### ❌ ANTES
```
Mercado Livre (dados master)
    ↓ sync FROM ML
Sistema (cópia dos dados)
Problema: Sem controle, sem atributos locais
```

### ✅ DEPOIS
```
Sistema (dados master)
    ↓ publish PARA ML
    ↓ publish PARA Shopee
    ↓ publish PARA outros
Vantagem: Controle total, atributos locais, multi-marketplace
```

---

## 🎯 Mudanças Simples

| Função | Antes | Depois |
|--------|-------|--------|
| **Cadastro** | Não tinha | ✅ Aqui no sistema |
| **Variações** | Do ML | ✅ DeviceColor/Model local |
| **Publicação** | Automática FROM ML | ✅ Manual "Publicar" button |
| **Controle** | Sem | ✅ 100% aqui |

---

## 🔧 Endpoints Novos

### 1. Publicar Produto
```bash
POST /api/ml/publish
Input: { productId, variantIds[], images[] }
Output: { mlListingId, url, status }
```

### 2. Atualizar Estoque
```bash
POST /api/ml/update-stock
Input: { variantId, newStock }
Output: { success, mlStock }
```

### 3. Atualizar Preço
```bash
POST /api/ml/update-price
Input: { variantId, newPrice }
Output: { success, mlPrice }
```

---

## ✅ Próximos Passos

1. ⏳ Desabilitar endpoints FROM ML (antigos)
2. ⏳ Criar POST /api/ml/publish
3. ⏳ Testar publicação
4. ⏳ Criar UI button "Publicar"
5. ⏳ Deploy

---

**Documento Completo**: `/docs/ML_NOVA_ESTRATEGIA.md`
**Implementação**: Fase 2 (Refatoração)
