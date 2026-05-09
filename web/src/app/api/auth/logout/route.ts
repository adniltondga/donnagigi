import { NextRequest, NextResponse } from "next/server"
import { clearAuthCookie, revokeSession } from "@/lib/auth-session"
import { getSession } from "@/lib/tenant"

export async function POST(_request: NextRequest) {
  // Revoga a Session no DB pra invalidar o JWT antes de limpar o cookie.
  // Falha de revoke não impede logout — limpar o cookie é o essencial.
  try {
    const session = await getSession()
    if (session?.sessionId) {
      await revokeSession(session.sessionId)
    }
  } catch (err) {
    console.error("[logout] falha ao revogar session:", err)
  }

  const response = NextResponse.json({ success: true })
  clearAuthCookie(response)
  return response
}
