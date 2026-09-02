const decisionSchema = {
  name: "recovery_decision",
  description: "Structured decision for payment recovery",
  strict: true,
  schema: {
    type: "object",
    properties: {
      customerSegment: {
        type: "string",
        enum: ["NEW_CUSTOMER", "REGULAR_CUSTOMER", "LOYAL_CUSTOMER", "HIGH_VALUE_CUSTOMER", "AT_RISK_CUSTOMER"],
        description: "Classification of the customer based on history"
      },
      failureCategory: {
        type: "string",
        enum: ["INSUFFICIENT_FUNDS", "BANK_ERROR", "CARD_ERROR", "CUSTOMER_CANCELLED", "NETWORK_ERROR", "UNKNOWN"],
        description: "Normalized category of the payment failure"
      },
      riskLevel: {
        type: "string",
        enum: ["LOW", "MEDIUM", "HIGH"],
        description: "Payment risk assessment"
      },
      strategy: {
        type: "string",
        enum: ["GENTLE_REMINDER", "PAYMENT_LINK", "RETRY", "HUMAN_ESCALATION", "STOP"],
        description: "High-level recovery strategy selected"
      },
      decision: {
        type: "string",
        enum: ["SEND_REMINDER", "CREATE_PAYMENT_LINK", "RETRY_PAYMENT", "ESCALATE_TO_HUMAN", "STOP_RECOVERY"],
        description: "The primary tool action to execute"
      },
      confidence: {
        type: "number",
        description: "Confidence in the decision, between 0.0 and 1.0"
      },
      reason: {
        type: "string",
        description: "Concise business rationale. Do not expose internal chain-of-thought."
      },
      expectedOutcome: {
        type: "string",
        description: "What the AI expects to happen (e.g. 'Customer completes payment using the link.')"
      },
      recommendedDelaySeconds: {
        type: "number",
        description: "Seconds to wait before the next action"
      },
      nextAction: {
        type: "string",
        description: "The action that should follow this one",
        enum: ["SEND_REMINDER", "CREATE_PAYMENT_LINK", "RETRY_PAYMENT", "ESCALATE_TO_HUMAN", "STOP_RECOVERY", "CHECK_PAYMENT", "NONE"]
      }
    },
    required: [
      "customerSegment", "failureCategory", "riskLevel", "strategy",
      "decision", "confidence", "reason", "expectedOutcome",
      "recommendedDelaySeconds", "nextAction"
    ],
    additionalProperties: false
  }
};

module.exports = { decisionSchema };
