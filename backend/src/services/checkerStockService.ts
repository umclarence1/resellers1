import { AppError } from '../middleware/errorHandler';
import {
  CHECKER_DEFAULT_IMAGE,
  CheckerType,
  checkerTypeLabel,
} from '../config/checker';
import { ResultChecker } from '../models/ResultChecker';
import { getSettings } from './settingsService';

export type CheckerStockRow = {
  type: CheckerType;
  inStock: boolean;
  imageUrl: string;
  availableCount: number;
  assignedCount: number;
};

function defaultCheckerSettings() {
  return {
    bece: { inStock: false, imageUrl: CHECKER_DEFAULT_IMAGE },
    wassce: { inStock: false, imageUrl: CHECKER_DEFAULT_IMAGE },
  };
}

async function ensureCheckerSettings() {
  const settings = await getSettings();
  if (!settings.checkerSettings) {
    settings.checkerSettings = defaultCheckerSettings();
    settings.markModified('checkerSettings');
    await settings.save();
  }
  return settings;
}

export async function getCheckerCounts(type: CheckerType) {
  const [availableCount, assignedCount] = await Promise.all([
    ResultChecker.countDocuments({ type, status: 'available' }),
    ResultChecker.countDocuments({ type, status: 'assigned' }),
  ]);
  return { availableCount, assignedCount };
}

export async function getCheckerStock(type: CheckerType): Promise<CheckerStockRow> {
  await ensureCheckerSettings();
  const settings = await getSettings();
  const row = settings.checkerSettings?.[type] ?? defaultCheckerSettings()[type];
  const counts = await getCheckerCounts(type);
  return {
    type,
    inStock: row.inStock && counts.availableCount > 0,
    imageUrl: row.imageUrl || CHECKER_DEFAULT_IMAGE,
    ...counts,
  };
}

export async function getAllCheckerStock(): Promise<CheckerStockRow[]> {
  return Promise.all([getCheckerStock('bece'), getCheckerStock('wassce')]);
}

export async function isCheckerInStock(type: CheckerType): Promise<boolean> {
  const row = await getCheckerStock(type);
  return row.inStock;
}

export async function assertCheckerInStock(type: CheckerType): Promise<void> {
  const row = await getCheckerStock(type);
  if (!row.inStock || row.availableCount === 0) {
    throw new AppError(
      `${checkerTypeLabel(type)} result checkers are currently out of stock. Please try again later.`,
      503
    );
  }
}

export async function syncCheckerStockAfterAssignment(type: CheckerType): Promise<void> {
  const counts = await getCheckerCounts(type);
  if (counts.availableCount === 0) {
    await setCheckerStock(type, false);
  }
}

export async function setCheckerStock(type: CheckerType, inStock: boolean): Promise<CheckerStockRow> {
  const settings = await ensureCheckerSettings();
  const counts = await getCheckerCounts(type);

  if (inStock && counts.availableCount === 0) {
    throw new AppError(`Cannot mark ${checkerTypeLabel(type)} in stock — no available checkers uploaded`);
  }

  if (!settings.checkerSettings) {
    settings.checkerSettings = defaultCheckerSettings();
  }
  settings.checkerSettings[type].inStock = inStock;
  if (!settings.checkerSettings[type].imageUrl) {
    settings.checkerSettings[type].imageUrl = CHECKER_DEFAULT_IMAGE;
  }
  settings.markModified('checkerSettings');
  await settings.save();
  return getCheckerStock(type);
}

export async function getCheckerSummary() {
  const stock = await getAllCheckerStock();
  return {
    bece: stock.find((s) => s.type === 'bece')!,
    wassce: stock.find((s) => s.type === 'wassce')!,
  };
}
