/**
 * tools.js
 *
 * OpenAI function/tool definitions for the AI Revenue Recovery Agent.
 * These are passed to the LLM so it knows what it can request.
 * The LLM never executes these — the backend does, via toolExecutor.js.
 */

const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'sendReminder',
      description: 'Send a payment reminder email to the customer for a failed payment. Use this as the first recovery action for customers with good payment history.',
      parameters: {
        type: 'object',
        properties: {
          paymentId:  { type: 'string', description: 'The MongoDB ID of the failed payment' },
          customerId: { type: 'string', description: 'The MongoDB ID of the customer' },
          orderId:    { type: 'string', description: 'The MongoDB ID of the order' },
        },
        required: ['paymentId', 'customerId', 'orderId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createPaymentLink',
      description: 'Create a new Razorpay payment link for the outstanding amount and deliver it to the customer. Use this if a reminder was already sent, or if the customer needs a fresh checkout link.',
      parameters: {
        type: 'object',
        properties: {
          paymentId: { type: 'string', description: 'The MongoDB ID of the failed payment' },
        },
        required: ['paymentId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'retryPayment',
      description: 'Attempt to retry the payment automatically. NOTE: Only supported for certain payment flows. If not supported, the system will recommend CREATE_PAYMENT_LINK instead.',
      parameters: {
        type: 'object',
        properties: {
          paymentId: { type: 'string', description: 'The MongoDB ID of the failed payment' },
        },
        required: ['paymentId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalateToHuman',
      description: 'Mark the recovery case as requiring human intervention. Use this for high-risk cases, repeated failures, or high-value customers.',
      parameters: {
        type: 'object',
        properties: {
          paymentId: { type: 'string', description: 'The MongoDB ID of the failed payment' },
          reason:    { type: 'string', description: 'Explanation of why human review is needed' },
        },
        required: ['paymentId', 'reason'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stopRecovery',
      description: 'Stop all automated recovery for this payment. Use when max retries are exhausted, customer has requested no contact, or recovery is clearly not possible.',
      parameters: {
        type: 'object',
        properties: {
          paymentId: { type: 'string', description: 'The MongoDB ID of the failed payment' },
          reason:    { type: 'string', description: 'Explanation of why recovery is being stopped' },
        },
        required: ['paymentId', 'reason'],
        additionalProperties: false,
      },
    },
  },
];

const ALLOWED_TOOLS = toolDefinitions.map(t => t.function.name);

module.exports = { toolDefinitions, ALLOWED_TOOLS };
