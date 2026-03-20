# 🔧 Corrigindo Erro: "Forbidden" ao Sincronizar Produtos

## ❌ Problema Identificado

O erro **"Erro ao buscar produtos: Forbidden"** ocorre porque o token OAuth2 **não tinha scopes** (permissões) para acessar as listagens do vendedor.

```
Status: 403 Forbidden
Motivo: Token sem permissão para acessar /users/{id}/listings
```

## ✅ Solução

### Passo 1: Resetar a Integração Anterior

Execute este comando para remover a integração antiga:

```bash
curl -X DELETE http://localhost:3000/api/mercadolivre/reset
```

Esperado:
```json
{
  "success": true,
  "message": "Integração resetada. Faça login novamente para obter as permissões corretas.",
  "nextStep": "/api/mercadolivre/auth"
}
```

### Passo 2: Reconectar com Escopo Correto

1. Abra a página admin:
   ```
   http://localhost:3000/admin/integracao
   ```

2. Clique em **"Conectar via OAuth"**

3. Faça login no Mercado Livre

4. **IMPORTANTE**: Na tela de autorização do ML, você verá as permissões solicitadas:
   - ✅ `offline_access` - Manter token ativo
   - ✅ `read` - Ler seus produtos

5. Autorize e clique em "Continuar"

### Passo 3: Sincronizar Novamente

Após retornar à página admin (agora conectado), clique em:
- **"Sincronizar Produtos (até 25)"**

Agora deve funcionar! ✅

## 🔍 O Que Mudou

### Antes (Não Funcionava):
```
URL de autenticação:
https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=...

❌ SEM scopes
❌ Token não tinha permissão para ler listagens
❌ Erro 403 ao tentar sincronizar
```

### Depois (Funciona):
```
URL de autenticação:
https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=...&scope=offline_access%20read

✅ COM scopes
✅ Token tem permissão para ler listagens
✅ Sincronização funciona
```

## 📊 Scopes Incluídos

| Scope | Função |
|-------|--------|
| `offline_access` | Obtém e renova refresh token |
| `read` | Permite ler produtos, usuário, listagens |

## 🆘 Se Ainda Não Funcionar

### 1. Verificar token salvo
```bash
curl http://localhost:3000/api/mercadolivre/integration
```

Deve retornar:
```json
{
  "configured": true,
  "sellerID": "123456789",
  "expiresAt": "2024-XX-XX...",
  "isExpired": false
}
```

### 2. Verificar mensagem de erro detalhada
```bash
curl http://localhost:3000/api/ml/sync
```

Verá mensagem mais específica com o erro exato do Mercado Livre.

### 3. Se tudo estiver OK mas ainda recusar:
- Verifique se você realmente tem produtos no Mercado Livre
- Acesse https://www.mercadolivre.com.br/meus-anuncios
- Se não houver produtos, crie um produto de teste no ML primeiro

## 🚀 Resumo Rápido

```bash
# 1. Reset
curl -X DELETE http://localhost:3000/api/mercadolivre/reset

# 2. Reconectar (em navegador)
Open: http://localhost:3000/admin/integracao
Click: "Conectar via OAuth"
Authorize no ML

# 3. Sincronizar
Click: "Sincronizar Produtos"
✅ Pronto!
```

## 📝 Logs para Monitorar

Abra o console do servidor Node e veja os logs:

```
[AUTH] Redirect URI: ...
[PKCE] Code Challenge: ...
[CALLBACK] Code recebido: ✓
[ML/SYNC] Buscando produtos...
[ML/SYNC] Listings obtidos: 5
```

Se ver `[ML/SYNC] Erro ao buscar listings: status: 403`, significa que ainda faltam scopes.

## ✨ Novidades

- ✅ Scopes adicionados automaticamente ao fazer login
- ✅ Mensagens de erro melhoradas
- ✅ Novo endpoint `/api/mercadolivre/reset` para facilitar reset
- ✅ Melhor debugging no console

---

**Próximos passos após sincronizar com sucesso**:
- Ver produtos em `/admin/produtos`
- Testar atualização de estoque
- Verificar variações importadas
