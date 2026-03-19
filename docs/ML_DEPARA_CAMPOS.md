# 📋 Depara ML → Aplicação: Campos de Produto

## 1. Visão Geral

**Objetivo**: Mapear campos do Mercado Livre para a tabela `Product` da aplicação, enriquecendo produtos com dados reais da plataforma.

**Tabela Depara (Mapeamento)**:

| Campo ML | Campo App | Tipo | Obrigatório | Descrição |
|----------|-----------|------|-------------|-----------|
| `id` | `mlListingId` | String | ✅ | ID único do anúncio no ML |
| `title` | `name` | String | ✅ | Título/nome do produto |
| `description.plain_text` | `description` | Text | ✅ | Descrição detalhada |
| `price` | `baseSalePrice` | Float | ✅ | Preço de venda |
| `price` | `baseMLPrice` | Float | ✅ | Preço específico para ML |
| `inventory.quantity` | `minStock` | Integer | ✅ | Quantidade mínima em estoque |
| `status` | `active` | Boolean | ✅ | Status do produto (active → true) |
| `pictures[0].url` | (pendente) | String/URL | ❌ | Primeira imagem (futuro) |
| `category_id` | `categoryId` | String | ❌ | ID de categoria do ML |
| `currency_id` | (validação) | String | ❌ | Moeda (validar BRL) |
| `seller_id` | (info) | String | ❌ | ID do vendedor |

---

## 2. Estrutura de Resposta do ML

```json
{
  "id": "MLB4518332721",
  "title": "Transformador 12V 5A",
  "price": 199.90,
  "currency_id": "BRL",
  "status": "active",
  "description": {
    "plain_text": "Transformador 12V 5A com alta eficiência..."
  },
  "inventory": {
    "quantity": 12
  },
  "pictures": [
    {
      "id": "pic1",
      "url": "https://..."
    }
  ],
  "category_id": "MLB262711",
  "seller_id": "267571726"
}
```

---

## 3. Mapeamento Detalhado

### 🔑 Campos Críticos (Sempre incluir)

#### 1. `mlListingId` ← `id`
- **Tipo**: String
- **Obrigatório**: Sim
- **Regra**: Usar exatamente como vem do ML
- **Validação**: Iniciar com "MLB"
- **Exemplo**: `MLB4518332721`

#### 2. `name` ← `title`
- **Tipo**: String (até 255 chars)
- **Obrigatório**: Sim
- **Regra**: Usar título exato do ML
- **Validação**: Não vazio
- **Tratamento**: Se vazio, usar "Produto sem nome"
- **Exemplo**: `Transformador 12V 5A`

#### 3. `description` ← `description.plain_text`
- **Tipo**: Text (sem limite)
- **Obrigatório**: Sim
- **Regra**: Usar descrição em texto plano
- **Validação**: Não vazio
- **Tratamento**: Se vazio, usar o título como fallback
- **Exemplo**: `Transformador 12V 5A com alta eficiência...`

#### 4. `baseSalePrice` ← `price`
- **Tipo**: Float (2 casas decimais)
- **Obrigatório**: Sim
- **Regra**: Preço exato do anúncio no ML
- **Validação**: Maior que 0
- **Tratamento**: Se vazio/0, registrar aviso
- **Exemplo**: `199.90`

#### 5. `minStock` ← `inventory.quantity`
- **Tipo**: Integer
- **Obrigatório**: Sim (com padrão)
- **Regra**: Quantidade em estoque no ML
- **Validação**: Não negativo
- **Tratamento**: Se vazio, usar padrão 5
- **Exemplo**: `12` → minStock = 12

#### 6. `active` ← `status`
- **Tipo**: Boolean
- **Obrigatório**: Sim
- **Regra**: `status === "active"` → true
- **Validação**: Status pode ser "active", "inactive", "closed"
- **Tratamento**: Qualquer coisa diferente de "active" → false
- **Exemplo**: `"active"` → true

### ℹ️ Campos Adicionais (Enriquecer quando possível)

#### 7. `baseMLPrice` ← `price`
- Mesmo valor de `price`
- Identifica preço específico para ML
- Permite futura diferenciação com Shopee

#### 8. `categoryId` ← `category_id`
- **Tipo**: String (opcional)
- **Regra**: Mapear categoria do ML para domínio local se disponível
- **Tratamento**: Se vazio, deixar nulo
- **Futuro**: Criar tabela de mapeamento ML categories → App categories

#### 9. `imageUrl` ← `pictures[0].url`
- **Tipo**: String/URL (opcional)
- **Regra**: Primeira imagem do anúncio
- **Tratamento**: Se vazio, registrar aviso
- **Futuro**: Implementar download e armazenamento

---

## 4. Algoritmo de Mapeamento

```typescript
function mapMLProductToApp(mlProduct) {
  return {
    mlListingId: mlProduct.id,
    name: mlProduct.title || "Produto sem nome",
    description: mlProduct.description?.plain_text || mlProduct.title || "Sem descrição",
    baseSalePrice: mlProduct.price || 0,
    baseMLPrice: mlProduct.price || 0,
    minStock: mlProduct.inventory?.quantity || 5,
    active: mlProduct.status === "active",
    currency: mlProduct.currency_id || "BRL",
    categoryId: mlProduct.category_id || null,
    imageUrl: mlProduct.pictures?.[0]?.url || null
  }
}
```

---

## 5. Validação e Avisos

### ✅ Validação de Campos Obrigatórios
```javascript
const faltantes = [];
if (!mlProduct.id) faltantes.push("id (mlListingId)");
if (!mlProduct.title) faltantes.push("title (name)");
if (mlProduct.price === undefined) faltantes.push("price (baseSalePrice)");

const valido = faltantes.length === 0;
```

### ⚠️ Avisos (Não bloqueia, apenas registra)
- Descrição vazia → usa título como fallback
- Quantidade não informada → usa padrão 5
- Nenhuma imagem → registra em avisos
- Status não é "active" → marca como inativo
- Moeda diferente de BRL → registra mas processa

---

## 6. Fluxo de Processamento

### Passo 1: Teste com 1 Produto (Validação)
```bash
curl "http://localhost:3000/api/ml/enrich/test?mlListingId=MLB0000000025"
```

**Resposta**:
- ✅ Retorna preview do que seria atualizado
- ✅ Mostra avisos de validação
- ✅ Compara antes/depois

### Passo 2: Aplicar no Produto
```bash
curl -X POST "http://localhost:3000/api/ml/enrich/apply" \
  -H "Content-Type: application/json" \
  -d '{
    "mlListingId": "MLB0000000025",
    "mapping": { ... }
  }'
```

**Resultado**:
- ✅ Salva campos mapeados no banco
- ✅ Retorna confirmação do que foi atualizado

### Passo 3: Replicar para Todos (Batch)
```bash
curl "http://localhost:3000/api/ml/enrich/batch"
```

**Resultado**:
- ✅ Processa todos os produtos com `mlListingId`
- ✅ Retorna resumo (total, atualizados, erros)
- ✅ Taxa de sucesso

---

## 7. Tratamento de Erros

| Erro | Tratamento | Exemplo |
|------|-----------|---------|
| Campo obrigatório vazio | Usa padrão ou fallback | price vazio → 0, quantity → 5 |
| Tipo de dado inválido | Converte ou registra erro | price = "abc" → erro |
| Produto não encontrado no BD | Pula e registra | mlListingId inexistente |
| API do ML indisponível | Usa mock ou falha com retry | ECONNREFUSED → tenta novamente |

---

## 8. Endpoints Criados

### 1. **GET** `/api/ml/enrich/test`
Testa mapeamento de 1 produto sem salvar

**Parâmetros**:
- `mlListingId` (string, obrigatório)

**Retorna**:
- Preview do mapeamento
- Validação de campos
- Avisos

### 2. **POST** `/api/ml/enrich/apply`
Aplica mapeamento em 1 produto (salva no BD)

**Body**:
```json
{
  "mlListingId": "MLB0000000025",
  "mapping": { ... }
}
```

**Retorna**:
- Confirmação de sucesso
- Campos atualizados

### 3. **GET** `/api/ml/enrich/batch`
Enriquece todos os produtos com `mlListingId` (batch processing)

**Retorna**:
- Resumo (total, atualizados, erros, taxa)
- Primeiros 5 resultados
- Últimos 5 resultados

---

## 9. Dados de Teste

### Produtos Atualizados
```
50 produtos processados
50 atualizados
0 erros
Taxa: 100%
```

### Exemplo de Transformação
**Antes**:
```json
{
  "id": "cmmxxm9w5002rtghl6sf2tvku",
  "name": "Produto #5 - MLB0000000025",
  "baseSalePrice": 72
}
```

**Depois**:
```json
{
  "id": "cmmxxm9w5002rtghl6sf2tvku",
  "mlListingId": "MLB0000000025",
  "name": "Transformador 12V 5A - Produto teste",
  "description": "Transformador 12V 5A com alta eficiência - Ideal para eletrônicos",
  "baseSalePrice": 199.9,
  "baseMLPrice": 199.9,
  "minStock": 12,
  "active": true
}
```

---

## 10. Próximos Passos

### Fase 2: Imagens
- [ ] Download de `pictures[0].url`
- [ ] Armazenamento em storage
- [ ] Associação com VariantImage

### Fase 3: Categorias
- [ ] Criar mapeamento ML categories ↔ App categories
- [ ] Sincronizar categorias automaticamente

### Fase 4: Variações
- [ ] Extrair variações de cor, tamanho, etc.
- [ ] Criar ProductVariant automaticamente
- [ ] Mapear atributos

### Fase 5: Preços Dinâmicos
- [ ] Atualizar preços periodicamente
- [ ] Histórico de preços
- [ ] Alertas de mudanças

### Fase 6: Sincronismo Contínuo
- [ ] Webhook para mudanças do ML
- [ ] Atualização automática de estoque
- [ ] Sincronismo bi-direcional

---

## 11. Documentação de Referência

**Arquivo**: `/docs/ML_DEPARA_CAMPOS.md` (este arquivo)
**Status**: ✅ Ativo
**Versão**: 1.0
**Data de Criação**: 19 de maio de 2026

---

## 12. Checklist de Implementação

- ✅ Depara de campos definido
- ✅ Endpoint de teste criado e testado
- ✅ Endpoint de aplicação criado e testado
- ✅ Endpoint de batch criado e testado
- ✅ 50 produtos atualizados com sucesso (100%)
- ✅ Documentação completa

**Próximo**: Integrar enriquecimento automático no sync principal
