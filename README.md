# 👜 Donna Gigi - E-commerce Platform

Plataforma de e-commerce moderna com Next.js, React, Tailwind CSS, PostgreSQL (NEON) e autenticação segura.

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Configurar banco de dados
npx prisma migrate dev

# Iniciar desenvolvimento
npm run dev
```

Acesse: http://localhost:3000

## 📚 Documentação

Toda a documentação está organizada em `/docs`:

- **[SETUP_PRODUCAO.md](docs/SETUP_PRODUCAO.md)** - Setup completo de produção
- **[DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)** - Guia passo a passo para deploy no Vercel
- **[CONFIGURAR_ENV_VARS.md](docs/CONFIGURAR_ENV_VARS.md)** - Como configurar variáveis de ambiente
- **[CHECKLIST_PRODUCAO.md](docs/CHECKLIST_PRODUCAO.md)** - Checklist de deployment

## 🏗️ Arquitetura

```
┌─────────────────────────┐
│   Next.js Frontend      │
│   - Pages               │
│   - Components          │
│   - Styles (Tailwind)   │
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│   API Routes            │
│   - /api/auth/*         │
│   - JWT + Cookies       │
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│   Prisma ORM            │
│   - PostgreSQL (NEON)   │
│   - Migrations          │
│   - Type Safety         │
└─────────────────────────┘
```

## 🔐 Autenticação

- **Frontend:** Login/Register com validação
- **Backend:** JWT + HttpOnly Cookies
- **Segurança:** Bcryptjs para hash de senhas
- **Middleware:** Proteção de rotas admin

## 👥 Usuários Padrão

| Email | Senha | Role |
|-------|-------|------|
| giovana.coutinho@donnagigi.com.br | gi13226014 | Admin |
| adnilton.santos@donnagigi.com.br | md98yp121556 | Admin |

## 🛠️ Tech Stack

- **Frontend:** React 18, Next.js 14, TypeScript
- **Styling:** Tailwind CSS, Radix UI
- **Database:** PostgreSQL (NEON)
- **ORM:** Prisma
- **Auth:** JWT, bcryptjs, jose
- **Charts:** Recharts
- **Deployment:** Vercel

## 📦 Estrutura do Projeto

```
├── src/
│   ├── app/
│   │   ├── admin/           # Admin panel
│   │   ├── api/auth/        # Autenticação
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/          # Componentes reutilizáveis
│   ├── lib/                 # Utilitários
│   ├── types/               # Type definitions
│   └── middleware.ts        # Proteção de rotas
├── prisma/
│   ├── schema.prisma        # Schema do banco
│   └── migrations/          # Histórico de mudanças
├── docs/                    # Documentação
├── .env                     # Variáveis de ambiente
└── package.json
```

## 🚀 Deploy

### Local Development
```bash
npm run dev        # Inicia servidor local
npm run build      # Build de produção
npm run start      # Inicia servidor produção
npm run lint       # Lint do código
```

### Production (Vercel)
Veja [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md) para instruções completas.

```bash
git push origin main  # Vercel faz deploy automático
```

## 🔧 Criar Usuários de Teste

```bash
# Criar usuário interativo
node create-user.js

# Criar com argumentos
node create-user-args.js email@example.com password username "Full Name"
```

## 🔌 Gerar JWT Secret

```bash
node generate-jwt-secret.js
```

## 📊 Database

### Conectar ao Studio (UI visual)
```bash
npx prisma studio
```

### Migrations
```bash
npx prisma migrate dev       # Criar nova migration
npx prisma migrate deploy    # Aplicar em produção
npx prisma migrate reset     # Reset (⚠️ perde dados)
```

## 🐛 Troubleshooting

### Build falha
- Verifique Environment Variables
- Execute `npm run build` localmente
- Veja logs em: Vercel Dashboard → Deployments

### Login não funciona
- Verifique JWT_SECRET é igual em local e produção
- Limpe cache do navegador (Ctrl+Shift+Del)
- Teste em navegador anônimo

### Database connection fails
- Verifique DIRECT_DATABASE_URL
- Teste: `npx prisma db push`
- NEON pode estar em sleep mode

## 📞 Suporte

Documentação detalhada em `/docs`

## 📝 License

MIT
