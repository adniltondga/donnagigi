import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export const dynamic = "force-dynamic"

/**
 * GET /api/ml/debug-sync
 * Debug: Testa qual endpoint funciona para listar produtos
 */
export async function GET() {
  try {
    const integration = await prisma.mLIntegration.findFirst()
    if (!integration) {
      return NextResponse.json({ error: "Sem integração" })
    }

    const token = integration.accessToken
    const sellerId = integration.sellerID
    const results: any = {}

    // TESTE 1: /users/{id}/listings
    try {
      const test1 = await fetch(`https://api.mercadolibre.com/users/${sellerId}/listings?limit=3`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const test1Data = await test1.json().catch(() => ({}))
      results.test1_userIdListings = {
        status: test1.status,
        ok: test1.ok,
        hasError: !!test1Data.error,
        errorMessage: test1Data.message || test1Data.error,
        dataKeys: test1.ok ? Object.keys(test1Data).slice(0, 5) : [],
      }
    } catch (e: any) {
      results.test1_userIdListings = { error: e.message }
    }

    // TESTE 2: /users/me/listings
    try {
      const test2 = await fetch("https://api.mercadolibre.com/users/me/listings?limit=3", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const test2Data = await test2.json().catch(() => ({}))
      results.test2_meListing = {
        status: test2.status,
        ok: test2.ok,
        hasError: !!test2Data.error,
        errorMessage: test2Data.message || test2Data.error,
      }
    } catch (e: any) {
      results.test2_meListing = { error: e.message }
    }

    // TESTE 3: /users/me para verificar token
    try {
      const test3 = await fetch("https://api.mercadolibre.com/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const test3Data = await test3.json().catch(() => ({}))
      results.test3_usersMe = {
        status: test3.status,
        ok: test3.ok,
        userId: test3Data.id,
        nickname: test3Data.nickname,
      }
    } catch (e: any) {
      results.test3_usersMe = { error: e.message }
    }

    // TESTE 4: /users/{id}/items/search (Endpoint correto!)
    try {
      const test4 = await fetch(
        `https://api.mercadolibre.com/users/${sellerId}/items/search?limit=25`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      const test4Data = await test4.json().catch(() => ({}))
      const results_array = test4Data.results || []
      results.test4_usersItemsSearch = {
        status: test4.status,
        ok: test4.ok,
        totalFound: test4Data.paging?.total || 0,
        totalReturned: results_array.length || 0,
        firstItemStructure: results_array[0] ? Object.keys(results_array[0]) : [],
        sampleFirstItem: results_array[0] ? results_array[0] : null,
      }
    } catch (e: any) {
      results.test4_usersItemsSearch = { error: e.message }
    }

    // TESTE 5: Operações privadas
    try {
      const test5 = await fetch("https://api.mercadolibre.com/myfeeds/seller_items", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const test5Data = await test5.json().catch(() => ({}))
      results.test5_myfeeds = {
        status: test5.status,
        ok: test5.ok,
        totalItems: test5Data.paging?.total,
      }
    } catch (e: any) {
      results.test5_myfeeds = { error: e.message }
    }

    // TESTE 6: Tentar /me/listings
    try {
      const test6 = await fetch("https://api.mercadolibre.com/me/listings", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const test6Data = await test6.json().catch(() => ({}))
      results.test6_meListings = {
        status: test6.status,
        ok: test6.ok,
        totalListings: test6Data.paging?.total || Array.isArray(test6Data) ? test6Data.length : 0,
      }
    } catch (e: any) {
      results.test6_meListings = { error: e.message }
    }

    // TESTE 8: Buscar detalhes em batch (formato especial)
    try {
      const listingIds = ["MLB4518332721", "MLB6429113696"]
      const idsParam = listingIds.join(",")
      const test8 = await fetch(`https://api.mercadolibre.com/items?ids=${idsParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const test8Data = await test8.json().catch(() => ({}))
      results.test8_itemsBatch = {
        status: test8.status,
        ok: test8.ok,
        dataType: Array.isArray(test8Data) ? "array" : typeof test8Data,
        itemCount: Array.isArray(test8Data) ? test8Data.length : 0,
        firstItemKeys: Array.isArray(test8Data) ? Object.keys(test8Data[0] || {}) : [],
        sampleFirstItem: Array.isArray(test8Data) ? test8Data[0] : test8Data,
      }
    } catch (e: any) {
      results.test8_itemsBatch = { error: e.message }
    }

    return NextResponse.json({
      integration: { sellerId, tokenExists: !!token },
      results,
    })
  } catch (error) {
    console.error("[DEBUG] Erro:", error)
    return NextResponse.json({ error: String(error) })
  }
}
