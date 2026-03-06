'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  parseCSV,
  formatBankLabel,
  type ParseResult,
  type BankFormat,
} from '@/lib/csv/parser';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  currentBalance?: number | null;
}

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  preselectedAccountId?: string;
}

type ImportState = 'select' | 'preview' | 'importing' | 'done';

export function CSVImportDialog({
  open,
  onOpenChange,
  accounts,
  preselectedAccountId,
}: CSVImportDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>('select');
  const [selectedAccountId, setSelectedAccountId] = useState(
    preselectedAccountId || ''
  );
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const reset = useCallback(() => {
    setState('select');
    setFile(null);
    setParseResult(null);
    setImportResult(null);
    if (!preselectedAccountId) setSelectedAccountId('');
  }, [preselectedAccountId]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) reset();
    onOpenChange(newOpen);
  };

  const processFile = useCallback(
    async (f: File) => {
      setFile(f);
      const content = await f.text();
      const account = accounts.find((a) => a.id === selectedAccountId);
      const bank = account?.institution as BankFormat | undefined;
      const result = parseCSV(content, bank || undefined);
      setParseResult(result);
      setState('preview');
    },
    [selectedAccountId, accounts]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const f = e.dataTransfer.files[0];
      if (f && (f.name.endsWith('.csv') || f.type === 'text/csv')) {
        processFile(f);
      }
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleImport = async () => {
    if (!file || !selectedAccountId) return;
    setState('importing');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', selectedAccountId);

    const account = accounts.find((a) => a.id === selectedAccountId);
    if (account?.institution) {
      formData.append('bank', account.institution);
    }

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setImportResult(data);
      setState('done');
      router.refresh();
    } catch {
      setImportResult({
        imported: 0,
        skipped: 0,
        errors: ['Network error: failed to reach server'],
      });
      setState('done');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import CSV Transactions</DialogTitle>
          <DialogDescription>
            Upload a CSV export from your bank to import transactions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Account</label>
            <Select
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
              disabled={state === 'importing'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acct) => (
                  <SelectItem key={acct.id} value={acct.id}>
                    {acct.name}
                    <span className="text-muted-foreground ml-2 text-xs capitalize">
                      {acct.institution} · {acct.type.replace('_', ' ')}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Drop Zone (only show when account selected and in select state) */}
          {selectedAccountId && state === 'select' && (
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors
                ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              `}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">
                Drop your CSV file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports Bank of America, Chase, and generic CSV formats
              </p>
            </div>
          )}

          {/* Preview */}
          {state === 'preview' && parseResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  {file?.name}
                </Badge>
                <Badge>
                  {formatBankLabel(parseResult.format)} format detected
                </Badge>
                <Badge variant="secondary">
                  {parseResult.transactions.length} transaction
                  {parseResult.transactions.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {parseResult.errors.length > 0 && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                  <p className="text-sm font-medium text-destructive mb-1">
                    {parseResult.errors.length} parsing warning
                    {parseResult.errors.length !== 1 ? 's' : ''}
                  </p>
                  <ul className="text-xs text-destructive/80 space-y-0.5">
                    {parseResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {parseResult.errors.length > 5 && (
                      <li>...and {parseResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              <ScrollArea className="h-[280px] border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">Date</th>
                      <th className="text-left p-2 font-medium">Description</th>
                      <th className="text-right p-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.transactions.slice(0, 50).map((txn, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 text-muted-foreground whitespace-nowrap">
                          {txn.date}
                        </td>
                        <td className="p-2 truncate max-w-[300px]">
                          {txn.description}
                        </td>
                        <td
                          className={`p-2 text-right tabular-nums whitespace-nowrap ${
                            txn.amount < 0 ? 'text-emerald-500' : ''
                          }`}
                        >
                          {formatCurrency(txn.amount)}
                        </td>
                      </tr>
                    ))}
                    {parseResult.transactions.length > 50 && (
                      <tr className="border-t">
                        <td
                          colSpan={3}
                          className="p-2 text-center text-muted-foreground text-xs"
                        >
                          ...and {parseResult.transactions.length - 50} more
                          transactions
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={reset}>
                  Cancel
                </Button>
                <Button onClick={handleImport}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {parseResult.transactions.length} Transaction
                  {parseResult.transactions.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {/* Importing state */}
          {state === 'importing' && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Importing transactions and detecting duplicates...
              </p>
            </div>
          )}

          {/* Done */}
          {state === 'done' && importResult && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-6 gap-2">
                {importResult.imported > 0 ? (
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-10 w-10 text-amber-500" />
                )}
                <p className="text-lg font-semibold">
                  {importResult.imported > 0
                    ? 'Import Complete'
                    : 'No New Transactions'}
                </p>
                <div className="flex gap-3 text-sm text-muted-foreground">
                  <span className="text-emerald-500 font-medium">
                    {importResult.imported} imported
                  </span>
                  <span>{importResult.skipped} duplicates skipped</span>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                  <ul className="text-xs text-destructive/80 space-y-0.5">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  Close
                </Button>
                <Button onClick={reset}>Import Another</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
