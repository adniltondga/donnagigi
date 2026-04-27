import React from "react"
import { cn } from "@/lib/utils"

const ACCENTS = {
  default: "text-foreground",
  emerald: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
  primary: "text-primary-600 dark:text-primary-400",
} as const

export type KpiAccent = keyof typeof ACCENTS

interface KpiCardProps {
  label: string
  value: string | number
  sub?: React.ReactNode
  accent?: KpiAccent
  className?: string
}

/**
 * Mini-card de KPI: label pequeno em uppercase + número grande
 * com cor de destaque opcional + sub-linha. Para cards com ícone,
 * use <StatCard />; para comparativos com delta, componente local.
 */
export function KpiCard({
  label,
  value,
  sub,
  accent = "default",
  className,
}: KpiCardProps) {
  return (
    <div className={cn("bg-card border border-border rounded-lg p-4", className)}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </p>
      <p className={cn("text-2xl font-bold mt-1", ACCENTS[accent])}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}
