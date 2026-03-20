#!/bin/bash

# Script para testar fluxo completo de integração OAuth2 com Mercado Livre

BASE_URL="${1:-http://localhost:3000}"
echo "🚀 Testando integração OAuth2 com Mercado Livre"
echo "Base URL: $BASE_URL"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para pretty print JSON
pretty_json() {
    echo "$1" | jq . 2>/dev/null || echo "$1"
}

# Teste 1: Verificar status da integração (deve estar desconectado inicialmente)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1️⃣  Verificar Status Inicial${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

RESPONSE=$(curl -s "$BASE_URL/api/mercadolivre/integration")
echo "GET $BASE_URL/api/mercadolivre/integration"
echo ""
echo "Response:"
pretty_json "$RESPONSE"
echo ""

# Verificar se retornou o esperado
if echo "$RESPONSE" | jq -e '.configured == false' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Status inicial: Não conectado (esperado)${NC}"
elif echo "$RESPONSE" | jq -e '.configured == true' > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Status inicial: Já conectado${NC}"
else
    echo -e "${RED}❌ Erro ao verificar status${NC}"
fi
echo ""

# Teste 2: Iniciar login OAuth
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2️⃣  Iniciar Login OAuth${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "GET $BASE_URL/api/mercadolivre/auth"
echo ""
echo "⚠️  Este endpoint faz redirect para Mercado Livre"
echo "Para testar manualmente:"
echo "1. Abra em browser: $BASE_URL/api/mercadolivre/auth"
echo "2. Faça login no Mercado Livre"
echo "3. Autorize o acesso"
echo "4. Será redirecionado para: $BASE_URL/admin/integracao"
echo ""

# Teste 3: Verificar endpoint /api/ml/sync
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3️⃣  Verificar Endpoint de Sincronização${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

RESPONSE=$(curl -s "$BASE_URL/api/ml/sync")
echo "GET $BASE_URL/api/ml/sync"
echo ""
echo "Response:"
pretty_json "$RESPONSE"
echo ""

if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    ERROR=$(echo "$RESPONSE" | jq -r '.error')
    if [[ "$ERROR" == *"não configurada"* ]] || [[ "$ERROR" == *"not configured"* ]]; then
        echo -e "${YELLOW}⚠️  Esperado: Integração não configurada ainda${NC}"
    else
        echo -e "${RED}❌ Erro: $ERROR${NC}"
    fi
else
    echo -e "${GREEN}✅ Sincronização funcionando!${NC}"
    STATS=$(echo "$RESPONSE" | jq '.stats')
    echo "Estatísticas:"
    pretty_json "$STATS"
fi
echo ""

# Teste 4: Verificar endpoints antigos
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}4️⃣  Verificar Endpoints Antigos${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "GET $BASE_URL/api/mercadolivre/integration (GET)"
RESPONSE=$(curl -s "$BASE_URL/api/mercadolivre/integration")
pretty_json "$RESPONSE"
echo ""

# Sumário
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Sumário de Testes${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Endpoints testados:"
echo "  ✅ GET /api/mercadolivre/integration - Status da integração"
echo "  ⚠️  GET /api/mercadolivre/auth - Redirect OAuth (teste manual)"
echo "  ✅ GET /api/ml/sync - Sincronizar produtos"
echo ""
echo "Próximos passos:"
echo "  1. Abra $BASE_URL/admin/integracao em um browser"
echo "  2. Clique no botão 'Conectar via OAuth'"
echo "  3. Faça login no Mercado Livre"
echo "  4. Retorne para verificar status"
echo "  5. Clique 'Sincronizar Produtos' para importar"
echo ""
echo "Para rodar testes novamente após conectar:"
echo "  bash test-oauth-flow.sh $BASE_URL"
echo ""
