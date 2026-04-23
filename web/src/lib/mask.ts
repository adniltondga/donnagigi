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

export function maskPhone(value: string): string {
  const raw = value.replace(/\D/g, '').slice(0, 11)
  if (raw.length <= 10) {
    return raw.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  return raw.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}
