/**
 * agent.js — Phase 4
 *
 * AI Revenue Recovery Agent with OpenAI Tool Calling.
 *
 * Flow:
 *  1. Build customer context from MongoDB
 *  2. Send context + tool definitions to GPT-4o
 *  3. LLM responds with a tool_call (e.g. sendReminder)
 *  4. toolExecutor validates and executes the tool
 *  5. Tool result is returned to the LLM for a final summary
 *  6. Return analysis + toolExecution to the controller
 */

const OpenAI = require('openai');
const { SYSTEM_PROMPT }      = require('./prompts');
const { toolDefinitions }    = require('./tools');
const { executeToolCall }    = require('./toolExecutor');
const RecoveryAttempt        = require('../models/RecoveryAttempt');
const { evaluateDecision }   = require('./decisionEngine');

// ─── Rule-based fallback (used when OpenAI quota is exhausted) ───────────────
const ruleBasedFallback = async (context) => {
  const { payment, history, order, recovery } = context;
  const retryCount = order?.retryCount || 0;
  const reminderCount = recovery?.reminderCount || 0;
  const totalAttempts = recovery?.totalAttempts || 0;

  let decision, confidence, reason, riskLevel, recommendedDelaySeconds, nextAction;
  let customerSegment = 'REGULAR_CUSTOMER';
  let failureCategory = 'UNKNOWN';
  let strategy = 'GENTLE_REMINDER';
  let expectedOutcome = 'Customer proceeds with payment.';

  if (totalAttempts >= 5) {
    decision = 'STOP_RECOVERY'; confidence = 0.99;
    reason   = 'Maximum total automated recovery attempts reached.';
    riskLevel = 'HIGH'; recommendedDelaySeconds = 0; nextAction = 'STOP_RECOVERY';
    strategy = 'STOP';
  } else if (reminderCount >= 2) {
    decision = 'ESCALATE_TO_HUMAN'; confidence = 0.90;
    reason   = 'Max reminders reached. Customer requires human intervention.';
    riskLevel = 'HIGH'; recommendedDelaySeconds = 0; nextAction = 'STOP_RECOVERY';
    strategy = 'HUMAN_ESCALATION';
  } else if (retryCount >= 3) {
    decision = 'STOP_RECOVERY'; confidence = 0.95;
    reason   = 'Payment has been retried too many times. Stopping automated recovery.';
    riskLevel = 'HIGH'; recommendedDelaySeconds = 0; nextAction = 'ESCALATE_TO_HUMAN';
    strategy = 'STOP';
  } else if (history.failed >= 3) {
    decision = 'ESCALATE_TO_HUMAN'; confidence = 0.88;
    reason   = 'Customer has multiple failed payments. Human review recommended.';
    riskLevel = 'HIGH'; recommendedDelaySeconds = 300; nextAction = 'STOP_RECOVERY';
    strategy = 'HUMAN_ESCALATION';
  } else if (history.successful > 0 && history.failed <= 1) {
    decision = 'SEND_REMINDER'; confidence = 0.90;
    reason   = "Customer's first failed payment with good history. A reminder is the best first step.";
    riskLevel = 'LOW'; recommendedDelaySeconds = 30; nextAction = 'CREATE_PAYMENT_LINK';
    customerSegment = 'LOYAL_CUSTOMER';
  } else if (payment.amount >= 3000) {
    decision = 'CREATE_PAYMENT_LINK'; confidence = 0.82;
    reason   = 'High-value payment. A direct payment link improves recovery chances.';
    riskLevel = 'MEDIUM'; recommendedDelaySeconds = 60; nextAction = 'ESCALATE_TO_HUMAN';
    customerSegment = 'HIGH_VALUE_CUSTOMER';
    strategy = 'PAYMENT_LINK';
  } else {
    decision = 'SEND_REMINDER'; confidence = 0.75;
    reason   = 'Standard first recovery attempt. Sending a reminder.';
    riskLevel = 'MEDIUM'; recommendedDelaySeconds = 30; nextAction = 'CREATE_PAYMENT_LINK';
  }

  const analysis = { 
    customerSegment, failureCategory, riskLevel, strategy, decision, 
    confidence, reason, expectedOutcome, recommendedDelaySeconds, nextAction 
  };

  // Only save an ANALYZED record for actionable decisions
  if (!['STOP_RECOVERY', 'ESCALATE_TO_HUMAN'].includes(decision)) {
    await RecoveryAttempt.create({
      paymentId: context.payment.id, orderId: context.order?._id, userId: context.customer?._id,
      ...analysis, 
      aiDecision: decision,
      status: 'analyzed',
    });
  }
  return analysis;
};

// ─── Build the user message ───────────────────────────────────────────────────
const buildUserMessage = (context) => {
  const { payment, customer, order, history, recovery } = context;
  return `
Analyze this failed payment and recommend the most appropriate recovery strategy.

=== CUSTOMER ===
ID:      ${customer?._id}
Name:    ${customer?.name || 'Unknown'}
Email:   ${customer?.email || 'Unknown'}

=== CURRENT PAYMENT ===
Payment ID:     ${payment.id || payment._id}
Amount:         ${payment.currency} ${payment.amount}
Status:         ${payment.status}
Failure Reason: ${payment.failureReason}
Date:           ${new Date(payment.createdAt).toLocaleString()}

=== ORDER & AUTOMATION ===
Order ID:       ${order?._id}
Retry Count:    ${order?.retryCount || 0}
Reminders Sent: ${recovery?.reminderCount || 0}
Total Attempts: ${recovery?.totalAttempts || 0}

=== CUSTOMER HISTORY ===
Successful payments: ${history.successful}
Failed payments:     ${history.failed}
Total amount paid:   ${payment.currency} ${history.totalPaid}
`.trim();
};

// ─── analyzePayment (Phase 9: structured JSON decision + Backend Policy) ────────
const analyzePayment = async (context) => {
  const { decisionSchema } = require('./schemas');
  const { payment, customer, order, history } = context;
  const userMessage = buildUserMessage(context);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-2024-08-06',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userMessage },
      ],
      response_format: { type: 'json_schema', json_schema: decisionSchema },
    });

    const aiAnalysis = JSON.parse(completion.choices[0].message.content);
    
    // Evaluate via Decision Engine
    const { finalDecision, policyOverride, overrideReason } = evaluateDecision(context, aiAnalysis);

    const finalAnalysis = {
      ...aiAnalysis,
      aiDecision: aiAnalysis.decision,
      decision: finalDecision, // overwritten by backend policy if applicable
      policyOverride,
      overrideReason
    };

    await RecoveryAttempt.create({
      paymentId: payment.id || payment._id,
      orderId: order?._id, userId: customer?._id,
      ...finalAnalysis, status: 'analyzed',
    });
    return finalAnalysis;
  } catch (err) {
    if (err.code === 'credit_balance_exhausted' || err.status === 429) {
      console.warn('[AI] OpenAI quota exhausted — using rule-based fallback.');
      return ruleBasedFallback(context);
    }
    console.error('[AI Error]', err);
    throw new Error('Failed to generate AI decision');
  }
};

// ─── runAgent (Phase 9: AI -> Decision Engine -> Tool Execution) ────────────
const runAgent = async (context) => {
  const { payment, customer, order } = context;

  console.log(`\n[AI] Payment received: ${payment.id || payment._id}`);
  console.log(`[AI] Analyzing payment and applying backend policy...`);

  // Step 1: AI JSON output + Decision Engine Policy Enforcement
  const analysis = await analyzePayment(context);
  const finalDecision = analysis.decision; // this has been through the engine
  
  console.log(`[AI] AI Recommendation: ${analysis.aiDecision}`);
  console.log(`[AI] Backend Final Decision: ${finalDecision}`);
  if (analysis.policyOverride) {
    console.log(`[AI] POLICY OVERRIDE: ${analysis.overrideReason}`);
  }

  let toolName = null;
  let toolResult = null;

  // Step 2: Map final decision to a backend tool
  if (finalDecision === 'SEND_REMINDER') toolName = 'sendReminder';
  else if (finalDecision === 'CREATE_PAYMENT_LINK') toolName = 'createPaymentLink';
  else if (finalDecision === 'RETRY_PAYMENT') toolName = 'retryPayment';
  else if (finalDecision === 'ESCALATE_TO_HUMAN') toolName = 'escalateToHuman';
  else if (finalDecision === 'STOP_RECOVERY') toolName = 'stopRecovery';
  
  if (toolName) {
    console.log(`[AI] Executing ${toolName}...`);
    const args = {
      paymentId:  (payment.id || payment._id).toString(),
      customerId: customer?._id?.toString(),
      orderId:    order?._id?.toString(),
      reason:     analysis.reason,
    };
    
    try {
      toolResult = await executeToolCall(toolName, args);
      console.log(`[AI] ${toolName} result: ${JSON.stringify(toolResult)}`);
    } catch (toolErr) {
      toolResult = { success: false, error: toolErr.message };
      console.log(`[AI] ${toolName} error: ${toolErr.message}`);
    }
    
    // Save the execution result
    await RecoveryAttempt.create({
      paymentId: payment.id || payment._id,
      orderId:   order?._id,
      userId:    customer?._id,
      decision:  finalDecision,
      status:    toolResult.success ? 'executed' : 'executed',
      reason:    toolResult.message || analysis.reason,
      result:    toolResult,
      executedAt: new Date(),
    });
  }

  return { analysis, toolName, toolResult };
};

module.exports = { analyzePayment, runAgent };
