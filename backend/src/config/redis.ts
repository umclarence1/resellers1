import Redis from 'ioredis';
import { env } from './env';

let client: Redis | null = null;
let connectAttempted = false;

/** Shared Redis client for rate limiting. Returns null when REDIS_URL is not configured. */
export function getRedisClient(): Redis | null {
  if (!env.redisUrl) return null;
  if (client) return client;
  if (connectAttempted) return null;

  connectAttempted = true;
  try {
    client = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    client.on('error', (err) => {
      console.error('Redis error:', err.message);
    });
    void client.connect().catch((err) => {
      console.error('Redis connect failed — using in-memory rate limits:', err.message);
      client = null;
    });
    return client;
  } catch (err) {
    console.error('Redis init failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
