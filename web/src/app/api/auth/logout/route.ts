import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const response = NextResponse.json(
    { message: 'Logout realizado com sucesso' },
    { status: 200 }
  )

  // Resposta inclui instrução para limpar localStorage
  response.headers.set('X-Clear-Storage', 'true')

  // Limpar o cookie
  response.cookies.set('token', '', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  })

  return response
}
