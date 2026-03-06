export type BankFormat = 'bofa' | 'chase' | 'generic';

export type ParsedTransaction = {
  date: string;
  description: string;
  amount: number;
  category?: string;
  type?: string;
  balance?: number;
};

export type ParseResult = {
  format: BankFormat;
  transactions: ParsedTransaction[];
  errors: string[];
};

function splitCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeHeaders(headers: string[]): string[] {
  return headers.map((h) =>
    h
      .replace(/^["']|["']$/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
  );
}

export function detectBankFormat(headers: string[]): BankFormat {
  const normalized = normalizeHeaders(headers);
  const joined = normalized.join(',');

  if (
    normalized.includes('transaction_date') &&
    normalized.includes('post_date') &&
    normalized.includes('category')
  ) {
    return 'chase';
  }

  if (
    joined.includes('date') &&
    joined.includes('description') &&
    joined.includes('amount') &&
    (joined.includes('running_bal') || normalized.length <= 4)
  ) {
    return 'bofa';
  }

  return 'generic';
}

function parseDateMMDDYYYY(dateStr: string): string | null {
  const cleaned = dateStr.replace(/['"]/g, '').trim();
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseBofA(lines: string[]): {
  transactions: ParsedTransaction[];
  errors: string[];
} {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const fields = splitCSVLine(lines[i]);
    if (fields.length < 3) {
      errors.push(
        `Line ${i + 2}: expected at least 3 fields, got ${fields.length}`
      );
      continue;
    }

    const date = parseDateMMDDYYYY(fields[0]);
    if (!date) {
      errors.push(`Line ${i + 2}: invalid date "${fields[0]}"`);
      continue;
    }

    const description = fields[1].replace(/^["']|["']$/g, '').trim();
    const amount = parseFloat(fields[2].replace(/[,$"]/g, ''));
    if (isNaN(amount)) {
      errors.push(`Line ${i + 2}: invalid amount "${fields[2]}"`);
      continue;
    }

    const balance =
      fields[3] !== undefined
        ? parseFloat(fields[3].replace(/[,$"]/g, ''))
        : undefined;

    transactions.push({
      date,
      description,
      amount: -amount,
      balance: balance && !isNaN(balance) ? balance : undefined,
    });
  }

  return { transactions, errors };
}

function parseChase(lines: string[]): {
  transactions: ParsedTransaction[];
  errors: string[];
} {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const fields = splitCSVLine(lines[i]);
    if (fields.length < 6) {
      errors.push(
        `Line ${i + 2}: expected at least 6 fields, got ${fields.length}`
      );
      continue;
    }

    const date = parseDateMMDDYYYY(fields[0]);
    if (!date) {
      errors.push(`Line ${i + 2}: invalid date "${fields[0]}"`);
      continue;
    }

    const description = fields[2].replace(/^["']|["']$/g, '').trim();
    const category = fields[3].replace(/^["']|["']$/g, '').trim();
    const type = fields[4].replace(/^["']|["']$/g, '').trim();
    const amount = parseFloat(fields[5].replace(/[,$"]/g, ''));
    if (isNaN(amount)) {
      errors.push(`Line ${i + 2}: invalid amount "${fields[5]}"`);
      continue;
    }

    transactions.push({
      date,
      description,
      amount: -amount,
      category: category || undefined,
      type: type || undefined,
    });
  }

  return { transactions, errors };
}

function parseGeneric(
  lines: string[],
  headers: string[]
): { transactions: ParsedTransaction[]; errors: string[] } {
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  const normalized = normalizeHeaders(headers);

  const dateIdx = normalized.findIndex((h) => h.includes('date'));
  const descIdx = normalized.findIndex(
    (h) =>
      h.includes('description') ||
      h.includes('memo') ||
      h.includes('name') ||
      h.includes('payee')
  );
  const amountIdx = normalized.findIndex(
    (h) => h.includes('amount') || h.includes('value')
  );

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    errors.push(
      `Could not identify required columns. Found headers: ${headers.join(', ')}. Need: date, description, amount.`
    );
    return { transactions, errors };
  }

  for (let i = 0; i < lines.length; i++) {
    const fields = splitCSVLine(lines[i]);

    const dateRaw = fields[dateIdx]?.replace(/^["']|["']$/g, '').trim();
    const date = parseDateMMDDYYYY(dateRaw || '');
    if (!date) {
      errors.push(`Line ${i + 2}: invalid date "${dateRaw}"`);
      continue;
    }

    const description =
      fields[descIdx]?.replace(/^["']|["']$/g, '').trim() || '';
    const amount = parseFloat((fields[amountIdx] || '').replace(/[,$"]/g, ''));
    if (isNaN(amount)) {
      errors.push(`Line ${i + 2}: invalid amount "${fields[amountIdx]}"`);
      continue;
    }

    transactions.push({
      date,
      description,
      amount: -amount,
    });
  }

  return { transactions, errors };
}

export function parseCSV(
  content: string,
  bankOverride?: BankFormat
): ParseResult {
  const rawLines = content.split(/\r?\n/).filter((l) => l.trim());
  if (rawLines.length < 2) {
    return {
      format: 'generic',
      transactions: [],
      errors: ['CSV file is empty or has no data rows'],
    };
  }

  const headerFields = splitCSVLine(rawLines[0]);
  const format = bankOverride || detectBankFormat(headerFields);
  const dataLines = rawLines.slice(1);

  switch (format) {
    case 'bofa':
      return { format, ...parseBofA(dataLines) };
    case 'chase':
      return { format, ...parseChase(dataLines) };
    default:
      return { format, ...parseGeneric(dataLines, headerFields) };
  }
}

export function formatBankLabel(bank: BankFormat): string {
  switch (bank) {
    case 'bofa':
      return 'Bank of America';
    case 'chase':
      return 'Chase';
    default:
      return 'Generic CSV';
  }
}
