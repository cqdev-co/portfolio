'use client';

import { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { CSVImportDialog } from './csv-import-dialog';

interface Account {
  id: string;
  name: string;
  type: string;
  institution: string | null;
  currentBalance?: number | null;
}

interface ImportButtonProps extends Omit<ButtonProps, 'onClick'> {
  accounts: Account[];
  preselectedAccountId?: string;
}

export function ImportButton({
  accounts,
  preselectedAccountId,
  variant,
  size,
  ...props
}: ImportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant || 'default'}
        size={size}
        onClick={() => setOpen(true)}
        {...props}
      >
        <Upload className="h-4 w-4 mr-2" />
        Import CSV
      </Button>
      <CSVImportDialog
        open={open}
        onOpenChange={setOpen}
        accounts={accounts}
        preselectedAccountId={preselectedAccountId}
      />
    </>
  );
}
