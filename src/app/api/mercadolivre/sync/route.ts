import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// POST - Sincronizar um produto para Mercado Livre
// Esta funcionalidade foi simplificada - use /api/ml/sync-orders em vez disso
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: "Este endpoint foi descontinuado. Use /api/ml/sync-orders para sincronizar pedidos." },
    { status: 410 }
  )
}
