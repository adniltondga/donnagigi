import { NextResponse } from "next/server"
import { getSession } from "@/lib/tenant"
import { generateAccountExport } from "@/lib/account-export"
import { captureError } from "@/lib/sentry"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Export LGPD — gera ZIP com snapshot dos dados do tenant.
 *
 * Restrições:
 *  - Só OWNER pode exportar (tem dados de toda a equipe)
 *  - Tokens/secrets/senhas mascarados (ver lib/account-export.ts)
 */
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }
    if (session.role !== "OWNER") {
      return NextResponse.json(
        { error: "Apenas o dono da conta pode exportar os dados." },
        { status: 403 },
      )
    }

    const { filename, buffer } = await generateAccountExport(session.tenantId)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    captureError(error, { operation: "account-export" })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao exportar" },
      { status: 500 },
    )
  }
}
