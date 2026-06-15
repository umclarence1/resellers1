import { Order } from '../models/Order';
import { generateOrderNumber } from '../utils/helpers';

const MISSING_ORDER_NUMBER_FILTER = {
  $or: [
    { orderNumber: null },
    { orderNumber: { $exists: false } },
    { orderNumber: '' },
  ],
};

/** Backfill legacy documents missing orderNumber before the sparse unique index is applied. */
export async function backfillOrderNumbers(): Promise<{ updated: number; remaining: number }> {
  const cursor = Order.collection.find(MISSING_ORDER_NUMBER_FILTER);
  let updated = 0;

  for await (const doc of cursor) {
    const existingId =
      typeof doc.orderId === 'string' && doc.orderId.trim() ? doc.orderId.trim() : '';
    const orderNumber = existingId || generateOrderNumber();
    const orderId = existingId || orderNumber;

    await Order.collection.updateOne(
      { _id: doc._id },
      { $set: { orderNumber, orderId } }
    );
    updated += 1;
  }

  const remaining = await Order.collection.countDocuments(MISSING_ORDER_NUMBER_FILTER);

  if (updated > 0) {
    console.log(`Backfilled orderNumber on ${updated} order(s)`);
  }
  if (remaining > 0) {
    console.warn(`${remaining} order(s) still missing orderNumber after backfill`);
  }

  return { updated, remaining };
}

/**
 * Replace a non-sparse unique orderNumber index (which rejects multiple nulls)
 * with a sparse unique index.
 */
export async function ensureOrderNumberIndexes(): Promise<void> {
  const collection = Order.collection;
  const indexes = await collection.indexes();
  const orderNumberIndex = indexes.find((idx) => idx.name === 'orderNumber_1');

  if (orderNumberIndex && !orderNumberIndex.sparse) {
    await collection.dropIndex('orderNumber_1');
    console.log('Dropped non-sparse orderNumber_1 index');
  }

  const refreshed = await collection.indexes();
  const hasSparseUnique = refreshed.some(
    (idx) =>
      idx.name === 'orderNumber_1' &&
      idx.unique === true &&
      idx.sparse === true
  );

  if (!hasSparseUnique) {
    await collection.createIndex({ orderNumber: 1 }, { unique: true, sparse: true });
    console.log('Created sparse unique index on orderNumber');
  }
}

export async function migrateOrderNumbers(): Promise<void> {
  await backfillOrderNumbers();
  await ensureOrderNumberIndexes();
}
