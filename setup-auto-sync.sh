#!/bin/bash
# 🚀 Setup Rápido - Auto Sync ML

set -e

echo "🔄 Setup Sincronização Automática - Mercado Livre"
echo "=================================================="
echo ""

# 1. Gerar token secreto
echo "1️⃣ Gerando token secreto..."
SECRET_TOKEN=$(openssl rand -base64 32 | tr -d '/+' | cut -c1-32)
echo "✅ Token gerado: $SECRET_TOKEN"
echo ""

# 2. Adicionar ao .env.local
echo "2️⃣ Atualizando .env.local..."
if grep -q "ML_POLLING_SECRET" .env.local 2>/dev/null; then
  sed -i '' "s/ML_POLLING_SECRET=.*/ML_POLLING_SECRET=$SECRET_TOKEN/" .env.local
else
  echo "ML_POLLING_SECRET=$SECRET_TOKEN" >> .env.local
fi
echo "✅ .env.local atualizado"
echo ""

# 3. Instruções para GitHub
echo "3️⃣ Configurar GitHub Actions:"
echo "   1. Vá para: https://github.com/seu-usuario/seu-repo/settings/secrets/actions"
echo "   2. Clique em 'New repository secret'"
echo "   3. Nome: ML_SYNC_URL"
echo "      Valor: https://seu-dominio-producao.com/api/ml/polling-sync"
echo "   4. Nome: ML_POLLING_SECRET"
echo "      Valor: $SECRET_TOKEN"
echo ""

echo "4️⃣ Configurar Webhook no ML (Opcional mas Recomendado):"
echo "   1. Vá para: https://www.mercadolibre.com/developers/panel"
echo "   2. Selecione sua aplicação"
echo "   3. Em 'Notificações e Webhooks', adicione:"
echo "      URL: https://seu-dominio-producao.com/api/ml/webhook"
echo "      Tópicos: item"
echo ""

echo "✅ Setup concluído!"
echo ""
echo "📚 Próximos passos:"
echo "   1. Defina as secrets no GitHub"
echo "   2. Test: npm run dev && curl http://localhost:3000/api/ml/polling-sync?token=$SECRET_TOKEN"
echo "   3. Leia: docs/ML_AUTO_SYNC.md"
echo ""
