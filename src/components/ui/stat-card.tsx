import React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const ACCENTS: Record<string, { bg: string; text: string }> = {
  primary: { bg: "bg-primary-50", text: "text-primary-700" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700" },
  amber: { bg: "bg-amber-50", text: "text-amber-700" },
  sky: { bg: "bg-sky-50", text: "text-sky-700" },
  rose: { bg: "bg-rose-50", text: "text-rose-700" },
  gray: { bg: "bg-gray-100", text: "text-gray-700" },
}

interface StatCardProps {
  label: string
  value: string | number
  sub?: React.ReactNode
  icon?: LucideIcon
  accent?: keyof typeof ACCENTS
  className?: string
}

/**
 * Card de KPI com ícone em caixa colorida à direita. Usado no
 * dashboard e em páginas de relatório.
 */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "primary",
  className,
}: StatCardProps) {
  const a = ACCENTS[accent] || ACCENTS.primary
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-gray-500 tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
        </div>
        {Icon && (
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              a.bg,
              a.text
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  )
}
