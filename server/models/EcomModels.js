const mongoose = require('mongoose');

// ─── Shared models (read-only views into the e-commerce collections) ───────────

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  address: String,
}, { timestamps: true, collection: 'users' });

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
}, { timestamps: true, collection: 'products' });

const orderItemSchema = new mongoose.Schema({
  productId: mongoose.Schema.Types.ObjectId,
  name: String,
  quantity: Number,
  price: Number,
});

const orderSchema = new mongoose.Schema({
  orderId: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser' },
  items: [orderItemSchema],
  amount: Number,
  currency: String,
  status: String,
  paymentStatus: String,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  retryCount: { type: Number, default: 0 },
  lastRetryAt: Date,
  recoveryStatus: { type: String, default: 'NONE' },
}, { timestamps: true, collection: 'orders' });

const paymentSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomOrder' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'EcomUser' },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  amount: Number,
  currency: String,
  status: String,
  method: String,
  failureReason: String,
}, { timestamps: true, collection: 'payments' });

const EcomUser    = mongoose.model('EcomUser',    userSchema);
const EcomProduct = mongoose.model('EcomProduct', productSchema);
const EcomOrder   = mongoose.model('EcomOrder',   orderSchema);
const EcomPayment = mongoose.model('EcomPayment', paymentSchema);

module.exports = { EcomUser, EcomProduct, EcomOrder, EcomPayment };
