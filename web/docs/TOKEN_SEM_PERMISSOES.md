# 🔐 Token SEM Permissões - Precisa Reconectar!

## ❌ Problema Encontrado

O token atual **NÃO TEM** o escopo `read` (permissão para ler seus produtos).

```
✅ Token válido (funciona em /users/me)
❌ SEM permissão read (não funciona em /users/me/orders, /users/{id}/listings, etc)
```

## 📊 Testes Realizados:

```
✅ /users/me                    → 200 OK (token válido)
❌ /users/{id}/listings         → 403 Forbidden (sem scopes)
❌ /me/listings                 → 404 Not Found (endpoint não existe)
❌ /users/me/orders             → 404 (sem scopes)
❌ /users/me/listings           → 404 (endpoint não existe)
❌ /items/search                → 405 (método incorreto)
❌ /myfeeds/seller_items        → 404 (sem scopes)
```

## 🛠️ SOLUÇÃO: Reconectar Corretamente

### PASSO 1: Resetar Token Antigo

```bash
curl -X DELETE http://localhost:3000/api/mercadolivre/reset
```

### PASSO 2: Reconectar NO NAVEGADOR (muito importante)

**Abra este URL em um navegador**, não no terminal:
```
http://localhost:3000/admin/integracao
```

### PASSO 3: Clique em "Conectar via OAuth"

- Sistem irá redirecionar para `https://auth.mercadolibre.com.br`

### PASSO 4: IMPORTANTE - Tela de Autorização

**Quando chegar na tela de autorização do Mercado Livre, você DEVE ver:**

```
┌─────────────────────────────────┐
│ DONNAGIGI App quer acessar:     │
│                                 │
│ ☑️ Acceso offline               │
│ ☑️ Leer información de usuario  │
│                                 │
│  [Autorizar]  [Cancelar]        │
└─────────────────────────────────┘
```

**CRÍTICO**: Clique em **"Autorizar"**

### PASSO 5: Voltar para Admin

Após clicar "Autorizar", você será redirecionado de volta para:
```
http://localhost:3000/admin/integracao?success=...
```

Verá: ✅ **Conectado**

### PASSO 6: Sincronizar

Clique em: **"Sincronizar Produtos (até 25)"**

**Agora deve funcionar!** ✅

## ⚠️ O Que Pode Ter Acontecido Antes

1. **Você clicou em "Cancelar"** na tela de autorização do ML
2. **Erro de rede** durante o redirecionamento
3. **Navegador bloqueou redirect** (verifique console)
4. **Scopes não foram enviados** (esse era o bug anterior, já corrigido)

## 🔍 Como Verificar se Funcionou

Após reconectar, execute:

```bash
curl http://localhost:3000/api/ml/debug-sync | jq '.results'
```

**Esperado:**
```json
{
  "test1_userIdListings": {
    "status": 200,
    "ok": true,
    "dataKeys": ["results", "paging", ...]
  },
  "test7_ordersEndpoint": {
    "message": "✅ Tem permissão read"
  }
}
```

## 🚀 Resumo Rápido

```bash
# 1. Reset
curl -X DELETE http://localhost:3000/api/mercadolivre/reset

# 2. Reconectar (no NAVEGADOR, não terminal!)
# Abrir: http://localhost:3000/admin/integracao
# Clicar: "Conectar via OAuth"
# AUTORIZAR na tela do ML (importante!)

# 3. Depois que vê "✅ Conectado", sincronizar
# Clicar: "Sincronizar Produtos"

# 4. Verificar
curl http://localhost:3000/api/ml/debug-sync | jq '.results'
```

---

**Importante**: O navegador é ESSENCIAL! O redirect OAuth2 só funciona via navegador, não via terminal/curl.
