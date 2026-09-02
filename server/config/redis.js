/**
 * redis.js
 * Centralized Redis connection config for BullMQ.
 * All queues and workers import this instead of duplicating config.
 */

const parseRedisUrl = (url) => {
  try {
    const u = new URL(url || 'redis://localhost:6379');
    return {
      host:                  u.hostname || 'localhost',
      port:                  parseInt(u.port || '6379'),
      password:              u.password || undefined,
      maxRetriesPerRequest:  null,          // required by BullMQ
      retryStrategy:         (times) => Math.min(times * 500, 5000), // retry with backoff up to 5s
    };
  } catch {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null, retryStrategy: (times) => Math.min(times * 500, 5000) };
  }
};

const redisConnection = parseRedisUrl(process.env.REDIS_URL);

module.exports = { redisConnection };
