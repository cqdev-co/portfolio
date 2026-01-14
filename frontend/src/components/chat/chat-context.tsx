'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

// ============================================================================
// Types
// ============================================================================

interface ChatContextValue {
  isOpen: boolean;
  isFullscreen: boolean;
  initialPrompt: string | null;
  openChat: (prompt?: string) => void;
  closeChat: () => void;
  toggleChat: () => void;
  toggleFullscreen: () => void;
  clearInitialPrompt: () => void;
}

// ============================================================================
// Context
// ============================================================================

const ChatContext = createContext<ChatContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const openChat = useCallback((prompt?: string) => {
    if (prompt) {
      setInitialPrompt(prompt);
    }
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
    // Reset fullscreen when closing
    setIsFullscreen(false);
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        // Closing - reset fullscreen
        setIsFullscreen(false);
      }
      return !prev;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const clearInitialPrompt = useCallback(() => {
    setInitialPrompt(null);
  }, []);

  // ========================================
  // Keyboard Shortcut: ⌘K / Ctrl+K
  // ========================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K to toggle chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleChat();
      }

      // Escape to close (only when open)
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closeChat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggleChat, closeChat]);

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        isFullscreen,
        initialPrompt,
        openChat,
        closeChat,
        toggleChat,
        toggleFullscreen,
        clearInitialPrompt,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useGlobalChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useGlobalChat must be used within ChatProvider');
  }
  return context;
}

// ============================================================================
// Helper: Build Position Analysis Prompt
// ============================================================================

interface PositionForPrompt {
  symbol: string;
  position_type: 'stock' | 'option';
  quantity: number;
  entry_price: number;
  current_price: number;
  pnl: number;
  pnl_percent: number;
  option_type?: 'call' | 'put';
  strike_price?: number;
  expiration_date?: string;
  entry_date: string;
}

export function buildPositionPrompt(position: PositionForPrompt): string {
  const isOption = position.position_type === 'option';
  const isLong = position.quantity > 0;

  let positionDesc = `${position.symbol}`;

  if (isOption) {
    positionDesc += ` ${position.option_type?.toUpperCase()} $${position.strike_price}`;
    if (position.expiration_date) {
      const expDate = new Date(position.expiration_date);
      positionDesc += ` exp ${expDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`;
    }
  }

  return `Analyze my ${isLong ? 'long' : 'short'} position in ${positionDesc}:
- Entry: $${position.entry_price.toFixed(2)}
- Current: $${position.current_price.toFixed(2)}
- P&L: ${position.pnl >= 0 ? '+' : ''}$${position.pnl.toFixed(2)} (${position.pnl_percent >= 0 ? '+' : ''}${position.pnl_percent.toFixed(1)}%)

Should I hold, trim, or exit? What key levels should I watch?`;
}

// ============================================================================
// Helper: Build Spread Analysis Prompt
// ============================================================================

interface SpreadForPrompt {
  symbol: string;
  spreadType: string;
  lowerStrike: number;
  upperStrike: number;
  netEntryPrice: number;
  netCurrentPrice: number;
  pnl: number;
  pnl_percent: number;
  expiration_date?: string;
}

export function buildSpreadPrompt(spread: SpreadForPrompt): string {
  let expStr = '';
  if (spread.expiration_date) {
    const expDate = new Date(spread.expiration_date);
    expStr = ` exp ${expDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })}`;
  }

  return `Analyze my ${spread.symbol} ${spread.spreadType.replace(/_/g, ' ')}:
- Strikes: $${spread.lowerStrike} / $${spread.upperStrike}${expStr}
- Entry: $${spread.netEntryPrice.toFixed(2)} debit
- Current: $${spread.netCurrentPrice.toFixed(2)}
- P&L: ${spread.pnl >= 0 ? '+' : ''}$${spread.pnl.toFixed(0)} (${spread.pnl_percent >= 0 ? '+' : ''}${spread.pnl_percent.toFixed(1)}%)

Should I hold to expiry, close now, or roll the position?`;
}

// ============================================================================
// Helper: Build Portfolio Review Prompt
// ============================================================================

interface SpreadForPortfolio {
  symbol: string;
  spreadType: string;
  longStrike: number;
  shortStrike: number;
  quantity: number;
  netEntryPrice: number;
  netCurrentPrice: number;
  pnl: number;
  pnlPercent: number;
  expirationDate?: string;
  underlyingPrice: number;
}

interface PositionForPortfolio {
  symbol: string;
  positionType: 'stock' | 'option';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  optionType?: 'call' | 'put';
  strikePrice?: number;
  expirationDate?: string;
}

interface PortfolioForPrompt {
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  positionsCount: number;
  spreadsCount: number;
  winners: number;
  losers: number;
  spreads: SpreadForPortfolio[];
  positions: PositionForPortfolio[];
}

export function buildPortfolioPrompt(portfolio: PortfolioForPrompt): string {
  const lines: string[] = [];

  // Header
  lines.push('Review my complete portfolio:');
  lines.push('');

  // Summary
  lines.push('=== PORTFOLIO SUMMARY ===');
  lines.push(`Total Value: $${portfolio.totalValue.toLocaleString()}`);
  lines.push(
    `Total P&L: ${portfolio.totalPnl >= 0 ? '+' : ''}$${portfolio.totalPnl.toFixed(2)} (${portfolio.totalPnlPercent >= 0 ? '+' : ''}${portfolio.totalPnlPercent.toFixed(1)}%)`
  );
  lines.push(
    `Positions: ${portfolio.positionsCount} stocks/options, ${portfolio.spreadsCount} spreads`
  );
  lines.push(
    `Win/Loss: ${portfolio.winners} winners, ${portfolio.losers} losers`
  );
  lines.push('');

  // Spreads section
  if (portfolio.spreads.length > 0) {
    lines.push('=== SPREADS ===');
    for (const spread of portfolio.spreads) {
      const expStr = spread.expirationDate
        ? new Date(spread.expirationDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        : 'N/A';
      const pnlSign = spread.pnl >= 0 ? '+' : '';
      const maxProfit =
        (spread.shortStrike - spread.longStrike - spread.netEntryPrice) *
        100 *
        spread.quantity;
      const maxLoss = spread.netEntryPrice * 100 * spread.quantity;

      lines.push(
        `${spread.symbol} ${spread.spreadType.replace(/_/g, ' ').toUpperCase()}:`
      );
      lines.push(
        `  Strikes: $${spread.longStrike} (long) / $${spread.shortStrike} (short)`
      );
      lines.push(`  Expiration: ${expStr}`);
      lines.push(`  Qty: ${spread.quantity} contracts`);
      lines.push(
        `  Entry: $${spread.netEntryPrice.toFixed(2)} | Current: $${spread.netCurrentPrice.toFixed(2)}`
      );
      lines.push(
        `  P&L: ${pnlSign}$${spread.pnl.toFixed(2)} (${pnlSign}${spread.pnlPercent.toFixed(1)}%)`
      );
      lines.push(`  Underlying: $${spread.underlyingPrice.toFixed(2)}`);
      lines.push(
        `  Max Profit: $${maxProfit.toFixed(0)} | Max Loss: $${maxLoss.toFixed(0)}`
      );
      lines.push('');
    }
  }

  // Individual positions section
  if (portfolio.positions.length > 0) {
    lines.push('=== INDIVIDUAL POSITIONS ===');
    for (const pos of portfolio.positions) {
      const pnlSign = pos.pnl >= 0 ? '+' : '';
      const direction = pos.quantity > 0 ? 'LONG' : 'SHORT';

      if (pos.positionType === 'option') {
        const expStr = pos.expirationDate
          ? new Date(pos.expirationDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          : 'N/A';
        lines.push(
          `${pos.symbol} ${pos.optionType?.toUpperCase()} $${pos.strikePrice} (${direction}):`
        );
        lines.push(`  Expiration: ${expStr}`);
        lines.push(`  Qty: ${Math.abs(pos.quantity)} contracts`);
        lines.push(
          `  Entry: $${pos.entryPrice.toFixed(2)} | Current: $${pos.currentPrice.toFixed(2)}`
        );
        lines.push(
          `  P&L: ${pnlSign}$${pos.pnl.toFixed(2)} (${pnlSign}${pos.pnlPercent.toFixed(1)}%)`
        );
      } else {
        lines.push(`${pos.symbol} STOCK (${direction}):`);
        lines.push(`  Qty: ${Math.abs(pos.quantity)} shares`);
        lines.push(
          `  Entry: $${pos.entryPrice.toFixed(2)} | Current: $${pos.currentPrice.toFixed(2)}`
        );
        lines.push(
          `  P&L: ${pnlSign}$${pos.pnl.toFixed(2)} (${pnlSign}${pos.pnlPercent.toFixed(1)}%)`
        );
      }
      lines.push('');
    }
  }

  // Analysis request
  lines.push('=== ANALYSIS REQUEST ===');
  lines.push('Please provide:');
  lines.push(
    '1. Overall portfolio assessment (risk exposure, diversification)'
  );
  lines.push(
    '2. Position-by-position analysis (hold, trim, or exit recommendations)'
  );
  lines.push('3. Key price levels to watch for each position');
  lines.push('4. Any immediate action items');

  return lines.join('\n');
}
