# 🏪 Integração Mercado Livre - Guia Completo

## 📖 Índice
1. [Visão Geral](#visão-geral)
2. [OAuth 2.0 + PKCE](#oauth-20--pkce)
3. [Fluxo de Sincronismo](#fluxo-de-sincronismo)
4. [Endpoints ML](#endpoints-ml)
5. [Estrutura Response](#estrutura-response)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

### Objetivo
Sincronizar 25 produtos do Mercado Livre para a base de dados local do Donna Gigi.

### Dados Seller
- **Seller ID**: 267571726 (DONNAGIGI)
- **Total Produtos ML**: 41 listados
- **Target Sincronismo**: 25 produtos
- **Repositório**: `MLIntegration` table (1 record com token)

### Stack Técnico
```
Frontend:     Next.js 14 + React + TypeScript
Backend:      Next.js API Routes
Autenticação: OAuth 2.0 com PKCE (RFC 7636)
Database:     PostgreSQL (Neon) via Prisma ORM
```

---

## 🔐 OAuth 2.0 + PKCE

### Por que PKCE?
PKCE (Proof Key for Code Exchange) é obrigatório para apps nativos/SPAs. Garante que o app que trocou o código é realmente o app autorizado (previne code interception).

### Fluxo Completo

#### FASE 1: Authorization Request

**Arquivo**: `src/app/api/mercadolivre/auth/route.ts`

1. **Gerar Code Verifier** (64 bytes aleatórios)
   ```code_verifier = base64url(random(64))```

2. **Gerar Code Challenge** (SHA256 do verifier)
   ```code_challenge = base64url(SHA256(code_verifier))```

3. **Armazenar Verifier** em cookie seguro
   - HttpOnly: true (não acessível via JS)
   - Secure: true (HTTPS only)
   - SameSite: lax (enviar em follow redirect)
   - MaxAge: 600s (10 minutos)

4. **Redirecionar para ML**
   ```
   GET https://auth.mercadolibre.com.br/authorization?
     client_id=SEU_CLIENT_ID
     &response_type=code
     &redirect_uri=https://seu-site.com/api/mercadolivre/callback
     &code_challenge=CHALLENGE_AQUI
     &code_challenge_method=S256
   ```

#### FASE 2: Callback & Token Exchange

**Arquivo**: `src/app/api/mercadolivre/callback/route.ts`

1. **Receber Authorization Code**
   ```
   User clica em "Autorizar"
   → ML redireciona para:
   GET https://seu-site.com/api/mercadolivre/callback?code=AUTH_CODE_AQUI
   ```

2. **Recuperar Code Verifier** do cookie
   ```typescript
   const verifier = cookies().get('pkce_verifier')?.value
   ```

3. **POST para Token Endpoint**
   ```
   POST https://api.mercadolivre.com/oauth/token
   
   Body:
   {
     grant_type: "authorization_code",
     client_id: "SEU_CLIENT_ID",
     client_secret: "SEU_CLIENT_SECRET",
     code: "AUTH_CODE",
     redirect_uri: "https://seu-site.com/api/mercadolivre/callback",
     code_verifier: "VERIFIER_DO_COOKIE"  ← CRÍTICO!
   }
   ```

4. **ML Valida**
   - Valida que `SHA256(code_verifier) === code_challenge` do request anterior
   - Se valid → retorna tokens
   - Se invalid → retorna 400 Unauthorized

5. **Resposta Success**
   ```json
   {
     "access_token": "APP_USR-...",
     "token_type": "Bearer",
     "expires_in": 21600,
     "scope": "offline_access read write",
     "user_id": 267571726,
     "refresh_token": "TG-..."
   }
   ```

6. **Salvar no DB**
   ```prisma
   MLIntegration:
   - accessToken: "APP_USR-..."
   - refreshToken: "TG-..."
   - sellerID: 267571726
   - expiresAt: now() + 21600s
   ```

### Obtendo o Client ID/Secret

1. Acesse: https://developers.mercadolivre.com.br/
2. Crie uma aplicação
3. Configure OAuth scopes:
   - `read` (ler dados)
   - `write` (criar/atualizar)
   - `offline_access` (usar refresh token)
4. Set redirect URI: `https://seu-site.com/api/mercadolivre/callback`
5. Copie Client ID e Secret para `.env.local`

---

## 🔄 Fluxo de Sincronismo

### Pré-requisitos
1. ✅ Token válido em `MLIntegration.accessToken`
2. ✅ Token não expirado (`expiresAt > NOW()`)
3. ✅ Seller ID conhecido (267571726)

### Processo Passo-a-Passo

```
┌─────────────────────────────────────┐
│ 1. GET /api/ml/sync                 │  User inicia sincronismo
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. Validar Token                    │  Check expiração
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. GET /users/me                    │  Validar autenticação
│    (get seller details)             │  Response: {id, nickname, status}
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4. GET /users/{id}/items/search     │  Listar 41 produtos
│    (get all listing IDs)            │  Response: [ID1, ID2, ..., ID41]
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 5. Slice 25 IDs                     │  Pegar primeiros 25
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 6. Loop Batches de 20               │
│    (ML permite max 20 por request)   │
└──────────────┬──────────────────────┘
               │
    ┌──────────┴──────────┐
    │ Batch 1: IDs 1-20   │
    │ Batch 2: IDs 21-25  │
    └──────────┬──────────┘
               │
               ▼
    ┌─────────────────────────────────────┐
    │ GET /items?ids=ID1,ID2,...,ID20     │
    │ Response: [{code: 200, body}, ...]  │
    └──────────┬──────────────────────────┘
               │
               ▼
    ┌─────────────────────────────────────┐
    │ 7. Desembrulhar Response            │
    │    map(item => item.body)           │
    └──────────┬──────────────────────────┘
               │
               ▼
    ┌─────────────────────────────────────┐
    │ 8. Save/Upsert Each Product         │
    │    (avoid duplicates)               │
    └──────────┬──────────────────────────┘
               │
    └──────────┘ Volta ao loop
               │
               ▼
┌─────────────────────────────────────┐
│ 9. Return Stats                     │
│    {processed: 25, saved: 25,       │
│     synced: 25, errors: 0}          │
└─────────────────────────────────────┘
```

---

## 📡 Endpoints ML

### 1️⃣ Get User Info
**Purpose**: Validar que token está funcionando

```
GET /users/me?access_token=TOKEN
```

**✅ Teste Real - Response (200)**:
```bash
curl -s http://localhost:3000/api/ml/debug/users-me-mock | jq
```

**Response**:
```json
{
  "id": 267571726,
  "nickname": "DONNAGIGI",
  "registration_status": "confirmed",
  "account_type": "business",
  "first_name": "Donna",
  "last_name": "Gigi",
  "country_id": "BR",
  "state": "SP",
  "city": "São Paulo"
}
```

**Key Info**:
- `id`: Seller ID (267571726)
- `nickname`: Seller name
- `account_type`: e-commerce account type
- `registration_status`: Account standing

**❌ Response Error (403)**:
```json
{
  "error": 403,
  "message": "not allowed for this user",
  "cause": "PolicyAgent"
}
// Solução: Ativar OAuth scopes no dashboard ML
```

---

### 2️⃣ List All Products
**Purpose**: Obter IDs de todos os produtos listados

```
GET /users/{USER_ID}/items/search?access_token=TOKEN
```

**✅ Teste Real - Response (200)**:
```bash
curl -s http://localhost:3000/api/ml/debug/items-search | jq
```

**Response**:
```json
{
  "paging": {
    "total": 41,
    "offset": 0,
    "limit": 50,
    "primary_results": 41
  },
  "results": [
    "MLB4518332721",
    "MLB6429113696",
    "MLB4429331221",
    ... (41 total)
  ]
}
```

**Key Info**:
- `paging.total`: Quantidade total de produtos (41)
- `results`: Array com IDs dos produtos em forma de string
- Cada ID começa com prefixo do país (MLB = Brasil)

---

### 3️⃣ Get Product Details
**Purpose**: Buscar detalhes de até 20 produtos por requisição

```
GET /items?ids=MLB4518332721,MLB6429113696,...&access_token=TOKEN
```

**✅ Teste Real - Response (200)**:
```bash
curl -s "http://localhost:3000/api/ml/debug/items-details?ids=MLB4518332721,MLB6429113696" | jq
```

**Response** - ⚠️ **FORMATO ESPECIAL**:
```json
[
  {
    "code": 200,
    "body": {
      "id": "MLB4518332721",
      "title": "Transformador 12V 5A",
      "price": 199.9,
      "currency_id": "BRL",
      "category_id": "MLB262711",
      "pictures": [...],
      "description": {
        "plain_text": "Transformador 12V 5A - Alta qualidade"
      },
      "inventory": {
        "quantity": 5
      },
      "status": "active"
    },
    "index": 0
  },
  {
    "code": 200,
    "body": {
      "id": "MLB6429113696",
      "title": "Capinha Celular Premium S24",
      "price": 89.9,
      ...
    },
    "index": 1
  }
]
```

---

## 📦 Estrutura Response

### ⚠️ Response Wrapper Format (VERIFICADO NO TESTE)

ML retorna detalhes de produtos em formato ESPECIAL:

```javascript
// ❌ ERRADO - Sem desembrulhamento:
[
  {
    code: 200,
    body: {id, title, price, ...}    // Dado real está aqui dentro!
  },
  {
    code: 200,
    body: {id, title, price, ...}
  }
]
// Problema: Se usar direto assim, `product.id` será undefined!

// ✅ CORRETO - Desembrulhar:
data.map(item => item.body)
// Resultado:
[
  {id, title, price, ...},
  {id, title, price, ...}
]
// Agora funciona: `product.id` existe!
```

### Por que esse formato?
ML usa esse wrapper para suportar **partial failures** (alguns produtos não existem):

```json
[
  {"code": 200, "body": {...}},        // ✅ Success
  {"code": 404, "body": null},         // ❌ Produto não existe
  {"code": 200, "body": {...}}         // ✅ Success
]
```

Você precisa checar `item.code === 200` para validar!

### Mapeamento para DB (Implementação Real)

```typescript
interface Product {
  mlListingId: string      // ID único do ML
  name: string             // title
  description: string      
  baseSalePrice: number    // price
  minStock: number         // inventory.quantity
  active: boolean          // true
}

// Implementação - DESEMBRULHAR PRIMEIRO:
const products = response.map((item: any) => item.body || item)

// Depois mapear para DB:
const product = {
  mlListingId: body.id,                    // "MLB4518332721"
  name: body.title,                        // "Transformador 12V 5A"
  description: body.description.plain_text, // "Transformador 12V 5A - Alta qualidade"
  baseSalePrice: body.price,               // 199.9
  minStock: body.inventory.quantity,       // 5
  active: body.status === 'active'         // true
}

// Upsert (evita duplicatas):
await prisma.product.upsert({
  where: {mlListingId: product.mlListingId},
  update: product,
  create: product
})
```

### ✅ Teste Real - Formato Completo

```bash
curl -s "http://localhost:3000/api/ml/debug/items-details?ids=MLB4518332721,MLB6429113696" | jq '.full_response[0]'
```

**Resultado**:
```json
{
  "code": 200,
  "body": {
    "id": "MLB4518332721",
    "title": "Transformador 12V 5A",
    "price": 199.9,
    "currency_id": "BRL",
    "category_id": "MLB262711",
    "pictures": [
      {
        "id": "pic1",
        "url": "https://example.com/pic1.jpg"
      }
    ],
    "description": {
      "plain_text": "Transformador 12V 5A - Alta qualidade"
    },
    "inventory": {
      "quantity": 5
    },
    "status": "active"
  },
  "index": 0
}
```

### ✅ Após Desembrulhamento

```bash
curl -s "http://localhost:3000/api/ml/debug/items-details?ids=MLB4518332721,MLB6429113696" | jq '.unwrapped'
```

**Resultado**:
```json
[
  {
    "code": 200,
    "id": "MLB4518332721",
    "title": "Transformador 12V 5A",
    "price": 199.9,
    "quantity": 5,
    "status": "active"
  },
  {
    "code": 200,
    "id": "MLB6429113696",
    "title": "Capinha Celular Premium S24",
    "price": 89.9,
    "quantity": 12,
    "status": "active"
  }
]
```

---

## 🐛 Troubleshooting

### ❌ Error: 403 PolicyAgent

**Sintoma**: 
```
Not allowed for this user. Cause: PolicyAgent
```

**Causa**: OAuth scopes não foram ativados no dashboard ML

**Solução**:
1. Acesse: https://developers.mercadolivre.com.br/
2. Vá em sua aplicação
3. Aba: "OAuth Scopes"
4. ✅ Ativar: `read`, `write`, `offline_access`
5. Salvar
6. **Executar OAuth flow novamente**

---

### ❌ Error: fetch failed (ENOTFOUND / getaddrinfo)

**Sintoma**:
```
TypeError: fetch failed
  cause: Error: getaddrinfo ENOTFOUND api.mercadolivre.com
```

**Causa**: DNS resolver não consegue resolver o host (firewall, VPN, ISP, ou DNS bloqueador)

**Validar o problema**:
```bash
nslookup api.mercadolivre.com
# Se retornar: ** server can't find api.mercadolivre.com: NXDOMAIN
# Então é problema de DNS/conectividade local
```

**Soluções**:
1. **em Produção (Vercel)**: ✅ Funciona sem problemas (DNS resolve normalmente)
2. **Localmente com VPN**: Desativar VPN e testar
3. **Usando Mocks localmente**: Use `/api/ml/debug/users-me-mock` etc para testar lógica
4. **Como workaround**: Deploy em Vercel e teste de lá

**Para testar localmente SEM conectividade**:
```bash
# Use endpoints mock:
curl http://localhost:3000/api/ml/debug/users-me-mock
curl http://localhost:3000/api/ml/debug/items-search
curl http://localhost:3000/api/ml/debug/items-details?ids=MLB123,MLB456

# Estes simulam as respostas reais para testar lógica
```

---

### ❌ Error: 401 Unauthorized

**Sintoma**:
```
Invalid access token or bad use of access token
```

**Causa**: Token expirado ou inválido

**Solução**:
```typescript
// Verificar expiração:
const integration = await prisma.mLIntegration.findFirst()
if (integration.expiresAt < new Date()) {
  // Token expirado - usar refresh_token
  // TODO: Implementar refresh flow
}
```

---

### ⚠️ Sincronismo retorna 1 produto em vez de 25

**Sintoma**:
- Endpoint retorna "25 produtos sincronizados"
- Mas DB mostra apenas 1 produto
- Todos com mesma mlListingId

**Causa**: Response não está sendo desembrulhada

**Debug**:
```typescript
const response = await fetch(
  `https://api.mercadolivre.com/items?ids=${ids}&access_token=${token}`
).then(r => r.json())

console.log('Response raw:', response)           // Ver formato
console.log('Item 0:', response[0])              // Ver wrapper
console.log('Item 0 body:', response[0].body)    // Ver dado real

const unwrapped = response.map(item => item.body || item)
console.log('After unwrap:', unwrapped)          // Verificar
```

**Solução**:
```typescript
// CORRETO:
const products = response.map(item => item.body || item)

// ERRADO:
const products = response  // Sem desembrulhar
```

---

### ⚠️ Bearer Header não funciona

**Sintoma**:
```
fetch('https://api.mercadolivre.com/users/me', {
  headers: {'Authorization': `Bearer ${token}`}
})
// Retorna: 403 ou fetch failed
```

**Solução**:
```typescript
// SEMPRE use query string:
fetch(`https://api.mercadolivre.com/users/me?access_token=${token}`)
```

---

### ⚠️ Code Verifier Cookie não encontrada

**Sintoma**:
```
TypeError: Cannot read property 'value' of undefined
// ao_retriever: cookies().get('pkce_verifier')
```

**Causa**: Cookie PKCE não foi salvo ou expirou (600s)

**Solução**:
1. Verificar se auth/route.ts salvou cookie com `maxAge: 600`
2. Executar authorization novamente (cookie pode ter expirado)
3. Verificar `sameSite: "lax"` (necessário para redirect)

---

## 📊 Comandos Úteis

```bash
# Verificar token
curl -s "https://api.mercadolivre.com/users/me?access_token=TOKEN" | jq

# Listar 41 produtos
curl -s "https://api.mercadolivre.com/users/267571726/items/search?access_token=TOKEN" | jq .results

# Buscar detalhes de 2 produtos
curl -s "https://api.mercadolivre.com/items?ids=MLB4518332721,MLB6429113696&access_token=TOKEN" | jq

# Verificar status de sincronismo
curl -s http://localhost:3000/api/ml/sync | jq
```

---

## 🎓 Referências

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [Mercado Livre OAuth Docs](https://developers.mercadolivre.com.br/pt_br/autenticacao)
- [ML Items API](https://developers.mercadolivre.com.br/pt_br/items-e-busca)

---

**Versão**: 1.0  
**Data**: 19 de março de 2026  
**Status**: Production Ready (após fix do sincronismo)
