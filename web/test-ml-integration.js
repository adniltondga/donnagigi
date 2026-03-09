#!/usr/bin/env node

/**
 * Script para testar integração com Mercado Livre localmente
 * Simula um token de autenticação para testes
 */

import fetch from "node-fetch"

const BASE_URL = "http://localhost:3000"

async function testMLIntegration() {
  console.log("🧪 Testando Integração com Mercado Livre\n")

  try {
    // 1. Configurar integração com token fake
    console.log("1️⃣ Configurando integração com token de teste...")
    const fakeToken = "TEST_TOKEN_" + Date.now()
    const sellerId = "123456789"
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas

    const configRes = await fetch(`${BASE_URL}/api/mercadolivre/integration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: fakeToken,
        refreshToken: null,
        sellerID: sellerId,
        expiresAt: expiresAt.toISOString(),
      }),
    })

    const configData = await configRes.json()
    if (!configRes.ok) {
      console.error("❌ Erro ao configurar:", configData)
      return
    }
    console.log("✅ Integração configurada:", configData.integration)

    // 2. Verificar status
    console.log("\n2️⃣ Verificando status da integração...")
    const statusRes = await fetch(`${BASE_URL}/api/mercadolivre/integration`)
    const status = await statusRes.json()
    console.log("✅ Status:", status)

    // 3. Criar um produto para teste
    console.log("\n3️⃣ Criando produto de teste para sincronizar...")

    // Você pode pular esse passo se já tiver produtos cadastrados
    console.log("⚠️ Certifique-se de que tem produtos cadastrados no admin!")
    console.log("   Vá para: http://localhost:3000/admin/products")

    console.log("\n✨ Teste concluído!")
    console.log("\n📝 Próximos passos:")
    console.log("   1. Cadastre um produto no admin/products")
    console.log("   2. Note o ID do produto")
    console.log("   3. Use node sync-product-test.js <PRODUCT_ID>")
  } catch (error) {
    console.error("💥 Erro:", error)
  }
}

testMLIntegration()
