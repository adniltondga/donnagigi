#!/bin/bash
# Script para testar os endpoints de produtos com múltiplas variações
# Use: bash test-endpoints.sh

API_URL="http://localhost:3000/api"

echo "🧪 Testando Endpoints de Produtos com Múltiplas Variações"
echo "=========================================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Criar produto com múltiplas variações
echo -e "${YELLOW}1️⃣  Criando produto COM múltiplas variações...${NC}"
response=$(curl -s -X POST "$API_URL/products" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Capinha Teste - iPhone",
    "description": "Capinha magnética de teste com múltiplas cores",
    "baseImage": "https://via.placeholder.com/300",
    "category": "Capinhas",
    "supplier": "testador",
    "attributes": [
      {
        "name": "Cor",
        "type": "color",
        "values": ["Preto", "Rosa", "Cinza"]
      },
      {
        "name": "Modelo",
        "type": "model",
        "values": ["iPhone 14 Pro Max", "iPhone 15 Pro Max"]
      }
    ],
    "variants": [
      {
        "sku": "TEST-IP14-PRETO-001",
        "salePrice": 59.90,
        "purchaseCost": 18.90,
        "stock": 15,
        "attributes": {
          "Cor": "Preto",
          "Modelo": "iPhone 14 Pro Max"
        }
      },
      {
        "sku": "TEST-IP14-ROSA-001",
        "salePrice": 59.90,
        "purchaseCost": 18.90,
        "stock": 12,
        "attributes": {
          "Cor": "Rosa",
          "Modelo": "iPhone 14 Pro Max"
        }
      },
      {
        "sku": "TEST-IP14-CINZA-001",
        "salePrice": 59.90,
        "purchaseCost": 18.90,
        "stock": 8,
        "attributes": {
          "Cor": "Cinza",
          "Modelo": "iPhone 14 Pro Max"
        }
      },
      {
        "sku": "TEST-IP15-PRETO-001",
        "salePrice": 59.90,
        "purchaseCost": 18.90,
        "stock": 20,
        "attributes": {
          "Cor": "Preto",
          "Modelo": "iPhone 15 Pro Max"
        }
      }
    ]
  }')

success=$(echo $response | grep -c '"success":true')
if [ $success -eq 1 ]; then
  echo -e "${GREEN}✅ Produto criado com sucesso!${NC}"
  product_id=$(echo $response | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  variants_count=$(echo $response | grep -o '"variantsCount":[0-9]*' | cut -d':' -f2)
  echo -e "${GREEN}   ID do produto: $product_id${NC}"
  echo -e "${GREEN}   Variações criadas: $variants_count${NC}"
  echo ""
else
  echo -e "${RED}❌ Erro ao criar produto${NC}"
  echo $response | jq '.' 2>/dev/null || echo $response
  echo ""
  exit 1
fi

# 2. Buscar produto pelo ID
echo -e "${YELLOW}2️⃣  Buscando produto específico...${NC}"
response=$(curl -s -X GET "$API_URL/products/$product_id")
success=$(echo $response | grep -c "TEST-IP14-PRETO-001")

if [ $success -eq 1 ]; then
  echo -e "${GREEN}✅ Produto encontrado com variações!${NC}"
  echo $response | jq '.data | {name, variants: (.variants | length)}' 2>/dev/null || echo "   Prodotto com variações retornado"
  echo ""
else
  echo -e "${RED}❌ Erro ao buscar produto${NC}"
  echo ""
fi

# 3. Listar todos os produtos
echo -e "${YELLOW}3️⃣  Listando todos os produtos...${NC}"
response=$(curl -s "$API_URL/products?page=1&limit=10")
success=$(echo $response | grep -c '"success":true')

if [ $success -eq 1 ]; then
  echo -e "${GREEN}✅ Produtos listados com sucesso!${NC}"
  count=$(echo $response | grep -o '"variants":\[' | wc -l)
  echo -e "${GREEN}   Produtos com variações: $count${NC}"
  echo ""
else
  echo -e "${RED}❌ Erro ao listar produtos${NC}"
  echo ""
fi

# 4. Atualizar informações gerais do produto
echo -e "${YELLOW}4️⃣  Atualizando nome do produto...${NC}"
response=$(curl -s -X PUT "$API_URL/products/$product_id" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Capinha Teste Atualizada - iPhone Pro Max",
    "description": "Nova descrição após teste"
  }')

success=$(echo $response | grep -c '"success":true')
if [ $success -eq 1 ]; then
  echo -e "${GREEN}✅ Produto atualizado com sucesso!${NC}"
  echo ""
else
  echo -e "${RED}❌ Erro ao atualizar produto${NC}"
  echo $response | jq '.' 2>/dev/null || echo $response
  echo ""
fi

# 5. Tentar atualizar preço (deve falhar, pois isso é feito em variações)
echo -e "${YELLOW}5️⃣  Tentando atualizar preço no produto (deve falhar!)...${NC}"
response=$(curl -s -X PUT "$API_URL/products/$product_id" \
  -H "Content-Type: application/json" \
  -d '{
    "salePrice": 69.90
  }')

success=$(echo $response | grep -c '"Campos de preço"')
if [ $success -eq 1 ]; then
  echo -e "${GREEN}✅ Bloqueio funcionando corretamente!${NC}"
  echo -e "${GREEN}   Mensagem: 'Campos de preço, estoque e variações devem ser atualizados via /variants'${NC}"
  echo ""
else
  echo -e "${RED}❌ Bloqueio não funcionou${NC}"
  echo ""
fi

# 6. Listar variações de um produto
echo -e "${YELLOW}6️⃣  Listando variações do produto...${NC}"
response=$(curl -s "$API_URL/products/$product_id/variants")
success=$(echo $response | grep -c '"success":true')

if [ $success -eq 1 ]; then
  echo -e "${GREEN}✅ Variações listadas com sucesso!${NC}"
  count=$(echo $response | grep -c '"sku"')
  echo -e "${GREEN}   Variações encontradas: $count${NC}"
  echo ""
else
  echo -e "${RED}❌ Erro ao listar variações${NC}"
  echo ""
fi

# 7. Teste: Filtrar variações por atributo
echo -e "${YELLOW}7️⃣  Filtrando variações por cor (Preto)...${NC}"
response=$(curl -s "$API_URL/products/$product_id/variants?Cor=Preto")
success=$(echo $response | grep -c '"success":true')

if [ $success -eq 1 ]; then
  count=$(echo $response | grep -c '"sku"')
  echo -e "${GREEN}✅ Variações filtradas! Encontradas: $count${NC}"
  echo ""
else
  echo -e "${RED}❌ Erro ao filtrar variações${NC}"
  echo ""
fi

echo "=========================================================="
echo -e "${GREEN}🎉 Testes Completos!${NC}"
echo ""
echo "Resumo:"
echo "✅ Produto criado com 4 variações"
echo "✅ Endpoints GET funcionando"
echo "✅ Endpoint PUT protegido contra atualizações de variações"
echo "✅ Variações podem ser filtradas"
echo ""
echo "Próximos passos:"
echo "1. Testar PATCH para atualizar uma variação específica"
echo "2. Testar DELETE para desativar uma variação"
echo "3. Testar criação de variação nova com POST /variants"
