import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { AuthError, authErrorResponse, requireSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * Migração one-shot do modelo de "Amortização" pra modelo "aporte vira paid".
 *
 * Modelo antigo: bills aporte ficavam pending eternamente; amortização era
 * uma bill nova com status=paid em billCategoryId="Amortização".
 *
 * Modelo novo: aporte = bill payable que vira status=paid quando 100%
 * devolvido. Sem subcategoria "Amortização".
 *
 * Esta rota:
 *  - GET: preview do que será feito (FIFO).
 *  - POST {action:"apply"}: executa em transação. Marca aportes como paid,
 *    splita aportes parciais, marca amortizações legacy com prefix
 *    "[migrated]" em notes pra que sejam ignoradas pelo cálculo de saldo.
 *    NÃO deleta nada.
 *  - POST {action:"cleanup"}: deleta as bills legacy marcadas.
 *
 * Idempotente: rodar 2x não bagunça (amortização migrada já tem prefix
 * e não é processada de novo).
 */

const MIGRATED_PREFIX = "[migrated]"

interface PlanItem {
  type: "mark_paid" | "split_and_pay"
  aporteId: string
  aporteAmount: number
  amortizacaoIds: string[]
  paidAmount: number
  remainingAmount: number
  paidDate: string
}

interface MigrationPlan {
  amortizacoesLegacy: number
  amortizacoesLegacyTotal: number
  aportesPendingAntes: number
  aportesPendingAntesTotal: number
  itens: PlanItem[]
  amortizacoesNaoUsadasTotal: number
  saldoAposMigracao: number
}

async function buildPlan(tenantId: string): Promise<MigrationPlan> {
  // Aporte raiz e categoria amortização
  const aporteRoot = await prisma.billCategory.findFirst({
    where: { tenantId, parentId: null, name: "Aporte sócio", type: "payable" },
    select: { id: true, children: { select: { id: true, name: true } } },
  })
  if (!aporteRoot) {
    return {
      amortizacoesLegacy: 0,
      amortizacoesLegacyTotal: 0,
      aportesPendingAntes: 0,
      aportesPendingAntesTotal: 0,
      itens: [],
      amortizacoesNaoUsadasTotal: 0,
      saldoAposMigracao: 0,
    }
  }
  const amortizacaoSubId =
    aporteRoot.children.find((c) => c.name === "Amortização")?.id ?? null
  const aporteOriginalIds = [
    aporteRoot.id,
    ...aporteRoot.children
      .filter((c) => c.name !== "Amortização")
      .map((c) => c.id),
  ]

  // Amortizações legacy não migradas (notes não começa com [migrated]).
  const amortizacoes = amortizacaoSubId
    ? await prisma.bill.findMany({
        where: {
          tenantId,
          type: "payable",
          status: "paid",
          billCategoryId: amortizacaoSubId,
          paidDate: { not: null },
        },
        orderBy: { paidDate: "asc" },
        select: {
          id: true,
          amount: true,
          paidDate: true,
          notes: true,
          description: true,
        },
      })
    : []
  const amortizacoesPendentes = amortizacoes.filter(
    (a) => !(a.notes ?? "").startsWith(MIGRATED_PREFIX),
  )

  // Aportes pending em ordem (FIFO pelo dueDate).
  const aportesPending = await prisma.bill.findMany({
    where: {
      tenantId,
      type: "payable",
      status: "pending",
      billCategoryId: { in: aporteOriginalIds },
    },
    orderBy: { dueDate: "asc" },
    select: { id: true, amount: true, dueDate: true, description: true },
  })

  const itens: PlanItem[] = []
  // Pool de "crédito" disponível das amortizações, em ordem.
  // Cada amortização contribui com seu amount; quando consumida, marca os ids.
  type Credit = { remaining: number; ids: string[]; paidDateRef: Date }
  const credits: Credit[] = []
  let amortizacoesNaoUsadasTotal = 0

  for (const am of amortizacoesPendentes) {
    if (!am.paidDate) continue
    credits.push({ remaining: am.amount, ids: [am.id], paidDateRef: am.paidDate })
  }

  // Função pra "puxar" credit pra cobrir um aporte. Junta múltiplas
  // amortizações se uma só não cobrir. Retorna { paidAmount, ids, paidDate }.
  function consumeCredit(needed: number) {
    let consumed = 0
    const idsUsados: string[] = []
    let paidDateUsada: Date | null = null
    while (consumed < needed && credits.length > 0) {
      const c = credits[0]
      const take = Math.min(c.remaining, needed - consumed)
      consumed += take
      c.remaining -= take
      // associar ids da amortização atual ao aporte (mesmo se uso parcial)
      for (const id of c.ids) {
        if (!idsUsados.includes(id)) idsUsados.push(id)
      }
      if (paidDateUsada == null) paidDateUsada = c.paidDateRef
      if (c.remaining <= 0.0001) {
        credits.shift()
      }
    }
    return { paidAmount: consumed, ids: idsUsados, paidDate: paidDateUsada }
  }

  for (const ap of aportesPending) {
    if (credits.length === 0) break
    const credit = consumeCredit(ap.amount)
    if (credit.paidAmount <= 0) continue
    if (credit.paidAmount >= ap.amount - 0.0001) {
      // Cobre 100%: marca paid.
      itens.push({
        type: "mark_paid",
        aporteId: ap.id,
        aporteAmount: ap.amount,
        amortizacaoIds: credit.ids,
        paidAmount: ap.amount,
        remainingAmount: 0,
        paidDate: (credit.paidDate ?? new Date()).toISOString(),
      })
    } else {
      // Cobre parcial: splita.
      itens.push({
        type: "split_and_pay",
        aporteId: ap.id,
        aporteAmount: ap.amount,
        amortizacaoIds: credit.ids,
        paidAmount: credit.paidAmount,
        remainingAmount: ap.amount - credit.paidAmount,
        paidDate: (credit.paidDate ?? new Date()).toISOString(),
      })
    }
  }

  // O que sobrou de amortização não consumida (não casou com aporte).
  amortizacoesNaoUsadasTotal = credits.reduce((s, c) => s + c.remaining, 0)

  const aportesPendingAntesTotal = aportesPending.reduce((s, b) => s + b.amount, 0)
  const amortizacoesLegacyTotal = amortizacoesPendentes.reduce((s, b) => s + b.amount, 0)

  // Saldo após = aportes pending atuais − somatório do que foi marcado paid + restantes do split
  const totalPagoNaMigracao = itens.reduce((s, i) => s + i.paidAmount, 0)
  const saldoAposMigracao = Math.max(0, aportesPendingAntesTotal - totalPagoNaMigracao)

  return {
    amortizacoesLegacy: amortizacoesPendentes.length,
    amortizacoesLegacyTotal,
    aportesPendingAntes: aportesPending.length,
    aportesPendingAntesTotal,
    itens,
    amortizacoesNaoUsadasTotal,
    saldoAposMigracao,
  }
}

export async function GET() {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()
    const plan = await buildPlan(tenantId)
    return NextResponse.json(plan)
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[aportes/migrar GET]", err)
    return NextResponse.json({ error: "Erro ao gerar preview" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession()
    const tenantId = await getTenantIdOrDefault()
    const body = await req.json().catch(() => null)
    const action: "apply" | "cleanup" | undefined = body?.action

    if (action !== "apply" && action !== "cleanup") {
      return NextResponse.json(
        { error: "action inválido — use 'apply' ou 'cleanup'" },
        { status: 400 },
      )
    }

    if (action === "cleanup") {
      // Deleta bills com prefix [migrated] em notes na subcategoria Amortização.
      const aporteRoot = await prisma.billCategory.findFirst({
        where: { tenantId, parentId: null, name: "Aporte sócio", type: "payable" },
        select: { children: { select: { id: true, name: true } } },
      })
      const amortizacaoSubId =
        aporteRoot?.children.find((c) => c.name === "Amortização")?.id ?? null
      if (!amortizacaoSubId) {
        return NextResponse.json({ ok: true, deleted: 0 })
      }
      const result = await prisma.bill.deleteMany({
        where: {
          tenantId,
          type: "payable",
          billCategoryId: amortizacaoSubId,
          notes: { startsWith: MIGRATED_PREFIX },
        },
      })
      return NextResponse.json({ ok: true, deleted: result.count })
    }

    // action === "apply"
    const plan = await buildPlan(tenantId)
    if (plan.itens.length === 0) {
      return NextResponse.json({ ok: true, applied: 0, plan })
    }

    await prisma.$transaction(async (tx) => {
      const amortizacoesParaMarcar = new Set<string>()

      for (const item of plan.itens) {
        if (item.type === "mark_paid") {
          await tx.bill.update({
            where: { id: item.aporteId },
            data: {
              status: "paid",
              paidDate: new Date(item.paidDate),
            },
          })
        } else {
          // split: pega o aporte original, atualiza pra valor pago + status paid,
          // e cria uma bill nova com o restante pending.
          const original = await tx.bill.findUnique({
            where: { id: item.aporteId },
            select: {
              tenantId: true,
              type: true,
              description: true,
              dueDate: true,
              billCategoryId: true,
              category: true,
              supplierId: true,
              productId: true,
              notes: true,
            },
          })
          if (!original) continue
          await tx.bill.update({
            where: { id: item.aporteId },
            data: {
              amount: item.paidAmount,
              status: "paid",
              paidDate: new Date(item.paidDate),
              notes: [original.notes, "[split por migração — parte paga]"]
                .filter(Boolean)
                .join(" · "),
            },
          })
          await tx.bill.create({
            data: {
              tenantId: original.tenantId,
              type: original.type,
              status: "pending",
              category: original.category,
              billCategoryId: original.billCategoryId,
              description: original.description,
              amount: item.remainingAmount,
              dueDate: original.dueDate,
              supplierId: original.supplierId,
              productId: original.productId,
              notes: [original.notes, "[split por migração — saldo pendente]"]
                .filter(Boolean)
                .join(" · "),
            },
          })
        }
        for (const id of item.amortizacaoIds) {
          amortizacoesParaMarcar.add(id)
        }
      }

      // Marca amortizações legacy consumidas com prefix [migrated]
      for (const amId of amortizacoesParaMarcar) {
        const am = await tx.bill.findUnique({
          where: { id: amId },
          select: { notes: true },
        })
        const newNotes = `${MIGRATED_PREFIX} ${am?.notes ?? ""}`.trim()
        await tx.bill.update({
          where: { id: amId },
          data: { notes: newNotes },
        })
      }
    })

    return NextResponse.json({ ok: true, applied: plan.itens.length, plan })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[aportes/migrar POST]", err)
    return NextResponse.json({ error: "Erro ao aplicar migração" }, { status: 500 })
  }
}
