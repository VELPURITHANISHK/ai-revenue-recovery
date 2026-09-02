# 3-Minute Live Demo Script

**Preparation:** Make sure to click the **"Reset Demo"** button on your dashboard to clear out all data.

## Introduction (0:00 - 0:30)
> *"Every day, businesses lose millions to failed payments, abandoned checkouts, and overdue invoices. Identifying the loss is easy. Actually getting the money back is hard. Let me show you what happens when a payment fails on our store."*

## Scenario 1: Standard Recovery (0:30 - 1:30)
*Action: Go to localhost:5173, add a product, checkout. In the Razorpay test window, select 'Failure'. Then go to localhost:5174 (Dashboard).*

> *"The payment has failed. Normally, this revenue is gone. But on our AI Recovery Dashboard, we can see a new failed payment in our Live Pipeline. I'll click **Run Full Recovery Demo**.*
> 
> *(Screen jumps to Recovery Case view)*
> 
> *The AI instantly analyzed the customer's history. Notice it identified this as a 'Regular Customer' with a 'Low Risk' failure. It chose to send a Reminder. But importantly, the AI didn't just decide — the Backend Policy validated the decision, the Tool was actually executed, and BullMQ automatically scheduled a follow-up check for 10 seconds from now. No human support agent had to do any of this."*
>
> *(Click 'Simulate Customer Paid')*
>
> *"Let's simulate the webhook that fires when they pay. Instantly, the automation stops. The case is marked as recovered. Our dashboard shows the recovered revenue."*

## Scenario 2: High-Value Override & Escalation (1:30 - 2:15)
*Action: Buy 3 laptops so the cart is over ₹10,000. Fail the payment. Go to Dashboard and run the demo on that case.*

> *"What happens if it's a high-value cart? I just failed a massive order. Let's run the AI on it.*
>
> *(Point out the Policy Override in the UI)*
>
> *"Look at this. The AI might have recommended a simple reminder, but our Backend Decision Engine detected a High Value threshold being crossed. It overrode the AI and chose **Escalate to Human**. The system is completely safe because the AI cannot override deterministic business policies."*

## Scenario 3: Safety Limits & Stop (2:15 - 3:00)
> *"Lastly, what if a customer pays right as a reminder is about to go out? We don't want to spam them.*
> 
> *Because we use Redis and BullMQ, our Recovery Worker checks the actual MongoDB payment state milliseconds before it acts. If the payment is already captured, the pending recovery stops automatically. Revenue is counted, the pipeline is cleared, and the customer has a flawless experience."*
