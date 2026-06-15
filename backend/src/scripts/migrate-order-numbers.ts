/**
 * One-off migration for legacy orders missing orderNumber.
 *
 * Usage:
 *   npm run migrate:order-numbers
 */
import 'dotenv/config';
import { connectDB } from '../config/db';
import { migrateOrderNumbers } from '../services/orderMigrationService';
import { Order } from '../models/Order';

const missingFilter = {
  $or: [
    { orderNumber: null },
    { orderNumber: { $exists: false } },
    { orderNumber: '' },
  ],
};

async function main() {
  await connectDB();

  const before = await Order.collection.countDocuments(missingFilter);
  console.log(`Orders missing orderNumber before migration: ${before}`);

  await migrateOrderNumbers();

  const after = await Order.collection.countDocuments(missingFilter);
  console.log(`Orders missing orderNumber after migration: ${after}`);
  console.log('Migration complete.');
  process.exit(after === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
