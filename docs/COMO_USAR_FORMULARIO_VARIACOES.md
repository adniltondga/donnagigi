# 🎉 Como Usar o Novo Formulário de Variações

## ✨ O Que Mudou

O formulário de produtos agora tem **interface completa para adicionar múltiplas variações**!

### Antes ❌
```
Nome do Produto
Modelo: [um campo]
Cor: [um campo]
Preço: [um campo]
Estoque: [um campo]
```
❌ Só criava 1 produto por vez

### Depois ✅
```
Nome do Produto
Descrição
Imagem

↓ Atributos ↓
+ Novo Atributo
[Cor] → Preto, Rosa, Cinza
[Modelo] → iPhone 14, iPhone 15

↓ Variações ↓
+ Adicionar Variação
○ Variação 1: SKU, Preço, Custo, Estoque...
○ Variação 2: SKU, Preço, Custo, Estoque...
○ Variação 3: SKU, Preço, Custo, Estoque...
```
✅ Cria 1 produto com N variações!

---

## 🚀 Como Usar

### 1. Clique em "Novo Produto" no Admin

Vai abrir o novo formulário com 3 seções:

**Seção 1: Informações Básicas**
- Nome do produto
- Descrição
- Imagem (URL)
- Categoria
- Fornecedor

**Seção 2: Atributos** (novo!)
- Clique "+ Novo Atributo"
- Defina o tipo (Cor, Modelo, Tamanho, etc)
- Adicione valores

**Seção 3: Variações** (novo!)
- Clique "+ Adicionar Variação" para cada combinação
- Preencha: SKU, Preço, Custo, Estoque, Tarifas
- Selecione os valores de atributos

### 2. Exemplo Prático

Criar: "Capinha Magnética" com 4 variações

**Seção 1:**
- Nome: "Capinha Magnética Colorida Fosca com Kit de Película"
- Descrição: "Capinha magnética premium..."
- Imagem: https://...
- Categoria: "Capinhas"
- Fornecedor: "capa25"

**Seção 2 - Atributos:**
```
+ Novo Atributo
  Nome: Cor
  Tipo: color
  Valores: Preto, Rosa, Cinza
  
+ Novo Atributo
  Nome: Modelo
  Tipo: model
  Valores: iPhone 14 Pro Max, iPhone 15 Pro Max
```

**Seção 3 - Variações:**
```
Variação 1:
  SKU: CAP-IP14-PRETA
  Preço: 59.90
  Custo: 18.90
  Embalagem: 2.00
  Estoque: 15
  Cor: Preto ↓
  Modelo: iPhone 14 Pro Max ↓

Variação 2:
  SKU: CAP-IP14-ROSA
  Preço: 59.90
  Custo: 18.90
  Embalagem: 2.00
  Estoque: 12
  Cor: Rosa ↓
  Modelo: iPhone 14 Pro Max ↓

Variação 3:
  SKU: CAP-IP15-PRETA
  Preço: 59.90
  Custo: 18.90
  Embalagem: 2.00
  Estoque: 20
  Cor: Preto ↓
  Modelo: iPhone 15 Pro Max ↓

Variação 4:
  SKU: CAP-IP15-ROSA
  Preço: 59.90
  Custo: 18.90
  Embalagem: 2.00
  Estoque: 17
  Cor: Rosa ↓
  Modelo: iPhone 15 Pro Max ↓
```

Clique "Criar Produto" → ✅ Produto criado com 4 variações!

---

## 🎯 Features

### ✅ Atributos Flexíveis
- Quantos atributos quiser
- Tipos: Texto, Cor, Modelo, Tamanho
- Adicionar/Remover valores

### ✅ Variações em Grid
- Visualizar todas de uma vez
- Preencher como planilha
- Mínimo 1, máximo ilimitado

### ✅ Validações
- SKU obrigatório
- Preço maior que 0
- Mínimo 1 variação

### ✅ Gerenciamento Posterior
- Editar dados do produto (nome, descrição, imagem)
- Editar cada variação em separado
- Adicionar/remover variações depois

---

## 📋 Campos de Cada Variação

| Campo | Obrigatório | Descrição |
|---|---|---|
| SKU | ✅ | Código único (ex: CAP-IP14-PRETO-001) |
| Preço Venda | ✅ | Quanto vende (ex: 59.90) |
| Custo | ❌ | Quanto comprou (ex: 18.90) |
| Embalagem | ❌ | Custo caixa (ex: 2.00) |
| Estoque | ❌ | Quantidade (ex: 15) |
| Tarifa ML | ❌ | Tarifa Mercado Livre (ex: 10.78) |
| Tarifa Entrega | ❌ | Tarifa entrega ML (ex: 12.35) |
| Atributos | ❌ | Combinações (Cor=Preto, Modelo=12PM) |

---

## 🔄 Fluxo de Edição

### Novo Produto
1. Clique "Novo Produto"
2. Preencha tudo
3. **Salva tudo junto** → 1 produto + N variações ✅

### Editar Produto Existente
1. Clique no produto
2. **Só edita dados gerais** (nome, descrição, imagem)
3. Para editar variações → Use a seção de variações na tabela

---

## 💡 Dicas

1. **SKUs Descritivos** - Use padrão: `PRODUTO-MODELO-COR-NUM`
   - ✅ `CAP-IP14-PRETO-001`
   - ✅ `CAP-IP15-ROSA-002`

2. **Copiar SKUs** - Se tem 2 cores × 3 modelos = 6 variações:
   - CAP-IP12-PRETA
   - CAP-IP12-ROSA
   - CAP-IP13-PRETA
   - CAP-IP13-ROSA
   - CAP-IP14-PRETA
   - CAP-IP14-ROSA

3. **Estoque** - Cada variação tem seu próprio estoque
   - Não é mais um total!
   - iPhone 12 Preto: 15
   - iPhone 12 Rosa: 12
   - iPhone 14 Preto: 20

4. **Preço** - Pode variar por variação
   - Preto standard: 59.90
   - Rosa premium: 79.90
   - Cinza limitada: 99.90

---

## 🐛 Troubleshooting

**"Erro: SKU é obrigatório"**
- Preencha o campo SKU de todas as variações

**"Erro: Preço deve ser maior que 0"**
- Cada variação precisa de preço > 0

**"Erro: Mínimo 1 variação"**
- Adicione pelo menos 1 variação

**Não consigo adicionar novo campo de atributo**
- Clique "+ Novo Atributo" no topo da seção
- Preencha nome e pelo menos 1 valor
- Clique "Adicionar"

---

## 🎨 Layout do Formulário

```
═══════════════════════════════════════════════════════════
  📝 Novo Produto com Variações
═══════════════════════════════════════════════════════════

┌─ INFORMAÇÕES BÁSICAS ─────────────────────────────────────┐
│ Nome: [Capinha Magnética...]                              │
│ Descrição: [Descrição...]                                 │
│ Imagem: [https://...]                                     │
│ Categoria: [Capinhas]  Fornecedor: [capa25]               │
└──────────────────────────────────────────────────────────┘

┌─ ATRIBUTOS ───────────────────────────────────────────────┐
│ [+ Novo Atributo]                                         │
│ ✓ Cor (color) → Preto, Rosa, Cinza         [x]           │
│ ✓ Modelo (model) → iPhone 14, iPhone 15    [x]           │
└──────────────────────────────────────────────────────────┘

┌─ VARIAÇÕES (4 de 4) ──────────────────────────────────────┐
│ [+ Adicionar Variação]                                    │
│ ┌─ Variação 1 ──────────────────────────────────────────┐ │
│ │ SKU: [CAP-IP14-PRETA]    Preço: [59.90]  Est: [15]   │ │
│ │ Custo: [18.90]  Embalagem: [2.00]                    │ │
│ │ Cor: [Preto ▼]  Modelo: [iPhone 14 PM ▼]           │ │
│ │                                           [x]        │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─ Variação 2 ──────────────────────────────────────────┐ │
│ │ SKU: [CAP-IP14-ROSA]     Preço: [59.90]  Est: [12]   │ │
│ │ ...                                                    │ │
│ └─────────────────────────────────────────────────────┘ │
│ ... mais variações ...                                    │
└──────────────────────────────────────────────────────────┘

[Cancelar]  [✓ Criar Produto]
═══════════════════════════════════════════════════════════
```

---

## ✅ Verificação

Depois de criar, você vai ver na tabela:

```
Nome: Capinha Magnética...
Variações: 4
├─ CAP-IP14-PRETO (P: R$ 59,90 | Est: 15)
├─ CAP-IP14-ROSA  (P: R$ 59,90 | Est: 12)
├─ CAP-IP15-PRETO (P: R$ 59,90 | Est: 20)
└─ CAP-IP15-ROSA  (P: R$ 59,90 | Est: 17)
```

✅ Pronto! Produto com múltiplas variações criado!

---

**Data:** 12 de Março, 2026  
**Versão:** 2.0 - Com Suporte a Variações  
**Status:** ✅ Pronto para Usar
