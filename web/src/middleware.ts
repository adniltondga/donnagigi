import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Rotas que requerem autenticação
  const protectedRoutes = ['/admin/dashboard', '/admin/products', '/admin/orders', '/admin/analytics']

  if (protectedRoutes.some(route => path.startsWith(route))) {
    const token = request.cookies.get('token')?.value

    if (!token) {
      console.log(`[Middleware] No token found for ${path}`)
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    try {
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET || 'seu_jwt_secret_super_seguro'
      )
      await jwtVerify(token, secret)
      console.log(`[Middleware] Token valid for ${path}`)
    } catch (error) {
      console.log(`[Middleware] Token invalid for ${path}:`, error)
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*']
}
