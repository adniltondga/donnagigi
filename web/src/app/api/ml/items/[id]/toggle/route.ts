import { NextRequest, NextResponse } from "next/server"
import { getTenantIdOrDefault } from "@/lib/tenant"
import { getMLIntegrationForTenant } from "@/lib/ml"
import { AuthError, authErrorResponse, requireRole } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * Alterna o status de um anúncio no Mercado Livre entre "active" e
 * "paused". Lê o status atual do ML primeiro e inverte. Anúncios em
 * outros estados (closed, under_review, etc) não são alterados.
 *
 * Usado pelo app mobile pra dar pause/resume rápido no anúncio.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireRole(["OWNER", "ADMIN"])

    const tenantId = await getTenantIdOrDefault()
    const integration = await getMLIntegrationForTenant(tenantId)
    if (!integration) {
      return NextResponse.json(
        { error: "Integração com Mercado Livre não configurada" },
        { status: 400 },
      )
    }

    const itemId = params.id

    const getRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
      },
    })
    if (!getRes.ok) {
      const txt = await getRes.text().catch(() => "")
      return NextResponse.json(
        {
          error: "Não foi possível ler o anúncio no ML",
          status: getRes.status,
          details: txt.slice(0, 200),
        },
        { status: getRes.status },
      )
    }
    const current = (await getRes.json()) as { status?: string }

    const currentStatus = current.status
    let nextStatus: "active" | "paused"
    if (currentStatus === "active") nextStatus = "paused"
    else if (currentStatus === "paused") nextStatus = "active"
    else {
      return NextResponse.json(
        {
          error: `Anúncio está em "${currentStatus}" — não pode ser pausado/ativado pelo app`,
        },
        { status: 409 },
      )
    }

    const putRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (!putRes.ok) {
      const txt = await putRes.text().catch(() => "")
      return NextResponse.json(
        {
          error: "Falha ao alterar status no ML",
          status: putRes.status,
          details: txt.slice(0, 200),
        },
        { status: putRes.status },
      )
    }

    return NextResponse.json({ ok: true, status: nextStatus })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error("[ml/items/toggle] erro:", err)
    return NextResponse.json(
      { error: "Erro ao alternar status" },
      { status: 500 },
    )
  }
}
