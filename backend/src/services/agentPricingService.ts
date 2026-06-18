import mongoose from 'mongoose';
import { Package, IPackage } from '../models/Package';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { validatePackagePrices } from './settingsService';

export async function getAgentPrice(
  agentId: mongoose.Types.ObjectId | string,
  packageId: mongoose.Types.ObjectId | string,
  pkg: Pick<IPackage, 'agentPrice'>
): Promise<number> {
  const agent = await User.findById(agentId);
  if (!agent?.agentApi?.customPrices) return pkg.agentPrice;

  const customPrice = agent.agentApi.customPrices.get(packageId.toString());
  return customPrice ?? pkg.agentPrice;
}

export function validateAgentCustomPrice(
  price: number,
  pkg: Pick<IPackage, 'costPrice' | 'maxSellingPrice'>
): void {
  validatePackagePrices({
    costPrice: pkg.costPrice,
    agentPrice: price,
    maxSellingPrice: pkg.maxSellingPrice,
  });
  if (price > pkg.maxSellingPrice) {
    throw new AppError('Agent price cannot exceed max selling price');
  }
}

export async function setAgentCustomPrice(
  agentId: string,
  packageId: string,
  price: number | null
): Promise<void> {
  const [agent, pkg] = await Promise.all([
    User.findOne({ _id: agentId, role: 'agent' }),
    Package.findById(packageId),
  ]);

  if (!agent) throw new AppError('Agent not found', 404);
  if (!pkg) throw new AppError('Package not found', 404);

  if (!agent.agentApi) {
    throw new AppError('Agent API profile not found', 400);
  }

  if (!agent.agentApi.customPrices) {
    agent.agentApi.customPrices = new Map();
  }

  if (price === null) {
    agent.agentApi.customPrices.delete(packageId);
  } else {
    validateAgentCustomPrice(price, pkg);
    agent.agentApi.customPrices.set(packageId, price);
  }

  agent.markModified('agentApi.customPrices');
  await agent.save();
}

export async function clearAgentCustomPrices(agentId: string): Promise<number> {
  const agent = await User.findOne({ _id: agentId, role: 'agent' });
  if (!agent) throw new AppError('Agent not found', 404);
  if (!agent.agentApi?.customPrices) return 0;

  const count = agent.agentApi.customPrices.size;
  agent.agentApi.customPrices = new Map();
  agent.markModified('agentApi.customPrices');
  await agent.save();
  return count;
}
