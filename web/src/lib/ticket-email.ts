/**
 * Templates e helpers de email para o fluxo de tickets de suporte.
 * Usa o `sendEmail` que já existe (Resend).
 */
import { sendEmail } from "./email"

const STAFF_NOTIFY_TO = process.env.SUPPORT_NOTIFY_EMAIL || "suporte@dgadigital.com.br"
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://aglivre.dgadigital.com.br"

function ticketUrl(id: string, isStaff: boolean): string {
  return isStaff
    ? `${SITE_URL}/staff/tickets/${id}`
    : `${SITE_URL}/admin/suporte/${id}`
}

/**
 * Cliente abriu um ticket — notifica o staff.
 */
export async function notifyStaffNewTicket(params: {
  ticketId: string
  subject: string
  category: string
  body: string
  tenantName: string
  authorName: string
  authorEmail: string
}) {
  const url = ticketUrl(params.ticketId, true)
  await sendEmail({
    to: STAFF_NOTIFY_TO,
    subject: `[agLivre suporte] ${params.subject}`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6d28d9;">Novo chamado de suporte</h2>
        <p><strong>De:</strong> ${escapeHtml(params.authorName)} (${escapeHtml(params.authorEmail)})</p>
        <p><strong>Loja:</strong> ${escapeHtml(params.tenantName)}</p>
        <p><strong>Categoria:</strong> ${escapeHtml(params.category)}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb;" />
        <p><strong>Assunto:</strong> ${escapeHtml(params.subject)}</p>
        <pre style="background: #f9fafb; padding: 12px; border-radius: 6px; white-space: pre-wrap; font-family: inherit;">${escapeHtml(params.body)}</pre>
        <p style="margin-top: 24px;">
          <a href="${url}" style="background: #6d28d9; color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none;">Abrir no painel staff</a>
        </p>
      </div>
    `,
  })
}

/**
 * Staff respondeu — notifica o cliente que abriu o ticket.
 */
export async function notifyClientStaffReply(params: {
  ticketId: string
  subject: string
  body: string
  toEmail: string
  toName: string
}) {
  const url = ticketUrl(params.ticketId, false)
  await sendEmail({
    to: params.toEmail,
    subject: `[agLivre] Nova resposta no seu chamado: ${params.subject}`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6d28d9;">Olá, ${escapeHtml(params.toName)}!</h2>
        <p>O suporte respondeu seu chamado <strong>${escapeHtml(params.subject)}</strong>:</p>
        <pre style="background: #f9fafb; padding: 12px; border-radius: 6px; white-space: pre-wrap; font-family: inherit;">${escapeHtml(params.body)}</pre>
        <p style="margin-top: 24px;">
          <a href="${url}" style="background: #6d28d9; color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none;">Ver e responder</a>
        </p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">
          Pra responder, clique no botão acima — não responda este email diretamente.
        </p>
      </div>
    `,
  })
}

/**
 * Cliente respondeu via web — notifica o staff (assignee se tiver, ou
 * caixa geral) que tem mensagem nova.
 */
export async function notifyStaffClientReply(params: {
  ticketId: string
  subject: string
  body: string
  tenantName: string
  authorName: string
  toEmail?: string
}) {
  const url = ticketUrl(params.ticketId, true)
  await sendEmail({
    to: params.toEmail || STAFF_NOTIFY_TO,
    subject: `[agLivre suporte] Resposta do cliente: ${params.subject}`,
    html: `
      <div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6d28d9;">Cliente respondeu</h2>
        <p><strong>De:</strong> ${escapeHtml(params.authorName)} · ${escapeHtml(params.tenantName)}</p>
        <p><strong>Assunto:</strong> ${escapeHtml(params.subject)}</p>
        <pre style="background: #f9fafb; padding: 12px; border-radius: 6px; white-space: pre-wrap; font-family: inherit;">${escapeHtml(params.body)}</pre>
        <p style="margin-top: 24px;">
          <a href="${url}" style="background: #6d28d9; color: white; padding: 10px 16px; border-radius: 6px; text-decoration: none;">Abrir no painel staff</a>
        </p>
      </div>
    `,
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
