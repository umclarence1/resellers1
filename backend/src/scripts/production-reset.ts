/**
 * Wipe transactional / financial test data before production launch.
 *
 * Usage:
 *   CONFIRM_PRODUCTION_RESET=yes npm run reset:production
 *   CONFIRM_PRODUCTION_RESET=yes npm run reset:production -- --remove-users
 */
import dotenv from 'dotenv';
import { connectAndReset } from '../services/productionResetService';

dotenv.config();

const uri = process.env.MONGODB_URI;
const confirmed = process.env.CONFIRM_PRODUCTION_RESET === 'yes';
const removeUsers = process.argv.includes('--remove-users');

async function main() {
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }
  if (!confirmed) {
    console.error('Set CONFIRM_PRODUCTION_RESET=yes to run this destructive reset.');
    process.exit(1);
  }

  console.log('Resetting platform data...');
  if (removeUsers) console.log('Also removing all non-admin users.');

  const summary = await connectAndReset(uri, { removeNonAdminUsers: removeUsers });
  console.log(JSON.stringify(summary, null, 2));
  console.log('Production reset complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
