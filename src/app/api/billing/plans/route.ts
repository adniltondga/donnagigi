import { NextResponse } from "next/server"
import { PLANS } from "@/lib/plans"

export const dynamic = "force-dynamic"

/**
 * Lista planos disponíveis. Público — não precisa de auth (usado na
 * landing e na tela /billing/planos).
 */
export async function GET() {
  return NextResponse.json({
    data: Object.values(PLANS),
  })
}
