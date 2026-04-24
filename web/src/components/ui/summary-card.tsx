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
    bg: "bg-white",
    border: "border-gray-200",
    iconBg: "bg-emerald-100 text-emerald-700",
    valueColor: "text-gray-900",
    labelColor: "text-emerald-700",
  },
  sky: {
    bg: "bg-gradient-to-br from-sky-50 to-white",
    border: "border-sky-200",
    iconBg: "bg-sky-100 text-sky-700",
    valueColor: "text-gray-900",
    labelColor: "text-sky-700",
  },
  amber: {
    bg: "bg-gradient-to-br from-amber-50 to-white",
    border: "border-amber-200",
    iconBg: "bg-amber-100 text-amber-700",
    valueColor: "text-amber-700",
    labelColor: "text-amber-800",
  },
  rose: {
    bg: "bg-gradient-to-br from-rose-50 to-white",
    border: "border-rose-200",
    iconBg: "bg-rose-100 text-rose-700",
    valueColor: "text-rose-700",
    labelColor: "text-rose-800",
  },
  fuchsia: {
    bg: "bg-gradient-to-br from-fuchsia-50 to-white",
    border: "border-fuchsia-200",
    iconBg: "bg-fuchsia-100 text-fuchsia-700",
    valueColor: "text-gray-900",
    labelColor: "text-fuchsia-700",
  },
  primary: {
    bg: "bg-gradient-to-br from-primary-50 to-white",
    border: "border-primary-200",
    iconBg: "bg-primary-100 text-primary-700",
    valueColor: "text-gray-900",
    labelColor: "text-primary-700",
  },
  gray: {
    bg: "bg-white",
    border: "border-gray-200",
    iconBg: "bg-gray-100 text-gray-600",
    valueColor: "text-gray-900",
    labelColor: "text-gray-600",
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
                <div className="text-xs text-gray-600 mt-1 flex items-center gap-1.5">
                  {sub && <span>{sub}</span>}
                  {tooltip && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600 shrink-0"
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
