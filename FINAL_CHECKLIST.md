# Hackathon Submission Final Checklist

## Environment Setup
- [x] Node.js is installed
- [x] Both .env files (ecommerce/server and i-revenue-recovery/server) exist
- [x] PORT, MONGO_URI, OPENAI_API_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET are correctly populated
- [x] DEMO_MODE=true is set

## Infrastructure
- [x] **MongoDB:** Running locally or remotely and connected successfully
- [x] **Redis:** Installed (via winget or WSL) and running on localhost:6379
- [x] **Razorpay:** Test mode keys are valid

## Applications
- [x] **E-Commerce Backend:** Running on port 5000
- [x] **E-Commerce Frontend:** Running on port 5173
- [x] **Recovery Backend:** Running on port 5001
- [x] **Recovery Dashboard:** Running on port 5174

## Feature Verification
- [x] **Checkout:** Products can be added to cart and Razorpay modal opens
- [x] **Failed Payments:** Choosing "Failure" in Razorpay correctly updates MongoDB
- [x] **AI Agent:** Properly receives context and outputs structured JSON
- [x] **Decision Engine:** Node.js successfully intercepts and validates the AI recommendation
- [x] **Tools:** Reminders, Payment Links, and Escalations trigger correctly
- [x] **Automation:** BullMQ pushes jobs to Redis, and ecoveryWorker.js executes them
- [x] **Idempotency:** Simulating payment success stops all further automation
- [x] **Metrics:** Dashboard accurately calculates Revenue at Risk, Recovered Revenue, and Strategy groupings

## Documentation
- [x] README.md is populated and accurate
- [x] ARCHITECTURE.md accurately describes the isolation boundaries
- [x] DEMO_CONTROL.md provides a tight 3-minute script
- [x] Architecture.jsx visually communicates the 5 core steps (Detect -> Recover) and the Safety Guardrails
