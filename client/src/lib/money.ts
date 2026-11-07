const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const amountFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBRL(cents: number): string {
  return brlFormatter.format((cents || 0) / 100);
}

export function formatBRLNoCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
}

export function formatAmountInput(cents: number): string {
  return amountFormatter.format((cents || 0) / 100);
}

export function centsFromDigits(digits: string): number {
  const clean = digits.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return clean ? Number(clean) : 0;
}

export function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function compactBRL(cents: number): string {
  const value = (cents || 0) / 100;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })} mi`;
  }
  if (abs >= 1_000) {
    return `R$ ${(value / 1_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })} mil`;
  }
  return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}
