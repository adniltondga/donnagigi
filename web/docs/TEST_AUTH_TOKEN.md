# Teste de Autenticação com Token - Mercado Livre

## Como obter um Access Token do Mercado Livre

### Opção 1: Via Developer (Recomendado para Testes)
1. Acesse: https://www.mercadolivre.com.br/
2. Vá para: **Seu nome > Painel de Controle > Ferramentas > Aplicações & Integrações**
3. Procure por "Credenciais" ou "Application Tokens"
4. Copie o `Access Token`

### Opção 2: Via OAuth (se conseguir acessar)
1. Acesse: https://www.mercadolivre.com.br/sellers/tools/applications/
2. Clique em "Criar Aplicação"
3. Faça login
4. Gere um token e copie

## Teste Local

### Passo 1: Inicie o servidor de desenvolvimento
```bash
npm run dev
```

### Passo 2: Teste o endpoint diretamente (Terminal/PowerShell)

#### PowerShell:
```powershell
$token = "SEU_TOKEN_AQUI"
$body = @{ accessToken = $token } | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/mercadolivre/authenticate" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

#### cURL (se tiver Git Bash):
```bash
curl -X POST http://localhost:3000/api/mercadolivre/authenticate \
  -H "Content-Type: application/json" \
  -d '{"accessToken":"SEU_TOKEN_AQUI"}'
```

### Passo 3: Tente via Interface

1. Acesse: http://localhost:3000/admin/integracao
2. No campo "Método 1: Cole seu Access Token":
   - Cole seu token
   - Clique no ícone 👁️ para ver o token
   - Clique em "Validar Token"

### Resposta Esperada (Sucesso)

```json
{
  "success": true,
  "message": "Autenticação bem-sucedida!",
  "integration": {
    "sellerID": "123456789",
    "email": "seu@email.com",
    "nickname": "seu_usuario_ml",
    "expiresAt": "2025-03-09T..."
  }
}
```

### Resposta Esperada (Erro)

```json
{
  "error": "Token inválido ou expirado",
  "details": "..."
}
```

## O que Acontece Internamente

1. ✅ Seu browser envia o token para `/api/mercadolivre/authenticate`
2. ✅ O servidor valida o token com Mercado Livre (sem passar por browser)
3. ✅ Se válido, cria/atualiza registro na tabela `MLIntegration`
4. ✅ Retorna dados do vendedor
5. ✅ A página recarrega e mostra o status "Conectado"

## Próximos Passos (Após validar o token)

- [ ] Verificar em http://localhost:3000/admin/integracao que mostra "Conectado"
- [ ] Ir para http://localhost:3000/admin/produtos
- [ ] Tentar sincronizar um produto com Mercado Livre
- [ ] Verificar o status "Sincronizado ✓" ou "Erro ✗"

## Debug

Se tiver problema, verifique:

1. **Token inválido**: Certifique-se de copiar o token inteiro (sem espaços extras)
2. **Token expirado**: Gere um novo token no Mercado Livre
3. **Rede/Firewall**: Seu ISP bloqueia `api.mercadolibre.com`?
   - Solução: Use VPN ou acesse pela Vercel (produção)
4. **Banco de dados**: A tabela `MLIntegration` foi criada?
   - Verifique: `npx prisma db push`

## Logs para Conferir

Verifique o console do VS Code para ver as logs:
```
[ML Auth] Validando token com Mercado Livre...
[ML Auth] ✅ Token validado para vendedor: 123456789
[ML Auth] ✅ Integração salva no banco de dados
```

Se ver erro, compartilhe o log para debug!
