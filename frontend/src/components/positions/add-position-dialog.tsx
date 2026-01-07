'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPosition, createSpread } from '@/lib/api/positions';
import type {
  Position,
  OptionType,
  SpreadType,
  CreatePositionRequest,
  CreateSpreadRequest,
} from '@/lib/types/positions';

// ============================================================================
// Types
// ============================================================================

interface AddPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPositionAdded: (position: Position) => void;
}

type TabType = 'stock' | 'option' | 'spread';

interface SpreadTemplate {
  type: SpreadType;
  label: string;
  shortLabel: string;
  description: string;
  legs: {
    type: OptionType;
    direction: 'long' | 'short';
    strike: 'lower' | 'higher';
  }[];
  bullish: boolean;
}

// ============================================================================
// Spread Templates
// ============================================================================

const SPREAD_TEMPLATES: SpreadTemplate[] = [
  {
    type: 'call_debit_spread',
    label: 'Call Debit Spread',
    shortLabel: 'CDS',
    description: 'Bullish • Limited risk/reward',
    legs: [
      { type: 'call', direction: 'long', strike: 'lower' },
      { type: 'call', direction: 'short', strike: 'higher' },
    ],
    bullish: true,
  },
  {
    type: 'put_credit_spread',
    label: 'Put Credit Spread',
    shortLabel: 'PCS',
    description: 'Bullish • Collect premium',
    legs: [
      { type: 'put', direction: 'short', strike: 'higher' },
      { type: 'put', direction: 'long', strike: 'lower' },
    ],
    bullish: true,
  },
  {
    type: 'put_debit_spread',
    label: 'Put Debit Spread',
    shortLabel: 'PDS',
    description: 'Bearish • Limited risk/reward',
    legs: [
      { type: 'put', direction: 'long', strike: 'higher' },
      { type: 'put', direction: 'short', strike: 'lower' },
    ],
    bullish: false,
  },
  {
    type: 'call_credit_spread',
    label: 'Call Credit Spread',
    shortLabel: 'CCS',
    description: 'Bearish • Collect premium',
    legs: [
      { type: 'call', direction: 'short', strike: 'lower' },
      { type: 'call', direction: 'long', strike: 'higher' },
    ],
    bullish: false,
  },
  {
    type: 'iron_condor',
    label: 'Iron Condor',
    shortLabel: 'IC',
    description: 'Neutral • Range bound play',
    legs: [
      { type: 'put', direction: 'long', strike: 'lower' },
      { type: 'put', direction: 'short', strike: 'higher' },
      { type: 'call', direction: 'short', strike: 'lower' },
      { type: 'call', direction: 'long', strike: 'higher' },
    ],
    bullish: false,
  },
];

// ============================================================================
// Component
// ============================================================================

export function AddPositionDialog({
  open,
  onOpenChange,
  onPositionAdded,
}: AddPositionDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('stock');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common fields
  const [symbol, setSymbol] = useState('');
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');

  // Stock fields
  const [stockShares, setStockShares] = useState('');
  const [stockPrice, setStockPrice] = useState('');
  const [stockDirection, setStockDirection] = useState<'long' | 'short'>(
    'long'
  );

  // Option fields
  const [optionType, setOptionType] = useState<OptionType>('call');
  const [optionDirection, setOptionDirection] = useState<'long' | 'short'>(
    'long'
  );
  const [optionContracts, setOptionContracts] = useState('');
  const [optionPremium, setOptionPremium] = useState('');
  const [optionStrike, setOptionStrike] = useState('');
  const [optionExpiry, setOptionExpiry] = useState('');

  // Spread fields
  const [spreadTemplate, setSpreadTemplate] =
    useState<SpreadType>('call_debit_spread');
  const [spreadContracts, setSpreadContracts] = useState('');
  const [spreadNetPrice, setSpreadNetPrice] = useState('');
  const [spreadLowerStrike, setSpreadLowerStrike] = useState('');
  const [spreadUpperStrike, setSpreadUpperStrike] = useState('');
  const [spreadExpiry, setSpreadExpiry] = useState('');

  // Get selected template
  const selectedTemplate = useMemo(
    () => SPREAD_TEMPLATES.find((t) => t.type === spreadTemplate),
    [spreadTemplate]
  );

  // Reset form
  const resetForm = useCallback(() => {
    setSymbol('');
    setEntryDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setStockShares('');
    setStockPrice('');
    setStockDirection('long');
    setOptionType('call');
    setOptionDirection('long');
    setOptionContracts('');
    setOptionPremium('');
    setOptionStrike('');
    setOptionExpiry('');
    setSpreadTemplate('call_debit_spread');
    setSpreadContracts('');
    setSpreadNetPrice('');
    setSpreadLowerStrike('');
    setSpreadUpperStrike('');
    setSpreadExpiry('');
    setError(null);
  }, []);

  // Handle stock submit
  const handleStockSubmit = async () => {
    if (!symbol.trim()) {
      setError('Symbol is required');
      return;
    }
    const shares = parseFloat(stockShares);
    const price = parseFloat(stockPrice);
    if (!shares || shares <= 0) {
      setError('Valid number of shares required');
      return;
    }
    if (!price || price <= 0) {
      setError('Valid entry price required');
      return;
    }

    const request: CreatePositionRequest = {
      symbol: symbol.toUpperCase().trim(),
      position_type: 'stock',
      quantity: stockDirection === 'short' ? -shares : shares,
      entry_price: price,
      entry_date: entryDate,
      notes: notes.trim() || undefined,
    };

    const result = await createPosition(request);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      onPositionAdded(result.data);
      resetForm();
    }
  };

  // Handle option submit
  const handleOptionSubmit = async () => {
    if (!symbol.trim()) {
      setError('Symbol is required');
      return;
    }
    const contracts = parseFloat(optionContracts);
    const premium = parseFloat(optionPremium);
    const strike = parseFloat(optionStrike);

    if (!contracts || contracts <= 0) {
      setError('Valid number of contracts required');
      return;
    }
    if (!premium || premium < 0) {
      setError('Valid premium required');
      return;
    }
    if (!strike || strike <= 0) {
      setError('Valid strike price required');
      return;
    }
    if (!optionExpiry) {
      setError('Expiration date required');
      return;
    }

    const request: CreatePositionRequest = {
      symbol: symbol.toUpperCase().trim(),
      position_type: 'option',
      quantity: optionDirection === 'short' ? -contracts : contracts,
      entry_price: premium,
      entry_date: entryDate,
      option_type: optionType,
      strike_price: strike,
      expiration_date: optionExpiry,
      notes: notes.trim() || undefined,
    };

    const result = await createPosition(request);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      onPositionAdded(result.data);
      resetForm();
    }
  };

  // Handle spread submit
  const handleSpreadSubmit = async () => {
    if (!symbol.trim()) {
      setError('Symbol is required');
      return;
    }
    const contracts = parseFloat(spreadContracts);
    const netPrice = parseFloat(spreadNetPrice);
    const lower = parseFloat(spreadLowerStrike);
    const upper = parseFloat(spreadUpperStrike);

    if (!contracts || contracts <= 0) {
      setError('Valid number of contracts required');
      return;
    }
    if (isNaN(netPrice)) {
      setError('Net debit/credit required');
      return;
    }
    if (!lower || lower <= 0 || !upper || upper <= 0) {
      setError('Valid strike prices required');
      return;
    }
    if (lower >= upper) {
      setError('Lower strike must be less than upper strike');
      return;
    }
    if (!spreadExpiry) {
      setError('Expiration date required');
      return;
    }

    const isDebit = spreadTemplate.includes('debit');
    const width = upper - lower;
    const maxProfit = isDebit
      ? (width - netPrice) * 100 * contracts
      : netPrice * 100 * contracts;
    const maxLoss = isDebit
      ? netPrice * 100 * contracts
      : (width - netPrice) * 100 * contracts;

    const request: CreateSpreadRequest = {
      symbol: symbol.toUpperCase().trim(),
      spread_type: spreadTemplate,
      net_debit_credit: isDebit ? netPrice : -netPrice,
      quantity: contracts,
      entry_date: entryDate,
      expiration_date: spreadExpiry,
      lower_strike: lower,
      upper_strike: upper,
      width,
      max_profit: maxProfit,
      max_loss: maxLoss,
      notes: notes.trim() || undefined,
    };

    const result = await createSpread(request);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      // For now, just close - we'll need to add spread handling
      resetForm();
      onOpenChange(false);
    }
  };

  // Handle submit based on tab
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      switch (activeTab) {
        case 'stock':
          await handleStockSubmit();
          break;
        case 'option':
          await handleOptionSubmit();
          break;
        case 'spread':
          await handleSpreadSubmit();
          break;
      }
    } catch (err) {
      console.error('[AddPosition] Error:', err);
      setError('Failed to add position');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Position</DialogTitle>
            <DialogDescription>
              Track a new stock, option, or spread position.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabType)}
            className="mt-4"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="option">Option</TabsTrigger>
              <TabsTrigger value="spread">Spread</TabsTrigger>
            </TabsList>

            {/* STOCK TAB */}
            <TabsContent value="stock" className="space-y-4 mt-4">
              {/* Symbol + Direction */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Symbol</Label>
                  <Input
                    placeholder="AAPL"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        stockDirection === 'long' ? 'default' : 'outline'
                      }
                      onClick={() => setStockDirection('long')}
                      className={cn(
                        'flex-1 gap-1',
                        stockDirection === 'long' &&
                          'bg-green-600 hover:bg-green-700'
                      )}
                    >
                      <TrendingUp className="h-3 w-3" />
                      Long
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        stockDirection === 'short' ? 'default' : 'outline'
                      }
                      onClick={() => setStockDirection('short')}
                      className={cn(
                        'flex-1 gap-1',
                        stockDirection === 'short' &&
                          'bg-red-600 hover:bg-red-700'
                      )}
                    >
                      <TrendingDown className="h-3 w-3" />
                      Short
                    </Button>
                  </div>
                </div>
              </div>

              {/* Shares + Price */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Shares</Label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={stockShares}
                    onChange={(e) => setStockShares(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Entry Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="150.00"
                    value={stockPrice}
                    onChange={(e) => setStockPrice(e.target.value)}
                  />
                </div>
              </div>

              {/* Date + Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Entry Date</Label>
                  <Input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    placeholder="Optional"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* OPTION TAB */}
            <TabsContent value="option" className="space-y-4 mt-4">
              {/* Symbol */}
              <div className="space-y-2">
                <Label>Symbol</Label>
                <Input
                  placeholder="AAPL"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>

              {/* Type + Direction */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={optionType === 'call' ? 'default' : 'outline'}
                      onClick={() => setOptionType('call')}
                      className={cn(
                        'flex-1',
                        optionType === 'call' &&
                          'bg-emerald-600 hover:bg-emerald-700'
                      )}
                    >
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                      Call
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={optionType === 'put' ? 'default' : 'outline'}
                      onClick={() => setOptionType('put')}
                      className={cn(
                        'flex-1',
                        optionType === 'put' && 'bg-rose-600 hover:bg-rose-700'
                      )}
                    >
                      <ArrowDownRight className="h-3 w-3 mr-1" />
                      Put
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        optionDirection === 'long' ? 'default' : 'outline'
                      }
                      onClick={() => setOptionDirection('long')}
                      className={cn(
                        'flex-1 gap-1',
                        optionDirection === 'long' &&
                          'bg-blue-600 hover:bg-blue-700'
                      )}
                    >
                      <Plus className="h-3 w-3" />
                      Buy
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        optionDirection === 'short' ? 'default' : 'outline'
                      }
                      onClick={() => setOptionDirection('short')}
                      className={cn(
                        'flex-1 gap-1',
                        optionDirection === 'short' &&
                          'bg-amber-600 hover:bg-amber-700'
                      )}
                    >
                      <Minus className="h-3 w-3" />
                      Sell
                    </Button>
                  </div>
                </div>
              </div>

              {/* Strike + Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Strike Price</Label>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="155.00"
                    value={optionStrike}
                    onChange={(e) => setOptionStrike(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiration</Label>
                  <Input
                    type="date"
                    value={optionExpiry}
                    onChange={(e) => setOptionExpiry(e.target.value)}
                  />
                </div>
              </div>

              {/* Contracts + Premium */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Contracts</Label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={optionContracts}
                    onChange={(e) => setOptionContracts(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Premium (per contract)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="3.50"
                    value={optionPremium}
                    onChange={(e) => setOptionPremium(e.target.value)}
                  />
                </div>
              </div>

              {/* Entry Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Entry Date</Label>
                  <Input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    placeholder="Optional"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Preview */}
              {optionStrike && optionExpiry && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm font-mono">
                    {optionDirection === 'long' ? '+' : '-'}
                    {optionContracts || '1'} {symbol || '___'} ${optionStrike}{' '}
                    {optionType.toUpperCase()}{' '}
                    {new Date(optionExpiry).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  {optionPremium && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {optionDirection === 'long' ? 'Debit' : 'Credit'}: $
                      {(
                        parseFloat(optionPremium) *
                        100 *
                        (parseFloat(optionContracts) || 1)
                      ).toFixed(0)}
                    </p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* SPREAD TAB */}
            <TabsContent value="spread" className="space-y-4 mt-4">
              {/* Strategy Selector */}
              <div className="space-y-2">
                <Label>Strategy</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SPREAD_TEMPLATES.slice(0, 4).map((template) => (
                    <Button
                      key={template.type}
                      type="button"
                      size="sm"
                      variant={
                        spreadTemplate === template.type ? 'default' : 'outline'
                      }
                      onClick={() => setSpreadTemplate(template.type)}
                      className={cn(
                        'h-auto py-2 flex-col items-start',
                        spreadTemplate === template.type &&
                          (template.bullish
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-red-600 hover:bg-red-700')
                      )}
                    >
                      <span className="font-medium">{template.shortLabel}</span>
                      <span className="text-[10px] opacity-80">
                        {template.bullish ? 'Bullish' : 'Bearish'}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Description */}
              {selectedTemplate && (
                <div className="p-2 rounded bg-muted/30 text-xs text-muted-foreground">
                  <span className="font-medium">{selectedTemplate.label}:</span>{' '}
                  {selectedTemplate.description}
                </div>
              )}

              {/* Symbol + Contracts */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Symbol</Label>
                  <Input
                    placeholder="AAPL"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contracts</Label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={spreadContracts}
                    onChange={(e) => setSpreadContracts(e.target.value)}
                  />
                </div>
              </div>

              {/* Strikes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Lower Strike</Label>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="150.00"
                    value={spreadLowerStrike}
                    onChange={(e) => setSpreadLowerStrike(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Upper Strike</Label>
                  <Input
                    type="number"
                    step="0.5"
                    placeholder="155.00"
                    value={spreadUpperStrike}
                    onChange={(e) => setSpreadUpperStrike(e.target.value)}
                  />
                </div>
              </div>

              {/* Net Price + Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>
                    Net {spreadTemplate.includes('debit') ? 'Debit' : 'Credit'}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="2.50"
                    value={spreadNetPrice}
                    onChange={(e) => setSpreadNetPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiration</Label>
                  <Input
                    type="date"
                    value={spreadExpiry}
                    onChange={(e) => setSpreadExpiry(e.target.value)}
                  />
                </div>
              </div>

              {/* Entry Date + Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Entry Date</Label>
                  <Input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input
                    placeholder="Optional"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Preview */}
              {spreadLowerStrike && spreadUpperStrike && spreadNetPrice && (
                <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {symbol || '___'} {selectedTemplate?.label}
                    </span>
                    <Badge
                      variant={
                        selectedTemplate?.bullish ? 'default' : 'secondary'
                      }
                    >
                      {selectedTemplate?.bullish ? 'Bullish' : 'Bearish'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    ${spreadLowerStrike} / ${spreadUpperStrike} •{' '}
                    {spreadExpiry
                      ? new Date(spreadExpiry).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })
                      : '---'}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">
                        {spreadTemplate.includes('debit')
                          ? 'Max Risk'
                          : 'Max Risk'}
                        :
                      </span>{' '}
                      <span className="text-red-500 font-medium">
                        $
                        {spreadTemplate.includes('debit')
                          ? (
                              parseFloat(spreadNetPrice) *
                              100 *
                              (parseFloat(spreadContracts) || 1)
                            ).toFixed(0)
                          : (
                              (parseFloat(spreadUpperStrike) -
                                parseFloat(spreadLowerStrike) -
                                parseFloat(spreadNetPrice)) *
                              100 *
                              (parseFloat(spreadContracts) || 1)
                            ).toFixed(0)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Max Profit:</span>{' '}
                      <span className="text-green-500 font-medium">
                        $
                        {spreadTemplate.includes('debit')
                          ? (
                              (parseFloat(spreadUpperStrike) -
                                parseFloat(spreadLowerStrike) -
                                parseFloat(spreadNetPrice)) *
                              100 *
                              (parseFloat(spreadContracts) || 1)
                            ).toFixed(0)
                          : (
                              parseFloat(spreadNetPrice) *
                              100 *
                              (parseFloat(spreadContracts) || 1)
                            ).toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Error */}
          {error && <p className="text-sm text-destructive mt-4">{error}</p>}

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Position'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
