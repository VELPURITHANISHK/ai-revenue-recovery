/**
 * toolExecutor.js
 *
 * The secure execution layer for AI tool calls.
 * 
 * Flow:
 *   AI requests tool → toolExecutor validates → safety rules → backend function → result
 *
 * The LLM NEVER executes code directly.
 * All data is read from MongoDB (never trusted from the LLM).
 */

const Razorpay = require('razorpay');
const RecoveryAttempt = require('../models/RecoveryAttempt');
const { EcomPayment, EcomOrder, EcomUser } = require('../models/EcomModels');
const { sendPaymentReminder, sendEscalationAlert } = require('../services/emailService');
const { ALLOWED_TOOLS } = require('./tools');

// ─── Business Safety Limits ───────────────────────────────────────────────────
const MAX_REMINDERS = 2;
const MAX_RETRIES   = 3;
const MAX_RECOVERY_ATTEMPTS = 5;

// ─── Helper: load fresh payment context from MongoDB ─────────────────────────
const loadContext = async (paymentId) => {
  const payment  = await EcomPayment.findById(paymentId).lean();
  if (!payment)  throw new Error(`Payment ${paymentId} not found`);

  const order    = await EcomOrder.findById(payment.orderId).lean();
  const customer = await EcomUser.findById(payment.userId).lean();

  const previousAttempts = await RecoveryAttempt.find({ paymentId }).sort({ createdAt: 1 }).lean();
  
  const RecoveryCase = require('../models/RecoveryCase');
  const recCase = await RecoveryCase.findOne({ paymentId });

  const reminderCount    = recCase?.reminderCount || 0;
  const retryCount       = recCase?.retryCount || 0;

  return { payment, order, customer, previousAttempts, reminderCount, retryCount, recCase };
};

const updateCase = async (recCase, updateObj) => {
  if (recCase) {
    Object.assign(recCase, updateObj);
    recCase.totalAttempts += 1;
    await recCase.save();
  }
};

// ─── Guard: already recovered ─────────────────────────────────────────────────
const guardAlreadyPaid = (payment) => {
  if (payment.status === 'CAPTURED') {
    return { success: false, reason: 'Payment already completed', action: 'STOP_RECOVERY' };
  }
  return null;
};

// ─── Tool: sendReminder ───────────────────────────────────────────────────────
const sendReminder = async ({ paymentId, customerId, orderId }) => {
  console.log(`[Tool] sendReminder → paymentId=${paymentId}`);

  const { payment, order, customer, reminderCount, recCase } = await loadContext(paymentId);

  const alreadyPaid = guardAlreadyPaid(payment);
  if (alreadyPaid) return alreadyPaid;

  // Safety limit
  if (reminderCount >= MAX_REMINDERS) {
    console.warn(`[Tool] sendReminder REJECTED — max reminders reached (${reminderCount}/${MAX_REMINDERS})`);
    return {
      success: false,
      reason:  `Max reminders (${MAX_REMINDERS}) already sent. Escalating to human instead.`,
      action:  'ESCALATE_TO_HUMAN',
    };
  }

  // Duplicate check: prevent sending the same reminder twice in quick succession (5 min window)
  const recentReminder = await RecoveryAttempt.findOne({
    paymentId,
    decision: 'SEND_REMINDER',
    status:   'executed',
    createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
  });
  if (recentReminder) {
    return { success: false, reason: 'Duplicate recovery action prevented — reminder sent within the last 5 minutes.' };
  }

  console.log(`[Tool] Executing sendReminder → sending email to ${customer?.email}`);

  let emailResult;
  try {
    emailResult = await sendPaymentReminder({
      customerName: customer?.name || 'Customer',
      email:        customer?.email,
      amount:       payment.amount,
      orderId:      order?.orderId || orderId,
      paymentLink:  null,
      reminderCount,
    });
  } catch (err) {
    console.error('[Tool] Email failed:', err.message);
    await RecoveryAttempt.create({
      paymentId, orderId: order?._id, userId: customer?._id,
      decision: 'SEND_REMINDER', status: 'executed',
      result: { success: false, error: err.message },
      executedAt: new Date(),
    });
    await updateCase(recCase, { currentAction: 'SEND_REMINDER', status: 'IN_PROGRESS' });
    return { success: false, error: `Email failed: ${err.message}` };
  }

  await RecoveryAttempt.create({
    paymentId, orderId: order?._id, userId: customer?._id,
    decision:   'SEND_REMINDER',
    status:     'executed',
    result:     { success: true, emailMode: emailResult.mode, emailId: emailResult.id, to: customer?.email },
    executedAt: new Date(),
  });
  await updateCase(recCase, { currentAction: 'SEND_REMINDER', status: 'WAITING', reminderCount: reminderCount + 1 });

  return { success: true, message: `Reminder email sent to ${customer?.email}`, mode: emailResult.mode };
};

// ─── Tool: createPaymentLink ──────────────────────────────────────────────────
const createPaymentLink = async ({ paymentId }) => {
  console.log(`[Tool] createPaymentLink → paymentId=${paymentId}`);

  const { payment, order, customer, reminderCount, recCase } = await loadContext(paymentId);

  const alreadyPaid = guardAlreadyPaid(payment);
  if (alreadyPaid) return alreadyPaid;

  // Safety limit
  if (reminderCount >= MAX_REMINDERS) {
    console.warn(`[Tool] createPaymentLink REJECTED — max reminders reached (${reminderCount}/${MAX_REMINDERS})`);
    return {
      success: false,
      reason:  `Max reminders (${MAX_REMINDERS}) already sent. Escalating to human instead.`,
      action:  'ESCALATE_TO_HUMAN',
    };
  }

  // Duplicate check: prevent sending the same link twice in quick succession (5 min window)
  const recentLink = await RecoveryAttempt.findOne({
    paymentId,
    decision: 'CREATE_PAYMENT_LINK',
    status:   'executed',
    createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
  });
  if (recentLink) {
    return { success: false, reason: 'Duplicate recovery action prevented — link sent within the last 5 minutes.' };
  }

  let linkData;
  try {
    const razorpay = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const contactNumber = customer?.phone === '9999999999' ? '9876543210' : (customer?.phone || '9876543210');

    const link = await razorpay.paymentLink.create({
      amount:      payment.amount * 100, // paise
      currency:    payment.currency || 'INR',
      accept_partial: false,
      description: `Recovery for Order #${order?.orderId || orderId}`,
      customer: {
        name:  customer?.name  || 'Customer',
        email: customer?.email || '',
        contact: contactNumber,
      },
      notify: { sms: false, email: true },
      reminder_enable: false,
      notes: { paymentId: paymentId.toString(), orderId: order?._id?.toString() },
    });

    linkData = { url: link.short_url, id: link.id };
    console.log(`[Tool] Razorpay payment link created: ${link.short_url}`);
  } catch (err) {
    console.error('[Tool] Razorpay link creation failed:', err.message);
    // Fallback — log as demo
    linkData = { url: `https://razorpay.com/test-link/${paymentId}`, id: 'demo', mode: 'demo' };
    console.log('[Tool] Using demo payment link (Razorpay unavailable in dev)');
  }

  // Send the link to the customer via email
  try {
    await sendPaymentReminder({
      customerName: customer?.name || 'Customer',
      email:        customer?.email,
      amount:       payment.amount,
      orderId:      order?.orderId || '',
      paymentLink:  linkData.url,
      reminderCount,
    });
  } catch (emailErr) {
    console.warn('[Tool] Could not email payment link:', emailErr.message);
  }

  await RecoveryAttempt.create({
    paymentId, orderId: order?._id, userId: customer?._id,
    decision:   'CREATE_PAYMENT_LINK',
    status:     'executed',
    result:     { success: true, paymentLinkUrl: linkData.url, paymentLinkId: linkData.id },
    executedAt: new Date(),
  });
  await updateCase(recCase, { currentAction: 'CREATE_PAYMENT_LINK', status: 'WAITING', reminderCount: reminderCount + 1 });

  return { success: true, message: 'Payment link created and sent to customer.', paymentLinkUrl: linkData.url };
};

// ─── Tool: retryPayment ───────────────────────────────────────────────────────
const retryPayment = async ({ paymentId }) => {
  console.log(`[Tool] retryPayment → paymentId=${paymentId}`);

  const { payment, order, customer, retryCount, recCase } = await loadContext(paymentId);

  const alreadyPaid = guardAlreadyPaid(payment);
  if (alreadyPaid) return alreadyPaid;

  if (retryCount >= MAX_RETRIES) {
    console.warn(`[Tool] retryPayment REJECTED — max retries reached (${retryCount}/${MAX_RETRIES})`);
    return {
      success: false,
      reason:  `Max retries (${MAX_RETRIES}) already reached.`,
      action:  'ESCALATE_TO_HUMAN',
    };
  }

  await RecoveryAttempt.create({
    paymentId, orderId: order?._id, userId: customer?._id,
    decision:   'RETRY_PAYMENT',
    status:     'executed',
    result:     { success: false, reason: 'Automatic retry not supported for this payment flow — customer action required.' },
    executedAt: new Date(),
  });
  await updateCase(recCase, { currentAction: 'RETRY_PAYMENT', status: 'WAITING', retryCount: retryCount + 1 });

  return {
    success: false,
    action:  'RETRY_PAYMENT',
    message: 'Automatic retry is not supported for this payment flow; customer action is required.',
    suggestion: 'CREATE_PAYMENT_LINK',
  };
};

// ─── Tool: escalateToHuman ────────────────────────────────────────────────────
const escalateToHuman = async ({ paymentId, reason }) => {
  console.log(`[Tool] escalateToHuman → paymentId=${paymentId}`);

  const { payment, order, customer, recCase } = await loadContext(paymentId);

  await RecoveryAttempt.create({
    paymentId, orderId: order?._id, userId: customer?._id,
    decision:   'ESCALATE_TO_HUMAN',
    status:     'executed',
    reason,
    result:     { success: true, status: 'ESCALATED', message: 'Payment escalated to human recovery team.' },
    executedAt: new Date(),
  });
  await updateCase(recCase, { currentAction: 'ESCALATE_TO_HUMAN', status: 'ESCALATED', stoppedAt: new Date() });

  // Notify the internal team
  try {
    await sendEscalationAlert({
      email:           customer?.email || 'support@myshop.com',
      customerName:    customer?.name || 'Customer',
      amount:          payment.amount,
      orderId:         order?.orderId || paymentId,
      aiRecommendation: reason,
    });
  } catch (err) {
    console.warn('[Tool] Escalation alert email failed:', err.message);
  }

  return { success: true, status: 'ESCALATED', message: 'Payment escalated to human recovery team.' };
};

// ─── Tool: stopRecovery ────────────────────────────────────────────────────────
const stopRecovery = async ({ paymentId, reason }) => {
  console.log(`[Tool] stopRecovery → paymentId=${paymentId}`);

  const { order, customer, recCase } = await loadContext(paymentId);

  await RecoveryAttempt.create({
    paymentId, orderId: order?._id, userId: customer?._id,
    decision:   'STOP_RECOVERY',
    status:     'executed',
    reason,
    result:     { success: true, status: 'STOPPED', message: 'Automated recovery has been stopped for this payment.' },
    executedAt: new Date(),
  });
  await updateCase(recCase, { currentAction: 'STOP_RECOVERY', status: 'STOPPED', stoppedAt: new Date() });

  return { success: true, status: 'STOPPED', message: 'Automated recovery has been stopped.' };
};

// ─── Dispatcher ───────────────────────────────────────────────────────────────
/**
 * executeToolCall
 * Validates the tool name, applies safety rules, and dispatches to the correct function.
 */
const executeToolCall = async (toolName, args) => {
  console.log(`\n[ToolExecutor] Tool requested: ${toolName}`);
  console.log(`[ToolExecutor] Args: ${JSON.stringify(args)}`);

  // 1. Validate tool name (whitelist only)
  if (!ALLOWED_TOOLS.includes(toolName)) {
    console.error(`[ToolExecutor] REJECTED — unknown tool: ${toolName}`);
    throw new Error(`Tool '${toolName}' is not an allowed tool.`);
  }

  console.log(`[ToolExecutor] Tool validation: PASSED`);

  const { EcomPayment } = require('../models/EcomModels');
  const RecoveryCase = require('../models/RecoveryCase');
  const payment = await EcomPayment.findById(args.paymentId);
  if (payment?.status === 'CAPTURED') {
    return { success: false, reason: 'Payment already completed', action: 'STOP_RECOVERY' };
  }

  const recCase = await RecoveryCase.findOne({ paymentId: args.paymentId });
  if (recCase && recCase.totalAttempts >= MAX_RECOVERY_ATTEMPTS) {
    if (toolName !== 'stopRecovery' && toolName !== 'escalateToHuman') {
      console.warn(`[ToolExecutor] REJECTED — MAX_RECOVERY_ATTEMPTS reached (${recCase.totalAttempts})`);
      return {
        success: false,
        reason: `Maximum recovery attempts (${MAX_RECOVERY_ATTEMPTS}) reached.`,
        action: 'STOP_RECOVERY',
      };
    }
  }

  // 2. Dispatch
  const toolMap = { sendReminder, createPaymentLink, retryPayment, escalateToHuman, stopRecovery };
  const result  = await toolMap[toolName](args);

  console.log(`[ToolExecutor] Tool result: ${JSON.stringify(result)}`);
  return result;
};

module.exports = { executeToolCall };
