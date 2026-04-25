"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SearchableSelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  required?: boolean
}

/**
 * Combobox simples (sem dependência externa): input com filtro por
 * digitação + lista flutuante. Suporta navegação por teclado (↑↓/Enter/
 * Esc), highlight do item selecionado e fecha ao clicar fora.
 *
 * Quando o input está aberto, mostra o que o usuário está digitando;
 * quando fechado, mostra o `label` da option selecionada.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  emptyText = "Nenhum resultado",
  disabled,
  className,
  required,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listboxId = useRef(`ss-list-${Math.random().toString(36).slice(2, 9)}`).current

  const selected = options.find((o) => o.value === value)

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  // Reset highlight quando query/open mudam
  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  // Click outside fecha
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  // Mantém o item destacado visível
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[highlight] as HTMLElement | undefined
    el?.scrollIntoView({ block: "nearest" })
  }, [highlight, open])

  const select = (opt: SearchableSelectOption) => {
    onChange(opt.value)
    setOpen(false)
    setQuery("")
    inputRef.current?.blur()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (!open) setOpen(true)
      else setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === "Enter") {
      if (open && filtered[highlight]) {
        e.preventDefault()
        select(filtered[highlight])
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setQuery("")
        inputRef.current?.blur()
      }
    } else if (e.key === "Tab") {
      setOpen(false)
      setQuery("")
    }
  }

  const displayValue = open ? query : selected?.label ?? ""

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center w-full border border-border rounded-lg pr-2 bg-background transition",
          disabled
            ? "opacity-60 cursor-not-allowed bg-muted"
            : "focus-within:ring-2 focus-within:ring-primary-600 focus-within:border-transparent"
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onClick={() => !disabled && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-required={required}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
          role="combobox"
          className="flex-1 bg-transparent px-3 py-2 outline-none text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform pointer-events-none",
            open && "rotate-180"
          )}
        />
      </div>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-popover text-popover-foreground border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</li>
          ) : (
            filtered.map((o, i) => {
              const isSelected = o.value === value
              const isHighlight = i === highlight
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    select(o)
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer",
                    isHighlight ? "bg-accent text-accent-foreground" : "text-foreground"
                  )}
                >
                  <Check
                    className={cn(
                      "w-4 h-4 shrink-0 text-primary-600 dark:text-primary-400",
                      isSelected ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate">{o.label}</span>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
