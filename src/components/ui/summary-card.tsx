"use client"

import React from "react"
import type { LucideIcon } from "lucide-react"
import { Info } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatCurrency } from "@/lib/calculations"
import { cn } from "@/lib/utils"

type Tone = "emerald" | "sky" | "amber" | "rose" | "fuchsia" | "primary" | "gray"

const TONES: Record<Tone, { bg: string; border: string; iconBg: string; valueColor: string; labelColor: string }> = {
  emerald: {
    bg: "bg-card",
    border: "border-border",
    iconBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    valueColor: "text-foreground",
    labelColor: "text-emerald-700 dark:text-emerald-400",
  },
  sky: {
    bg: "bg-gradient-to-br from-sky-50 to-card dark:bg-none dark:bg-card",
    border: "border-sky-200 dark:border-sky-900/50",
    iconBg: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    valueColor: "text-foreground",
    labelColor: "text-sky-700 dark:text-sky-400",
  },
  amber: {
    bg: "bg-gradient-to-br from-amber-50 to-card dark:bg-none dark:bg-card",
    border: "border-amber-200 dark:border-amber-900/50",
    iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    valueColor: "text-amber-700 dark:text-amber-300",
    labelColor: "text-amber-800 dark:text-amber-400",
  },
  rose: {
    bg: "bg-gradient-to-br from-rose-50 to-card dark:bg-none dark:bg-card",
    border: "border-rose-200 dark:border-rose-900/50",
    iconBg: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    valueColor: "text-rose-700 dark:text-rose-300",
    labelColor: "text-rose-800 dark:text-rose-400",
  },
  fuchsia: {
    bg: "bg-gradient-to-br from-fuchsia-50 to-card dark:bg-none dark:bg-card",
    border: "border-fuchsia-200 dark:border-fuchsia-900/50",
    iconBg: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
    valueColor: "text-foreground",
    labelColor: "text-fuchsia-700 dark:text-fuchsia-400",
  },
  primary: {
    bg: "bg-gradient-to-br from-primary-50 to-card dark:bg-none dark:bg-card",
    border: "border-primary-200 dark:border-primary-900/50",
    iconBg: "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300",
    valueColor: "text-foreground",
    labelColor: "text-primary-700 dark:text-primary-400",
  },
  gray: {
    bg: "bg-card",
    border: "border-border",
    iconBg: "bg-muted text-muted-foreground",
    valueColor: "text-foreground",
    labelColor: "text-muted-foreground",
  },
}

export interface SummaryCardProps {
  label: string
  /** Número → formatado como moeda. String → exibido como está. */
  value: number | string
  sub?: React.ReactNode
  /** LucideIcon ou qualquer ReactNode (ex: <Clock className="w-5 h-5" />) */
  icon?: LucideIcon | React.ReactNode
  tone?: Tone
  tooltip?: string
  loading?: boolean
  action?: React.ReactNode
  className?: string
}

export function SummaryCard({
  label,
  value,
  sub,
  icon,
  tone = "emerald",
  tooltip,
  loading = false,
  action,
  className,
}: SummaryCardProps) {
  const t = TONES[tone]

  const displayValue = loading
    ? "—"
    : typeof value === "number"
    ? formatCurrency(value)
    : value

  const iconNode = (() => {
    if (!icon) return null
    if (React.isValidElement(icon)) return icon
    const Icon = icon as LucideIcon
    return <Icon className="w-5 h-5" />
  })()

  return (
    <TooltipProvider delayDuration={150}>
      <Card className={cn(t.border, t.bg, className)}>
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            {iconNode && (
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", t.iconBg)}>
                {iconNode}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs font-medium uppercase tracking-wide", t.labelColor)}>{label}</p>
              <p className={cn("text-2xl font-bold mt-0.5 tabular-nums break-words", t.valueColor)}>
                {displayValue}
              </p>
              {(sub || tooltip) && (
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  {sub && <span>{sub}</span>}
                  {tooltip && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground/70 hover:text-foreground shrink-0"
                          aria-label="Detalhes"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{tooltip}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
              {action}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
