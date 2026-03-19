# 📦 Guia de Sincronismo com Mercado Livre

## Visão Geral
Este documento descreve como sincronizar seus produtos anunciados no Mercado Livre com a plataforma Donna Gigi.

---

## 🔑 Pré-requisitos

### 1. Conta do Mercado Livre
- ✅ Já tem 25 produtos anunciados
- ✅ Acesso à sua loja

### 2. Credenciais da API do Mercado Livre
Você precisa gerar as credenciais:

1. Acesse: https://developers.mercadolivre.com.br/
2. Faça login com sua conta
3. Acesse: "Meus Apps" → "Criar uma aplicação"
4. Preencha os dados:
   - **Nome**: "Donna Gigi Sync"
   - **Tipo**: "Aplicação de servidor web"
   - **URL de redirecionamento**: `http://localhost:3000/api/ml/callback` (desenvolvimento)
   
5. Você receberá:
   - `App ID` (Client ID)
   - `Client Secret`

### 3. Adicionar ao `.env`
```env
# Mercado Livre
ML_CLIENT_ID=seu_app_id_aqui
ML_CLIENT_SECRET=seu_client_secret_aqui
ML_REDIRECT_URL=http://localhost:3000/api/ml/callback
ML_ACCESS_TOKEN=sera_gerado_automaticamente
```

---

## 📋 Passo a Passo da Implementação

### Etapa 1: Configurar Autenticação OAuth

**Arquivo**: `src/app/api/ml/auth/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { redirect } from 'next/navigation';

const ML_AUTH_URL = 'https://auth.mercadolivre.com.br/authorization';

export async function GET(req: NextRequest) {
  const clientId = process.env.ML_CLIENT_ID;
  const redirectUrl = process.env.ML_REDIRECT_URL;

  if (!clientId || !redirectUrl) {
    return NextResponse.json(
      { error: 'Credenciais do Mercado Livre não configuradas' },
      { status: 400 }
    );
  }

  const authUrl = `${ML_AUTH_URL}?response_type=code&client_id=${clientId}&redirect_uri=${redirectUrl}`;
  
  return NextResponse.redirect(authUrl);
}
```

### Etapa 2: Processar Callback de Autenticação

**Arquivo**: `src/app/api/ml/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

const ML_TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Código não recebido' }, { status: 400 });
  }

  try {
    const response = await fetch(ML_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.ML_CLIENT_ID,
        client_secret: process.env.ML_CLIENT_SECRET,
        code,
        redirect_uri: process.env.ML_REDIRECT_URL,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: 'Falha na autenticação' }, { status: 500 });
    }

    // Salvar token no .env ou banco de dados
    // TODO: Implementar armazenamento seguro do token
    console.log('✅ Token obtido:', data.access_token);

    return NextResponse.json({ message: 'Autenticado com sucesso!' });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao obter token' }, { status: 500 });
  }
}
```

### Etapa 3: Buscar Produtos do Mercado Livre

**Arquivo**: `src/app/api/ml/sync/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const ML_API = 'https://api.mercadolibre.com';

export async function GET(req: NextRequest) {
  const accessToken = process.env.ML_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Token de acesso não configurado' },
      { status: 400 }
    );
  }

  try {
    // 1. Buscar IDs dos produtos do seller
    const searchRes = await fetch(
      `${ML_API}/users/me/listings?access_token=${accessToken}`,
      { headers: { 'Accept': 'application/json' } }
    );

    const listings = await searchRes.json();

    if (!Array.isArray(listings)) {
      throw new Error('Resposta inválida');
    }

    const syncedProducts = [];

    // 2. Para cada produto, buscar detalhes
    for (const listingId of listings.slice(0, 25)) {
      const detailRes = await fetch(
        `${ML_API}/items/${listingId}?access_token=${accessToken}`,
        { headers: { 'Accept': 'application/json' } }
      );

      const product = await detailRes.json();

      // 3. Verificar se já existe no banco
      let dbProduct = await prisma.product.findFirst({
        where: { mlListingId: product.id },
      });

      if (!dbProduct) {
        // 4. Criar novo produto
        dbProduct = await prisma.product.create({
          data: {
            name: product.title,
            description: product.description || '',
            mlListingId: product.id,
            baseSalePrice: product.price,
            minStock: 5,
            active: product.status === 'active',
          },
        });
      } else {
        // 5. Atualizar produto existente
        dbProduct = await prisma.product.update({
          where: { id: dbProduct.id },
          data: {
            name: product.title,
            baseSalePrice: product.price,
            active: product.status === 'active',
          },
        });
      }

      syncedProducts.push(dbProduct);
    }

    return NextResponse.json({
      success: true,
      message: `${syncedProducts.length} produtos sincronizados`,
      data: syncedProducts,
    });
  } catch (error) {
    console.error('Erro ao sincronizar:', error);
    return NextResponse.json(
      { error: 'Erro ao sincronizar com Mercado Livre' },
      { status: 500 }
    );
  }
}
```

### Etapa 4: Adicionar Cliente de Sincronismo no Admin

**Arquivo**: `src/app/admin/integracao/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function IntegracaoPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleConnectML = async () => {
    window.location.href = '/api/ml/auth';
  };

  const handleSyncProducts = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/ml/sync');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setMessage(`✅ ${data.message}`);
    } catch (err) {
      setError(`❌ ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Integrações</h1>

      {/* Mercado Livre */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">🟡 Mercado Livre</h2>
            <p className="text-gray-600 text-sm">Sincronize seus produtos anunciados</p>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleConnectML}
            className="w-full"
          >
            Conectar com Mercado Livre
          </Button>

          <Button
            onClick={handleSyncProducts}
            disabled={loading}
            variant="outline"
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              'Sincronizar Produtos'
            )}
          </Button>
        </div>

        {message && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-green-800">{message}</p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Etapa 5: Adicionar Link no Menu do Admin

No `src/components/AdminSidebar.tsx`, adicione:

```typescript
<li>
  <Link
    href="/admin/integracao"
    className={`block px-4 py-2 rounded-lg transition ${
      isActive("/admin/integracao")
        ? "bg-primary-500 text-white"
        : "text-admin-300 hover:bg-admin-700"
    }`}
  >
    🔗 Integrações
  </Link>
</li>
```

---

## 🚀 Passo a Passo de Uso

### 1️⃣ Primeira Conexão
```bash
1. Acesse: http://localhost:3000/admin/integracao
2. Clique em "Conectar com Mercado Livre"
3. Autorize a aplicação
4. Você será redirecionado de volta
```

### 2️⃣ Sincronizar Produtos
```bash
1. Clique em "Sincronizar Produtos"
2. Aguarde a sincronização (pode levar alguns segundos)
3. Seus 25 produtos aparecerão no sistema!
```

### 3️⃣ Gerenciar Produtos
- Agora você pode editar preços, estoque, etc. no painel
- Os IDs do Mercado Livre ficarão vinculados

---

## 🔄 Sincronização Automática (Opcional)

Para atualizar automaticamente, você pode adicionar uma rotina com Vercel Cron:

**Arquivo**: `src/app/api/cron/sync-ml/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Validar que é de um cron do Vercel
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    await fetch(`${process.env.NEXTAUTH_URL}/api/ml/sync`);
    return NextResponse.json({ success: true, message: 'Sincronismo executado' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

**Em `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-ml",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

---

## 🔒 Segurança

⚠️ **IMPORTANTE:**
- Nunca commite tokens no GitHub
- Use `.env` e variáveis de ambiente
- Implemente refresh token para tokens de longa duração
- Considere armazenar tokens criptografados no banco

---

## ✅ Verificação

Após sincronizar, você verá seus produtos com:
- ✅ ID do Mercado Livre vinculado
- ✅ Preço sincronizado
- ✅ Título do produto
- ✅ Status (ativo/inativo)

---

## 📞 Próximos Passos (Futuros)

- [ ] Sincronizar mudanças de preço de volta para ML
- [ ] Sincronizar estoque em tempo real
- [ ] Importar avaliações dos clientes
- [ ] Sincronizar com Shopee também

---

**Dúvidas?** Consulte a [documentação oficial do Mercado Livre](https://developers.mercadolivre.com.br/pt_BR/referencia-api)
