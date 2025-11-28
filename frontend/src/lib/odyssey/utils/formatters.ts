/**
 * Data formatting utilities for the Odyssey dashboard
 */

/**
 * Format currency values
 */
export function formatCurrency(
  value: number,
  decimals: number = 2
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format percentage values
 */
export function formatPercentage(
  value: number,
  decimals: number = 2
): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

/**
 * Format large numbers with abbreviations
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  } else if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  } else if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toFixed(0);
}

/**
 * Format date for expiration display
 */
export function formatExpirationDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format date with time
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format time only
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Format DTE (days to expiration)
 */
export function formatDTE(dte: number): string {
  if (dte === 0) return "Today";
  if (dte === 1) return "1 day";
  return `${dte} days`;
}

/**
 * Format risk/reward ratio
 */
export function formatRiskReward(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}

/**
 * Format implied volatility
 */
export function formatIV(iv: number): string {
  return `${(iv * 100).toFixed(1)}%`;
}

/**
 * Format Greeks
 */
export function formatGreek(value: number, decimals: number = 3): string {
  return value.toFixed(decimals);
}

/**
 * Format symbol with optional description
 */
export function formatSymbol(
  symbol: string,
  includePrefix: boolean = true
): string {
  if (symbol.startsWith("^") && includePrefix) {
    return symbol;
  }
  return symbol.replace("^", "");
}

/**
 * Get color class for change value
 */
export function getChangeColor(change: number): string {
  if (change > 0) return "text-green-600 dark:text-green-400";
  if (change < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

/**
 * Get background color for confidence score
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) {
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  }
  if (confidence >= 60) {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  }
  if (confidence >= 40) {
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  }
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}

/**
 * Format confidence score
 */
export function formatConfidence(confidence: number): string {
  return `${confidence}%`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

