import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

const MIGRATED_PREFIX = "[migrated]"

/**
 * GET /api/financeiro/aportes/listar
 *
 * Retorna a lista completa de aportes (raiz + filhas, exceto Amortização)
 * com status, subcategoria e ações disponíveis. Também devolve as
 * subcategorias da hierarquia "Aporte sócio" (pra dropdown ao lançar)
 * e os totais agregados.
 *
 * Bills com prefix [migrated] em notes (amortizações legacy consolidadas)
 * são listadas separadamente em legacyAmortizacoes pra auditoria.
 */
export async function GET() {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()

    const aporteRoot = await prisma.billCategory.findFirst({
      where: { tenantId, parentId: null, name: "Aporte sócio", type: "payable" },
      select: {
        id: true,
        name: true,
        children: {
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
      },
    })

    if (!aporteRoot) {
      return NextResponse.json({
        configured: false,
        aportes: [],
        legacyAmortizacoes: [],
        subcategorias: [],
        totals: {
          pendingTotal: 0,
          pendingCount: 0,
          paidTotal: 0,
          paidCount: 0,
          saldoDevedor: 0,
        },
        amortizacaoSubId: null,
      })
    }

    const amortizacaoSubId =
      aporteRoot.children.find((c) => c.name === "Amortização")?.id ?? null
    const subcategoriasValidas = aporteRoot.children.filter(
      (c) => c.name !== "Amortização",
    )
    const idsValidos = [aporteRoot.id, ...subcategoriasValidas.map((c) => c.id)]

    // Aportes (raiz + filhas exceto Amortização)
    const aportes = await prisma.bill.findMany({
      where: {
        tenantId,
        type: "payable",
        billCategoryId: { in: idsValidos },
        NOT: { status: "cancelled" },
      },
      orderBy: [{ status: "asc" }, { dueDate: "desc" }],
      select: {
        id: true,
        amount: true,
        status: true,
        dueDate: true,
        paidDate: true,
        description: true,
        notes: true,
        billCategoryId: true,
        billCategory: { select: { name: true, parent: { select: { name: true } } } },
      },
    })

    // Amortizações legacy (sub Amortização). Marca quais já foram migradas.
    const legacyAmortizacoes = amortizacaoSubId
      ? await prisma.bill.findMany({
          where: {
            tenantId,
            type: "payable",
            billCategoryId: amortizacaoSubId,
            NOT: { status: "cancelled" },
          },
          orderBy: { paidDate: "desc" },
          select: {
            id: true,
            amount: true,
            status: true,
            paidDate: true,
            description: true,
            notes: true,
          },
        })
      : []

    let pendingTotal = 0
    let pendingCount = 0
    let paidTotal = 0
    let paidCount = 0
    for (const a of aportes) {
      if (a.status === "pending") {
        pendingTotal += a.amount
        pendingCount += 1
      } else if (a.status === "paid") {
        paidTotal += a.amount
        paidCount += 1
      }
    }

    // Saldo devedor: soma de aportes pending + amortizações legacy não-migradas
    // (essas continuam descontando da fórmula até cleanup).
    const legacyAmortizacaoNaoMigradaTotal = legacyAmortizacoes
      .filter((a) => a.status === "paid" && !(a.notes ?? "").startsWith(MIGRATED_PREFIX))
      .reduce((s, a) => s + a.amount, 0)
    const saldoDevedor = Math.max(0, pendingTotal - legacyAmortizacaoNaoMigradaTotal)

    return NextResponse.json({
      configured: true,
      amortizacaoSubId,
      subcategorias: [
        { id: aporteRoot.id, name: aporteRoot.name + " (raiz)" },
        ...subcategoriasValidas,
      ],
      aportes: aportes.map((a) => ({
        id: a.id,
        amount: Math.round(a.amount * 100) / 100,
        status: a.status,
        dueDate: a.dueDate.toISOString(),
        paidDate: a.paidDate ? a.paidDate.toISOString() : null,
        description: a.description,
        notes: a.notes,
        billCategoryId: a.billCategoryId,
        billCategoryName: a.billCategory?.name ?? null,
      })),
      legacyAmortizacoes: legacyAmortizacoes.map((a) => ({
        id: a.id,
        amount: Math.round(a.amount * 100) / 100,
        status: a.status,
        paidDate: a.paidDate ? a.paidDate.toISOString() : null,
        description: a.description,
        notes: a.notes,
        migrated: (a.notes ?? "").startsWith(MIGRATED_PREFIX),
      })),
      totals: {
        pendingTotal: Math.round(pendingTotal * 100) / 100,
        pendingCount,
        paidTotal: Math.round(paidTotal * 100) / 100,
        paidCount,
        legacyAmortizacaoNaoMigradaTotal:
          Math.round(legacyAmortizacaoNaoMigradaTotal * 100) / 100,
        saldoDevedor: Math.round(saldoDevedor * 100) / 100,
      },
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[aportes/listar]", err)
    return NextResponse.json({ error: "Erro ao listar" }, { status: 500 })
  }
}
