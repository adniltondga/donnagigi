"use client"

/**
 * Filtro de período padrão dos relatórios.
 * Chips de atalho (Hoje / 7 dias / Este mês / Custom) + 2 date pickers.
 * Usado em /admin/financeiro/relatorios/* e /admin/financeiro/mercado-pago.
 */

export type PeriodPreset = "hoje" | "7dias" | "mes" | "custom"

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function todayISO(): string {
  return ymd(new Date())
}

function firstOfMonth(): string {
  const d = new Date()
  return ymd(new Date(d.getFullYear(), d.getMonth(), 1))
}

function lastOfMonth(): string {
  const d = new Date()
  return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

function plusDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return ymd(dt)
}

/**
 * Resolve um preset em { from, to } — útil pra estado inicial do caller.
 */
export function resolvePreset(preset: Exclude<PeriodPreset, "custom">): {
  from: string
  to: string
} {
  if (preset === "hoje") {
    const t = todayISO()
    return { from: t, to: t }
  }
  if (preset === "7dias") {
    const t = todayISO()
    return { from: t, to: plusDays(t, 6) }
  }
  // mes
  return { from: firstOfMonth(), to: lastOfMonth() }
}

interface Props {
  from: string
  to: string
  preset: PeriodPreset
  onChange: (next: { from: string; to: string; preset: PeriodPreset }) => void
  /** Esconder algum preset (ex: "hoje") em contextos específicos. */
  exclude?: PeriodPreset[]
  /** Label customizado pro "Custom" (default: "Custom"). */
  customLabel?: string
}

export function PeriodFilter({ from, to, preset, onChange, exclude = [], customLabel = "Custom" }: Props) {
  const OPTIONS = [
    { key: "hoje" as const, label: "Hoje" },
    { key: "7dias" as const, label: "7 dias" },
    { key: "mes" as const, label: "Este mês" },
    { key: "custom" as const, label: customLabel },
  ].filter((o) => !exclude.includes(o.key))

  const applyPreset = (p: PeriodPreset) => {
    if (p === "custom") {
      onChange({ from, to, preset: "custom" })
      return
    }
    const { from: f, to: t } = resolvePreset(p)
    onChange({ from: f, to: t, preset: p })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
        {OPTIONS.map((opt) => {
          const active = preset === opt.key
          return (
            <button
              key={opt.key}
              onClick={() => applyPreset(opt.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">De</label>
        <input
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value, to, preset: "custom" })}
          className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Até</label>
        <input
          type="date"
          value={to}
          onChange={(e) => onChange({ from, to: e.target.value, preset: "custom" })}
          className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none"
        />
      </div>
    </div>
  )
}
