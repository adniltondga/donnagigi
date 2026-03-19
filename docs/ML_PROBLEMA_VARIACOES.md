# 🚨 PROBLEMA: Produtos com Variações Não Estão Sendo Inseridos

**Data**: 19 de março de 2026
**Status**: 🔴 IDENTIFICADO E DOCUMENTADO
**Severidade**: ⚠️ ALTA

---

## 📋 O Problema

Produtos do Mercado Livre que possuem variações (cores, tamanhos, modelos, etc.) **não estão sendo inseridos corretamente** no sistema.

### Sintomas
- ✅ Produtos **sem variações** são sincronizados normalmente
- ❌ Produtos **com múltiplas cores/modelos** aparecem como simples (sem variações)
- ❌ As variações não são extraídas do ML
- ❌ ProductVariant não é criada no banco

---

## 🔍 Causa Raiz

O endpoint `/api/ml/sync` cria **apenas o Product base**, ignorando completamente a estrutura `variations` da resposta do ML.

### Fluxo Atual (Incompleto)
```
ML Response (com variations)
    ↓
Sync extrai: id, title, price, status
    ↓
Salva: 1 Product (base)
    ✗ IGNORA: .variations array
    ✗ NÃO CRIA: ProductVariant
```

### O que Deveria Acontecer (Futuro)
```
ML Response (com variations)
    ↓
Sync extrai: id, title, price, status, variations
    ↓
Salva: 1 Product (base)
    ↓
Para cada variation:
    → Cria 1 ProductVariant
    → Com cod, salePrice, stock específicos
    → Com atributos (color, modelo, etc)
```

---

## 📊 Estrutura de Variações do ML

### Exemplo: Capinha com 3 cores

```json
{
  "id": "MLB1234567890",
  "title": "Capinha iPhone 14 Pro - Multi Cores",
  "price": 99.90,
  "variations": [
    {
      "id": "MLB1234567890-5678901",
      "attribute_combinations": [
        {
          "name": "color",
          "value_id": "52002",
          "value": "Preto"
        }
      ],
      "price": 99.90,
      "available_quantity": 5,
      "picture_ids": ["pic_1"]
    },
    {
      "id": "MLB1234567890-5678902",
      "attribute_combinations": [
        {
          "name": "color",
          "value_id": "52000",
          "value": "Branco"
        }
      ],
      "price": 99.90,
      "available_quantity": 8,
      "picture_ids": ["pic_2"]
    },
    {
      "id": "MLB1234567890-5678903",
      "attribute_combinations": [
        {
          "name": "color",
          "value_id": "52001",
          "value": "Azul"
        }
      ],
      "price": 99.90,
      "available_quantity": 3,
      "picture_ids": ["pic_3"]
    }
  ]
}
```

---

## 🗂️ Como Deveria Mapear no Banco

### Product (1 por anúncio ML)
```
Product {
  mlListingId: "MLB1234567890",
  name: "Capinha iPhone 14 Pro - Multi Cores",
  description: "",
  baseSalePrice: 99.90,      ← Preço da 1ª variação
  minStock: 16,               ← Soma de todas (5+8+3)
  active: true
}
```

### ProductVariant (1 por color/modelo/etc)
```
ProductVariant[0] {
  productId: <ID do Product>,
  cod: "MLB123-COL-PRE",      ← Color-Preto
  salePrice: 99.90,
  stock: 5,
  color: <Preto relationship>
}

ProductVariant[1] {
  productId: <ID do Product>,
  cod: "MLB123-COL-BRA",      ← Color-Branco
  salePrice: 99.90,
  stock: 8,
  color: <Branco relationship>
}

ProductVariant[2] {
  productId: <ID do Product>,
  cod: "MLB123-COL-AZU",      ← Color-Azul
  salePrice: 99.90,
  stock: 3,
  color: <Azul relationship>
}
```

---

## 🎯 Solução em 4 Passos

### Passo 1: Detectar Variações
- [ ] Verificar se `response.variations` existe
- [ ] Contar quantas variações tem
- [ ] Se zero → produto simples (sem variante)
- [ ] Se > 0 → produto com variações

### Passo 2: Criar ProductVariant para Cada Uma
- [ ] Para cada variation no array
- [ ] Extrair `attribute_combinations` (color, model, size, etc)
- [ ] Gerar código único (`cod`)
- [ ] Criar ProductVariant com preço e estoque específicos

### Passo 3: Mapear Atributos
- [ ] Se `name: "color"` → link com DeviceColor
- [ ] Se `name: "model"` → link com DeviceModel
- [ ] Se outros atributos → ProductAttribute + ProductAttributeValue

### Passo 4: Sincronizar com ML
- [ ] Cada ProductVariant tem `mlListingId` único
- [ ] Vincular via MLProduct table
- [ ] Permite sincronismo bidirecional

---

## 🛠️ Endpoints Criados para Debug

### 1. Estrutura de Variações
```bash
curl http://localhost:3000/api/ml/debug/variations-structure
```
**Resultado**: Mostra como ML estrutura variações

### 2. Processar Variações de UM Produto
```bash
curl "http://localhost:3000/api/ml/process-variants?mlListingId=MLB0000000025"
```
**Resultado**: Extrai e cria variantes no banco

---

## 📊 Dados Observados

### Produto Sem Variações
```json
{
  "id": "MLB4518332721",
  "title": "Transformador 12V 5A",
  "variations": []  ← ARRAY VAZIO
}
```

### Produto Com Variações
```json
{
  "id": "MLB1234567890",
  "title": "Capinha - Multi Cores",
  "variations": [
    { /* variation 1 */ },
    { /* variation 2 */ },
    { /* variation 3 */ }
  ]
}
```

---

## ✅ Checklist de Implementação

- [ ] Endpoint de debug criado (estrutura)
- [ ] Endpoint de processo de variações criado
- [ ] Testar com 1 produto com variações
- [ ] Modificar `/api/ml/sync` para processar variações
- [ ] Testar sync batch com variações
- [ ] Documentar atributos (color → DeviceColor, etc)
- [ ] Integrar no UI admin
- [ ] Deploy em produção

---

## 🚀 Próximos Passos

### Imediato (Priority 1)
1. **Testar endpoint de variações**
   ```bash
   curl "http://localhost:3000/api/ml/process-variants?mlListingId=MLB0000000025"
   ```

2. **Verificar quantos produtos têm variações**
   - Rodar em loop em alguns produtos
   - Ver quantos ativam o processo

3. **Modificar sync principal**
   - Adicionar processamento de `.variations`
   - Testar com batch de 25

### Próximo (Priority 2)
- [ ] Mapear atributos ML → App (color, size, model)
- [ ] Extrair images por variação
- [ ] Criar UI para visualizar variações

### Futuro (Priority 3)
- [ ] Sincronismo de quantidade por variação
- [ ] Atualização de preços por cor
- [ ] Webhooks para mudanças de variações

---

## 📁 Arquivos Relacionados

**Criados para Debug**:
- `/src/app/api/ml/debug/variations-structure/route.ts` - Estrutura
- `/src/app/api/ml/process-variants/route.ts` - Processar variações

**Precisam Modificar**:
- `/src/app/api/ml/sync/route.ts` - Adicionar processo de variações
- `/src/app/api/ml/enrich/batch/route.ts` - Incluir variações

---

## 💡 Exemplo de Comando Para Testar

### 1. Ver estrutura de variações
```bash
curl http://localhost:3000/api/ml/debug/variations-structure | jq .
```

### 2. Processar variações de um produto
```bash
curl "http://localhost:3000/api/ml/process-variants?mlListingId=MLB0000000025" | jq '.resumo'
```

### 3. Ver antes/depois na DB
```bash
# Antes: sem variantes
curl "http://localhost:3000/api/products" | jq '.data[0] | {name, variants}'

# Depois: com variantes criadas
curl "http://localhost:3000/api/products" | jq '.data[0] | {name, variants}'
```

---

## 📝 Conclusão

**Problema**: Sync não extrai nem processa variações do ML
**Impacto**: Produtos com múltiplas cores/modelos aparecem como simples
**Solução**: Modificar sync para detectar e criar ProductVariant
**Status**: 🟠 EM DESENVOLVIMENTO

---

**Documento**: `/docs/ML_PROBLEMA_VARIACOES.md`
**Data Criaçao**: 19 de março de 2026
**Próxima Revisão**: Após implementar Passo 1
