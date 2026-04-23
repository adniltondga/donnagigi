import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { getMLIntegrationForTenant } from "@/lib/ml"
import { AuthError, authErrorResponse, requireRole } from "@/lib/auth"
import { formatVariationLabel } from "../sync-orders/route"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * POST /api/ml/backfill-variations
 * Re-busca no ML os pedidos de vendas já importadas e atualiza a
 * description + notes com a variação (cor/tamanho/etc).
 *
 * Query: ?limit=N (default 500, máx 1000) pra controlar volume por chamada.
 *
 * Idempotente: bills que já têm " · " na descrição (ou sem variação no
 * pedido) são puladas.
 */
export async function POST(req: NextRequest) {
  try {
    await requireRole(["OWNER", "ADMIN"])
    const tenantId = await getTenantIdOrDefault()
    const integration = await getMLIntegrationForTenant(tenantId)
    if (!integration) {
      return NextResponse.json(
        { error: "Mercado Livre não configurado pra esse tenant" },
        { status: 400 }
      )
    }

    const accessToken = integration.accessToken
    const limitParam = Number(req.nextUrl.searchParams.get("limit")) || 500
    const limit = Math.min(Math.max(limitParam, 1), 1000)

    // Pega bills de venda do tenant que têm mlOrderId e ainda NÃO têm "·" na description
    // (sinal de que nunca foi populada com variação).
    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        category: "venda",
        mlOrderId: { not: null },
        NOT: { description: { contains: " · " } },
      },
      select: { id: true, mlOrderId: true, description: true, notes: true },
      take: limit,
    })

    let updated = 0
    let semVariacao = 0
    let erros = 0
    let processados = 0

    for (const bill of bills) {
      processados++
      const orderId = bill.mlOrderId?.replace(/^order_/, "")
      if (!orderId) {
        erros++
        continue
      }

      try {
        const res = await fetch(
          `https://api.mercadolibre.com/orders/${orderId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!res.ok) {
          erros++
          continue
        }
        const order = await res.json()
        const firstItem = order?.order_items?.[0]?.item
        if (!firstItem) {
          semVariacao++
          continue
        }

        const variation = formatVariationLabel(firstItem.variation_attributes)
        if (!variation) {
          semVariacao++
          continue
        }

        const itemTitle = firstItem.title || "Venda Mercado Livre"
        const itemId = firstItem.id || ""
        const newDescription = `Venda ML - ${itemTitle} · ${variation} [Produto ML: ${itemId || "sem-id"}]`

        // Injeta/substitui o bloco "Variação" nas notes sem perder o resto
        let newNotes = bill.notes || ""
        const variacaoBlock = `\nVariação\n${variation}\n`
        if (newNotes.includes("\nVariação\n")) {
          newNotes = newNotes.replace(/\nVariação\n[^\n]*\n/, variacaoBlock)
        } else if (newNotes.includes("\nProduto\n")) {
          // Insere logo depois do bloco Produto
          newNotes = newNotes.replace(/(\nProduto\n[^\n]+\n)/, `$1${variacaoBlock}`)
        } else {
          newNotes = newNotes + variacaoBlock
        }

        await prisma.bill.update({
          where: { id: bill.id },
          data: { description: newDescription, notes: newNotes },
        })
        updated++
      } catch (err) {
        console.error(`[backfill-variations] erro no pedido ${orderId}:`, err)
        erros++
      }

      // throttle leve pra não estourar rate limit do ML (10k/h por app)
      await new Promise((r) => setTimeout(r, 50))
    }

    return NextResponse.json({
      success: true,
      stats: { processados, updated, semVariacao, erros, pendentes: bills.length === limit },
      message: `${updated} venda(s) atualizada(s) com variação.`,
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[backfill-variations] erro geral:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao fazer backfill" },
      { status: 500 }
    )
  }
}
