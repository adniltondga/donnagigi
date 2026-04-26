import { NextResponse } from "next/server"
import type { UserRole } from "@prisma/client"
import prisma from "./prisma"
import { getSession, type SessionPayload } from "./tenant"

export type { UserRole } from "@prisma/client"

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * Exige sessão válida. Lança AuthError(401) se não logado.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) throw new AuthError("Não autenticado", 401)
  return session
}

/**
 * Exige role entre os permitidos. Retorna a sessão ou lança AuthError.
 *
 * OWNER > ADMIN > VIEWER (hierarquia).
 * - Passar ['OWNER'] → só OWNER.
 * - Passar ['OWNER','ADMIN'] → OWNER ou ADMIN (escrita).
 * - GET/leitura não precisa chamar — qualquer sessão autenticada pode ler.
 */
export async function requireRole(
  allowed: UserRole[]
): Promise<SessionPayload> {
  const session = await requireSession()
  if (!allowed.includes(session.role)) {
    throw new AuthError("Sem permissão pra essa ação", 403)
  }
  return session
}

/**
 * Wrapper pra transformar AuthError em NextResponse JSON.
 * Uso:
 *   try { const s = await requireRole(['OWNER','ADMIN']); ... }
 *   catch (e) { return authErrorResponse(e); }
 */
export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  throw err
}

export function isWriter(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN"
}

/**
 * Exige que a sessão pertença a um usuário marcado como staff (DGA Digital).
 * Usado em rotas /api/staff/* e na área /staff. O bit `isStaff` mora em
 * User — toggle manual no banco. Lança AuthError(403) se não staff.
 */
export async function requireStaff(): Promise<SessionPayload> {
  const session = await requireSession()
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { isStaff: true },
  })
  if (!user?.isStaff) throw new AuthError("Acesso restrito a staff", 403)
  return session
}
