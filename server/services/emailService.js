/**
 * emailService.js
 *
 * Abstraction layer for email sending.
 * In DEMO_MODE (or when no email provider is configured) all emails
 * are printed to the console so the full AI workflow can be demonstrated
 * without a live email account.
 *
 * To switch to a real provider later, only this file needs changing.
 */

const DEMO_MODE = process.env.DEMO_MODE === 'true';

/**
 * sendPaymentReminder - notify the customer about their failed payment.
 */
const sendPaymentReminder = async ({ customerName, email, amount, orderId, paymentLink, reminderCount = 0 }) => {
  let subject = `Action required: Complete your payment of ₹${amount}`;
  let body = '';

  if (reminderCount === 0) {
    body = `Hi ${customerName},\n\nYour recent payment of ₹${amount} for Order #${orderId} was unsuccessful.\n\n${paymentLink ? `You can complete your payment using the link below:\n${paymentLink}` : 'Please try again.'}\n\nThank you,\nMyShop Support`;
  } else if (reminderCount === 1) {
    subject = `Reminder: Your payment of ₹${amount} is still pending`;
    body = `Hi ${customerName},\n\nYour payment is still pending.\nPlease complete your payment using this secure payment link:\n${paymentLink || 'Please login to your account to pay.'}\n\nThank you,\nMyShop Support`;
  } else {
    subject = `Final Reminder: Urgent action required for Order #${orderId}`;
    body = `Hi ${customerName},\n\nThis is a final reminder regarding your pending payment of ₹${amount}.\n\n${paymentLink ? `Please pay here:\n${paymentLink}` : 'Please login to pay.'}\n\nIf you need help, please reply to this email.\n\nThank you,\nMyShop Support`;
  }

  if (process.env.EMAIL_API_KEY && process.env.EMAIL_API_KEY !== 'your_email_api_key') {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.EMAIL_API_KEY);
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject,
      text: body,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    console.log(`[EMAIL] Sent real email via Resend to ${email}: ${result.id}`);
    return { success: true, id: result.id, mode: 'real' };
  }

  if (DEMO_MODE) {
    console.log('\n============ [EMAIL - DEMO MODE] ============');
    console.log(`TO:      ${email}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY:\n${body}`);
    console.log('=============================================\n');
    return { success: true, mode: 'demo', to: email, subject };
  }

  throw new Error('No email provider configured. Set DEMO_MODE=true or configure Resend.');
};

/**
 * sendEscalationAlert - notify a human agent about an unresolved case.
 */
const sendEscalationAlert = async ({ email, customerName, amount, orderId, aiRecommendation }) => {
  const subject = `[ESCALATION] Failed payment ₹${amount} – Order #${orderId}`;
  const body = `
A customer payment could not be recovered automatically.

Customer: ${customerName} (${email})
Amount:   ₹${amount}
Order:    #${orderId}

AI Recommendation:
${aiRecommendation}

Please handle this case manually.
  `.trim();

  if (DEMO_MODE) {
    console.log('\n============ [ESCALATION EMAIL - DEMO MODE] ============');
    console.log(`TO:      ${email}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY:\n${body}`);
    console.log('========================================================\n');
    return { success: true, mode: 'demo' };
  }

  // Add real provider here the same way as above
  throw new Error('No email provider configured.');
};

module.exports = { sendPaymentReminder, sendEscalationAlert };
