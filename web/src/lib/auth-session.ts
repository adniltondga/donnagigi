import { SignJWT } from "jose"
import type { NextResponse } from "next/server"
import type { UserRole } from "@prisma/client"
import prisma from "./prisma"
import { getClientIp } from "./rate-limit"
import { sendEmail, loginAlertTemplate } from "./email"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "seu_jwt_secret_super_seguro",
)

const COOKIE_NAME = "token"
const SESSION_TTL_DAYS = 7
const SESSION_TTL_SEC = SESSION_TTL_DAYS * 24 * 60 * 60

interface KnownDevice {
  ua: string
  ip: string
  addedAt: string
}

interface SessionUser {
  id: string
  email: string
  tenantId: string
  role: UserRole
  isStaff?: boolean
}

interface IssueSessionOpts {
  user: SessionUser
  request: Request
  /** Se true e o UA do request não está em knownDevices, dispara email
   *  de alerta. Use false em fluxos onde o usuário acabou de provar ID
   *  por outro fator (verify-email, restore). */
  alertOnNewDevice: boolean
}

export async function issueSession(
  opts: IssueSessionOpts,
): Promise<{ token: string; sessionId: string }> {
  const { user, request, alertOnNewDevice } = opts

  const ua = (request.headers.get("user-agent") || "").slice(0, 1024)
  const ip = getClientIp(request)
  const expiresAt = new Date(Date.now() + SESSION_TTL_SEC * 1000)

  // Cria a Session primeiro pra ter o jti antes de assinar o JWT
  const session = await prisma.session.create({
    data: { userId: user.id, ua, ip, expiresAt },
    select: { id: true },
  })

  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    tenantId: user.tenantId,
    role: user.role,
    isStaff: !!user.isStaff,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(session.id)
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(JWT_SECRET)

  // Atualiza knownDevices + alerta de novo dispositivo (separado do
  // tracking de Session pra manter a UX de "primeiro login não alerta").
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { knownDevices: true, name: true, email: true },
  })
  const known = (row?.knownDevices as KnownDevice[] | null | undefined) ?? []
  const isKnown = known.some((d) => d.ua === ua)

  if (!isKnown) {
    const updated: KnownDevice[] = [
      ...known,
      { ua, ip, addedAt: new Date().toISOString() },
    ].slice(-5)
    await prisma.user.update({
      where: { id: user.id },
      data: { knownDevices: updated as unknown as object },
    })

    if (alertOnNewDevice && known.length > 0 && row) {
      const tpl = loginAlertTemplate({
        name: row.name,
        ua,
        ip,
        when: new Date(),
      })
      sendEmail({ to: row.email, ...tpl }).catch((err) => {
        console.error("[auth-session] falha ao mandar alerta de novo login", err)
      })
    }
  }

  return { token, sessionId: session.id }
}

/**
 * Marca uma Session específica como revogada. JWTs com esse jti param
 * de ser aceitos por getSession() imediatamente.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/**
 * Revoga todas as Sessions de um user, opcionalmente preservando uma
 * (a "atual") — útil quando o user troca a senha sem querer ser
 * deslogado do dispositivo onde está.
 */
export async function revokeAllUserSessions(
  userId: string,
  exceptSessionId?: string,
): Promise<number> {
  const where = exceptSessionId
    ? { userId, revokedAt: null, id: { not: exceptSessionId } }
    : { userId, revokedAt: null }
  const r = await prisma.session.updateMany({
    where,
    data: { revokedAt: new Date() },
  })
  return r.count
}

export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SEC,
    path: "/",
  })
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })
}
