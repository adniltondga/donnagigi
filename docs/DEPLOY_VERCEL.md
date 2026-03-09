# 🚀 Deploy Vercel - Guia Passo a Passo

## 📋 Checklist Rápido

- [ ] Conta Vercel criada (https://vercel.com)
- [ ] GitHub conectado ao Vercel
- [ ] Projeto importado
- [ ] Environment Variables configuradas
- [ ] Deploy executado
- [ ] Teste login em produção

---

## 🔧 PASSO 1: Criar/Acessar Vercel

### 1.1 Criar Conta (se não tiver)
```
1. Abra: https://vercel.com/signup
2. Clique em "Continue with GitHub"
3. Autorize Vercel no GitHub
4. Confirme email
```

### 1.2 Acessar Dashboard
```
https://vercel.com/dashboard
```

---

## 📦 PASSO 2: Importar Projeto GitHub

### 2.1 Adicionar Novo Projeto
```
1. Dashboard → "Add New..." (botão preto)
2. Selecione "Project"
```

### 2.2 Selecionar Repositório
```
1. Clique em "Select a Git Repository"
2. Procure por: "donnagigi"
3. Clique em "Import"
```

### 2.3 Configurar Projeto
```
Frame Work: Next.js (detectado automaticamente)
Root Directory: ./ (deixar padrão)
Clique em "Continue"
```

---

## 🔐 PASSO 3: Configurar Environment Variables

### 3.1 Acessar Configurações
```
1. Após clicar "Continue", você verá: "Configure Project"
2. Role até "Environment Variables"
```

### 3.2 Adicionar Variáveis
**Você vai adicionar 3 variáveis:**

#### ✅ Variável 1: DIRECT_DATABASE_URL

```
Name: DIRECT_DATABASE_URL
Value: postgresql://neondb_owner:npg_JsrXpIOeQz12@ep-floral-violet-aczi7l62-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

Environments: 
  ☑ Production
  ☑ Preview
  ☑ Development
```

**Como preencher:**
1. Clique no campo "Name" e digite: `DIRECT_DATABASE_URL`
2. Clique no campo "Value" e copie a URL do NEON
3. Marque os 3 checkboxes
4. Clique "Add"

#### ✅ Variável 2: JWT_SECRET

```
Name: JWT_SECRET
Value: eaed1add4974156b0c727ec8d277c5f6b521df82676869ea1de2e736af7603da

Environments: 
  ☑ Production
  ☑ Preview
  ☑ Development
```

**Como preencher:**
1. Clique em "Add New" (se não aparecer outro campo)
2. Digite `JWT_SECRET` no Name
3. Cole o valor gerado no Value
4. Marque os 3 checkboxes
5. Clique "Add"

#### ✅ Variável 3: NEXT_PUBLIC_APP_URL

```
Name: NEXT_PUBLIC_APP_URL
Value: https://donnagigi.vercel.app

Environments: 
  ☑ Production
  ☑ Preview
  ☑ Development
```

**Como preencher:**
1. Clique em "Add New"
2. Digite `NEXT_PUBLIC_APP_URL`
3. Digite `https://donnagigi.vercel.app` (será o URL temporário)
4. Marque os 3 checkboxes
5. Clique "Add"

---

## 🚀 PASSO 4: Deploy

### 4.1 Iniciar Deploy
```
1. Após adicionar as 3 variáveis
2. Clique em "Deploy" (botão grande preto)
3. Vercel iniciará o build
```

### 4.2 Acompanhar Progresso
```
Você verá:
- Building...
- Creating Serverless Functions...
- Finalizing...

Tempo estimado: 3-5 minutos
```

### 4.3 Deploy Completo
```
✅ When you see "Congratulations!"
   Seu app está LIVE!

URL: https://donnagigi.vercel.app
```

---

## ✅ PASSO 5: Testar em Produção

### 5.1 Acessar App
```
Abra: https://donnagigi.vercel.app/admin/login
```

### 5.2 Testar Login
```
Email: giovana.coutinho@donnagigi.com.br
Senha: gi13226014

Deve redirecionar para: /admin/dashboard
```

### 5.3 Ver Logs (se houver erro)
```
1. Dashboard Vercel
2. Clique no projeto "donnagigi"
3. Aba "Deployments"
4. Clique no deploy recente
5. Aba "Logs"
6. Procure por erros em vermelho
```

---

## 🎯 PASSO 6: Domínio Customizado (Opcional)

Se quiser usar seu próprio domínio (`donnagigi.com.br`):

### 6.1 Acessar Configurações
```
1. Dashboard → projeto "donnagigi"
2. "Settings" (engrenagem)
3. "Domains"
```

### 6.2 Adicionar Domínio
```
1. "Add Domain"
2. Digite: donnagigi.com.br
3. Clique "Add"
```

### 6.3 Configurar DNS
```
Vercel mostrará nameservers para adicionar no seu registrador
(Namecheap, GoDaddy, etc)

Tempo para sincronizar: 5-48 horas
```

---

## 📊 Referência Rápida

| Ambiente | URL |
|----------|-----|
| **Desenvolvimento** | http://localhost:3000 |
| **Produção (Vercel)** | https://donnagigi.vercel.app |
| **Produção (Domínio)** | https://donnagigi.com.br |

---

## 🔍 Troubleshooting

### ❌ "Build failed"
**Solução:**
1. Verifique variáveis de ambiente
2. Veja logs no Vercel
3. Execute localmente: `npm run build`
4. Faça commit das correções
5. Redeploy automático

### ❌ "Cannot connect to database"
**Solução:**
1. Verifique DIRECT_DATABASE_URL está correto
2. Teste localmente: `npx prisma studio`
3. NEON pode estar em sleep mode
4. Adicione `?sslmode=require` na URL

### ❌ "Login não funciona"
**Solução:**
1. Verifique JWT_SECRET é igual em Vercel e local
2. Verifique NEXT_PUBLIC_APP_URL está correto
3. Limpe cache do navegador (Ctrl+Shift+Del)
4. Teste em navegador anônimo

### ❌ "Usuários não aparecem"
**Solução:**
1. Neon e Vercel apontam para mesmo banco? ✓
2. Migrations foram rodadas? (`npx prisma migrate status`)
3. Crie usuário novamente localmente

---

## 📞 Suporte

Se der problema:

1. **Verificar logs Vercel:**
   - Dashboard → Deployments → Logs

2. **Verificar logs NEON:**
   - https://console.neon.tech → Activity

3. **Teste localmente:**
   ```bash
   npm run dev
   ```

4. **Reset banco (⚠️ perda de dados):**
   ```bash
   npx prisma migrate reset
   ```

---

## ✨ Após Deploy

Parabéns! 🎉

Você tem:
- ✅ Banco PostgreSQL na nuvem (NEON)
- ✅ App Next.js em produção (Vercel)
- ✅ Login e autenticação funcionando
- ✅ Admin panel protegido

**Próximos passos (opcional):**
1. Conectar domínio personalizado
2. Implementar email de confirmação
3. Adicionar Analytics (Vercel Analytics)
4. Configurar CI/CD com GitHub Actions
