import { AppError } from '../middleware/errorHandler';
import { AFA_DEFAULT_IMAGE } from '../config/afa';
import { getSettings } from './settingsService';

export type AfaStockRow = {
  inStock: boolean;
  imageUrl: string;
};

export async function getAfaStock(): Promise<AfaStockRow> {
  const settings = await getSettings();
  return {
    inStock: settings.afaSettings?.inStock ?? true,
    imageUrl: settings.afaSettings?.imageUrl || AFA_DEFAULT_IMAGE,
  };
}

export async function isAfaInStock(): Promise<boolean> {
  const row = await getAfaStock();
  return row.inStock;
}

export async function assertAfaInStock(): Promise<void> {
  if (!(await isAfaInStock())) {
    throw new AppError('MTN AFA registration is currently out of stock. Please try again later.', 503);
  }
}

export async function setAfaStock(inStock: boolean): Promise<AfaStockRow> {
  const settings = await getSettings();
  if (!settings.afaSettings) {
    settings.afaSettings = { inStock, imageUrl: AFA_DEFAULT_IMAGE };
  } else {
    settings.afaSettings.inStock = inStock;
    if (!settings.afaSettings.imageUrl) {
      settings.afaSettings.imageUrl = AFA_DEFAULT_IMAGE;
    }
  }
  settings.markModified('afaSettings');
  await settings.save();
  return getAfaStock();
}
