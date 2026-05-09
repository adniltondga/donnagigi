/**
 * Email sender com 3 backends, escolhidos por env:
 * - Mailtrap (dev): se MAILTRAP_HOST + MAILTRAP_USER + MAILTRAP_PASS
 *   estão setadas, manda via SMTP do sandbox do Mailtrap. Os emails
 *   ficam no inbox virtual em mailtrap.io — não entregam de verdade.
 * - Resend (prod): se NODE_ENV=production e RESEND_API_KEY está setada.
 * - Fallback (jsonTransport): imprime no terminal — usado quando
 *   nenhum dos dois acima está configurado.
 */

import nodemailer from 'nodemailer';

const FROM = process.env.EMAIL_FROM || 'agLivre <nao-responda@aglivre.dgadigital.com.br>';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

async function sendViaJsonTransport(input: SendEmailInput) {
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const info = await transport.sendMail({
    from: FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  console.log('\n========== EMAIL (dev/log) ==========');
  console.log(`→ To: ${input.to}`);
  console.log(`→ Subject: ${input.subject}`);
  console.log(`→ ${input.text || input.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
  console.log('======================================\n');
  return info;
}

async function sendViaMailtrap(input: SendEmailInput) {
  const transport = nodemailer.createTransport({
    host: process.env.MAILTRAP_HOST!,
    port: Number(process.env.MAILTRAP_PORT) || 2525,
    auth: {
      user: process.env.MAILTRAP_USER!,
      pass: process.env.MAILTRAP_PASS!,
    },
  });
  const info = await transport.sendMail({
    from: FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  console.log(`[email/mailtrap] → ${input.to} · ${input.subject} · id=${info.messageId}`);
  return info;
}

async function sendViaResend(input: SendEmailInput) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return sendViaJsonTransport(input);
  // Chamada direta via fetch (não SDK) pra poder logar via loggedFetch.
  const { loggedFetch } = await import('./api-log');
  const res = await loggedFetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
    provider: 'resend',
    endpoint: '/emails',
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${errText}`);
  }
  return res.json();
}

export async function sendEmail(input: SendEmailInput) {
  // Prod com Resend tem prioridade absoluta
  if (process.env.NODE_ENV === 'production' && process.env.RESEND_API_KEY) {
    return sendViaResend(input);
  }
  // Mailtrap em dev (ou prod sem Resend) — captura no sandbox virtual
  if (
    process.env.MAILTRAP_HOST &&
    process.env.MAILTRAP_USER &&
    process.env.MAILTRAP_PASS
  ) {
    return sendViaMailtrap(input);
  }
  // Último recurso: log no terminal
  return sendViaJsonTransport(input);
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

export function loginAlertTemplate(params: {
  name: string
  ua: string
  ip: string
  when: Date
}) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://aglivre.dgadigital.com.br'
  const changePwdUrl = `${appUrl}/admin/configuracoes`
  const forgotUrl = `${appUrl}/forgot-password`
  const whenStr = params.when.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
  const body = `
    <p>Oi ${params.name.split(' ')[0]}, detectamos um <strong>novo login</strong> na sua conta agLivre:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9fafb;border-radius:8px">
      <tr><td style="padding:10px 14px;color:#6b7280;font-size:13px;width:90px">Quando</td><td style="padding:10px 14px;font-size:13px"><strong>${whenStr}</strong></td></tr>
      <tr><td style="padding:10px 14px;color:#6b7280;font-size:13px">IP</td><td style="padding:10px 14px;font-size:13px;font-family:monospace">${params.ip}</td></tr>
      <tr><td style="padding:10px 14px;color:#6b7280;font-size:13px;vertical-align:top">Dispositivo</td><td style="padding:10px 14px;font-size:12px;font-family:monospace;word-break:break-all">${params.ua || '—'}</td></tr>
    </table>
    <p style="color:#6b7280;font-size:14px">Se foi você, pode ignorar este email.</p>
    <p style="color:#111827;font-size:14px"><strong>Se não foi você</strong>, troque sua senha agora:</p>
    ${ctaButton(changePwdUrl, 'Trocar senha')}
    <p style="color:#6b7280;font-size:13px">
      Sem acesso à conta? Use <a href="${forgotUrl}" style="color:${BRAND}">Esqueci a senha</a>.
    </p>
  `
  return {
    subject: 'Novo login detectado — agLivre',
    html: layout('Novo login na sua conta', body),
    text: `Novo login detectado em ${whenStr}\nIP: ${params.ip}\nDispositivo: ${params.ua}\n\nSe não foi você, troque sua senha em ${changePwdUrl}`,
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

/* ============================================================
 * BILLING / DUNNING TEMPLATES
 * ============================================================ */

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDate = (d: Date | string | null) => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function ctaButton(href: string, label: string) {
  return `
    <div style="text-align:center;margin:32px 0">
      <a href="${href}" style="display:inline-block;background:${BRAND};color:white;font-weight:bold;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px">
        ${label}
      </a>
    </div>
  `;
}

export function trialEndingTemplate(daysLeft: number, planUrl: string) {
  const dayWord = daysLeft === 1 ? 'dia' : 'dias';
  const body = `
    <p>Seu período de teste do agLivre acaba em <strong>${daysLeft} ${dayWord}</strong>.</p>
    <p>Pra continuar usando todas as funcionalidades sem interrupção, escolha um plano:</p>
    ${ctaButton(planUrl, 'Ver planos')}
    <p style="color:#6b7280;font-size:13px">
      Se você não escolher um plano, sua conta vira o plano Free quando o trial acabar.
      Seus dados ficam intactos — só alguns recursos premium ficam bloqueados.
    </p>
  `;
  return {
    subject: `Seu trial agLivre acaba em ${daysLeft} ${dayWord}`,
    html: layout('Trial acabando', body),
    text: `Seu trial acaba em ${daysLeft} ${dayWord}. Escolha um plano em ${planUrl}`,
  };
}

export function trialExpiredTemplate(planUrl: string) {
  const body = `
    <p>Seu período de teste do agLivre <strong>terminou</strong> e sua conta foi movida pro plano Free.</p>
    <p>Você ainda tem acesso aos recursos básicos, mas alguns premium (Mercado Pago, relatórios avançados, multi-usuário) estão bloqueados.</p>
    ${ctaButton(planUrl, 'Reativar com um plano pago')}
    <p style="color:#6b7280;font-size:13px">
      Seus dados continuam salvos — quando voltar pro Pro, está tudo lá.
    </p>
  `;
  return {
    subject: 'Seu trial agLivre terminou',
    html: layout('Trial terminou', body),
    text: `Trial encerrado. Reative em ${planUrl}`,
  };
}

export function paymentConfirmedTemplate(params: {
  value: number;
  nextDueDate: Date | string | null;
  invoicesUrl: string;
}) {
  const body = `
    <p>Recebemos seu pagamento de <strong>${formatBRL(params.value)}</strong>. Tudo certo!</p>
    ${
      params.nextDueDate
        ? `<p>Próxima cobrança: <strong>${formatDate(params.nextDueDate)}</strong>.</p>`
        : ''
    }
    ${ctaButton(params.invoicesUrl, 'Ver histórico de faturas')}
    <p style="color:#6b7280;font-size:13px">
      Obrigado por usar o agLivre. Qualquer dúvida, responde esse email ou manda pra suporte@dgadigital.com.br.
    </p>
  `;
  return {
    subject: 'Pagamento confirmado — agLivre',
    html: layout('Pagamento recebido', body),
    text: `Pagamento de ${formatBRL(params.value)} confirmado. ${
      params.nextDueDate ? `Próxima: ${formatDate(params.nextDueDate)}.` : ''
    }`,
  };
}

export function paymentOverdueTemplate(updateUrl: string) {
  const body = `
    <p>Sua última cobrança do agLivre <strong>não foi paga</strong>.</p>
    <p>Pode ser cartão expirado, limite insuficiente ou problema temporário do banco. Atualize seu método de pagamento pra evitar perda de acesso:</p>
    ${ctaButton(updateUrl, 'Atualizar pagamento')}
    <p style="color:#6b7280;font-size:13px">
      Se você não atualizar em até 7 dias, sua conta volta pro plano Free automaticamente.
      Seus dados ficam preservados, mas alguns recursos ficam bloqueados.
    </p>
  `;
  return {
    subject: '⚠️ Pagamento em atraso — atualize seu cartão',
    html: layout('Pagamento em atraso', body),
    text: `Cobrança recusada. Atualize em ${updateUrl}`,
  };
}

export function accountDeletedTemplate(params: {
  tenantName: string;
  hardDeleteDate: Date | string;
  restoreUrl: string;
}) {
  const body = `
    <p>Sua conta <strong>${params.tenantName}</strong> no agLivre foi excluída.</p>
    <p>Seus dados ainda estão preservados e podem ser restaurados até <strong>${formatDate(params.hardDeleteDate)}</strong>. Após essa data, eles serão apagados permanentemente.</p>
    ${ctaButton(params.restoreUrl, 'Restaurar minha conta')}
    <p style="color:#6b7280;font-size:13px">
      Se foi você que excluiu, ignore esse email. Se não foi, restaure imediatamente e entre em contato com suporte@dgadigital.com.br.
    </p>
  `;
  return {
    subject: 'Sua conta agLivre foi excluída',
    html: layout('Conta excluída', body),
    text: `Sua conta foi excluída. Restaure até ${formatDate(params.hardDeleteDate)} em ${params.restoreUrl}`,
  };
}

export function accountRestoredTemplate(params: { tenantName: string; loginUrl: string }) {
  const body = `
    <p>Sua conta <strong>${params.tenantName}</strong> foi <strong>restaurada com sucesso</strong>.</p>
    <p>Todos os seus dados estão de volta. É só fazer login pra continuar de onde parou.</p>
    ${ctaButton(params.loginUrl, 'Acessar agLivre')}
  `;
  return {
    subject: 'Sua conta agLivre foi restaurada',
    html: layout('Conta restaurada', body),
    text: `Conta restaurada. Acesse em ${params.loginUrl}`,
  };
}

export function subscriptionCanceledTemplate(params: {
  periodEnd: Date | string | null;
  reactivateUrl: string;
}) {
  const body = `
    <p>Sua assinatura do agLivre foi <strong>cancelada</strong>.</p>
    ${
      params.periodEnd
        ? `<p>Você ainda tem acesso completo até <strong>${formatDate(params.periodEnd)}</strong>. Depois disso, sua conta volta pro plano Free.</p>`
        : '<p>Sua conta foi movida pro plano Free.</p>'
    }
    ${ctaButton(params.reactivateUrl, 'Reativar minha assinatura')}
    <p style="color:#6b7280;font-size:13px">
      Seus dados continuam salvos. Quando quiser voltar, é só reativar — sem precisar migrar nada.
    </p>
  `;
  return {
    subject: 'Sua assinatura agLivre foi cancelada',
    html: layout('Cancelamento confirmado', body),
    text: `Assinatura cancelada${
      params.periodEnd ? `. Acesso até ${formatDate(params.periodEnd)}.` : '.'
    } Reative em ${params.reactivateUrl}`,
  };
}
