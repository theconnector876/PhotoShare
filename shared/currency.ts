export type Currency = 'USD' | 'JMD' | 'GBP' | 'CAD' | 'EUR';

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  JMD: 'J$',
  GBP: '£',
  CAD: 'C$',
  EUR: '€',
};

export const CURRENCY_NAMES: Record<Currency, string> = {
  USD: 'US Dollar',
  JMD: 'Jamaican Dollar',
  GBP: 'British Pound',
  CAD: 'Canadian Dollar',
  EUR: 'Euro',
};

export const SUPPORTED_CURRENCIES: Currency[] = ['USD', 'JMD', 'GBP', 'CAD', 'EUR'];

export function formatCurrency(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
