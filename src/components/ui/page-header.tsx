import React from "react"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  badge?: React.ReactNode
}

/**
 * Header padrão de páginas internas do admin. Fica no topo do conteúdo,
 * antes dos Cards. Segue o layout do agoficina (título 2xl bold +
 * subtítulo cinza + slot de ações à direita).
 */
export function PageHeader({ title, description, actions, badge }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {badge}
        </div>
        {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}
