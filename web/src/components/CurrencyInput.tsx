'use client'

import { useState } from 'react'

interface CurrencyInputProps {
  value: number | string
  onChange: (value: number) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function CurrencyInput({
  value,
  onChange,
  placeholder = 'R$ 0,00',
  disabled = false,
  className = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(formatCurrency(value))

  function formatCurrency(val: number | string): string {
    if (val === '' || val === null || val === undefined) return ''
    const num = typeof val === 'string' ? parseFloat(val) : val
    if (isNaN(num)) return ''
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value

    // Remove tudo que não é número
    const onlyNumbers = input.replace(/\D/g, '')

    if (onlyNumbers === '') {
      setDisplayValue('')
      onChange(0)
      return
    }

    // Converter para número (dividindo por 100 pra ter as casas decimais)
    const numValue = parseInt(onlyNumbers) / 100

    // Formatar para exibição
    const formatted = numValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })

    setDisplayValue(formatted)
    onChange(numValue)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleInput}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  )
}
