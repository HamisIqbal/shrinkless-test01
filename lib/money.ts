export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function parsePriceToCents(input: string): number {
  const cleaned = input.replace(/[$,\s]/g, '');
  const value = Number(cleaned);

  // Number('') is 0, so an empty field would otherwise price an item at zero.
  if (cleaned === '' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid price: ${input}`);
  }

  return Math.round(value * 100);
}
