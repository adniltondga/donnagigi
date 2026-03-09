# 🔧 Configurar Environment Variables

## 📍 LOCAL - Arquivo `.env.local`

Este arquivo já existe na raiz do seu projeto. **Nunca commitar no GitHub!** (está no .gitignore)

```bash
# Caminho: c:/Users/Usuário/Documents/projects/site/donnagigi/.env.local
```

### Preencher com seus valores:

```env
# ========================================
# 1. DATABASE - PostgreSQL (NEON)
# ========================================

# Direct URL: para migrações e desenvolvimento
# Copie de: https://console.neon.tech → Connection string
DIRECT_DATABASE_URL="postgresql://user:password@ep-xxxxx.neon.tech/neondb?sslmode=require"

# Prisma Accelerate: para pooling em produção (opcional)
# Se usar: crie em https://console.prisma.io
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=..."

# ========================================
# 2. AUTENTICAÇÃO
# ========================================

# JWT Secret: gere com: node generate-jwt-secret.js
JWT_SECRET="eaed1add4974156b0c727ec8d277c5f6b521df82676869ea1de2e736af7603da"

# ========================================
# 3. APP CONFIG
# ========================================

# URL do app local (para desenvolvimento)
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Environment
NODE_ENV="development"
```

**Exemplo completo:**
```env
DIRECT_DATABASE_URL="postgresql://app_user:super_secret_pass@ep-cool-cloud-123456.neon.tech/donnagigi_db?sslmode=require"
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGc..."
JWT_SECRET="abc123def456ghi789jkl012mno345pqr678stu901"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

---

## ☁️ PRODUÇÃO - Vercel Dashboard

### Passo 1: Acessar Environment Variables

```
1. Abra: https://vercel.com/dashboard
2. Selecione seu projeto: "donnagigi"
3. Vá em: Settings (engrenagem) → Environment Variables
```

### Passo 2: Adicionar Variáveis

Clique em "**Add Environment Variable**" e preencha:

#### **Variável 1: DIRECT_DATABASE_URL**
```
Name: DIRECT_DATABASE_URL
Value: postgresql://user:password@ep-xxxxx.neon.tech/neondb?sslmode=require
Environment: Production (selecionar)
```

#### **Variável 2: JWT_SECRET**
```
Name: JWT_SECRET
Value: [seu valor gerado com: node generate-jwt-secret.js]
Environment: Production (selecionar)
```

#### **Variável 3: NEXT_PUBLIC_APP_URL**
```
Name: NEXT_PUBLIC_APP_URL
Value: https://seu-app.vercel.app
Environment: Production (selecionar)
```

#### **Variável 4: NODE_ENV** (opcional)
```
Name: NODE_ENV
Value: production
Environment: Production (selecionar)
```

### Passo 3: Salvar

- Clique em "Save"
- Vercel mostrará: "Environment variables updated successfully"
- **Importante:** Redeploy será necessário

---

## 🔄 Diferenças: Local vs Produção

| Variável | Local (.env.local) | Produção (Vercel) |
|----------|-------------------|-------------------|
| DIRECT_DATABASE_URL | Seu Neon local | Seu Neon local (mesmo) |
| JWT_SECRET | Valor teste | Valor forte novo |
| NEXT_PUBLIC_APP_URL | http://localhost:3000 | https://seu-app.vercel.app |
| NODE_ENV | development | production |

---

## 📋 Checklist: Onde Preencher

### LOCAL (`.env.local`)
- [ ] Abrir: `c:/Users/Usuário/Documents/projects/site/donnagigi/.env.local`
- [ ] Preencher DIRECT_DATABASE_URL com seu Neon
- [ ] Preencher JWT_SECRET (execute: `node generate-jwt-secret.js`)
- [ ] Salvar arquivo
- [ ] Testar: `npm run dev`

### VERCEL (Dashboard)
- [ ] Acessar: https://vercel.com/dashboard
- [ ] Selecionar projeto "donnagigi"
- [ ] Settings → Environment Variables
- [ ] Adicionar as 4 variáveis acima
- [ ] Salvar
- [ ] Vercel fará redeploy automático

---

## ⚠️ Segurança

- ✅ `.env.local` está no `.gitignore` (não será comittado)
- ✅ Variáveis sensíveis no Vercel são encriptadas
- ❌ **Nunca** commitar `.env.local` no GitHub
- ❌ **Nunca** compartilhar JWT_SECRET
- ✅ Usar HTTPS em produção (Vercel automático)

---

## 🧪 Validar Configuração

### Localmente:
```bash
# Verificar se consegue conectar ao banco
npx prisma db push

# Visualizar dados do banco
npx prisma studio

# Iniciar dev server
npm run dev

# Testar em: http://localhost:3000/admin/login
```

### Em Produção (após deploy):
1. Acesse: https://seu-app.vercel.app/admin/login
2. Tente registrar novo usuário
3. Faça login
4. Deve redirecionar para dashboard

Se der erro: Vercel → Deployments → Logs (procure por errors)

---

## 🔍 Encontrar seus Valores

### DIRECT_DATABASE_URL (Neon)
```
1. Acesse: https://console.neon.tech
2. Seu projeto
3. Connection string
4. Copie a URL postgresql://...
5. Adicione no final: ?sslmode=require
```

### JWT_SECRET
```bash
# Execute no terminal:
node generate-jwt-secret.js

# Copie a saída:
# JWT_SECRET=abc123def456...
```

### NEXT_PUBLIC_APP_URL (Vercel)
```
1. Após deploy, sua URL fica em:
   https://vercel.com/dashboard → seu projeto
   Mostrará algo como: https://donnagigi.vercel.app
2. Use essa URL
```

---

## ❓ Dúvidas Comuns

**P: Preciso de DATABASE_URL ou DIRECT_DATABASE_URL?**
A: Ambos! DATABASE_URL com Prisma Accelerate é opcional para produção (pool de conexões). DIRECT_DATABASE_URL é obrigatório.

**P: Posso usar o mesmo JWT_SECRET local e produção?**
A: Não recomendado. Use valores diferentes por segurança.

**P: Quanto tempo leva redeploy no Vercel?**
A: ~1-2 minutos. Vercel mostra progresso em real time.

**P: E se esquecer de adicionar variável?**
A: App vai crashar com erro "process.env.VARIAVEL is undefined". Veja logs no Vercel.
