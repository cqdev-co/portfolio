import { writeFile } from 'node:fs/promises';
import type { Report } from '../types.ts';

export async function writeJsonReport(
  path: string,
  report: Report
): Promise<void> {
  await writeFile(path, JSON.stringify(report, null, 2), 'utf8');
}
