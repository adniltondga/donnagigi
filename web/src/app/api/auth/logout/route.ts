import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { message: 'Logout realizado com sucesso' },
    { status: 200 }
  )

  // Limpar o cookie
  response.cookies.set('token', '', {
    httpOnly: true,
    maxAge: 0
  })

  return response
}
