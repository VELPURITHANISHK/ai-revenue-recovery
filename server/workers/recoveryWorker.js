/**
 * recoveryWorker.js — Phase 5
 *
 * BullMQ Worker: listens on the "recovery" queue and processes jobs.
 *
 * For every job:
 *  1. Read paymentId from job data
 *  2. Check if payment is already CAPTURED → stop & mark RECOVERED
 *  3. If still failed → enforce safety limits
 *  4. Ask AI for next action
 *  5. Execute the tool
 *  6. Schedule another CHECK_PAYMENT after the AI's recommended delay
 *
 * The worker runs as either:
 *  - Part of the main server (embedded mode, for simplicity)
 *  - A standalone process: node workers/recoveryWorker.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { Worker }             = require('bullmq');
const { redisConnection }    = require('../config/redis');
const { runAgent }           = require('../agent/agent');
const { executeToolCall }    = require('../agent/toolExecutor');
const { scheduleNextAction, cancelPendingJobs } = require('../services/automationService');
const { getCustomerContext } = require('../services/recoveryService');
const { EcomPayment, EcomOrder } = require('../models/EcomModels');
const RecoveryAttempt        = require('../models/RecoveryAttempt');

// ─── Safety limits ────────────────────────────────────────────────────────────
const MAX_RECOVERY_ATTEMPTS = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const countExecuted = async (paymentId) =>
  RecoveryAttempt.countDocuments({ paymentId, status: 'executed' });

// ─── Worker processor ─────────────────────────────────────────────────────────
const processJob = async (job) => {
  const { paymentId, action, attemptNumber = 1 } = job.data;

  console.log(`\n[Worker] ─── Job #${job.id} ─── action=${action} payment=${paymentId} attempt=${attemptNumber}`);

  // Connect MongoDB if running standalone
  if (require('mongoose').connection.readyState === 0) {
    await require('mongoose').connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce_db');
    console.log('[Worker] MongoDB connected (standalone mode)');
  }

    // ── 1. Check if already paid ───────────────────────────────────────────────
  const payment = await EcomPayment.findById(paymentId).lean();
  if (!payment) {
    console.log(`[Worker] Payment ${paymentId} not found — skipping`);
    return { status: 'payment_not_found' };
  }

  const RecoveryCase = require('../models/RecoveryCase');
  const recCase = await RecoveryCase.findOne({ paymentId });

  if (recCase && ['STOPPED', 'ESCALATED', 'RECOVERED'].includes(recCase.status)) {
    console.log(`[Worker] Case ${paymentId} is ${recCase.status} — skipping job`);
    await cancelPendingJobs(paymentId);
    return { status: `skipped_${recCase.status.toLowerCase()}` };
  }

  if (payment.status === 'CAPTURED') {
    console.log(`[Worker] ✓ Payment ${paymentId} already CAPTURED — marking RECOVERED`);

    await cancelPendingJobs(paymentId);

    const lastAttempt = await RecoveryAttempt.findOne({ paymentId }).sort({ createdAt: -1 });
    if (lastAttempt?.orderId) {
      await EcomOrder.findByIdAndUpdate(lastAttempt.orderId, { recoveryStatus: 'RECOVERED' });
    }

    await RecoveryAttempt.create({
      paymentId,
      orderId:    lastAttempt?.orderId,
      userId:     lastAttempt?.userId,
      decision:   'STOP_RECOVERY',
      status:     'successful',
      reason:     'Payment captured — recovery successful',
      result:     { recovered: true, recoveredAt: new Date() },
      executedAt: new Date(),
    });

    if (recCase) {
      recCase.status = 'RECOVERED';
      recCase.recoveredAt = new Date();
      recCase.recoveredAmount = payment.amount;
      await recCase.save();
    }

    return { status: 'recovered' };
  }

  // ── 2. Safety ceiling ─────────────────────────────────────────────────────
  const executedCount = await countExecuted(paymentId);
  if (executedCount >= MAX_RECOVERY_ATTEMPTS) {
    console.warn(`[Worker] Max recovery attempts (${MAX_RECOVERY_ATTEMPTS}) reached for ${paymentId} — stopping`);
    await executeToolCall('stopRecovery', {
      paymentId,
      reason: `Safety limit: ${MAX_RECOVERY_ATTEMPTS} recovery attempts already made.`,
    });
    await cancelPendingJobs(paymentId);
    return { status: 'safety_limit_reached' };
  }

  // ── 3. If job is CHECK_PAYMENT — re-run AI for next decision ──────────────
  if (action === 'CHECK_PAYMENT') {
    console.log(`[Worker] Payment still unpaid — asking AI for follow-up decision...`);
    const context = await getCustomerContext(paymentId);

    let agentResult;
    try {
      agentResult = await runAgent(context);
    } catch (err) {
      console.error('[Worker] Agent error:', err.message);
      await RecoveryAttempt.create({
        paymentId,
        decision: 'STOP_RECOVERY',
        status:   'executed',
        reason:   `Worker agent error: ${err.message}`,
        result:   { success: false, error: err.message },
        executedAt: new Date(),
      });
      return { status: 'agent_error' };
    }

    const { analysis, toolResult } = agentResult;

    // Stop recovery if AI or safety rules say so
    if (['STOP_RECOVERY', 'stopRecovery'].includes(analysis?.decision) || toolResult?.status === 'STOPPED') {
      await cancelPendingJobs(paymentId);
      return { status: 'stopped_by_agent' };
    }

    // Stop if the tool was blocked (spam protection / limits reached)
    // toolResult.success === false with a reason means the backend rejected the action
    if (toolResult?.success === false) {
      const reason = toolResult.reason || toolResult.error || '';
      console.warn(`[Worker] Tool returned failure: "${reason}" — stopping loop`);

      // If max reminders reached → escalate to human
      if (toolResult.action === 'ESCALATE_TO_HUMAN') {
        await executeToolCall('escalateToHuman', { paymentId, reason });
      }
      // Otherwise just stop
      await cancelPendingJobs(paymentId);
      return { status: 'tool_blocked', reason };
    }

    // Schedule the next CHECK_PAYMENT
    const delay = analysis?.recommendedDelaySeconds || 10;
    await scheduleNextAction(paymentId, 'CHECK_PAYMENT', delay, attemptNumber + 1);
    console.log(`[Worker] Next CHECK_PAYMENT scheduled in ${delay}s`);

    return { status: 'agent_ran', decision: analysis?.decision };
  }

  // ── 4. Direct tool execution jobs (future use for scheduled actions) ───────
  console.log(`[Worker] Executing direct action: ${action}`);
  const toolName = {
    SEND_REMINDER:       'sendReminder',
    CREATE_PAYMENT_LINK: 'createPaymentLink',
    RETRY_PAYMENT:       'retryPayment',
    ESCALATE_TO_HUMAN:   'escalateToHuman',
    STOP_RECOVERY:       'stopRecovery',
  }[action];

  if (!toolName) {
    console.warn(`[Worker] Unknown action: ${action}`);
    return { status: 'unknown_action' };
  }

  const context = await getCustomerContext(paymentId);
  await executeToolCall(toolName, {
    paymentId,
    customerId: context.customer?.id,
    orderId:    context.order?.id,
    reason:     `Automated execution by worker (attempt ${attemptNumber})`,
  });

  // Schedule CHECK_PAYMENT to follow up
  const delay = parseInt(process.env.DEMO_MODE === 'true' ? 10 : 3600);
  await scheduleNextAction(paymentId, 'CHECK_PAYMENT', delay, attemptNumber + 1);

  return { status: 'tool_executed', action };
};

// ─── Worker factory ───────────────────────────────────────────────────────────
const startWorker = () => {
  const worker = new Worker('recovery', processJob, {
    connection:  redisConnection,
    concurrency: 5,
  });

  worker.on('completed', (job, result) => {
    console.log(`[Worker] ✓ Job #${job.id} (${job.name}) completed:`, result?.status);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] ✗ Job #${job?.id} failed:`, err.message);
  });

  let redisErrorLogged = false;
  worker.on('error', (err) => {
    if (!redisErrorLogged) {
      console.warn(`[Worker] Redis connection issue: ${err.message}`);
      console.warn('[Worker] Automated scheduling is disabled until Redis starts.');
      redisErrorLogged = true;
    }
  });

  console.log('[Worker] BullMQ recovery worker started (listening for jobs)');
  return worker;
};

// 📦 Standalone entrypoint
if (require.main === module) {
  console.log('Worker started');
  
  require('mongoose').connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce_db')
    .then(() => {
      console.log('MongoDB connected');
      
      // Wait for redis connection event or assume connected if ready
      if (redisConnection.status === 'ready') {
        console.log('Redis connected');
        startWorker();
        console.log('Recovery queue ready');
      } else {
        redisConnection.on('ready', () => {
          console.log('Redis connected');
          startWorker();
          console.log('Recovery queue ready');
        });
      }
    })
    .catch(err => {
      console.error('Failed to connect to MongoDB:', err.message);
      process.exit(1);
    });
}

module.exports = { startWorker };
