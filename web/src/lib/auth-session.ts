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
const COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60

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

export async function issueSession(opts: IssueSessionOpts): Promise<{ token: string }> {
  const { user, request, alertOnNewDevice } = opts

  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    tenantId: user.tenantId,
    role: user.role,
    isStaff: !!user.isStaff,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET)

  const ua = (request.headers.get("user-agent") || "").slice(0, 512)
  const ip = getClientIp(request)

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

    // Só alerta se já havia dispositivos antes — primeiro login não dispara.
    if (alertOnNewDevice && known.length > 0 && row) {
      const tpl = loginAlertTemplate({
        name: row.name,
        ua,
        ip,
        when: new Date(),
      })
      // Fire-and-forget: não bloqueia o login se SMTP cair.
      sendEmail({ to: row.email, ...tpl }).catch((err) => {
        console.error("[auth-session] falha ao mandar alerta de novo login", err)
      })
    }
  }

  return { token }
}

export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_SEC,
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
