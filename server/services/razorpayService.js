/**
 * razorpayService.js
 *
 * Creates Razorpay Test Mode payment links so customers can retry
 * failed payments without re-entering their order details.
 */

const Razorpay = require('razorpay');

const getRazorpay = () =>
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

/**
 * createPaymentLink
 * @param {object} params
 * @param {string} params.customerName
 * @param {string} params.email
 * @param {string} params.phone
 * @param {number} params.amount   - in INR (not paise)
 * @param {string} params.orderId  - your internal order ID string
 * @returns {{ shortUrl: string, id: string }}
 */
const createPaymentLink = async ({ customerName, email, phone, amount, orderId }) => {
  const razorpay = getRazorpay();

  const options = {
    amount: amount * 100, // paise
    currency: 'INR',
    accept_partial: false,
    description: `Payment recovery for Order ${orderId}`,
    customer: {
      name: customerName,
      email: email,
      contact: phone || '',
    },
    notify: {
      sms: false,
      email: false, // We handle email ourselves
    },
    reminder_enable: false,
    notes: {
      orderId,
      source: 'ai_revenue_recovery',
    },
    callback_url: `${process.env.ECOM_FRONTEND_URL || 'http://localhost:5173'}/success`,
    callback_method: 'get',
  };

  const link = await razorpay.paymentLink.create(options);
  return { shortUrl: link.short_url, id: link.id };
};

module.exports = { createPaymentLink };
