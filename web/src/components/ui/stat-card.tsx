import React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const ACCENTS: Record<string, { bg: string; text: string }> = {
  primary: { bg: "bg-primary-50 dark:bg-primary-900/30", text: "text-primary-700 dark:text-primary-300" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300" },
  amber: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300" },
  sky: { bg: "bg-sky-50 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-300" },
  rose: { bg: "bg-rose-50 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300" },
  gray: { bg: "bg-muted", text: "text-foreground" },
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
        "bg-card text-card-foreground rounded-xl border border-border shadow-sm p-5 hover:shadow-md transition",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold text-foreground mt-2">{value}</p>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
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
