/**
 * Email sender com dois backends:
 * - Dev (NODE_ENV != 'production'): Nodemailer jsonTransport — imprime no
 *   terminal do dev server, não envia de verdade. Útil pra copiar o OTP
 *   durante teste local.
 * - Prod (NODE_ENV === 'production' e RESEND_API_KEY definido): Resend.
 *
 * Se RESEND_API_KEY não estiver setada em prod, cai pro nodemailer em
 * jsonTransport (log-only) pra não quebrar o app — o email precisa ser
 * configurado pra funcionar de verdade.
 */

import nodemailer from 'nodemailer';

const FROM = process.env.EMAIL_FROM || 'agLivre <nao-responda@aglivre.dgadigital.com.br>';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

async function sendViaNodemailer(input: SendEmailInput) {
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const info = await transport.sendMail({
    from: FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  // Log visível no terminal do dev server
  console.log('\n========== EMAIL (dev) ==========');
  console.log(`→ To: ${input.to}`);
  console.log(`→ Subject: ${input.subject}`);
  console.log(`→ ${input.text || input.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
  console.log('==================================\n');
  return info;
}

async function sendViaResend(input: SendEmailInput) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return sendViaNodemailer(input);
  const { Resend } = await import('resend');
  const resend = new Resend(key);
  return resend.emails.send({
    from: FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}

export async function sendEmail(input: SendEmailInput) {
  if (process.env.NODE_ENV === 'production' && process.env.RESEND_API_KEY) {
    return sendViaResend(input);
  }
  return sendViaNodemailer(input);
}

/**
 * Helpers de templates. Mantemos inline styles pra compatibilidade
 * máxima com clientes de email.
 */

const BRAND = '#7c3aed'; // primary-600 (violet)

function otpBox(code: string) {
  return `
    <div style="background:#f5f3ff;border:2px dashed ${BRAND};border-radius:12px;padding:24px;text-align:center;margin:24px 0">
      <div style="font-family:'Courier New',monospace;font-size:36px;letter-spacing:8px;color:${BRAND};font-weight:bold">${code}</div>
    </div>
  `;
}

function layout(title: string, body: string) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
        <div style="background:${BRAND};color:white;padding:8px;border-radius:8px;font-weight:bold">aL</div>
        <div style="font-size:20px;font-weight:bold">ag<span style="color:${BRAND}">Livre</span></div>
      </div>
      <h1 style="font-size:24px;margin:0 0 16px">${title}</h1>
      ${body}
      <hr style="border:0;border-top:1px solid #e5e7eb;margin:32px 0 16px">
      <p style="color:#6b7280;font-size:12px;margin:0">
        agLivre · Gestão financeira pra vendedores do Mercado Livre
      </p>
    </div>
  `;
}

export function verifyEmailTemplate(code: string) {
  const body = `
    <p>Use o código abaixo pra ativar sua conta:</p>
    ${otpBox(code)}
    <p style="color:#6b7280;font-size:14px">
      O código expira em 10 minutos. Se você não solicitou este cadastro, pode ignorar este email.
    </p>
  `;
  return {
    subject: 'Ative sua conta agLivre',
    html: layout('Quase lá!', body),
    text: `Seu código de ativação: ${code}\n\nExpira em 10 minutos.`,
  };
}

export function teamInviteTemplate(params: {
  inviterName: string
  tenantName: string
  role: "OWNER" | "ADMIN" | "VIEWER"
  acceptUrl: string
}) {
  const { inviterName, tenantName, role, acceptUrl } = params
  const roleLabel = role === "ADMIN" ? "Administrador" : role === "OWNER" ? "Dono" : "Visualizador"
  const roleDesc =
    role === "ADMIN"
      ? "acesso total — pode cadastrar custos, integrar Mercado Livre e gerenciar o negócio."
      : role === "OWNER"
      ? "acesso total ao negócio."
      : "acesso de leitura — vê dashboard, relatórios e pedidos, mas não altera dados."
  const body = `
    <p><strong>${inviterName}</strong> te convidou pra fazer parte de <strong>${tenantName}</strong> no agLivre como <strong>${roleLabel}</strong>.</p>
    <p style="color:#6b7280;font-size:14px">Com esse papel, você terá ${roleDesc}</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${acceptUrl}" style="display:inline-block;background:${BRAND};color:white;font-weight:bold;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px">
        Aceitar convite
      </a>
    </div>
    <p style="color:#6b7280;font-size:13px">
      Ou copie o link: <br>
      <span style="font-family:monospace;word-break:break-all">${acceptUrl}</span>
    </p>
    <p style="color:#6b7280;font-size:12px;margin-top:24px">
      O convite expira em 7 dias. Se você não conhece ${inviterName}, pode ignorar este email.
    </p>
  `
  return {
    subject: `${inviterName} te convidou pra ${tenantName} no agLivre`,
    html: layout(`Convite pra ${tenantName}`, body),
    text: `${inviterName} te convidou pra ${tenantName} no agLivre como ${roleLabel}.\n\nAceite: ${acceptUrl}\n\nO convite expira em 7 dias.`,
  }
}

export function resetPasswordTemplate(code: string) {
  const body = `
    <p>Recebemos um pedido pra redefinir sua senha. Use o código abaixo:</p>
    ${otpBox(code)}
    <p style="color:#6b7280;font-size:14px">
      O código expira em 10 minutos. Se você não solicitou, pode ignorar — sua senha continua a mesma.
    </p>
  `;
  return {
    subject: 'Recuperação de senha agLivre',
    html: layout('Redefinir senha', body),
    text: `Código pra redefinir sua senha: ${code}\n\nExpira em 10 minutos.`,
  };
}

/**
 * Gera OTP de 6 dígitos.
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
