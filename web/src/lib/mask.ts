export function maskCpfCnpj(value: string): string {
  const raw = value.replace(/\D/g, '').slice(0, 14)
  if (raw.length <= 11) {
    return raw
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return raw
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export function unmaskCpfCnpj(value: string): string {
  return value.replace(/\D/g, '')
}

export function validateCpf(cpf: string): boolean {
  const n = cpf.replace(/\D/g, '')
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(n[i]) * (10 - i)
  let r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== parseInt(n[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(n[i]) * (11 - i)
  r = (sum * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === parseInt(n[10])
}

export function validateCnpj(cnpj: string): boolean {
  const n = cnpj.replace(/\D/g, '')
  if (n.length !== 14 || /^(\d)\1{13}$/.test(n)) return false
  const calc = (weights: number[]) =>
    weights.reduce((acc, w, i) => acc + parseInt(n[i]) * w, 0)
  const mod = (sum: number) => {
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = mod(calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
  const d2 = mod(calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]))
  return d1 === parseInt(n[12]) && d2 === parseInt(n[13])
}

export function validateCpfCnpj(value: string): boolean {
  const n = value.replace(/\D/g, '')
  if (n.length === 11) return validateCpf(n)
  if (n.length === 14) return validateCnpj(n)
  return false
}

export function maskPhone(value: string): string {
  const raw = value.replace(/\D/g, '').slice(0, 11)
  if (raw.length <= 10) {
    return raw.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  return raw.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}
