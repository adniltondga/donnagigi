/**
 * Cadastro está aberto?
 *
 * Em produção: sempre fechado (waitlist). Em dev/staging: sempre aberto.
 * Quando for liberar oficialmente, troca por `return true`.
 */
export function isRegistrationOpen(): boolean {
  return process.env.NODE_ENV !== "production"
}
