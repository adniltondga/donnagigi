# Como Funciona a Integração Admin com OAuth2

## 📋 Resumo

O fluxo agora é totalmente integrado na página `/admin/integracao` usando OAuth2 PKCE para autenticação segura com o Mercado Livre.

## 🔄 Fluxo Completo

### 1. **Login no Admin** 
   - Usuário acessa `/admin/integracao`
   - Componente carrega status da integração via `GET /api/mercadolivre/integration`

### 2. **Conectar ao Mercado Livre** (Se não conectado)
   - Usuário clica em "Conectar via OAuth"
   - Browser é redirecionado para `GET /api/mercadolivre/auth`
   - Endpoint gera PKCE challenge e redireciona para ML
   - Code verifier é salvo em cookie

### 3. **Login no Mercado Livre**
   - Usuário faz login e autoriza acesso
   - ML redireciona para `/api/mercadolivre/callback?code=...`

### 4. **Callback e Token**
   - Endpoint `/api/mercadolivre/callback` processa o código
   - Troca código por token usando PKCE
   - Busca informações do seller (ID)
   - Salva integração no banco: `MLIntegration`
   - Redireciona para `/admin/integracao?success=...`

### 5. **Status Conectado**
   - Admin mostra "Conectado como [Seller ID]"
   - Tokens expirados são detectados automaticamente
   - Botões: "Sincronizar Produtos" e "Desconectar"

### 6. **Sincronizar Produtos**
   - Usuário clica "Sincronizar Produtos (até 25)"
   - Admin chama `GET /api/ml/sync`
   - Endpoint obtém lista do Mercado Livre
   - Importa produtos e variações
   - Retorna resultado com estatísticas

## 📁 Arquivos Envolvidos

### Endpoints API
```
GET  /api/mercadolivre/auth                    - Inicia PKCE, redireciona ML
GET  /api/mercadolivre/callback                - Processa callback, salva token
GET  /api/mercadolivre/integration             - Verifica status
POST /api/mercadolivre/integration             - Cria/atualiza integração
DELETE /api/mercadolivre/integration           - Desconecta
GET  /api/ml/sync                              - Sincroniza produtos do ML
```

### Componentes Frontend
```
/src/app/admin/integracao/page.tsx               - Wrapper com Suspense
/src/app/admin/integracao/integracao-content.tsx - UI principal (Client Component)
```

### Database
```
MLIntegration:
  - id: string (cuid)
  - sellerID: string
  - accessToken: string
  - refreshToken: string (opcional)
  - expiresAt: datetime

MLProduct:
  - id: string
  - variantId: string
  - integrationId: string
  - mlListingId: string
  - status: string
```

## 🔐 Segurança

- ✅ **PKCE Flow**: Protege contra authorization code interception
- ✅ **State Parameter**: Valida origem do callback
- ✅ **HttpOnly Cookies**: Code verifier em cookie seguro
- ✅ **Token Refresh**: Suporte para renovação de tokens
- ✅ **Expiração**: Detecta tokens expirados

## 🌊 Estados da UI

### Estado 1: Não Conectado
```
┌─────────────────────────────┐
│  Integração Mercado Livre   │
│                             │
│  Autentique com sua conta   │
│  🔐 Botão: Conectar OAuth   │
└─────────────────────────────┘
```

### Estado 2: Conectado
```
┌─────────────────────────────┐
│  Integração Mercado Livre   │
│                             │
│  ✅ Conectado                │
│  Vendedor: 123456789        │
│  Expira em: [data]          │
│                             │
│  [Sincronizar] [Desconectar]│
│                             │
│  📊 Resultado:              │
│  Total: 25  Sucesso: 24     │
│  Erros: 1                   │
└─────────────────────────────┘
```

## 📊 Exemplo de Resposta do /api/ml/sync

```json
{
  "message": "Sincronização completa: 5 produtos importados com sucesso",
  "stats": {
    "total": 5,
    "synced": 5,
    "failed": 0
  },
  "data": [
    {
      "id": "prod_123",
      "name": "Capinha iPhone 15",
      "price": 29.90,
      "variants": 3
    },
    ...
  ]
}
```

## 🧪 Testando o Fluxo

### 1. Verificar Status Atual
```bash
curl http://localhost:3000/api/mercadolivre/integration
```

Esperado:
```json
{
  "configured": false,
  "message": "Integração não configurada"
}
```

### 2. Iniciar Login (em browser)
```
Abrir: http://localhost:3000/admin/integracao
Botão: "Conectar via OAuth"
```

### 3. Autorizar no Mercado Livre
- Fazer login com credenciais ML
- Autorizar acesso

### 4. Verificar Depois do Login
```bash
curl http://localhost:3000/api/mercadolivre/integration
```

Esperado:
```json
{
  "configured": true,
  "sellerID": "123456789",
  "expiresAt": "2024-XX-XX...",
  "isExpired": false
}
```

### 5. Sincronizar Produtos
```bash
curl http://localhost:3000/api/ml/sync
```

Esperado:
```json
{
  "message": "Sincronização completa: X produtos...",
  "stats": { "total": 25, "synced": 25, "failed": 0 },
  "data": [...]
}
```

## 🛠️ Troubleshooting

### Erro: "Variáveis de ambiente não configuradas"
**Solução**: Verificar `.env`:
```
ML_CLIENT_ID=seu_client_id
ML_CLIENT_SECRET=seu_client_secret
ML_REDIRECT_URI=http://localhost:3000/api/mercadolivre/callback
```

### Erro: "Code verifier não encontrado"
**Solução**: Cookies podem estar desabilitados. Verificar:
- Browser permite cookies
- Cookie `ml_code_verifier` está sendo criado
- Mesmo domínio para auth e callback

### Erro: "Token expirado"
**Solução**: Desconectar e reconectar:
- Clique "Desconectar"
- Novo login auto-renova o token

### Erro: "Nenhum produto encontrado"
**Solução**: Possíveis causas:
- Conta do ML não tem produtos
- Token não tem permissão para listar
- Limite de 25 produtos foi atingido

## 📝 Próximos Passos

1. **Teste com dados reais**: Conectar com conta ML real
2. **Monitorar sincronização**: Ver logs no console
3. **Validar dados importados**: Verificar `/admin/produtos`
4. **Tratamento de erros**: Melhorar mensagens de erro
5. **Retry automático**: Re-tentar produtos que falharem

## 🎯 Objetivo Final

✅ Admin integrado com OAuth2  
✅ Sincronização em um clique  
✅ Sem necessidade de tokens manuais  
✅ Seguro com PKCE  
✅ Pronto para produção
