import mongoose from 'mongoose';

/**
 * Runs a callback inside a MongoDB replica-set transaction.
 * Falls back to non-transactional execution when transactions are unavailable (e.g. standalone dev Mongo).
 */
export async function withMongoTransaction<T>(
  fn: (session: mongoose.ClientSession | null) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    try {
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result as T;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const noTxn =
        message.includes('Transaction numbers are only allowed') ||
        message.includes('replica set member') ||
        message.includes('not supported');
      if (noTxn) {
        return fn(null);
      }
      throw err;
    }
  } finally {
    await session.endSession();
  }
}

export function sessionOpts(session: mongoose.ClientSession | null | undefined) {
  return session ? { session } : {};
}
