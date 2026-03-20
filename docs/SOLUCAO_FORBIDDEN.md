# 🎯 Solução: Corrigir Erro "Forbidden" - PASSO A PASSO

## 📋 Resumo do Problema

Você recebeu erro: **"Erro ao buscar produtos: Forbidden"**

### Por Que Aconteceu?

O token OAuth2 anterior **não tinha permissões (scopes)** para ler os produtos do seu Mercado Livre.

```
❌ Token antigo: SEM scopes
❌ Resultado: Erro 403 Forbidden
```

## ✅ SOLUÇÃO EM 3 PASSOS

### 🔧 PASSO 1: Resetar Integração Antiga

Copie e cole este comando no terminal:

```bash
curl -X DELETE http://localhost:3002/api/mercadolivre/reset
```

**Esperado:**
```json
{
  "success": true,
  "message": "Integração resetada. Faça login..."
}
```

### 🔐 PASSO 2: Reconectar com Escopo Correto

1. **Abra em um navegador:**
   ```
   http://localhost:3002/admin/integracao
   ```

2. **Clique no botão:**
   ```
   "Conectar via OAuth"
   ```

3. **O navegador vai para o Mercado Livre:**
   - Entre com suas credenciais
   - Clique em "Continuar"

4. **Autorize as permissões:**
   - ✅ Será solicitado: `offline_access` (manter token ativo)
   - ✅ Será solicitado: `read` (ler seus produtos)
   - Clique em "Autorizar"

5. **Retorna para o admin:**
   - Deve mostrar: ✅ **Conectado**
   - Seller ID: seu_id
   - Data de expiração

### 🚀 PASSO 3: Sincronizar Produtos

Na mesma página do admin, clique em:
```
"Sincronizar Produtos (até 25)"
```

**Esperado:**
```json
{
  "message": "Sincronização completa: 5 produtos importados com sucesso",
  "stats": {
    "total": 5,
    "synced": 5,
    "failed": 0
  },
  "data": [...]
}
```

## 🎉 Pronto!

Se seguiu os 3 passos, deve ver:
- ✅ Seus produtos listados
- ✅ Variações importadas
- ✅ Estoque sincronizado
- ✅ Sem erros

## 🔍 Se Ainda Não Funcionar

### Verifique o Status

```bash
curl http://localhost:3002/api/mercadolivre/integration | jq .
```

Deve retornar:
```json
{
  "configured": true,
  "sellerID": "seuNumero",
  "isExpired": false,
  "expiresAt": "2026-03-20T..."
}
```

Se retornar `"configured": false`, o PASSO 2 não foi concluído.

### Verifique Mensagem de Erro Detalhada

```bash
curl http://localhost:3002/api/ml/sync | jq .
```

Agora mostra mensagem de erro mais específica.

### Requisitos

- ✅ Estar logado em `/admin/integracao`
- ✅ Ter autorizado escopo `read`
- ✅ Ter produtos criados no Mercado Livre
- ✅ Token não expirado

## 📊 O Que Mudou no Código

### Auth Endpoint (`/api/mercadolivre/auth`)
```typescript
// ANTES:
const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=...`

// DEPOIS (COM SCOPES):
const scopes = ["offline_access", "read"]
const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=...&scope=${encodeURIComponent(scopeString)}`
```

### Sync Endpoint (`/api/ml/sync`)
```typescript
// ANTES:
throw new Error(`Erro ao buscar produtos: 403`)

// DEPOIS (COM DETALHES):
throw new Error(`Erro ao buscar produtos: 403. Verifique se o token tem permissões.`)
```

### Reset Endpoint (NOVO)
```typescript
// DELETE /api/mercadolivre/reset → Remove integração antiga
```

## 🆘 Último Recurso

Se nada funcionar:

1. **Desconecte completamente:**
   ```bash
   curl -X DELETE http://localhost:3002/api/mercadolivre/integration
   ```

2. **Limpe dados do banco:**
   ```bash
   npx prisma db push --force-reset
   ```

3. **Comece do zero:**
   - Abra `/admin/integracao`
   - Clique "Conectar OAuth"
   - Siga PASSO 2 acima

## 📝 Resumo Rápido

```bash
# 1. Reset (terminal)
curl -X DELETE http://localhost:3002/api/mercadolivre/reset

# 2. Reconectar (browser)
Open: http://localhost:3002/admin/integracao
Click: "Conectar via OAuth"
Login no ML + Autorize

# 3. Sincronizar (browser)
Click: "Sincronizar Produtos"
✅ Pronto!
```

---

💡 **Dica**: Se ver erro novamente, provavelmente é porque os `scopes` ainda não estão sendo reconhecidos. Execute o PASSO 1 (reset) e reconecte com cuidado até a autorização.
