'use client'

import { useEffect, useState } from 'react'

interface CurrencyInputProps {
  value: number | string
  onChange: (value: number) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  required?: boolean
}

function formatBR(val: number | string): string {
  if (val === '' || val === null || val === undefined) return ''
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (!Number.isFinite(num)) return ''
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseDisplayed(display: string): number {
  if (!display) return 0
  const onlyNumbers = display.replace(/\D/g, '')
  if (!onlyNumbers) return 0
  return parseInt(onlyNumbers, 10) / 100
}

export default function CurrencyInput({
  value,
  onChange,
  placeholder = 'R$ 0,00',
  disabled = false,
  className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-600',
  id,
  required,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(() => formatBR(value))

  // Sincroniza quando o value externo muda (ex: abrir o form em modo edição).
  // Só reescreve se o valor externo for diferente do que o usuário tem digitado.
  useEffect(() => {
    const external = typeof value === 'number' ? value : parseFloat(value || '0')
    const current = parseDisplayed(displayValue)
    if (Number.isFinite(external) && Math.abs(external - current) > 0.005) {
      setDisplayValue(formatBR(external))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const onlyNumbers = input.replace(/\D/g, '')

    if (onlyNumbers === '') {
      setDisplayValue('')
      onChange(0)
      return
    }

    const numValue = parseInt(onlyNumbers, 10) / 100
    const formatted = numValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    setDisplayValue(formatted)
    onChange(numValue)
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleInput}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={className}
    />
  )
}
