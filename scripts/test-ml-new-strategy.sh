#!/bin/bash

# 🧪 TESTER: Endpoints ML de Nova Estratégia
# Teste rápido para validar publicação e sincronização

echo "🚀 TESTANDO NOVA ESTRATÉGIA ML"
echo "================================\n"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"
PRODUCT_ID="seu_product_id_aqui"
VARIANT_ID="sua_variant_id_aqui"

echo -e "${BLUE}1. Testando /api/ml/publish${NC}"
echo "---------------------------------"
echo "Publicando produto no ML...\n"

PUBLISH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/ml/publish" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "'$PRODUCT_ID'",
    "variantIds": ["'$VARIANT_ID'"],
    "titulo": "Chinelo Donna Gigi Rosa Premium",
    "categoria_ml": "246427"
  }')

echo -e "${GREEN}Resposta:${NC}"
echo "$PUBLISH_RESPONSE" | jq '.' 2>/dev/null || echo "$PUBLISH_RESPONSE"

# Extrair mlListingId se sucesso
ML_LISTING_ID=$(echo "$PUBLISH_RESPONSE" | jq -r '.mlListingId' 2>/dev/null)

echo "\n"
echo -e "${BLUE}2. Testando /api/ml/sync-inventory${NC}"
echo "-------------------------------------"
echo "Sincronizando estoque...\n"

INVENTORY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/ml/sync-inventory" \
  -H "Content-Type: application/json" \
  -d '{
    "variantId": "'$VARIANT_ID'",
    "newStock": 50
  }')

echo -e "${GREEN}Resposta:${NC}"
echo "$INVENTORY_RESPONSE" | jq '.' 2>/dev/null || echo "$INVENTORY_RESPONSE"

echo "\n"
echo -e "${BLUE}3. Testando /api/ml/sync-price${NC}"
echo "--------------------------------"
echo "Sincronizando preço...\n"

PRICE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/ml/sync-price" \
  -H "Content-Type: application/json" \
  -d '{
    "variantId": "'$VARIANT_ID'",
    "newPrice": 199.90
  }')

echo -e "${GREEN}Resposta:${NC}"
echo "$PRICE_RESPONSE" | jq '.' 2>/dev/null || echo "$PRICE_RESPONSE"

echo "\n"
echo -e "${BLUE}4. Testando /api/ml/sync-inventory (batch)${NC}"
echo "-------------------------------------------"
echo "Sincronizando todos os estoques...\n"

BATCH_INVENTORY=$(curl -s -X POST "$BASE_URL/api/ml/sync-inventory" \
  -H "Content-Type: application/json" \
  -d '{"batch": true}')

echo -e "${GREEN}Resposta:${NC}"
echo "$BATCH_INVENTORY" | jq '.' 2>/dev/null || echo "$BATCH_INVENTORY"

echo "\n"
echo -e "${BLUE}5. Testando /api/ml/sync-price (batch)${NC}"
echo "--------------------------------------"
echo "Sincronizando todos os preços...\n"

BATCH_PRICE=$(curl -s -X POST "$BASE_URL/api/ml/sync-price" \
  -H "Content-Type: application/json" \
  -d '{"batch": true}')

echo -e "${GREEN}Resposta:${NC}"
echo "$BATCH_PRICE" | jq '.' 2>/dev/null || echo "$BATCH_PRICE"

echo "\n"
echo -e "${GREEN}✅ TESTES CONCLUÍDOS${NC}"
echo "================================\n"

echo -e "${YELLOW}📋 Checklist de Validação:${NC}"
echo "□ /api/ml/publish - Retorna mlListingId"
echo "□ /api/ml/sync-inventory - 100% sincronizado"
echo "□ /api/ml/sync-price - 100% sincronizado"
echo "□ Batch mode - Processa todos os itens"
echo "□ Erros tratados corretamente"
echo ""
echo -e "${YELLOW}💡 Próximos testes:${NC}"
echo "1. Fazer curl com dados reais de produto/variante"
echo "2. Verificar se mlListingId foi salvo no BD"
echo "3. Testar em produção com dados reais do ML"
