/**
 * Sector ETF definitions
 */

export interface SectorETF {
  etf: string;
  name: string;
}

export const SECTOR_ETFS: Record<string, SectorETF> = {
  XLK: { etf: 'XLK', name: 'Technology' },
  XLF: { etf: 'XLF', name: 'Financials' },
  XLV: { etf: 'XLV', name: 'Healthcare' },
  XLY: { etf: 'XLY', name: 'Consumer Discretionary' },
  XLP: { etf: 'XLP', name: 'Consumer Staples' },
  XLE: { etf: 'XLE', name: 'Energy' },
  XLI: { etf: 'XLI', name: 'Industrials' },
  XLB: { etf: 'XLB', name: 'Materials' },
  XLU: { etf: 'XLU', name: 'Utilities' },
  XLRE: { etf: 'XLRE', name: 'Real Estate' },
  XLC: { etf: 'XLC', name: 'Communication Services' },
};
