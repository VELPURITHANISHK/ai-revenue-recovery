/**
 * recoveryQueue.js
 *
 * BullMQ Queue — the single queue that holds all scheduled recovery jobs.
 * Imported by both the API server (to add jobs) and the worker (to consume them).
 */

const { Queue } = require('bullmq');
const { redisConnection } = require('../config/redis');

const QUEUE_NAME = 'recovery';

let recoveryQueue = null;

const getRecoveryQueue = () => {
  if (!recoveryQueue) {
    recoveryQueue = new Queue(QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail:     50,
        attempts:         3,                      // retry failed jobs up to 3×
        backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s
      },
    });
  }
  return recoveryQueue;
};

// Lazy proxy — safe to import even before Redis is ready
const recoveryQueueProxy = new Proxy({}, {
  get(_, prop) {
    return (...args) => {
      try {
        return getRecoveryQueue()[prop](...args);
      } catch (err) {
        console.warn(`[Queue] Redis unavailable — cannot call "${prop}": ${err.message}`);
        return Promise.resolve(null);
      }
    };
  },
});

module.exports = { recoveryQueue: recoveryQueueProxy, getRecoveryQueue, redisConnection };
