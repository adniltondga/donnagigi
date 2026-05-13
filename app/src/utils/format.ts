export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  const valid = typeof num === 'number' && !isNaN(num) ? num : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valid);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function unmaskPhone(value: string): string {
  return value.replace(/\D/g, '');
}

export function maskCpfCnpj(value: string): string {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const hasLetter = /[A-Z]/.test(raw);
  const isCnpj = hasLetter || raw.length > 11;

  if (!isCnpj) {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  const head = raw.slice(0, 12);
  const tailDigits = raw.slice(12).replace(/\D/g, '').slice(0, 2);
  const c = head + tailDigits;
  if (c.length <= 2) return c;
  if (c.length <= 5) return `${c.slice(0, 2)}.${c.slice(2)}`;
  if (c.length <= 8)
    return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5)}`;
  if (c.length <= 12)
    return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8)}`;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

export function unmaskCpfCnpj(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function maskThousands(value: string | number): string {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function unmaskThousands(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}
