# 🔄 MUDANÇA DE ESTRATÉGIA: Nova Abordagem de Sincronismo

**Data**: 19 de março de 2026
**Status**: 🆕 PROPOSTA E VALIDADA
**Decisão**: ✅ APROVADA

---

## ❌ Problema da Abordagem Anterior

**O que estávamos fazendo:**
```
Mercado Livre (Source of Truth)
    ↓ Sincronismo UNI-DIRECIONAL
Sistema (Replica)
```

**Problemas:**
1. ML é a fonte de verdade
2. Não há controle sobre atributos (cor, tamanho, modelo)
3. Usuário não pode cadastrar produtos aqui
4. Variações limitadas aos dados do ML
5. Sem flexibilidade para criar estrutura própria

---

## ✅ Nova Estratégia: Sistema como Source of Truth

**O que deveria ser:**
```
Sistema (Source of Truth)
    ↓ Sincronismo BI-DIRECIONAL
Mercado Livre (Marketplace)
Shopee (Marketplace)
Outros (Marketplaces futuros)
```

**Benefícios:**
1. ✅ Sistema é a fonte de verdade
2. ✅ Controle total sobre atributos (DeviceColor, DeviceModel)
3. ✅ Usuário cadastra aqui e publica nos marketplaces
4. ✅ Variações criadas com estrutura própria
5. ✅ Sincronismo bi-direcional (preço, estoque)
6. ✅ Fácil integrar futuros marketplaces

---

## 🔄 Fluxo Novo (Proposto)

### Parte 1: Cadastro Local (Administrador)

```
1. Admin entra no sistema
2. Clica "Novo Produto"
3. Preenche:
   ├─ Nome
   ├─ Descrição
   ├─ Preço Base
   ├─ Estoque Mínimo
   ├─ Categoria
   └─ Imagens (thumbnail)
4. Adiciona Variações:
   ├─ Seleciona cor (DeviceColor)
   ├─ Seleciona modelo (DeviceModel)
   ├─ Define quantidade
   ├─ Define preço (opcional, herda do base)
5. Clica "Publicar no ML"
```

### Parte 2: Publicação no Marketplace

```
Sistema processa:
├─ Monta JSON para ML conforme especificação
├─ Faz POST /items para criar anúncio
├─ Cria ProductVariant para cada variação
├─ Salva mlListingId (reference ao anúncio)
└─ Retorna link do anúncio criado
```

### Parte 3: Sincronismo Contínuo

```
A cada 6h ou quando mudar:
├─ Sincroniza preço
├─ Sincroniza estoque
├─ Sincroniza descrição
└─ Recebe dados de vendas do ML
```

---

## 📊 Estrutura de Dados (BDD)

### ANTES (Sincronismo FROM ML)
```
Product (do ML)
  ├─ mlListingId (do ML)
  └─ ProductVariant (extraído do ML)
```

### DEPOIS (Sistema como Source)
```
Product (CRIADO AQUI)
  ├─ name (definido aqui)
  ├─ description (definido aqui)
  ├─ baseSalePrice (definido aqui)
  └─ ProductVariant (criado aqui)
      ├─ colorId (DeviceColor - escolhido aqui)
      ├─ modelId (DeviceModel - escolhido aqui)
      ├─ preco (específico ou herda)
      ├─ estoque (específico)
      └─ mlListingId (DEPOIS de publicar)
```

---

## 🎯 Mudanças Necessárias

### 1. Desabilitar Sincronismo FROM ML
```typescript
// REMOVER ou desabilitar:
- GET /api/ml/sync  (sincroniza FROM ML)
- GET /api/ml/enrich/batch  (enriquece dados DO ML)
- processProductVariations()  (processa variations DO ML)

// REPARAR para new strategy:
- POST /api/ml/publish  (NOVO - publica PARA ML)
- POST /api/ml/update-stock  (NOVO - atualiza estoque)
- POST /api/ml/update-price  (NOVO - atualiza preço)
```

### 2. Novo Fluxo de Publicação
```
POST /api/ml/publish
  ├─ Input: productId, variantIds[]
  ├─ Valida dados completos
  ├─ Monta JSON para ML
  ├─ Faz POST /items no ML
  ├─ Recebe mlListingId
  └─ Salva no ProductVariant.mlListingId
```

### 3. Sincronismo de Estoque
```
GET /api/ml/sync-stock (NEW)
  ├─ Para cada variant com mlListingId
  ├─ Busca dados atuais no ML
  ├─ Compara com estoque local
  ├─ Publica mudanças → ML
  └─ Atualiza timestamps
```

### 4. Sincronismo de Preço
```
GET /api/ml/sync-price (NEW)
  ├─ Para cada variant com preço diferente
  ├─ Calcula margin/tarifa
  ├─ Publica novo preço → ML
  └─ Atualiza mlPrice
```

---

## 📋 Checklist de Implementação

### Fase 1: Documentação e Planejamento
- [x] Identificar problema da estratégia antiga
- [x] Documentar nova estratégia
- [x] Validar com usuário
- [ ] Criar diagrama de fluxo visual

### Fase 2: Refatoração do Código
- [ ] Desabilitar endpoints FROM ML
- [ ] Criar endpoint POST /api/ml/publish
- [ ] Criar endpoint GET /api/ml/sync-stock
- [ ] Criar endpoint GET /api/ml/sync-price
- [ ] Adicionar UI button "Publicar no ML"

### Fase 3: Testes
- [ ] Testar publicação de 1 produto
- [ ] Testar publicação com múltiplas cores
- [ ] Testar sincronismo de estoque
- [ ] Testar sincronismo de preço

### Fase 4: Deploy
- [ ] Migração de dados (se necessário)
- [ ] Deploy em staging
- [ ] Teste em produção
- [ ] Deploy final

---

## 🔌 Integração com ML API

### Criar Anúncio (POST)
```bash
POST https://api.mercadolivre.com/items?access_token=TOKEN

{
  "title": "Capinha iPhone 14 - Preto",
  "description": "...",
  "category_id": "MLB262711",
  "price": 99.90,
  "currency_id": "BRL",
  "available_quantity": 5,
  "listing_type_id": "gold_pro",
  "variations": [
    {
      "attribute_combinations": [
        {"name": "color", "value_id": "52002"}
      ],
      "quantity": 5,
      "price": 99.90,
      "picture_ids": ["pic_1"]
    }
  ]
}

Response: { "id": "MLB1234567890", ... }
```

### Atualizar Anúncio (PUT)
```bash
PUT https://api.mercadolivre.com/items/MLB1234567890?access_token=TOKEN

{
  "available_quantity": 10,  # atualizar estoque
  "price": 109.90            # atualizar preço
}
```

---

## 💾 Impacto na Database

### NÃO muda schema
Temos tudo que precisa:
- ✅ Product (base)
- ✅ ProductVariant (cores, modelos)
- ✅ DeviceColor / DeviceModel (atributos)
- ✅ MLProduct (linking)

### Muda fluxo de dados
- FROM ML → Sistema (REMOVER)
- Sistema → ML (NOVO)

---

## 🎓 Vantagens da Nova Abordagem

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Source of Truth | ML | Sistema ✅ |
| Controle de atributos | Limitado (do ML) | Completo ✅ |
| Cadastro de produtos | Não (sync apenas) | Sim ✅ |
| Flexibilidade | Baixa | Alta ✅ |
| Múltiplos marketplaces | Difícil | Fácil ✅ |
| Sincronismo | Uni | Bi ✅ |
| Preço negociável | Não | Sim ✅ |

---

## 📝 Próximos Passos Imediatos

**Se aprovado:**

1. ✅ Documentação criada (ESTE ARQUIVO)
2. ⏳ Criar diagrama visual do novo fluxo
3. ⏳ Desabilitar endpoints antigos (marcar como deprecated)
4. ⏳ Criar novo endpoint POST /api/ml/publish
5. ⏳ Testar publicação com 1 produto
6. ⏳ Integrar botão no UI admin
7. ⏳ Deploy em staging

---

## 🔑 Decisão Final

**Proposta**: Mudar de "Sincronizar FROM ML" para "Publicar PARA ML"
**Status**: ✅ VALIDADA COM USUÁRIO
**Aprovação**: SIM
**Próximo**: Iniciar Fase 2 (Refatoração)

---

**Arquivo**: `/docs/ML_NOVA_ESTRATEGIA.md`
**Data**: 19 de março de 2026
**Versão**: 1.0
