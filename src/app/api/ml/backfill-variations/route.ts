import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { getMLIntegrationForTenant } from "@/lib/ml"
import { AuthError, authErrorResponse, requireRole } from "@/lib/auth"
import { formatVariationLabel } from "@/lib/ml-format"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * POST /api/ml/backfill-variations
 * Re-busca no ML os pedidos de vendas já importadas e atualiza description
 * + notes com a variação em ordem canônica (cor/tamanho/modelo sempre na
 * mesma sequência, ordenados pelo `name` do atributo).
 *
 * Query: ?limit=N (default 500, máx 1000) pra controlar volume por chamada.
 *
 * Idempotente: só chama o update quando a description canônica é
 * diferente da atual. Processa TODAS as bills de venda (incluindo as
 * que já têm " · " em ordem inconsistente).
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

    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        category: "venda",
        mlOrderId: { not: null },
      },
      select: { id: true, mlOrderId: true, description: true, notes: true },
      orderBy: { paidDate: "desc" },
      take: limit,
    })

    let updated = 0
    let semVariacao = 0
    let jaOk = 0
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
        const itemTitle = firstItem.title || "Venda Mercado Livre"
        const itemId = firstItem.id || ""
        const displayTitle = variation ? `${itemTitle} · ${variation}` : itemTitle
        const newDescription = `Venda ML - ${displayTitle} [Produto ML: ${itemId || "sem-id"}]`

        if (!variation) {
          semVariacao++
        }

        // Monta nova notes: substitui/injeta bloco "Variação" sem perder o resto
        let newNotes = bill.notes || ""
        const variacaoBlock = variation ? `\nVariação\n${variation}\n` : ""
        if (newNotes.includes("\nVariação\n")) {
          newNotes = newNotes.replace(/\nVariação\n[^\n]*\n/, variacaoBlock || "\n")
        } else if (variation && newNotes.includes("\nProduto\n")) {
          newNotes = newNotes.replace(/(\nProduto\n[^\n]+\n)/, `$1${variacaoBlock}`)
        } else if (variation) {
          newNotes = newNotes + variacaoBlock
        }

        const precisaUpdate =
          newDescription !== bill.description || newNotes !== (bill.notes || "")
        if (!precisaUpdate) {
          jaOk++
        } else {
          await prisma.bill.update({
            where: { id: bill.id },
            data: { description: newDescription, notes: newNotes },
          })
          updated++
        }
      } catch (err) {
        console.error(`[backfill-variations] erro no pedido ${orderId}:`, err)
        erros++
      }

      // throttle leve pra não estourar rate limit do ML (10k/h por app)
      await new Promise((r) => setTimeout(r, 50))
    }

    return NextResponse.json({
      success: true,
      stats: { processados, updated, jaOk, semVariacao, erros, pendentes: bills.length === limit },
      message: `${updated} atualizada(s), ${jaOk} já consistentes, ${semVariacao} sem variação.`,
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
