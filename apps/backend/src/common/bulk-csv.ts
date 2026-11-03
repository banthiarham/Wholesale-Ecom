import { BadRequestException } from '@nestjs/common';

/** One CSV cell, quoted when it holds a comma, quote or line break. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV text (with a UTF-8 BOM so Excel shows ₹ and other non-ASCII characters correctly). */
export function toCsv(headers: string[], rows: Record<string, unknown>[]): Buffer {
  const lines = [headers.map(cell).join(',')];
  for (const row of rows) lines.push(headers.map((h) => cell(row[h])).join(','));
  return Buffer.from('﻿' + lines.join('\r\n') + '\r\n', 'utf8');
}

/** Header text reduced to lower-case letters and digits, so "Unit Price (Rs.)" and "unitPrice" compare alike. */
export const normKey = (h: string) => String(h).toLowerCase().replace(/[^a-z0-9]/g, '');

export interface ParsedSheet {
  /** Original header text, in column order. */
  headers: string[];
  /** One entry per data row: normalised header -> trimmed text (always strings, never numbers). */
  rows: { rowNumber: number; get: (...names: string[]) => string | undefined; raw: Record<string, string> }[];
}

/** Reads an uploaded CSV / Excel file; every value is kept as text so ids, SKUs and phone numbers are never mangled. */
export async function parseSheet(buffer: Buffer): Promise<ParsedSheet> {
  const XLSX = await import('xlsx');
  let records: Record<string, unknown>[];
  let headers: string[] = [];
  try {
    const wb = XLSX.read(buffer, { type: 'buffer', raw: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
    headers = (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })[0] || []).map((h) => String(h));
  } catch {
    throw new BadRequestException('Unable to read the uploaded file. Upload the CSV you exported (or an Excel file).');
  }
  if (records.length === 0) throw new BadRequestException('The file has no data rows');
  if (records.length > 20000) throw new BadRequestException('A maximum of 20,000 rows can be imported at once');

  const rows = records.map((rec, i) => {
    const byKey = new Map<string, string>();
    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec)) {
      const text = String(v ?? '').trim();
      byKey.set(normKey(k), text);
      raw[k] = text;
    }
    return {
      rowNumber: i + 2,
      raw,
      // First name that exists as a column wins; undefined means "this column is not in the file".
      get: (...names: string[]) => {
        for (const n of names) {
          const key = normKey(n);
          if (byKey.has(key)) return byKey.get(key);
        }
        return undefined;
      },
    };
  });
  return { headers, rows };
}

/** Text -> number, or undefined for an empty cell, or NaN for something that is not a number. */
export function toNumber(text: string | undefined): number | undefined {
  if (text === undefined || text === '') return undefined;
  const n = Number(text.replace(/[₹,\s]/g, '').replace(/^Rs\.?/i, ''));
  return Number.isFinite(n) ? n : NaN;
}

export const toBool = (text: string | undefined): boolean | undefined => {
  if (text === undefined || text === '') return undefined;
  const t = text.toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(t)) return true;
  if (['false', 'no', 'n', '0'].includes(t)) return false;
  return undefined;
};

/** Cell value meaning "clear this field". */
export const isClear = (text: string | undefined) => text === '-';
