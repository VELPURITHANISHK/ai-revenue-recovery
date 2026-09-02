# AI Revenue Recovery Agent

**One-line description:** An autonomous AI Agent that detects failed payments, analyzes customer history, decides the best recovery strategy, and automates follow-ups until the revenue is recovered.

## Problem Statement
Revenue doesn't disappear in one step. Payments fail. Customers abandon checkout. Subscriptions fail. Invoices become overdue. Businesses often identify these problems but do not recover the revenue efficiently, relying on generic mass emails or expensive human support agents.

## Solution
This project implements a complete microservices architecture where an autonomous AI Agent acts as a Senior Billing Manager. 
Instead of a simple chatbot, this system:
1. **DETECTS** failed payments automatically from a shared database.
2. **UNDERSTANDS** customer context (lifetime value, previous failures).
3. **DECIDES** on the most effective recovery strategy.
4. **ACTS** by triggering deterministic backend tools.
5. **AUTOMATES** follow-ups via a distributed BullMQ/Redis queue until the payment succeeds or requires human escalation.

## Why this is an AI Agent and not just a chatbot
Most ""AI"" in e-commerce is just a chat interface. This is a true agentic system:
- **No User Chat Interface:** The AI operates entirely in the background.
- **Tool Calling:** The AI executes real business logic (sending emails, creating payment links, escalating to human queues).
- **Temporal Automation:** Using Redis and BullMQ, the AI schedules its own future tasks, loops back to check if the payment succeeded, and takes follow-up actions without human intervention.
- **Business Safeguards:** The AI is decoupled from direct execution. It recommends actions to a deterministic Node.js Decision Engine which enforces strict rate limits.

## Key Features
- **MERN E-commerce Stack:** Fully functional e-commerce app with Razorpay integration.
- **AI Tool Calling:** OpenAI integration using structured JSON output and explicit function execution.
- **Redis + BullMQ Automation:** Fault-tolerant job queue for robust background scheduling.
- **Live Demo Dashboard:** Real-time visibility into the AI's actions, pipelines, and recovered revenue ROI.
- **Hackathon Demo Mode:** Accelerated time delays to show a multi-day recovery process in just 3 minutes.

## Complete Architecture
- **E-commerce App:** React, Context API, Tailwind, Express.
- **Payment Gateway:** Razorpay Test Mode.
- **Shared Database:** MongoDB (Users, Orders, Payments, Recovery Cases, Attempts).
- **AI Agent Backend:** Express, OpenAI API, BullMQ, Redis.
- **Recovery Dashboard:** React, Recharts, Tailwind.

## AI Decision Flow
1. **Customer + Payment Context:** Merges data from EcomPayment, EcomUser, and EcomOrder.
2. **AI Decision Engine:** GPT-4o analyzes the JSON context and outputs a structured recovery decision (e.g. CREATE_PAYMENT_LINK, SEND_REMINDER).
3. **Policy/Safety Layer:** A deterministic script validates the AI decision against limits (e.g., max 3 retries).
4. **Tool Executor:** The validated decision maps to a specific Node.js function.

## Automation Flow (BullMQ + Redis)
When the AI decides to follow up, the backend schedules a CHECK_PAYMENT job in BullMQ with a specific delay. When the delay expires, the worker checks MongoDB. If the payment is still failed, the AI is invoked again. If the payment succeeded, the recovery stops automatically.

## MongoDB Collections
- ecomusers / ecomproducts / ecomorders / ecompayments: Core store data.
- ecoverycases: Central state of a failed payment recovery effort.
- ecoveryattempts: Audit log of every AI analysis, backend decision, tool execution, and automation schedule.

## Security and Safety Guardrails
- AI does NOT directly access MongoDB, Redis, or Razorpay.
- AI cannot execute arbitrary code. It can only trigger whitelisted tool endpoints.
- Backend restricts execution via MAX_RETRIES (3), MAX_REMINDERS (2), and MAX_TOTAL_ATTEMPTS (5).
- If the payment succeeds, idempotency checks immediately kill any pending jobs.

## DEMO_MODE Explanation
By setting DEMO_MODE=true, the delays that usually take days (e.g., waiting 48 hours for an email response) are condensed into seconds (e.g., 10 seconds, 15 seconds) so you can demonstrate the full loop live to judges.

---

## Installation & Setup

### Environment Variables
Create a .env file in **both** ecommerce/server and i-revenue-recovery/server:
`env
PORT=5000 # (or 5001 for AI server)
MONGO_URI=mongodb://127.0.0.1:27017/ai_revenue_recovery
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
OPENAI_API_KEY=your_openai_key
DEMO_MODE=true
`

### Running Redis
You must have Redis installed and running on port 6379.
On Windows: Run edis-server.exe.
On Mac/Linux: Run edis-server.

### Running the System
You need 4 terminal tabs:

**Tab 1: E-commerce Backend**
`ash
cd ecommerce/server
npm install
npm run dev
`

**Tab 2: E-commerce Frontend (Port 5173)**
`ash
cd ecommerce/client
npm install
npm run dev
`

**Tab 3: AI Recovery Backend (Port 5001)**
`ash
cd ai-revenue-recovery/server
npm install
npm run dev
`

**Tab 4: AI Recovery Dashboard (Port 5174)**
`ash
cd ai-revenue-recovery/client
npm install
npm run dev
`

---

## Complete Demo Scenarios

### Scenario 1: The Standard Recovery
1. Go to localhost:5174 and click **Reset Demo**.
2. Go to localhost:5173, add a product, checkout.
3. In the Razorpay test window, select **Failure**.
4. Go to the Dashboard, watch the **Revenue at Risk** increase.
5. Click **Run Full Recovery Demo**.
6. The AI will analyze, execute a tool, and schedule automation.
7. Click **Simulate Customer Paid**. The automation stops, and the revenue is successfully marked as recovered!

### Scenario 2: High Value Override
1. Add ₹15,000+ worth of items to the cart and fail the checkout.
2. Run the AI Recovery.
3. Observe how the Decision Engine marks it as HIGH RISK, and potentially overrides standard reminders in favor of immediate human escalation or payment links.

### Future Improvements
- Two-way email integration via SendGrid (detecting customer replies).
- Real predictive ML models for churn probability.
- Twilio integration for automated SMS recovery links.
