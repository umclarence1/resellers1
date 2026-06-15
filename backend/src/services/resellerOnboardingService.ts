import type { IUser } from '../models/User';

export function activateResellerStore(user: IUser): void {
  if (user.role !== 'reseller' || !user.resellerStore) return;
  if (user.status === 'suspended') return;
  if (user.status === 'pending') user.status = 'active';
  user.resellerStore.isActive = true;
}
