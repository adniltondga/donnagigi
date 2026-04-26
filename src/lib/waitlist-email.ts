/**
 * Template de email enviado quando o agLivre abre os cadastros — vai
 * pra todos da WaitlistSignup com `notified=false`.
 */
import { sendEmail } from "./email"

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://aglivre.dgadigital.com.br"

export async function sendWaitlistOpenedEmail(to: string) {
  await sendEmail({
    to,
    subject: "🚀 agLivre está no ar — sua vez de testar",
    html: `
      <div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937; line-height: 1.55;">
        <div style="background: linear-gradient(135deg, #6d28d9 0%, #a21caf 100%); color: white; padding: 32px 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800;">É agora! 🎉</h1>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">os cadastros do agLivre estão abertos</p>
        </div>
        <div style="background: white; padding: 28px 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 16px;">Olá,</p>
          <p style="margin: 0 0 16px;">
            Você entrou na lista de espera do <strong>agLivre</strong> — e a hora chegou.
            Cadastros estão liberados e você pode começar agora mesmo, com
            <strong>14 dias grátis</strong> e sem cartão de crédito.
          </p>
          <p style="margin: 0 0 24px;">
            Em poucos minutos você conecta seu Mercado Livre e Mercado Pago e já vê:
            <br />• vendas, taxas e lucro real
            <br />• cronograma do que o MP vai liberar
            <br />• DRE e contas a pagar/receber num lugar só
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${SITE_URL}/admin/login?register=1" style="display: inline-block; background: #6d28d9; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700;">
              Criar minha conta grátis
            </a>
          </div>
          <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
            Tem alguma dúvida? Responde esse email — a gente lê tudo.
          </p>
          <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">
            Você está recebendo este email porque entrou na lista de espera em ${SITE_URL}.
            Se prefere não receber mais novidades, é só ignorar essa mensagem — não vamos enviar mais nada sobre isso.
          </p>
        </div>
      </div>
    `,
  })
}
