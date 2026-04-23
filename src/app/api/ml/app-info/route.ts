import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Info sobre o APP do agLivre registrado no Mercado Livre DevCenter
 * (o app oficial que todos os tenants usam via OAuth).
 *
 * As credenciais ML_CLIENT_ID / ML_CLIENT_SECRET ficam no .env do
 * servidor — este endpoint só reporta se estão configuradas e mostra
 * a redirect URI pra facilitar setup.
 */
export async function GET() {
  const clientId = process.env.ML_CLIENT_ID
  const hasSecret = !!process.env.ML_CLIENT_SECRET
  const redirectUri =
    process.env.ML_REDIRECT_URI ||
    "https://www.aglivre.com.br/api/ml/oauth/callback"

  return NextResponse.json({
    configured: !!clientId && hasSecret,
    // Expõe só os primeiros/últimos chars pra identificar sem vazar
    clientIdPreview: clientId
      ? `${clientId.slice(0, 4)}…${clientId.slice(-4)}`
      : null,
    redirectUri,
    devCenterUrl: "https://developers.mercadolivre.com.br/devcenter",
  })
}
