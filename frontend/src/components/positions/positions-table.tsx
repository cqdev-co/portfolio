'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Trash2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { deletePosition } from '@/lib/api/positions';
import type { PositionWithMarketData } from '@/lib/types/positions';

interface PositionsTableProps {
  positions: PositionWithMarketData[];
  onDelete: (id: string) => void;
  onAIClick?: (position: PositionWithMarketData) => void;
  hasMarketData: boolean;
}

export function PositionsTable({
  positions,
  onDelete,
  onAIClick,
  hasMarketData,
}: PositionsTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      const result = await deletePosition(deleteId);
      if (result.success) {
        onDelete(deleteId);
      }
    } catch (error) {
      console.error('[Positions] Delete error:', error);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const getYahooFinanceUrl = (symbol: string) =>
    `https://finance.yahoo.com/quote/${symbol}`;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Entry</TableHead>
              {hasMarketData && (
                <>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                </>
              )}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => (
              <TableRow
                key={position.id}
                className="hover:bg-muted/50 cursor-pointer"
              >
                {/* Symbol */}
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        window.open(
                          getYahooFinanceUrl(position.symbol),
                          '_blank'
                        )
                      }
                      className="flex items-center gap-1 hover:text-primary 
                        transition-colors group"
                    >
                      {position.symbol}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60" />
                    </button>
                    {position.pnl_percent >= 10 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        </TooltipTrigger>
                        <TooltipContent>Big winner!</TooltipContent>
                      </Tooltip>
                    )}
                    {position.pnl_percent <= -10 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        </TooltipTrigger>
                        <TooltipContent>Needs attention</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>

                {/* Type */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      position.position_type === 'option'
                        ? 'bg-purple-100 text-purple-700 ' +
                            'dark:bg-purple-900 dark:text-purple-300'
                        : 'bg-blue-100 text-blue-700 ' +
                            'dark:bg-blue-900 dark:text-blue-300'
                    )}
                  >
                    {position.position_type === 'option'
                      ? `${position.option_type?.toUpperCase()} $${position.strike_price}`
                      : 'Stock'}
                  </Badge>
                  {position.position_type === 'option' &&
                    position.expiration_date && (
                      <span className="text-xs text-muted-foreground ml-2">
                        Exp: {formatDate(position.expiration_date)}
                      </span>
                    )}
                </TableCell>

                {/* Quantity */}
                <TableCell className="text-right font-mono">
                  {position.quantity}
                </TableCell>

                {/* Entry Price */}
                <TableCell className="text-right font-mono">
                  ${position.entry_price.toFixed(2)}
                  <div className="text-xs text-muted-foreground">
                    {formatDate(position.entry_date)}
                  </div>
                </TableCell>

                {/* Current Price (if market data) */}
                {hasMarketData && (
                  <TableCell className="text-right font-mono">
                    <div>${position.current_price.toFixed(2)}</div>
                    {position.position_type === 'option' &&
                      position.underlying_price && (
                        <div className="text-xs text-muted-foreground">
                          {position.symbol} @ $
                          {position.underlying_price.toFixed(2)}
                        </div>
                      )}
                  </TableCell>
                )}

                {/* P&L (if market data) */}
                {hasMarketData && (
                  <TableCell className="text-right">
                    <div
                      className={cn(
                        'font-mono font-medium',
                        position.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                    </div>
                    <div
                      className={cn(
                        'text-xs',
                        position.pnl_percent >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      )}
                    >
                      {position.pnl_percent >= 0 ? '+' : ''}
                      {position.pnl_percent.toFixed(2)}%
                    </div>
                  </TableCell>
                )}

                {/* Actions */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => onAIClick?.(position)}
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>AI Analysis</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive 
                            hover:text-destructive"
                          onClick={() => setDeleteId(position.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Position</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this position? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground 
                hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
