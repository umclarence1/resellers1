import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkerTypeFromBundle,
  isCheckerProduct,
  bundleSizeFromCheckerType,
} from '../config/checker.js';
import { parseCheckerExcel, maskSerial } from '../services/checkerInventoryService.js';
import * as XLSX from 'xlsx';

test('isCheckerProduct detects checker packages', () => {
  assert.equal(isCheckerProduct('checker', 'BECE'), true);
  assert.equal(isCheckerProduct('data', '1GB'), false);
  assert.equal(isCheckerProduct(undefined, 'WASSCE'), true);
});

test('checkerTypeFromBundle maps bundle sizes', () => {
  assert.equal(checkerTypeFromBundle('BECE'), 'bece');
  assert.equal(checkerTypeFromBundle('WASSCE'), 'wassce');
  assert.equal(checkerTypeFromBundle('1GB'), null);
});

test('bundleSizeFromCheckerType maps types', () => {
  assert.equal(bundleSizeFromCheckerType('bece'), 'BECE');
  assert.equal(bundleSizeFromCheckerType('wassce'), 'WASSCE');
});

test('parseCheckerExcel reads Serial and PIN columns', () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Serial', 'PIN'],
    ['ABC123', '999888'],
    ['DEF456', '777666'],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  const rows = parseCheckerExcel(buffer);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { serial: 'ABC123', pin: '999888' });
});

test('parseCheckerExcel skips empty rows', () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Serial', 'PIN'],
    ['ABC123', '999888'],
    ['', ''],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

  const rows = parseCheckerExcel(buffer);
  assert.equal(rows.length, 1);
});

test('maskSerial hides middle digits', () => {
  assert.equal(maskSerial('1234567890'), '12****90');
});
