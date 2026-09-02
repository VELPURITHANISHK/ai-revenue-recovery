const mongoose = require('mongoose');

const recoveryCaseSchema = new mongoose.Schema({
  paymentId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'EcomPayment', unique: true },
  orderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'EcomOrder' },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser' },

  amount:    { type: Number, required: true },
  currency:  { type: String, default: 'INR' },

  status: {
    type: String,
    enum: ['PENDING', 'ANALYZING', 'IN_PROGRESS', 'WAITING', 'RECOVERED', 'ESCALATED', 'STOPPED', 'FAILED'],
    default: 'PENDING'
  },

  currentAction: { type: String },

  retryCount:    { type: Number, default: 0 },
  reminderCount: { type: Number, default: 0 },
  totalAttempts: { type: Number, default: 0 },

  recoveredAmount: { type: Number, default: 0 },

  aiDecision:   { type: String },
  aiReason:     { type: String },
  aiConfidence: { type: String },
  riskLevel:    { type: String },

  startedAt:   { type: Date },
  recoveredAt: { type: Date },
  stoppedAt:   { type: Date },

}, { timestamps: true });

module.exports = mongoose.model('RecoveryCase', recoveryCaseSchema);
