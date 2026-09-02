/**
 * automationService.js
 *
 * The only place that talks to BullMQ from the API side.
 * The AI agent and tools NEVER add jobs directly — they call scheduleNextAction().
 *
 * The backend controls ALL scheduling decisions.
 */

const { getRecoveryQueue } = require('../queues/recoveryQueue');
const RecoveryAttempt      = require('../models/RecoveryAttempt');

// ─── Delays ───────────────────────────────────────────────────────────────────
const DEMO_MODE   = process.env.DEMO_MODE === 'true';
const DEMO_DELAYS = {
  CHECK_PAYMENT:      10_000,  // 10 s
  SEND_REMINDER:      15_000,  // 15 s
  CREATE_PAYMENT_LINK:20_000,  // 20 s
  RETRY_PAYMENT:      15_000,  // 15 s
  ESCALATE_TO_HUMAN:  30_000,  // 30 s
};
const PROD_DELAYS = {
  CHECK_PAYMENT:      3_600_000,   // 1 h
  SEND_REMINDER:     14_400_000,   // 4 h
  CREATE_PAYMENT_LINK:28_800_000,  // 8 h
  RETRY_PAYMENT:      7_200_000,   // 2 h
  ESCALATE_TO_HUMAN: 86_400_000,   // 24 h
};

const getDelay = (action, overrideSeconds) => {
  if (overrideSeconds && overrideSeconds > 0) {
    return overrideSeconds * 1000;
  }
  return DEMO_MODE ? (DEMO_DELAYS[action] || 10_000) : (PROD_DELAYS[action] || 3_600_000);
};

// ─── Allowed actions ──────────────────────────────────────────────────────────
const ALLOWED_ACTIONS = [
  'SEND_REMINDER', 'CREATE_PAYMENT_LINK', 'RETRY_PAYMENT',
  'CHECK_PAYMENT', 'ESCALATE_TO_HUMAN', 'STOP_RECOVERY',
];

/**
 * scheduleNextAction
 * Adds a delayed job to the recovery queue.
 * Uses a deterministic job ID to prevent duplicates.
 *
 * @param {string} paymentId
 * @param {string} action        — one of ALLOWED_ACTIONS
 * @param {number} delaySeconds  — override delay in seconds (optional)
 * @param {number} attemptNumber — used for deduplication
 */
const scheduleNextAction = async (paymentId, action, delaySeconds, attemptNumber = 1) => {
  if (!ALLOWED_ACTIONS.includes(action)) {
    console.warn(`[Automation] Blocked attempt to schedule unknown action: "${action}"`);
    return null;
  }

  const delayMs = getDelay(action, delaySeconds);
  const jobId   = `${paymentId}_${action}_${attemptNumber}`;

  let queue;
  try {
    queue = getRecoveryQueue();
  } catch (err) {
    console.warn(`[Automation] Redis unavailable — cannot schedule ${action}: ${err.message}`);
    return null;
  }

  // Prevent exact duplicates
  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (['waiting', 'delayed', 'active'].includes(state)) {
      console.log(`[Automation] Job ${jobId} already ${state} — skipping duplicate`);
      return existing;
    }
  }

  const job = await queue.add(
    action,
    { paymentId, action, attemptNumber, scheduledAt: new Date().toISOString() },
    { jobId, delay: delayMs }
  );

  const runAt = new Date(Date.now() + delayMs);
  console.log(`[Automation] Scheduled ${action} for payment ${paymentId} — runs at ${runAt.toLocaleTimeString()} (job ${jobId})`);

  // Record the scheduled job in MongoDB so the UI can show "Next action in X seconds"
  await RecoveryAttempt.create({
    paymentId,
    decision:   action,
    status:     'scheduled',
    reason:     `Scheduled by automation — runs after ${delayMs / 1000}s`,
    result:     { jobId, runAt: runAt.toISOString(), delayMs },
    scheduledFor: runAt,
  });

  return job;
};

/**
 * cancelPendingJobs
 * Removes all pending BullMQ jobs for a given payment.
 */
const cancelPendingJobs = async (paymentId) => {
  let queue;
  try {
    queue = getRecoveryQueue();
  } catch {
    return;
  }

  const scheduled = await RecoveryAttempt.find({ paymentId, status: 'scheduled' }).lean();
  let cancelled = 0;
  
  // 1. Cancel via stored job IDs
  for (const attempt of scheduled) {
    const jobId = attempt.result?.jobId;
    if (jobId) {
      try {
        const job = await queue.getJob(jobId);
        if (job) { await job.remove(); cancelled++; }
      } catch { /* job already consumed */ }
    }
  }

  // 2. Deep clean: search all delayed/waiting jobs in BullMQ
  try {
    const jobs = await queue.getJobs(['delayed', 'waiting']);
    for (const job of jobs) {
      if (job.data?.paymentId === paymentId.toString()) {
        await job.remove();
        cancelled++;
      }
    }
  } catch (e) {
    console.warn('[Automation] Deep clean of BullMQ failed:', e.message);
  }

  await RecoveryAttempt.updateMany(
    { paymentId, status: 'scheduled' },
    { status: 'cancelled', executedAt: new Date() }
  );

  console.log(`[Automation] Cancelled ${cancelled} pending jobs for payment ${paymentId}`);
};

module.exports = { scheduleNextAction, cancelPendingJobs, ALLOWED_ACTIONS };
