import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      console.error("[SET-TOKEN] Token não fornecido")
      return NextResponse.json(
        { error: "Token não fornecido" },
        { status: 400 }
      )
    }

    console.log("[SET-TOKEN] Salvando token no cookie")
    console.log("[SET-TOKEN] Token length:", token.length)

    const response = NextResponse.json({
      success: true,
      message: "Token salvo com sucesso"
    })

    // Salvar token em cookie httpOnly
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: false, // Em dev é false, em prod ajustar para true
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 dias
      path: "/"
    })

    console.log("[SET-TOKEN] Cookie definido com sucesso")
    return response
  } catch (error) {
    console.error("[SET-TOKEN] Erro ao salvar token:", error)
    return NextResponse.json(
      { error: "Erro ao salvar token" },
      { status: 500 }
    )
  }
}
