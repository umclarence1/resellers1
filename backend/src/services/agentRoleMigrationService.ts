import mongoose from 'mongoose';
import { User } from '../models/User';

/**
 * One-time idempotent migration: dealer → agent terminology in MongoDB.
 */
export async function migrateDealerToAgent(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  const users = db.collection('users');
  const orders = db.collection('orders');
  const packages = db.collection('packages');
  const apiLogs = db.collection('apilogs');

  const roleResult = await users.updateMany({ role: 'dealer' }, { $set: { role: 'agent' } });
  if (roleResult.modifiedCount > 0) {
    console.log(`Migration: updated ${roleResult.modifiedCount} user role(s) dealer → agent`);
  }

  const renameApi = await users.updateMany(
    { dealerApi: { $exists: true }, agentApi: { $exists: false } },
    { $rename: { dealerApi: 'agentApi' } }
  );
  if (renameApi.modifiedCount > 0) {
    console.log(`Migration: renamed dealerApi → agentApi on ${renameApi.modifiedCount} user(s)`);
  }

  const cleanupApi = await users.updateMany(
    { dealerApi: { $exists: true }, agentApi: { $exists: true } },
    { $unset: { dealerApi: '' } }
  );
  if (cleanupApi.modifiedCount > 0) {
    console.log(`Migration: removed legacy dealerApi on ${cleanupApi.modifiedCount} user(s)`);
  }

  const renameOrderAgent = await orders.updateMany(
    { dealerId: { $exists: true }, agentId: { $exists: false } },
    { $rename: { dealerId: 'agentId' } }
  );
  if (renameOrderAgent.modifiedCount > 0) {
    console.log(`Migration: renamed dealerId → agentId on ${renameOrderAgent.modifiedCount} order(s)`);
  }

  await orders.updateMany(
    { dealerId: { $exists: true }, agentId: { $exists: true } },
    { $unset: { dealerId: '' } }
  );

  const sourceDealer = await orders.updateMany({ source: 'dealer' }, { $set: { source: 'agent' } });
  if (sourceDealer.modifiedCount > 0) {
    console.log(`Migration: updated ${sourceDealer.modifiedCount} order source dealer → agent`);
  }

  const sourceDealerApi = await orders.updateMany(
    { source: 'dealer_api' },
    { $set: { source: 'agent_api' } }
  );
  if (sourceDealerApi.modifiedCount > 0) {
    console.log(`Migration: updated ${sourceDealerApi.modifiedCount} order source dealer_api → agent_api`);
  }

  const renamePrice = await packages.updateMany(
    { dealerPrice: { $exists: true }, agentPrice: { $exists: false } },
    { $rename: { dealerPrice: 'agentPrice' } }
  );
  if (renamePrice.modifiedCount > 0) {
    console.log(`Migration: renamed dealerPrice → agentPrice on ${renamePrice.modifiedCount} package(s)`);
  }

  await packages.updateMany(
    { dealerPrice: { $exists: true }, agentPrice: { $exists: true } },
    { $unset: { dealerPrice: '' } }
  );

  const renameLogAgent = await apiLogs.updateMany(
    { dealerId: { $exists: true }, agentId: { $exists: false } },
    { $rename: { dealerId: 'agentId' } }
  );
  if (renameLogAgent.modifiedCount > 0) {
    console.log(`Migration: renamed dealerId → agentId on ${renameLogAgent.modifiedCount} API log(s)`);
  }

  await apiLogs.updateMany(
    { dealerId: { $exists: true }, agentId: { $exists: true } },
    { $unset: { dealerId: '' } }
  );

  void User.findOne({ role: 'agent' });
}
