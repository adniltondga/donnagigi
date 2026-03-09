#!/usr/bin/env node

/**
 * Script de teste para autenticação com token no Mercado Livre
 * 
 * Uso:
 * node test-auth-token.js "SEU_TOKEN_AQUI"
 * 
 * ou
 * npm run test:ml-auth "SEU_TOKEN_AQUI"
 */

const token = process.argv[2];

if (!token) {
  console.error("❌ Erro: Cole um token como argumento");
  console.error("");
  console.error("Uso:");
  console.error("  node test-auth-token.js \"SEU_TOKEN_ML_AQUI\"");
  console.error("");
  console.error("Ou no package.json:");
  console.error("  npm run test:ml-auth");
  console.error("");
  process.exit(1);
}

async function testAuthentication() {
  const baseUrl = process.env.TEST_URL || "http://localhost:3000";
  const endpoint = `${baseUrl}/api/mercadolivre/authenticate`;

  console.log("🧪 Testando autenticação com Mercado Livre...");
  console.log(`📍 Endpoint: ${endpoint}`);
  console.log(`🔑 Token: ${token.substring(0, 10)}...${token.substring(token.length - 10)}`);
  console.log("");

  try {
    console.log("⏳ Enviando requisição...");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accessToken: token }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("");
      console.error("❌ ERRO na autenticação:");
      console.error(`Status: ${response.status}`);
      console.error(`Erro: ${data.error}`);
      if (data.details) {
        console.error(`Detalhes: ${data.details}`);
      }
      console.error("");
      
      if (response.status === 401) {
        console.log("💡 Dica: Token inválido ou expirado.");
        console.log("   Gere um novo token em: https://www.mercadolivre.com.br/sellers/tools/applications");
      } else if (response.status === 500) {
        console.log("💡 Dica: Erro no servidor.");
        console.log("   Verifique se o servidor está rodando (npm run dev)");
      }
      process.exit(1);
    }

    console.log("✅ SUCESSO!");
    console.log("");
    console.log("📊 Dados retornados:");
    console.log(`  ID do Vendedor: ${data.integration.sellerID}`);
    console.log(`  E-mail: ${data.integration.email}`);
    console.log(`  Usuário: ${data.integration.nickname}`);
    console.log(`  Expira em: ${new Date(data.integration.expiresAt).toLocaleDateString("pt-BR")}`);
    console.log("");
    console.log("💾 Token salvo no banco de dados!");
    console.log("");
    console.log("✨ Próximos passos:");
    console.log("  1. Acesse: http://localhost:3000/admin/integracao");
    console.log("  2. Verifique se mostra 'Conectado'");
    console.log("  3. Vá para http://localhost:3000/admin/produtos");
    console.log("  4. Sincronize um produto com o Mercado Livre");
    console.log("");

  } catch (error) {
    console.error("");
    console.error("❌ ERRO de rede:");
    console.error(error instanceof Error ? error.message : error);
    console.error("");
    console.log("💡 Dica: Verifique se:");
    console.log("  - O servidor está rodando (npm run dev)");
    console.log("  - A URL está correta");
    console.log("  - Você tem conexão com a internet");
    process.exit(1);
  }
}

testAuthentication();
