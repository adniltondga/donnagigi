import { NextRequest, NextResponse } from "next/server"

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ success: true })

  // Remover token do cookie
  response.cookies.set("token", "", {
    maxAge: 0,
    path: "/"
  })

  return response
}
