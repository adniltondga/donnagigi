# Donna Gigi - E-commerce de Capinhas de Celular

Um site moderno de e-commerce construído com **Next.js**, **React** e **Tailwind CSS**, ideal para vender capinhas de celular no Shopee e Mercado Livre com um painel administrativo robusto.

## 🎯 Características

### 🏪 Página Inicial (Catálogo)
- Mostruário completo de produtos
- Design moderno com paleta de rosa firme que transmite confiabilidade
- Links diretos para Shopee e Mercado Livre
- Layout responsivo para todos os dispositivos
- Galeria de produtos com imagens de alta qualidade

### 👨‍💼 Painel Administrativo
- **Login seguro** com credenciais
- **Dashboard** com estatísticas em tempo real
- **Gerenciador de Produtos**: Adicionar, editar e deletar capinhas
- **Gerenciador de Pedidos**: Acompanhamento de vendas
- **Análise**: Relatórios de vendas e desempenho por plataforma
- Paleta de cores confortável para os olhos (tons cinza/azul)

## 📋 Credenciais de Acesso (Demo)

```
Usuário: admin
Senha: admin123
```

## 🚀 Como Começar

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Instalação

```bash
# Instalar dependências
npm install

# Rodar o servidor de desenvolvimento
npm run dev

# Construir para produção
npm build

# Iniciar servidor de produção
npm start
```

Acesse [http://localhost:3000](http://localhost:3000) para ver a página inicial.

## 📁 Estrutura do Projeto

```
donnagigi/
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   ├── login/page.tsx       # Página de login
│   │   │   ├── dashboard/page.tsx   # Dashboard principal
│   │   │   ├── products/page.tsx    # Gerenciador de produtos
│   │   │   ├── orders/page.tsx      # Gerenciador de pedidos
│   │   │   ├── analytics/page.tsx   # Análises
│   │   │   └── layout.tsx           # Layout do admin
│   │   ├── page.tsx                 # Página inicial (catálogo)
│   │   ├── layout.tsx               # Layout raiz
│   │   └── globals.css              # Estilos globais
│   ├── components/
│   │   ├── Header.tsx               # Cabeçalho do site
│   │   ├── ProductCard.tsx          # Card de produto
│   │   ├── Footer.tsx               # Rodapé
│   │   └── AdminSidebar.tsx         # Sidebar do admin
│   ├── types/
│   │   └── index.ts                 # Tipos TypeScript
│   └── lib/
│       └── mockData.ts              # Dados simulados
├── public/                           # Arquivos estáticos
├── tailwind.config.ts               # Configuração Tailwind
├── tsconfig.json                    # Configuração TypeScript
├── next.config.js                   # Configuração Next.js
└── package.json                     # Dependências do projeto
```

## 🎨 Paleta de Cores

### Página Inicial (Rosa - Confiabilidade)
- **Rosa Primária**: `#be185d` (Rosa firme)
- **Tons degradados**: Rosa 600, 700, 800

### Dashboard Admin (Confortável)
- **Cinza Escuro**: `#1e293b` (Fundo principal)
- **Cinza Médio**: `#64748b` (Textos)
- **Azul/Cinza Suave**: Tons confortáveis para os olhos

## 🔑 Funcionalidades Principais

### 📦 Gerenciamento de Produtos
- Adicionar novos produtos
- Editar informações de produtos
- Deletar produtos do catálogo
- Tracking de estoque em tempo real
- Upload de imagens

### 🛒 Dashboard de Vendas
- Total de pedidos
- Faturamento total
- Produtos mais vendidos
- Performance por plataforma (Shopee vs Mercado Livre)
- Gráficos e estatísticas

### 👥 Autenticação
- Login/Logout seguro
- Proteção de rotas admin
- Sessão persistente (localStorage)

## 🔧 Tecnologias Utilizadas

- **Next.js 14** - Framework React
- **React 18** - Biblioteca UI
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Next.js Image** - Otimização de imagens

## 📝 Notas Importantes

1. **Dados Simulados**: O projeto usa dados em memória (localStorage). Para produção, implemente um banco de dados real (MongoDB, PostgreSQL, etc.)

2. **Autenticação**: O sistema de login é básico. Para produção, use bibliotecas como NextAuth.js

3. **Segurança**: Senhas não devem ser armazenadas em texto plano. Use bcrypt ou similar para hash

4. **Integração com Plataformas**: Integre com as APIs do Shopee e Mercado Livre para sincronizar produtos

## 🚀 Próximos Passos

1. **Banco de Dados**: Migrar para PostgreSQL com Prisma
2. **API REST**: Implementar APIs com Next.js Route Handlers
3. **Autenticação Avançada**: Usar NextAuth.js com JWT
4. **Pagamentos**: Integrar gateway de pagamento
5. **Notificações**: Sistema de notificações por email
6. **Mobile**: Aplicativo mobile com expo/react-native

## 📞 Suporte

Para dúvidas ou sugestões, entre em contato através dos canais da Donna Gigi.

## 📄 Licença

Todos os direitos reservados © 2024 Donna Gigi
