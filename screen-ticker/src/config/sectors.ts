/**
 * Sector benchmarks for comparative analysis
 * Data approximates typical sector valuations (update quarterly)
 */

export interface SectorBenchmark {
  avgPE: number;
  avgPEG: number;
  avgFCFYield: number;
  avgEVEBITDA: number;
}

export const SECTOR_BENCHMARKS: Record<string, SectorBenchmark> = {
  Technology: {
    avgPE: 28,
    avgPEG: 1.8,
    avgFCFYield: 4,
    avgEVEBITDA: 18,
  },
  Healthcare: {
    avgPE: 22,
    avgPEG: 2.0,
    avgFCFYield: 5,
    avgEVEBITDA: 14,
  },
  'Financial Services': {
    avgPE: 12,
    avgPEG: 1.2,
    avgFCFYield: 8,
    avgEVEBITDA: 8,
  },
  'Consumer Cyclical': {
    avgPE: 20,
    avgPEG: 1.5,
    avgFCFYield: 5,
    avgEVEBITDA: 12,
  },
  'Consumer Defensive': {
    avgPE: 22,
    avgPEG: 2.5,
    avgFCFYield: 4,
    avgEVEBITDA: 14,
  },
  Industrials: {
    avgPE: 18,
    avgPEG: 1.6,
    avgFCFYield: 5,
    avgEVEBITDA: 11,
  },
  Energy: {
    avgPE: 10,
    avgPEG: 0.8,
    avgFCFYield: 10,
    avgEVEBITDA: 5,
  },
  Utilities: {
    avgPE: 18,
    avgPEG: 3.0,
    avgFCFYield: 3,
    avgEVEBITDA: 10,
  },
  'Real Estate': {
    avgPE: 35,
    avgPEG: 2.5,
    avgFCFYield: 4,
    avgEVEBITDA: 18,
  },
  'Basic Materials': {
    avgPE: 12,
    avgPEG: 1.0,
    avgFCFYield: 6,
    avgEVEBITDA: 7,
  },
  'Communication Services': {
    avgPE: 20,
    avgPEG: 1.4,
    avgFCFYield: 6,
    avgEVEBITDA: 10,
  },
};

/**
 * Get sector benchmark, with fallback for unknown sectors
 */
export function getSectorBenchmark(
  sector: string | undefined
): SectorBenchmark | null {
  if (!sector) return null;
  return SECTOR_BENCHMARKS[sector] ?? null;
}

export interface SectorComparison {
  text: string;
  type: 'bullish' | 'bearish' | 'neutral';
}

/**
 * Compare stock metrics to sector averages
 * Returns both bullish (below avg) and bearish (above avg) comparisons
 */
export function compareToBenchmark(
  sector: string | undefined,
  pe: number | undefined,
  peg: number | undefined,
  evEbitda: number | undefined
): SectorComparison[] {
  const benchmark = getSectorBenchmark(sector);
  if (!benchmark || !sector) return [];

  const signals: SectorComparison[] = [];

  // P/E comparison - show both bullish and bearish
  if (pe && pe > 0) {
    if (pe < benchmark.avgPE * 0.8) {
      signals.push({
        text: `P/E ${pe.toFixed(1)} is 20%+ below ${sector} avg (${benchmark.avgPE})`,
        type: 'bullish',
      });
    } else if (pe < benchmark.avgPE * 0.95) {
      signals.push({
        text: `P/E ${pe.toFixed(1)} below ${sector} avg (${benchmark.avgPE})`,
        type: 'bullish',
      });
    } else if (pe > benchmark.avgPE * 1.3) {
      signals.push({
        text: `P/E ${pe.toFixed(1)} is 30%+ above ${sector} avg (${benchmark.avgPE})`,
        type: 'bearish',
      });
    } else if (pe > benchmark.avgPE * 1.1) {
      signals.push({
        text: `P/E ${pe.toFixed(1)} above ${sector} avg (${benchmark.avgPE})`,
        type: 'bearish',
      });
    }
  }

  // PEG comparison - show both directions
  if (peg && peg > 0) {
    if (peg < benchmark.avgPEG * 0.7) {
      signals.push({
        text: `PEG ${peg.toFixed(2)} well below ${sector} avg (${benchmark.avgPEG})`,
        type: 'bullish',
      });
    } else if (peg > benchmark.avgPEG * 1.5) {
      signals.push({
        text: `PEG ${peg.toFixed(2)} above ${sector} avg (${benchmark.avgPEG})`,
        type: 'bearish',
      });
    }
  }

  // EV/EBITDA comparison
  if (evEbitda && evEbitda > 0) {
    if (evEbitda < benchmark.avgEVEBITDA * 0.7) {
      signals.push({
        text: `EV/EBITDA ${evEbitda.toFixed(1)} attractive vs ${sector} avg (${benchmark.avgEVEBITDA})`,
        type: 'bullish',
      });
    } else if (evEbitda > benchmark.avgEVEBITDA * 1.3) {
      signals.push({
        text: `EV/EBITDA ${evEbitda.toFixed(1)} expensive vs ${sector} avg (${benchmark.avgEVEBITDA})`,
        type: 'bearish',
      });
    }
  }

  return signals;
}
