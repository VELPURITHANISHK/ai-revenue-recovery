const policy = require('../config/recoveryPolicy');

/**
 * Validates and overrides AI decisions based on strict backend policies.
 * @param {Object} context - Customer and payment context
 * @param {Object} aiDecision - The parsed JSON response from the AI
 * @returns {Object} { finalDecision, policyOverride, overrideReason }
 */
function evaluateDecision(context, aiResponse) {
  let finalDecision = aiResponse.decision;
  let policyOverride = false;
  let overrideReason = null;

  const { payment, recovery = {} } = context;
  const isHighValue = payment.amount >= policy.HIGH_VALUE_THRESHOLD;

  // Rule 1: If payment is already successful, force stop.
  if (payment.status === 'CAPTURED') {
    if (finalDecision !== 'STOP_RECOVERY') {
      policyOverride = true;
      overrideReason = 'Payment is already successful. Recovery must stop.';
      finalDecision = 'STOP_RECOVERY';
    }
    return { finalDecision, policyOverride, overrideReason };
  }

  // Rule 2: Max attempts reached
  if (recovery.totalAttempts >= policy.MAX_TOTAL_ATTEMPTS) {
    if (finalDecision !== 'STOP_RECOVERY' && finalDecision !== 'ESCALATE_TO_HUMAN') {
      policyOverride = true;
      overrideReason = 'Maximum total attempts limit reached. Forcing escalation.';
      finalDecision = 'ESCALATE_TO_HUMAN';
    }
  }

  // Rule 3: Max retries reached
  if (finalDecision === 'RETRY_PAYMENT' && recovery.retryCount >= policy.MAX_RETRIES) {
    policyOverride = true;
    overrideReason = 'Maximum retry limit reached. Forcing escalation.';
    finalDecision = 'ESCALATE_TO_HUMAN';
  }

  // Rule 4: Max reminders reached
  if (finalDecision === 'SEND_REMINDER' && recovery.reminderCount >= policy.MAX_REMINDERS) {
    policyOverride = true;
    overrideReason = 'Maximum reminder limit reached. Falling back to payment link or escalation.';
    finalDecision = isHighValue ? 'ESCALATE_TO_HUMAN' : 'CREATE_PAYMENT_LINK';
  }

  // Rule 5: Repeated failures for high-value carts should be escalated fast
  if (isHighValue && recovery.totalAttempts >= 2 && finalDecision !== 'ESCALATE_TO_HUMAN' && finalDecision !== 'STOP_RECOVERY') {
    policyOverride = true;
    overrideReason = 'High value payment with repeated failures. Escalating immediately.';
    finalDecision = 'ESCALATE_TO_HUMAN';
  }

  return { finalDecision, policyOverride, overrideReason };
}

module.exports = { evaluateDecision };
