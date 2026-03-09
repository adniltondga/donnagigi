# ✅ CHECKLIST - Production com NEON + Vercel + Login

## 📍 Seção 1: Preparação Local

- [ ] **Criar banco NEON**
  - Acesse https://console.neon.tech
  - Crie novo projeto (free tier)
  - Copie a URL: `postgresql://...`

- [ ] **Atualizar .env.local**
  ```bash
  DIRECT_DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
  ```

- [ ] **Gerar JWT_SECRET forte**
  ```bash
  node generate-jwt-secret.js
  ```
  Copie a saída e adicione ao `.env.local`:
  ```bash
  JWT_SECRET=<valor_gerado>
  ```

---

## 🗄️ Seção 2: Configurar Database

- [ ] **Rodar migration**
  ```bash
  npx prisma migrate dev --name initial_setup
  ```

- [ ] **Verificar banco**
  ```bash
  npx prisma studio
  ```
  Deve abrir interface visual do banco

---

## 🧪 Seção 3: Testar Localmente

- [ ] **Iniciar dev server**
  ```bash
  npm run dev
  ```

- [ ] **Testar Register** (http://localhost:3000/admin/login)
  - Criar novo usuário
  - Verificar senha foi hasheada (bcrypt)
  - Ver usuário em `npx prisma studio`

- [ ] **Testar Login**
  - Fazer login com usuário criado
  - Deve redirecionar para /admin/dashboard
  - Deve ter cookie 'token'

- [ ] **Testar Logout**
  - Clicar botão "Sair" no sidebar
  - Redirecionado para /admin/login
  - Cookie deve estar limpo

---

## 🚀 Seção 4: Deploy Vercel

- [ ] **Commit das mudanças**
  ```bash
  git add .
  git commit -m "feat: setup production auth with NEON and PostgreSQL"
  git push origin main
  ```

- [ ] **Conectar GitHub no Vercel**
  - Acesse https://vercel.com/dashboard
  - "Add New Project"
  - Selecione seu repo

- [ ] **Configurar Environment Variables**
  No Vercel → Project Settings → Environment Variables:
  ```
  DIRECT_DATABASE_URL = postgresql://...
  JWT_SECRET = [valor gerado]
  NEXT_PUBLIC_APP_URL = https://seu-app.vercel.app
  NODE_ENV = production
  ```

- [ ] **Deploy**
  - Vercel fará build automaticamente
  - Esperar completion

---

## 🔍 Seção 5: Validar Production

- [ ] **Acessar live**
  - https://seu-app.vercel.app/admin/login
  - Teste Register → Login → Dashboard

- [ ] **Verificar logs**
  - Vercel Dashboard → Deployments → Logs
  - Procurar por erros de database

- [ ] **Testar persistência**
  - Criar usuário
  - Logout
  - Login novamente
  - Deve funcionar

---

## 🔐 Security Final

- [ ] ( ) JWT_SECRET é aleatório e forte (32+ chars)
- [ ] ( ) Database URL não está no repositório (apenas em env vars)
- [ ] ( ) .env.local está no .gitignore
- [ ] ( ) HTTPS habilitado (Vercel automático)
- [ ] ( ) Senhas hasheadas com bcrypt ✅
- [ ] ( ) Cookies HTTP-only ✅

---

## 📞 Suporte Rápido

| Problema | Solução |
|----------|---------|
| "P1000: Authentication failed" | Verifique user/pass no NEON |
| "Connection refused" | NEON pode estar em modo sleep; reimicie projeto |
| "Prisma lock" | `rm prisma/migrations/migration_lock.toml` então `npx prisma migrate resolve` |
| Login não funciona | Verifique JWT_SECRET é igual em .env.local e Vercel |
| Usuários não persistem | Verifique DIRECT_DATABASE_URL está correto |

---

## 📚 Próximos Passos (Opcional)

- [ ] Implementar "Recuperar Senha"
- [ ] Adicionar 2FA
- [ ] Email de confirmação no register
- [ ] OAuth (Google/GitHub)
- [ ] Rate limiting no login
