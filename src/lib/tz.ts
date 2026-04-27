/**
 * Helpers de fuso horário — tudo no agLivre opera em America/Sao_Paulo.
 *
 * Por padrão, `Date.getDate()` / `getMonth()` / `getFullYear()` retornam
 * componentes no fuso LOCAL do servidor. Em prod (Vercel = UTC), isso
 * dava bug: vendas fechadas entre 21h e 23h59 BR caíam no dia seguinte
 * UTC. Esses helpers usam Intl com timeZone fixo pra garantir o fuso BR.
 */

export const TZ_BR = "America/Sao_Paulo"

/**
 * Formata uma data como YYYY-MM-DD no fuso BR.
 * Ex: new Date('2026-04-28T01:00:00Z') → '2026-04-27'
 */
export function dateKeyBR(d: Date = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ_BR })
}

/**
 * Retorna os componentes da data atual no fuso BR. Útil pra construir
 * Date de "1º do mês corrente" sem cair no dia anterior em UTC.
 */
export function nowPartsBR(): { year: number; month0: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_BR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return { year: get("year"), month0: get("month") - 1, day: get("day") }
}

/**
 * Extrai o dia (1-31) de uma data, no fuso BR.
 * Substitui `date.getDate()` em código server-side.
 */
export function dayOfMonthBR(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ_BR,
      day: "2-digit",
    }).format(d),
  )
}
