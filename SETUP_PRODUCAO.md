# 🚀 Setup Production com NEON + Vercel + Login

## ✅ PASSO 1: Configurar NEON Database (PostgreSQL)

### 1.1 Criar conta no NEON
- Acesse: https://console.neon.tech
- Sign up gratuito
- Criar novo projeto (leave defaults)

### 1.2 Obter Connection String
- No dashboard, clique em "Connection string"
- Copie a URL `postgresql://...`
- **Importante:** adicione `?sslmode=require` no final

### 1.3 Adicionar ao `.env.local`
```
DIRECT_DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require"
```

---

## ✅ PASSO 2: Rodar Migration Localmente

Depois de adicionar a URL do NEON:

```bash
npx prisma migrate dev --name initial_setup
```

Isto irá:
- ✅ Criar tabelas no NEON
- ✅ Gerar novo migration
- ✅ Sincronizar schema

---

## ✅ PASSO 3: Testar Localmente

1. Iniciar dev server:
```bash
npm run dev
```

2. Acessar: http://localhost:3000/admin/login
3. Testar **Register**: criar novo usuário
4. Testar **Login**: fazer login com esse usuário
5. Testar **Protected Routes**: acessar /admin/dashboard

---

## ✅ PASSO 4: Preparar Vercel

### 4.1 Criar secrets seguros

Gere um JWT_SECRET forte:
```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Copie o output (ex: `JWT_SECRET=a1b2c3d4...`)

### 4.2 Variáveis para Vercel
No dashboard do Vercel, Configure as Environment Variables:

```
DATABASE_URL = [sua Prisma Accelerate key se tiver]
DIRECT_DATABASE_URL = postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
JWT_SECRET = [gere um novo valor forte]
NEXT_PUBLIC_APP_URL = https://seu-app.vercel.app
NODE_ENV = production
```

### 4.3 Deploy no Vercel

```bash
# 1. Commit suas mudanças
git add .
git commit -m "setup: configure postgresql and production"

# 2. Push para GitHub
git push origin main

# 3. Conectar no Vercel:
# - Acesse https://vercel.com/dashboard
# - "Add New Project"
# - Conectar seu repo do GitHub
# - Vercel detectará Next.js automaticamente
# - Adicione as environment variables (passo 4.2)
# - Deploy!
```

---

## ✅ PASSO 5: Verificar Production

Após deploy:
1. Acesse: `https://seu-app.vercel.app/admin/login`
2. Crie novo usuário (Register)
3. Faça login
4. Acesse dashboard - deve funcionar

**Se der erro de conexão:**
- Verifique DIRECT_DATABASE_URL
- Verifique se NEON tem whitelist de IP (geralmente automático)
- Veja logs no Vercel: Dashboard → Deployments → Logs

---

## 🔒 Security Checklist

- [ ] JWT_SECRET é forte (32+ caracteres aleatórios)
- [ ] DATABASE_URL não está no .env.local (apenas DIRECT para dev)
- [ ] .env.local está no .gitignore
- [ ] SSL mode = `require` na connection string
- [ ] Cookies são HTTP-only ✅ (já configurado)
- [ ] Senhas com bcrypt ✅ (já configurado)

---

## 📝 Troubleshooting

### "Error: connect ECONNREFUSED"
→ Verifique DIRECT_DATABASE_URL está correta

### "P1000: Authentication failed"
→ User/password incorretos no NEON

### "Prisma migration conflict"
→ Execute: `npx prisma migrate resolve --rolled-back initial_setup`

---

## 🔧 Comandos Úteis

```bash
# Ver status da migration
npx prisma migrate status

# Ver dados no banco
npx prisma studio

# Reset banco (⚠️ apaga tudo)
npx prisma migrate reset

# Gerar migration nova
npx prisma migrate dev --name add_something
```
