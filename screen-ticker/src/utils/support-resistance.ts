import type { HistoricalData } from "../types/index.ts";

interface PriceLevel {
  price: number;
  strength: number; // Number of touches
  type: "support" | "resistance";
}

/**
 * Detect support and resistance levels from historical data
 * Uses pivot point detection with tolerance bands
 */
export function detectSupportResistance(
  data: HistoricalData[],
  tolerance = 0.02, // 2% tolerance band
  minTouches = 2
): PriceLevel[] {
  if (data.length < 20) return [];

  const levels: Map<number, PriceLevel> = new Map();
  
  // Find local minima (support) and maxima (resistance)
  for (let i = 2; i < data.length - 2; i++) {
    const current = data[i];
    const prev1 = data[i - 1];
    const prev2 = data[i - 2];
    const next1 = data[i + 1];
    const next2 = data[i + 2];

    if (!current || !prev1 || !prev2 || !next1 || !next2) continue;

    // Local minimum (support)
    if (
      current.low < prev1.low &&
      current.low < prev2.low &&
      current.low < next1.low &&
      current.low < next2.low
    ) {
      addLevel(levels, current.low, "support", tolerance);
    }

    // Local maximum (resistance)
    if (
      current.high > prev1.high &&
      current.high > prev2.high &&
      current.high > next1.high &&
      current.high > next2.high
    ) {
      addLevel(levels, current.high, "resistance", tolerance);
    }
  }

  // Filter by minimum touches and sort by strength
  return Array.from(levels.values())
    .filter((level) => level.strength >= minTouches)
    .sort((a, b) => b.strength - a.strength);
}

function addLevel(
  levels: Map<number, PriceLevel>,
  price: number,
  type: "support" | "resistance",
  tolerance: number
): void {
  // Check if this price is within tolerance of an existing level
  for (const [key, level] of levels) {
    if (Math.abs(key - price) / key <= tolerance && level.type === type) {
      // Average the price and increment strength
      const newPrice = (key * level.strength + price) / (level.strength + 1);
      levels.delete(key);
      levels.set(newPrice, {
        price: newPrice,
        strength: level.strength + 1,
        type,
      });
      return;
    }
  }

  // New level
  levels.set(price, { price, strength: 1, type });
}

/**
 * Find the nearest support level below current price
 */
export function findNearestSupport(
  currentPrice: number,
  data: HistoricalData[]
): { level: number; distance: number } | null {
  const levels = detectSupportResistance(data);
  
  const supports = levels
    .filter((l) => l.type === "support" && l.price < currentPrice)
    .sort((a, b) => b.price - a.price); // Closest first

  if (supports.length === 0) return null;
  
  const nearest = supports[0];
  if (!nearest) return null;
  
  return {
    level: nearest.price,
    distance: (currentPrice - nearest.price) / currentPrice,
  };
}

/**
 * Check if price is near a support level
 */
export function isNearSupport(
  currentPrice: number,
  data: HistoricalData[],
  threshold = 0.03 // 3% from support
): boolean {
  const nearest = findNearestSupport(currentPrice, data);
  if (!nearest) return false;
  return nearest.distance <= threshold;
}

