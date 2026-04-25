import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Info estática sobre como configurar o app ML.
 *
 * Cada tenant cadastra seu próprio app ML no DevCenter — não há mais
 * app global. Este endpoint só retorna links úteis pra setup.
 */
export async function GET() {
  return NextResponse.json({
    devCenterUrl: "https://developers.mercadolivre.com.br/devcenter",
    setupUrl: "/admin/configuracoes?tab=ml",
  })
}
