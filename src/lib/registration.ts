/**
 * Cadastro está aberto?
 *
 * 🚧 MODO LANÇAMENTO 🚧
 * Hardcoded fechado em produção e aberto em dev/preview até a gente
 * liberar oficialmente. No dia do lançamento, basta trocar pra
 * `return true` aqui (ou deletar o arquivo e os calls — todo lugar
 * que usa este helper assume aberto se não chamar).
 */
export function isRegistrationOpen(): boolean {
  return process.env.NODE_ENV !== "production"
}
