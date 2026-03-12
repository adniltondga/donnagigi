# 🧪 Testes Locais de Integração Mercado Livre

## 📋 Problemas com DNS?

Se você está tendo erro `DNS_PROBE_FINISHED_NXDOMAIN` ao tentar acessar `auth.mercadolibre.com.br`, pode usar esses scripts para testar a integração **enquanto resolve o problema de DNS**.

## 🚀 Como usar:

### 1️⃣ Primeiro teste - Configurar integração com token fake

```bash
node test-ml-integration.js
```

Este script:
- ✅ Configura uma integração "fake" no banco de dados
- ✅ Simula credenciais do Mercado Livre
- ✅ Verifica se está tudo OK no banco

### 2️⃣ Segundo teste - Sincronizar um produto

Primeiro, **crie um produto no admin**:
- Vá para: http://localhost:3000/admin/products
- Clique "Novo Produto"
- Preencha: Nome, Preço, Descrição, Imagem, Estoque
- Salve e copie o ID do produto

Depois, execute:

```bash
node sync-product-test.js <PRODUCT_ID>
```

Exemplo:
```bash
node sync-product-test.js cm4x5y2z1a9b
```

## ✅ Resultado esperado:

Se tudo funcionar:
```
✅ Integração configurada
✅ Token salvo no banco de dados
✅ Produto sincronizado
```

## 🔧 Para usar com token REAL:

Quando conseguir resolver o DNS e fazer login no Mercado Livre:

1. Acesse: http://localhost:3000/admin/integracao
2. Clique "Conectar ao Mercado Livre"
3. Autorize a conta
4. O token será salvo automaticamente
5. Pronto! Agora todos os produtos que criar serão sincronizados

## 🐛 Troubleshooting:

**Erro: connect ECONNREFUSED**
- Dev server não está rodando
- Execute: `npm run dev`

**Erro: Produto não encontrado**
- O ID do produto está errado
- Verifique no admin/products

**Erro: Integração não configurada**
- Execute `test-ml-integration.js` primeiro
