import React from "react"
import type { LucideIcon } from "lucide-react"

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  description?: string
  action?: React.ReactNode
}

/**
 * Estado vazio padrão (nenhum dado encontrado). Usado dentro de
 * Cards e tabelas. Ícone cinza + título + descrição + ação opcional.
 */
export function EmptyState({
  icon: Icon,
  title = "Nenhum resultado",
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="p-12 text-center">
      {Icon && <Icon className="w-12 h-12 mx-auto mb-3 text-gray-300" />}
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
