/**
 * recoveryService.js
 *
 * Core service layer utilizing RecoveryCase and RecoveryAttempt models.
 */

const { EcomPayment, EcomOrder, EcomUser } = require('../models/EcomModels');
const RecoveryAttempt = require('../models/RecoveryAttempt');
const RecoveryCase = require('../models/RecoveryCase');

const getCustomerContext = async (paymentId) => {
  const payment = await EcomPayment.findById(paymentId).lean();
  if (!payment) throw new Error('Payment not found');

  const order = payment.orderId ? await EcomOrder.findById(payment.orderId).lean() : null;
  const user  = payment.userId  ? await EcomUser.findById(payment.userId).lean()  : null;

  let paymentHistory = { successful: 0, failed: 0, totalPaid: 0 };
  if (payment.userId) {
    const allPayments = await EcomPayment.find({ userId: payment.userId }).lean();
    paymentHistory.successful = allPayments.filter(p => p.status === 'CAPTURED').length;
    paymentHistory.failed     = allPayments.filter(p => p.status === 'FAILED').length;
    paymentHistory.totalPaid  = allPayments
      .filter(p => p.status === 'CAPTURED')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }

  const recCase = await RecoveryCase.findOne({ paymentId }).lean();

  return {
    payment: {
      id: payment._id.toString(),
      amount: payment.amount,
      currency: payment.currency || 'INR',
      failureReason: payment.failureReason || 'Unknown',
      razorpayPaymentId: payment.razorpayPaymentId,
      razorpayOrderId: payment.razorpayOrderId,
      status: payment.status,
      createdAt: payment.createdAt,
    },
    order: order ? {
      id: order._id.toString(),
      orderId: order.orderId,
      items: order.items,
      amount: order.amount,
      paymentStatus: order.paymentStatus,
      recoveryStatus: order.recoveryStatus,
    } : null,
    customer: user ? {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
    } : null,
    history: paymentHistory,
    recovery: {
      reminderCount: recCase?.reminderCount || 0,
      retryCount:    recCase?.retryCount || 0,
      totalAttempts: recCase?.totalAttempts || 0,
      status:        recCase?.status || 'NONE',
    },
  };
};

const getOrCreateRecoveryCase = async (paymentId) => {
  let recCase = await RecoveryCase.findOne({ paymentId });
  if (!recCase) {
    const payment = await EcomPayment.findById(paymentId);
    if (!payment) throw new Error('Payment not found');
    recCase = await RecoveryCase.create({
      paymentId: payment._id,
      orderId: payment.orderId,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency || 'INR',
      status: 'PENDING',
      startedAt: new Date()
    });
  }
  return recCase;
};

const getDashboardStats = async () => {
  const RecoveryAttempt = require('../models/RecoveryAttempt');

  // All payments that were ever FAILED (including now-recovered ones)
  const allFailed = await EcomPayment.find({ status: 'FAILED' }).lean();
  const revenueAtRisk = allFailed.reduce((sum, p) => sum + (p.amount || 0), 0);

  // Stats from recovery cases
  const cases = await RecoveryCase.find({}).lean();
  const recoveredCases = cases.filter(c => c.status === 'RECOVERED');
  
  // Recovered revenue: sum from RECOVERED cases OR from successful attempts on CAPTURED payments
  let recoveredRevenue = recoveredCases.reduce((sum, c) => sum + (c.recoveredAmount || 0), 0);

  // If no RecoveryCase exists but payment is CAPTURED with a successful attempt, count it
  const successfulAttempts = await RecoveryAttempt.find({ status: 'successful', decision: 'STOP_RECOVERY' }).lean();
  for (const att of successfulAttempts) {
    const alreadyCounted = recoveredCases.some(c => c.paymentId?.toString() === att.paymentId?.toString());
    if (!alreadyCounted && att.result?.recovered) {
      const payment = await EcomPayment.findById(att.paymentId).lean();
      if (payment && payment.status === 'CAPTURED') {
        recoveredRevenue += (payment.amount || 0);
      }
    }
  }

  const activeCases = cases.filter(c => ['IN_PROGRESS', 'WAITING', 'ANALYZING'].includes(c.status));
  const escalations = cases.filter(c => c.status === 'ESCALATED');
  const successfulRecoveries = recoveredCases.length + successfulAttempts.filter(a => {
    return !recoveredCases.some(c => c.paymentId?.toString() === a.paymentId?.toString()) && a.result?.recovered;
  }).length;

  const recoveryRate = revenueAtRisk > 0 ? Math.round((recoveredRevenue / (revenueAtRisk + recoveredRevenue)) * 100) : 0;
  
  // Pipeline
  const pipeline = {
    failed: allFailed.length + recoveredCases.length,  // total ever failed
    analyzing: cases.filter(c => c.status !== 'PENDING').length,
    active: cases.filter(c => !['PENDING', 'ANALYZING', 'RECOVERED', 'STOPPED'].includes(c.status)).length,
    recovered: successfulRecoveries
  };

  // Average recovery time
  let totalTimeMs = 0;
  recoveredCases.forEach(c => {
    if (c.startedAt && c.recoveredAt) {
      totalTimeMs += (new Date(c.recoveredAt) - new Date(c.startedAt));
    }
  });
  const avgRecoveryTimeHrs = recoveredCases.length > 0 
    ? (totalTimeMs / recoveredCases.length / (1000 * 60 * 60)).toFixed(1) 
    : 0;

  // Strategy Analytics
  const strategies = { 'PAYMENT_LINK': 0, 'GENTLE_REMINDER': 0, 'HUMAN_ESCALATION': 0 };
  for (const c of recoveredCases) {
    if (c.aiDecision === 'CREATE_PAYMENT_LINK') strategies['PAYMENT_LINK'] += c.recoveredAmount || 0;
    else if (c.aiDecision === 'SEND_REMINDER') strategies['GENTLE_REMINDER'] += c.recoveredAmount || 0;
    else if (c.aiDecision === 'ESCALATE_TO_HUMAN') strategies['HUMAN_ESCALATION'] += c.recoveredAmount || 0;
  }

  return {
    revenueAtRisk,
    recoveredRevenue,
    recoveryRate,
    failedPayments: allFailed.length,
    activeRecoveries: activeCases.length,
    successfulRecoveries,
    humanEscalations: escalations.length,
    totalAttempts: cases.reduce((sum, c) => sum + (c.totalAttempts || 0), 0),
    avgRecoveryTimeHrs,
    pipeline,
    strategies
  };
};

const getFailedPayments = async () => {
  const payments = await EcomPayment.find({ status: 'FAILED' }).sort({ createdAt: -1 }).lean();
  const enriched = await Promise.all(payments.map(async (payment) => {
    const order = payment.orderId ? await EcomOrder.findById(payment.orderId).lean() : null;
    const user = payment.userId ? await EcomUser.findById(payment.userId).lean() : null;
    const recCase = await RecoveryCase.findOne({ paymentId: payment._id }).lean();

    return {
      ...payment,
      order,
      user,
      caseStatus: recCase ? recCase.status : 'PENDING',
      attemptCount: recCase ? recCase.totalAttempts : 0,
    };
  }));
  return enriched;
};

const getRecoveryCases = async () => {
  return await RecoveryCase.find({}).sort({ updatedAt: -1 }).populate('paymentId').populate('userId').lean();
};

const getCaseDetail = async (paymentId) => {
  const context  = await getCustomerContext(paymentId);
  const recCase = await RecoveryCase.findOne({ paymentId }).lean();
  const attempts = await RecoveryAttempt.find({ paymentId }).sort({ createdAt: 1 }).lean();
  return { ...context, case: recCase, attempts };  // 'case' matches what frontend reads as caseData.case
};

const getEscalations = async () => {
  return await RecoveryCase.find({ status: 'ESCALATED' })
    .populate('paymentId')
    .populate('userId')
    .populate('orderId')
    .sort({ updatedAt: -1 })
    .lean();
};

module.exports = {
  getCustomerContext,
  getOrCreateRecoveryCase,
  getDashboardStats,
  getFailedPayments,
  getRecoveryCases,
  getCaseDetail,
  getEscalations,
};
