import { NextResponse } from "next/server"
import { registrationStatus } from "@/lib/registration"

// Lido em todo request — não pode cachear (senão fica preso no valor de build).
export const dynamic = "force-dynamic"

/**
 * GET /api/registration-status — público.
 * Retorna se cadastro está aberto agora + a fonte do valor (debug).
 *
 * Usado pelo /admin/login (client) pra evitar dependência de
 * NEXT_PUBLIC_* no bundle (que exige rebuild pra atualizar).
 */
export async function GET() {
  const status = registrationStatus()
  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store",
    },
  })
}
