'use client'

import { useCallback, useRef, useEffect } from 'react'

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value'> {
  value: number
  onChange: (value: number) => void
}

export default function CurrencyInput({
  value,
  onChange,
  className = '',
  ...props
}: CurrencyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Formata número para exibição brasileira
  const formatCurrency = useCallback((num: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }, [])

  // Extrai apenas números de uma string
  const extractNumbers = useCallback((str: string): string => {
    return str.replace(/\D/g, '')
  }, [])

  // Converte string de números para valor decimal
  const stringToNumber = useCallback((str: string): number => {
    const nums = extractNumbers(str)
    if (!nums) return 0
    // Divide por 100 para trabalhar com centavos
    return parseInt(nums, 10) / 100
  }, [extractNumbers])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    const numericValue = stringToNumber(inputValue)
    
    // Atualiza o valor no componente pai
    onChange(numericValue)

    // Formata para exibição
    if (inputRef.current) {
      inputRef.current.value = formatCurrency(numericValue)
    }
  }, [onChange, stringToNumber, formatCurrency])

  // Inicializa o campo com o valor correto
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = formatCurrency(value)
    }
  }, [value, formatCurrency])

  const handleFocus = useCallback(() => {
    if (inputRef.current) {
      const numericValue = stringToNumber(inputRef.current.value)
      inputRef.current.value = numericValue.toString()
      inputRef.current.select()
    }
  }, [stringToNumber])

  const handleBlur = useCallback(() => {
    if (inputRef.current) {
      const numericValue = stringToNumber(inputRef.current.value)
      inputRef.current.value = formatCurrency(numericValue)
    }
  }, [stringToNumber, formatCurrency])

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      placeholder="R$ 0,00"
      {...props}
    />
  )
}
