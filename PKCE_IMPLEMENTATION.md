# PKCE (Proof Key for Code Exchange) - Implementação no OAuth ML

## O que é PKCE?

**PKCE** (RFC 7636) é um padrão de segurança adicional para OAuth 2.0 que protege contra:
- **Authorization Code Interception**: Se alguém interceptar o código, não pode trocá-lo sem o `code_verifier`
- **CSRF Attacks**: O `state` parameter já protegia, PKCE adiciona proteção em camada dupla
- **Ataques em ambientes inseguros**: Como redes públicas ou quando ISP bloqueia URLs

## Como Funciona

### Fluxo Clássico (sem PKCE)
```
1. App → ML: code authorizado
2. ML → App: authorization code
3. App → ML: exchange code por token (usando client_secret)
```

### Fluxo com PKCE (SEGURO)
```
1. App gera: code_verifier = random(64 bytes)
2. App calcula: code_challenge = SHA256(code_verifier) em base64url
3. App → ML: "Me autoriza, aqui está o code_challenge"
4. ML → App: code
5. App → ML: "Troque meu code por token, aqui está meu code_verifier"
6. ML valida: SHA256(code_verifier) == code_challenge? ✓
7. ML → App: access_token
```

## Implementação no Projeto

### 1. **auth/route.ts** - Geração do PKCE

```typescript
import { randomBytes, createHash } from "crypto"

// Gera code_challenge a partir de code_verifier
function generateCodeChallenge(codeVerifier: string): string {
  return createHash("sha256")
    .update(codeVerifier)
    .digest("base64url")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

// No GET /api/mercadolivre/auth:
const codeVerifier = randomBytes(64).toString("base64url")
const codeChallenge = generateCodeChallenge(codeVerifier)

// URL com PKCE
const authUrl = `https://auth.mercadolibre.com.br/authorization?
  response_type=code&
  client_id=${clientId}&
  redirect_uri=${redirectUri}&
  code_challenge=${codeChallenge}&
  code_challenge_method=S256&
  state=${state}`

// Guardar code_verifier em cookie seguro
response.cookies.set("ml_code_verifier", codeVerifier, {
  httpOnly: true,  // JavaScript não acessa
  secure: false,   // true em HTTPS (produção)
  maxAge: 600,     // 10 minutos
  path: "/",
})
```

### 2. **callback/route.ts** - Validação do PKCE

```typescript
// No GET /api/mercadolivre/callback:
const codeVerifier = request.cookies.get("ml_code_verifier")?.value

if (!codeVerifier) {
  return NextResponse.redirect("/admin/integracao?error=PKCE validation failed")
}

// Token exchange COM code_verifier
const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,  // ← CRÍTICO!
  }).toString(),
})

// Limpar cookie
response.cookies.set("ml_code_verifier", "", { maxAge: 0 })
```

## Segurança em Detalhes

### Por que SHA256 com base64url?

```
code_verifier = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
                  (128 caracteres aleatórios)

code_challenge = base64url(SHA256(code_verifier))
                = "9dXCOYvxXQ5c7xYz..."
                  (base64url = base64 sem padding e com -_ em vez de +/)
```

### Por que S256 método?

- **S256** = SHA256 (recomendado, mais forte)
- **plain** = sem hash (menos seguro, legacy)

O Mercado Livre requer S256.

## Teste Local

### 1. Inicie o servidor
```bash
npm run dev
```

### 2. Clique em "Conectar via OAuth"
```
http://localhost:3000/admin/integracao
↓
Clique em "Método 2: Login OAuth"
```

### 3. Fluxo Automático (por trás dos panos)
```
1. auth/route.ts gera code_verifier e code_challenge ✓
2. Armazena code_verifier em cookie HttpOnly ✓
3. Começa autenticação do Mercado Livre
4. ML pede que você autorize
5. ML retorna code
6. callback/route.ts recebe code e code_verifier do cookie ✓
7. Envia code + code_verifier para ML
8. ML valida: SHA256(code_verifier) == code_challenge? ✓
9. Token gerado!
```

## Logs de Debug

Verifique no console do VS Code (npm run dev):

```
[PKCE] Iniciando autenticação com URL: https://...code_challenge=...method=S256...
[PKCE] Code Challenge: 9dXCOYvxXQ5c7xYz...
[PKCE] Trocando código por token com code_verifier
[PKCE] ✅ OAuth com PKCE completado com sucesso
```

## Diagramas

```
┌─────────────────────────────────────────────────────────────┐
│ TESTE: Você tenta autorizar no Mercado Livre              │
└─────────────────────────────────────────────────────────────┘

1️⃣ Clica "Conectar via OAuth"
   ↓
2️⃣ Browser → admin/api/mercadolivre/auth
   ↓
3️⃣ auth/route.ts:
   • gera code_verifier = randomBytes(64).toString('base64url')
   • calcula code_challenge = SHA256(code_verifier)
   • armazena code_verifier em cookie (HttpOnly)
   • redireciona para ML com code_challenge
   ↓
4️⃣ Browser → Mercado Livre (auth.mercadolibre.com.br)
   URL: https://auth.mercadolibre.com.br/authorization?
        response_type=code&
        client_id=1656045364090057&
        redirect_uri=http://localhost:3000/api/mercadolivre/callback&
        code_challenge=9dXCOYvxXQ5c7xYz&
        code_challenge_method=S256&
        state=randomstate123
   ↓
5️⃣ Você faz login e clica "Autorizar"
   ↓
6️⃣ ML redireciona:
   http://localhost:3000/api/mercadolivre/callback?code=AUTH_CODE_123&state=randomstate123
   ↓
7️⃣ callback/route.ts:
   • valida state
   • recupera code_verifier do cookie
   • faz POST para ML: { code, code_verifier, client_id, client_secret }
   • ML valida: SHA256(code_verifier) == code_challenge? ✓
   ↓
8️⃣ ML retorna access_token
   ↓
9️⃣ Salva MLIntegration no banco
   ↓
🔟 Redireciona para /admin/integracao com sucesso!
```

## Comparação: Antes vs Depois

### ❌ Antes (sem PKCE)
```
auth/route.ts → URL: ?...&state=xxx
callback/route.ts → Apenas valida state
Risco: Se alguém interceptar o code, consegue fazer token exchange
```

### ✅ Depois (com PKCE)
```
auth/route.ts →
  • Gera code_verifier aleatório
  • Calcula code_challenge = SHA256(code_verifier)
  • URL: ?...&code_challenge=xxx&code_challenge_method=S256&state=yyy

callback/route.ts →
  • Valida state ✓
  • Envia code_verifier na troca de token ✓
  • ML valida: SHA256(code_verifier) == code_challenge ✓
  
Risco agora: Praticamente zero - mesmo que alguém intercepte code,
            não consegue trocá-lo sem o code_verifier!
```

## Referências

- [RFC 7636 - PKCE](https://tools.ietf.org/html/rfc7636)
- [Mercado Libre OAuth Docs](https://developers.mercadolibre.com.ar/es_AR/oauth)
- [OWASP OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)

## Status

✅ PKCE implementado e testado
✅ Seguro para produção
✅ Compatível com Mercado Livre
✅ Melhor que autenticação por token manual

## Próximas Melhorias

- [ ] Adicionar webhook do Mercado Livre para atualizações em tempo real
- [ ] Implementar refresh token rotation
- [ ] Adicionar rate limiting no endpoint de auth
- [ ] Logs estruturados (JSON) para observabilidade
