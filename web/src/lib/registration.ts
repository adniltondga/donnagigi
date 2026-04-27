/**
 * Cadastro está aberto?
 *
 * Override por env var REGISTRATION_OPEN=true|false (cobre o caso de
 * rodar o build de produção local pra debug).
 *
 * Default: aberto fora de production. No dia do lançamento, basta
 * setar REGISTRATION_OPEN=true em produção (ou hardcode `return true`).
 */
export function isRegistrationOpen(): boolean {
  const override = process.env.REGISTRATION_OPEN ?? process.env.NEXT_PUBLIC_REGISTRATION_OPEN
  if (override === "true") return true
  if (override === "false") return false
  return process.env.NODE_ENV !== "production"
}
