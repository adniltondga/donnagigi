/**
 * Dunning emails — comunicação automática de billing.
 *
 * Tipos de email tratados aqui (idempotência via Subscription.lastDunningType):
 *  - trial_t3        : 3 dias antes do trial expirar
 *  - trial_t1        : 1 dia antes / no dia do fim do trial
 *  - trial_expired   : 24h após o trial expirar
 *
 * Dunning ligados a webhook (não passam por aqui — disparados direto
 * em /api/billing/webhook):
 *  - payment_confirmed
 *  - payment_overdue
 *  - canceled
 */

import prisma from "./prisma"
import {
  sendEmail,
  trialEndingTemplate,
  trialExpiredTemplate,
} from "./email"
import { captureError } from "./sentry"

const SITE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://aglivre.dgadigital.com.br"

const PLANS_URL = `${SITE_URL}/admin/billing/planos`

interface DunningResult {
  sent: number
  failed: number
}

async function ownerEmailFor(tenantId: string): Promise<string | null> {
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: "OWNER" },
    select: { email: true },
  })
  return owner?.email ?? null
}

/**
 * Manda email T-3 e T-1 do trial. Idempotência via lastDunningType:
 * uma subscription nunca recebe o mesmo tipo 2x.
 */
export async function sendTrialEndingEmails(): Promise<DunningResult> {
  let sent = 0
  let failed = 0

  const now = new Date()
  const in1d = new Date(now)
  in1d.setDate(now.getDate() + 1)
  const in3d = new Date(now)
  in3d.setDate(now.getDate() + 3)

  // T-1: trial expira nas próximas 24h e ainda não recebeu T-1
  const t1 = await prisma.subscription.findMany({
    where: {
      status: "TRIAL",
      trialEndsAt: { gte: now, lte: in1d },
      OR: [
        { lastDunningType: null },
        { lastDunningType: { not: "trial_t1" } },
      ],
    },
    select: { id: true, tenantId: true },
  })
  for (const sub of t1) {
    const email = await ownerEmailFor(sub.tenantId)
    if (!email) {
      failed++
      continue
    }
    try {
      await sendEmail({ to: email, ...trialEndingTemplate(1, PLANS_URL) })
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { lastDunningType: "trial_t1", lastDunningAt: now },
      })
      sent++
    } catch (err) {
      captureError(err, {
        tenantId: sub.tenantId,
        operation: "dunning-trial-t1",
      })
      failed++
    }
  }

  // T-3: trial expira em 1-3 dias e ainda não recebeu T-3 nem T-1
  // (se já mandou T-1, não manda T-3 pra trás)
  const t3 = await prisma.subscription.findMany({
    where: {
      status: "TRIAL",
      trialEndsAt: { gt: in1d, lte: in3d },
      OR: [
        { lastDunningType: null },
        { lastDunningType: { notIn: ["trial_t3", "trial_t1"] } },
      ],
    },
    select: { id: true, tenantId: true },
  })
  for (const sub of t3) {
    const email = await ownerEmailFor(sub.tenantId)
    if (!email) {
      failed++
      continue
    }
    try {
      await sendEmail({ to: email, ...trialEndingTemplate(3, PLANS_URL) })
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { lastDunningType: "trial_t3", lastDunningAt: now },
      })
      sent++
    } catch (err) {
      captureError(err, {
        tenantId: sub.tenantId,
        operation: "dunning-trial-t3",
      })
      failed++
    }
  }

  return { sent, failed }
}

/**
 * Manda email pra trials que expiraram nas últimas 24h.
 */
export async function sendTrialExpiredEmails(): Promise<DunningResult> {
  let sent = 0
  let failed = 0

  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const subs = await prisma.subscription.findMany({
    where: {
      status: "EXPIRED",
      trialEndsAt: { gte: last24h, lte: now },
      OR: [
        { lastDunningType: null },
        { lastDunningType: { not: "trial_expired" } },
      ],
    },
    select: { id: true, tenantId: true },
  })
  for (const sub of subs) {
    const email = await ownerEmailFor(sub.tenantId)
    if (!email) {
      failed++
      continue
    }
    try {
      await sendEmail({ to: email, ...trialExpiredTemplate(PLANS_URL) })
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { lastDunningType: "trial_expired", lastDunningAt: now },
      })
      sent++
    } catch (err) {
      captureError(err, {
        tenantId: sub.tenantId,
        operation: "dunning-trial-expired",
      })
      failed++
    }
  }

  return { sent, failed }
}

/* ------------- Webhook-driven (chamadas diretas) ------------- */

/** Email pós PAYMENT_CONFIRMED do ASAAS. */
export async function sendPaymentConfirmedEmail(params: {
  tenantId: string
  value: number
  nextDueDate: Date | string | null
}): Promise<void> {
  try {
    const email = await ownerEmailFor(params.tenantId)
    if (!email) return
    const { paymentConfirmedTemplate } = await import("./email")
    await sendEmail({
      to: email,
      ...paymentConfirmedTemplate({
        value: params.value,
        nextDueDate: params.nextDueDate,
        invoicesUrl: `${SITE_URL}/admin/billing/faturas`,
      }),
    })
  } catch (err) {
    captureError(err, {
      tenantId: params.tenantId,
      operation: "dunning-payment-confirmed",
    })
  }
}

/** Email pós PAYMENT_OVERDUE do ASAAS. */
export async function sendPaymentOverdueEmail(tenantId: string): Promise<void> {
  try {
    const email = await ownerEmailFor(tenantId)
    if (!email) return
    const { paymentOverdueTemplate } = await import("./email")
    await sendEmail({
      to: email,
      ...paymentOverdueTemplate(`${SITE_URL}/admin/billing/assinatura`),
    })
  } catch (err) {
    captureError(err, {
      tenantId,
      operation: "dunning-payment-overdue",
    })
  }
}

/** Email pós cancelamento (manual via /cancel ou webhook). */
export async function sendSubscriptionCanceledEmail(params: {
  tenantId: string
  periodEnd: Date | string | null
}): Promise<void> {
  try {
    const email = await ownerEmailFor(params.tenantId)
    if (!email) return
    const { subscriptionCanceledTemplate } = await import("./email")
    await sendEmail({
      to: email,
      ...subscriptionCanceledTemplate({
        periodEnd: params.periodEnd,
        reactivateUrl: PLANS_URL,
      }),
    })
  } catch (err) {
    captureError(err, {
      tenantId: params.tenantId,
      operation: "dunning-canceled",
    })
  }
}
