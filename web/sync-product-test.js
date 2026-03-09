#!/usr/bin/env node

/**
 * Script para testar sincronização de um produto com Mercado Livre
 * Uso: node sync-product-test.js <PRODUCT_ID>
 */

const BASE_URL = "http://localhost:3000"

async function syncProduct(productId) {
  if (!productId) {
    console.error("❌ Erro: Forneça um ID do produto")
    console.log("Uso: node sync-product-test.js <PRODUCT_ID>")
    process.exit(1)
  }

  console.log(`🧪 Testando sincronização do produto ${productId}\n`)

  try {
    console.log("📤 Enviando produto para sincronizar...")
    const syncRes = await fetch(`${BASE_URL}/api/mercadolivre/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    })

    const syncData = await syncRes.json()

    if (!syncRes.ok) {
      console.error("❌ Erro ao sincronizar:", syncData)
      return
    }

    console.log("✅ Resultado:", syncData)
    console.log("\n📊 Resumo:")
    console.log(`   - Produto: ${productId}`)
    console.log(`   - Status: ${syncData.syncStatus || syncData.success}`)
    if (syncData.mlListingId) {
      console.log(`   - Listing ML: ${syncData.mlListingId}`)
    }
  } catch (error) {
    console.error("💥 Erro:", error.message)
  }
}

const productId = process.argv[2]
syncProduct(productId)
