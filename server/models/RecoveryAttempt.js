const mongoose = require('mongoose');

const recoveryAttemptSchema = new mongoose.Schema({
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomPayment',
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomOrder'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EcomUser'
  },
  decision: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'executed', 'failed', 'cancelled', 'analyzed', 'successful'],
    default: 'executed'
  },
  reason: {
    type: String
  },
  result: {
    type: mongoose.Schema.Types.Mixed
  },
  aiDecision: {
    type: mongoose.Schema.Types.Mixed
  },
  policyOverride: {
    type: Boolean,
    default: false
  },
  customerSegment: {
    type: String
  },
  executedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('RecoveryAttempt', recoveryAttemptSchema);
