/**
 * recoveryController.js — Phase 4
 *
 * HTTP controllers for all recovery API endpoints.
 */

const recoveryService  = require('../services/recoveryService');
const { analyzePayment, runAgent } = require('../agent/agent');
const { scheduleNextAction, cancelPendingJobs } = require('../services/automationService');
const RecoveryAttempt  = require('../models/RecoveryAttempt');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const hasApiKey = () =>
  process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key';

// ─── GET /api/recovery/stats ──────────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    res.json(await recoveryService.getDashboardStats());
  } catch (err) {
    console.error('[Controller] getStats error:', err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
};

// ─── GET /api/recovery/failed-payments ───────────────────────────────────────
const getFailedPayments = async (req, res) => {
  try {
    res.json(await recoveryService.getFailedPayments());
  } catch (err) {
    console.error('[Controller] getFailedPayments error:', err);
    res.status(500).json({ message: 'Failed to fetch failed payments' });
  }
};

// ─── GET /api/recovery/cases ──────────────────────────────────────────────────
const getCases = async (req, res) => {
  try {
    res.json(await recoveryService.getRecoveryCases());
  } catch (err) {
    console.error('[Controller] getCases error:', err);
    res.status(500).json({ message: 'Failed to fetch cases' });
  }
};

// ─── GET /api/recovery/escalations ──────────────────────────────────────────────────
const getEscalations = async (req, res) => {
  try {
    res.json(await recoveryService.getEscalations());
  } catch (err) {
    console.error('[Controller] getEscalations error:', err);
    res.status(500).json({ message: 'Failed to fetch escalations' });
  }
};

// ─── GET /api/recovery/cases/:id ─────────────────────────────────────────────
const getCaseDetail = async (req, res) => {
  try {
    res.json(await recoveryService.getCaseDetail(req.params.id));
  } catch (err) {
    console.error('[Controller] getCaseDetail error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch case detail' });
  }
};

// ─── POST /api/recovery/:paymentId/analyze ────────────────────────────────────
// Phase 3: AI analysis → structured JSON decision only (no tool execution)
const analyzePaymentCtrl = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const context = await recoveryService.getCustomerContext(paymentId);

    if (context.payment.status !== 'FAILED') {
      return res.status(400).json({ message: 'Payment is not in FAILED status.' });
    }

    const analysis = await analyzePayment(context);

    // Update RecoveryCase status to ANALYZING so the pipeline funnel reflects it
    const recCase = await recoveryService.getOrCreateRecoveryCase(paymentId);
    if (recCase.status === 'PENDING') {
      recCase.status = 'ANALYZING';
      await recCase.save();
    }

    res.json({ success: true, analysis });
  } catch (err) {
    console.error('[Controller] analyzePayment error:', err);
    res.status(500).json({ message: 'AI Agent failed to analyze payment' });
  }
};

// ─── POST /api/recovery/:paymentId/start ──────────────────────────────────────
const startRecovery = async (req, res) => {
  try {
    const { paymentId } = req.params;
    console.log(`\n[Controller] startRecovery → paymentId=${paymentId}`);

    const context = await recoveryService.getCustomerContext(paymentId);

    if (context.payment.status !== 'FAILED') {
      return res.status(400).json({ message: 'Payment is not in FAILED status. Cannot start recovery.' });
    }

    const pending = await RecoveryAttempt.findOne({ paymentId, status: 'scheduled' });
    if (pending) {
      return res.status(409).json({
        message: 'Automated recovery is already running for this payment.',
        nextAction: pending.decision,
        scheduledFor: pending.scheduledFor,
      });
    }

    // Ensure RecoveryCase exists
    const recCase = await recoveryService.getOrCreateRecoveryCase(paymentId);

    const { analysis, toolName, toolResult } = await runAgent(context);

    // Save AI details to RecoveryCase
    if (analysis) {
      recCase.aiDecision = analysis.decision;
      recCase.aiReason = analysis.reason;
      recCase.aiConfidence = analysis.confidence;
      recCase.riskLevel = analysis.riskLevel;
      await recCase.save();
    }

    let scheduledJob = null;
    const shouldStop = ['STOP_RECOVERY', 'stopRecovery', 'ESCALATE_TO_HUMAN'].includes(toolName)
      || toolResult?.status === 'STOPPED';

    if (!shouldStop) {
      const delaySec = analysis?.recommendedDelaySeconds || 10;
      try {
        scheduledJob = await scheduleNextAction(paymentId, 'CHECK_PAYMENT', delaySec, 1);
      } catch (schedErr) {
        console.warn('[Controller] Could not schedule next check (Redis unavailable):', schedErr.message);
      }
    }

    res.json({
      success:       true,
      analysis,
      toolExecution: {
        tool:    toolName,
        status:  toolResult?.success ? 'SUCCESS' : 'FAILED',
        message: toolResult?.message || toolResult?.reason || toolResult?.error || 'Tool executed',
        data:    toolResult,
      },
      automation: {
        scheduled:   !!scheduledJob,
        nextAction:  scheduledJob ? 'CHECK_PAYMENT' : null,
        delaySeconds: analysis?.recommendedDelaySeconds || null,
        message:     scheduledJob
          ? `Next check in ${analysis?.recommendedDelaySeconds || 10}s (Redis active)`
          : 'Redis unavailable — automation disabled. Install Redis to enable scheduling.',
      },
    });
  } catch (err) {
    console.error('[Controller] startRecovery error:', err);
    res.status(500).json({ message: err.message || 'Recovery failed' });
  }
};

// ─── POST /api/recovery/:paymentId/stop ──────────────────────────────────────
const stopRecovery = async (req, res) => {
  try {
    const { paymentId } = req.params;

    await cancelPendingJobs(paymentId);

    await RecoveryAttempt.create({
      paymentId,
      decision:   'STOP_RECOVERY',
      reason:     'Manually stopped by user',
      status:     'executed',
      result:     { success: true, status: 'STOPPED', message: 'Recovery manually stopped.' },
      executedAt: new Date(),
    });

    const RecoveryCase = require('../models/RecoveryCase');
    const recCase = await RecoveryCase.findOne({ paymentId });
    if (recCase) {
      recCase.status = 'STOPPED';
      recCase.stoppedAt = new Date();
      await recCase.save();
    }

    res.json({ success: true, message: 'Recovery stopped and all pending jobs cancelled.' });
  } catch (err) {
    console.error('[Controller] stopRecovery error:', err);
    res.status(500).json({ message: 'Failed to stop recovery' });
  }
};

// ─── GET /api/recovery/:paymentId/activity ────────────────────────────────────
const getActivity = async (req, res) => {
  try {
    const attempts = await RecoveryAttempt
      .find({ paymentId: req.params.paymentId })
      .sort({ createdAt: 1 })
      .lean();
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch activity' });
  }
};

// ─── POST /api/recovery/:paymentId/simulate-success ───────────────────────────
const simulateSuccess = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { EcomPayment, EcomOrder } = require('../models/EcomModels');

    const payment = await EcomPayment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    payment.status = 'CAPTURED';
    payment.razorpayPaymentId = `pay_simulated_${Date.now()}`;
    await payment.save();

    if (payment.orderId) {
      await EcomOrder.findByIdAndUpdate(payment.orderId, { paymentStatus: 'PAID', status: 'PROCESSING', recoveryStatus: 'RECOVERED' });
    }

    await cancelPendingJobs(paymentId);

    await RecoveryAttempt.create({
      paymentId,
      orderId:    payment.orderId,
      userId:     payment.userId,
      decision:   'STOP_RECOVERY',
      status:     'successful',
      reason:     'Payment captured — recovery successful (Simulated)',
      result:     { recovered: true, recoveredAt: new Date() },
      executedAt: new Date(),
    });

    const RecoveryCase = require('../models/RecoveryCase');
    const recCase = await RecoveryCase.findOne({ paymentId });
    if (recCase) {
      recCase.status = 'RECOVERED';
      recCase.recoveredAt = new Date();
      recCase.recoveredAmount = payment.amount;
      await recCase.save();
    }

    res.json({ success: true, message: 'Simulated webhook payment success!' });
  } catch (err) {
    console.error('[Controller] simulateSuccess error:', err);
    res.status(500).json({ message: 'Failed to simulate success' });
  }
};

// ─── POST /api/recovery/reset-demo ────────────────────────────────────────────
const resetDemo = async (req, res) => {
  try {
    if (process.env.DEMO_MODE !== 'true') {
      return res.status(403).json({ message: 'Reset is only available in DEMO_MODE' });
    }

    const { EcomOrder } = require('../models/EcomModels');
    
    // 1. Clear recovery collections
    const RecoveryCase = require('../models/RecoveryCase');
    await RecoveryCase.deleteMany({});
    await RecoveryAttempt.deleteMany({});
    
    // 2. Cancel all pending jobs in BullMQ Redis
    try {
      const { recoveryQueue } = require('../services/automationService');
      if (recoveryQueue) {
        await recoveryQueue.obliterate({ force: true });
        console.log('[Controller] BullMQ obliterate successful.');
      }
    } catch (e) {
      console.warn('[Controller] BullMQ obliterate failed/unavailable:', e.message);
    }
    
    // 3. Reset EcomOrders recoveryStatus
    await EcomOrder.updateMany({}, { $set: { recoveryStatus: 'PENDING' } });

    console.log('[Controller] Demo environment reset successfully.');
    res.json({ success: true, message: 'Recovery cases and attempts cleared.' });
  } catch (err) {
    console.error('[Controller] resetDemo error:', err);
    res.status(500).json({ message: 'Failed to reset demo data' });
  }
};

// ─── GET /api/recovery/activity ───────────────────────────────────────────────────
const getGlobalActivity = async (req, res) => {
  try {
    const RecoveryAttempt = require('../models/RecoveryAttempt');
    const activities = await RecoveryAttempt.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('paymentId', 'amount currency status')
      .populate('userId', 'name')
      .lean();
    res.json({ success: true, activities });
  } catch (err) {
    console.error('Error fetching global activity:', err);
    res.status(500).json({ message: 'Error fetching activity' });
  }
};

module.exports = {
  getStats,
  getFailedPayments,
  getCases,
  getEscalations,
  getCaseDetail,
  analyzePayment: analyzePaymentCtrl,
  startRecovery,
  stopRecovery,
  getActivity,
  simulateSuccess,
  resetDemo,
  getGlobalActivity,
};
