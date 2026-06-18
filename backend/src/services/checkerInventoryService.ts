import crypto from 'crypto';
import * as XLSX from 'xlsx';
import { AppError } from '../middleware/errorHandler';
import { CheckerType } from '../config/checker';
import { ResultChecker } from '../models/ResultChecker';

export type CheckerUploadResult = {
  imported: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  uploadBatchId: string;
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => h === candidate || h.includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseRow(row: unknown[], serialIdx: number, pinIdx: number): { serial: string; pin: string } | null {
  const serial = String(row[serialIdx] ?? '').trim();
  const pin = String(row[pinIdx] ?? '').trim();
  if (!serial || !pin) return null;
  return { serial, pin };
}

export function parseCheckerExcel(buffer: Buffer): Array<{ serial: string; pin: string }> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new AppError('Excel file has no sheets');
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][];
  if (rows.length < 2) {
    throw new AppError('Excel file must contain a header row and at least one data row');
  }

  const headers = (rows[0] || []).map(normalizeHeader);
  const serialIdx = findColumnIndex(headers, ['serial', 'serialnumber', 'serialno', 's/n']);
  const pinIdx = findColumnIndex(headers, ['pin', 'pincode', 'pinnumber']);

  if (serialIdx < 0 || pinIdx < 0) {
    throw new AppError('Excel must have Serial and PIN columns in the first row');
  }

  const parsed: Array<{ serial: string; pin: string }> = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const item = parseRow(row, serialIdx, pinIdx);
    if (item) parsed.push(item);
  }
  return parsed;
}

export async function importCheckerInventory(
  type: CheckerType,
  buffer: Buffer
): Promise<CheckerUploadResult> {
  const rows = parseCheckerExcel(buffer);
  if (rows.length === 0) {
    throw new AppError('No valid checker rows found in file');
  }

  const uploadBatchId = `CHK-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  let imported = 0;
  let skippedDuplicates = 0;
  let skippedInvalid = 0;

  const existingSerials = new Set(
    (
      await ResultChecker.find({ type, serial: { $in: rows.map((r) => r.serial) } }).select('serial')
    ).map((d) => d.serial)
  );

  const seenInFile = new Set<string>();
  const toInsert: Array<{ type: CheckerType; serial: string; pin: string; uploadBatchId: string }> = [];

  for (const row of rows) {
    if (!row.serial || !row.pin) {
      skippedInvalid++;
      continue;
    }
    if (seenInFile.has(row.serial) || existingSerials.has(row.serial)) {
      skippedDuplicates++;
      continue;
    }
    seenInFile.add(row.serial);
    toInsert.push({
      type,
      serial: row.serial,
      pin: row.pin,
      uploadBatchId,
    });
  }

  if (toInsert.length > 0) {
    try {
      const result = await ResultChecker.insertMany(toInsert, { ordered: false });
      imported = result.length;
    } catch (err) {
      const bulkErr = err as { insertedDocs?: unknown[]; writeErrors?: unknown[] };
      if (bulkErr.insertedDocs) {
        imported = bulkErr.insertedDocs.length;
        skippedDuplicates += (bulkErr.writeErrors?.length ?? 0);
      } else {
        throw err;
      }
    }
  }

  return { imported, skippedDuplicates, skippedInvalid, uploadBatchId };
}

export function maskSerial(serial: string): string {
  if (serial.length <= 4) return '****';
  return `${serial.slice(0, 2)}****${serial.slice(-2)}`;
}
