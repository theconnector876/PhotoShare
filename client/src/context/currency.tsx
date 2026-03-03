import { createContext, useContext, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { type Currency, SUPPORTED_CURRENCIES, formatCurrency } from "@shared/currency";

const STORAGE_KEY = "cag_currency";

interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  source: string;
}

interface CurrencyContextValue {
  selectedCurrency: Currency;
  setCurrency: (c: Currency) => void;
  rates: Record<string, number>;
  convert: (amount: number, fromCurrency: Currency) => number;
  format: (amount: number, fromCurrency: Currency) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrencyState] = useState<Currency>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_CURRENCIES.includes(stored as Currency)) {
        return stored as Currency;
      }
    }
    return "USD";
  });

  const { data: ratesData } = useQuery<ExchangeRates>({
    queryKey: ["/api/exchange-rates"],
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  });

  // rates relative to USD (e.g. { JMD: 157, GBP: 0.79, ... })
  const rates: Record<string, number> = {
    USD: 1,
    JMD: 157,
    GBP: 0.79,
    CAD: 1.36,
    EUR: 0.92,
    ...(ratesData?.rates ?? {}),
  };

  const setCurrency = (c: Currency) => {
    setSelectedCurrencyState(c);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, c);
    }
  };

  // Convert amount from its native currency to the selected display currency
  const convert = (amount: number, fromCurrency: Currency): number => {
    if (fromCurrency === selectedCurrency) return amount;
    const fromRate = rates[fromCurrency] ?? 1;
    const toRate = rates[selectedCurrency] ?? 1;
    return (amount / fromRate) * toRate;
  };

  const format = (amount: number, fromCurrency: Currency): string => {
    const converted = convert(amount, fromCurrency);
    return formatCurrency(converted, selectedCurrency);
  };

  return (
    <CurrencyContext.Provider value={{ selectedCurrency, setCurrency, rates, convert, format }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
