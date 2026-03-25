import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: "Token não fornecido" },
        { status: 400 }
      )
    }

    const response = NextResponse.json({ success: true })

    // Salvar token em cookie httpOnly
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 dias
      path: "/"
    })

    return response
  } catch (error) {
    console.error("Erro ao salvar token:", error)
    return NextResponse.json(
      { error: "Erro ao salvar token" },
      { status: 500 }
    )
  }
}
