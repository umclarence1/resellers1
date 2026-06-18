import { isMongoDuplicateKeyError } from '../utils/mongoErrors';

/**
 * Run a startup step without taking down the API on benign duplicate-key races
 * (common on serverless cold starts when seed runs concurrently).
 */
export async function safeStartupStep(
  label: string,
  fn: () => Promise<void>,
  options?: { critical?: boolean }
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    if (isMongoDuplicateKeyError(err)) {
      console.warn(`Startup ${label}: duplicate key — continuing (${label} already applied)`);
      return;
    }
    console.error(`Startup ${label} failed:`, err);
    if (options?.critical) throw err;
  }
}
