import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'seu_jwt_secret_super_seguro'
)

/**
 * Middleware roteia o app por isStaff:
 *  - Staff que cair em /admin/* (exceto login) → vai pra /staff
 *  - Não-staff que tentar /staff/* → vai pra /admin/dashboard
 *  - Sem token em rota protegida → /admin/login
 *
 * Lê isStaff do JWT (preenchido em /api/auth/login). Tokens antigos
 * sem isStaff são tratados como cliente (false) — basta re-logar.
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // /admin/login é público (precisa entrar antes de saber se é staff)
  if (path === '/admin/login') return NextResponse.next()

  const isAdminRoute = path.startsWith('/admin/')
  const isStaffRoute = path.startsWith('/staff')

  if (!isAdminRoute && !isStaffRoute) return NextResponse.next()

  const token = request.cookies.get('token')?.value
  if (!token) {
    const url = new URL('/admin/login', request.url)
    if (isStaffRoute) url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  let payload: { isStaff?: boolean } = {}
  try {
    const verified = await jwtVerify(token, SECRET)
    payload = verified.payload as { isStaff?: boolean }
  } catch {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  const isStaff = payload.isStaff === true

  // Staff em /admin/* (que não é login) → manda pro painel staff
  if (isAdminRoute && isStaff) {
    return NextResponse.redirect(new URL('/staff', request.url))
  }

  // Não-staff tentando /staff/* → manda pro admin do cliente
  if (isStaffRoute && !isStaff) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*'],
}
