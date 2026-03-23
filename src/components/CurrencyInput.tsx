'use client'

interface CurrencyInputProps {
  value: number | string
  onChange: (value: number) => void
  placeholder?: string
  disabled?: boolean
}

export default function CurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
  disabled = false,
}: CurrencyInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    const numericValue = parseFloat(input.replace(/[^\d.,-]/g, '').replace(',', '.'))

    if (!isNaN(numericValue)) {
      onChange(numericValue)
    } else if (input === '' || input === '0') {
      onChange(0)
    }
  }

  const formatValue = (val: number | string) => {
    if (!val && val !== 0) return ''
    const num = typeof val === 'string' ? parseFloat(val) : val
    return num.toFixed(2).replace('.', ',')
  }

  return (
    <input
      type="text"
      value={formatValue(value)}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right"
    />
  )
}
