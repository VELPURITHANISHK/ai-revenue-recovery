import React from 'react';
import { Search, Brain, GitBranch, Wrench, ShieldCheck, Repeat, StopCircle, UserCheck } from 'lucide-react';

function Architecture() {
  return (
    <div className="max-w-6xl mx-auto pb-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">How It Works</h1>
      <p className="text-gray-500 mb-8">The anatomy of our autonomous Revenue Recovery AI Agent.</p>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-12">
        {/* DETECT */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">1. DETECT</h3>
          <p className="text-xs text-gray-500">Finds failed payments across E-commerce platforms via Razorpay/MongoDB webhooks.</p>
        </div>

        {/* UNDERSTAND */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative text-center">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Brain className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">2. UNDERSTAND</h3>
          <p className="text-xs text-gray-500">Analyzes customer lifetime value, failure reasons, and historical payment risk.</p>
        </div>

        {/* DECIDE */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative text-center">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <GitBranch className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">3. DECIDE</h3>
          <p className="text-xs text-gray-500">AI selects a targeted recovery strategy. Validated immediately by backend policies.</p>
        </div>

        {/* ACT */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative text-center">
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Wrench className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">4. ACT</h3>
          <p className="text-xs text-gray-500">Backend executes controlled tools: Send Reminders, Payment Links, or Escalations.</p>
        </div>

        {/* RECOVER */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative text-center">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Repeat className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">5. RECOVER</h3>
          <p className="text-xs text-gray-500">Automation (BullMQ/Redis) follows up until recovered, escalated, or stopped.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-indigo-50 border-b border-indigo-100 p-5 flex items-center">
            <ShieldCheck className="w-6 h-6 mr-3 text-indigo-600" />
            <h2 className="text-lg font-bold text-indigo-900">Safety & Guardrails</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-6">
              AI agents must be deterministic, auditable, and safe. Our AI strictly recommends actions, but the Node.js backend has the final say.
            </p>
            <ul className="space-y-4">
              <li className="flex items-start">
                <StopCircle className="w-5 h-5 mr-3 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-sm text-gray-900 block">Strict Rate Limits</strong>
                  <span className="text-xs text-gray-500">Maximum retry limits (3), max reminders (2), and max total attempts (5) are hardcoded in the backend.</span>
                </div>
              </li>
              <li className="flex items-start">
                <UserCheck className="w-5 h-5 mr-3 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-sm text-gray-900 block">Backend Policy Validation</strong>
                  <span className="text-xs text-gray-500">The AI's choice is processed through a deterministic Decision Engine. If the AI hallucinates or violates policy, it is overridden.</span>
                </div>
              </li>
              <li className="flex items-start">
                <ShieldCheck className="w-5 h-5 mr-3 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-sm text-gray-900 block">No Direct Access</strong>
                  <span className="text-xs text-gray-500">The AI cannot execute arbitrary code. It does NOT have access to MongoDB, Redis, or Razorpay credentials. It merely triggers pre-built Node.js functions.</span>
                </div>
              </li>
              <li className="flex items-start">
                <Repeat className="w-5 h-5 mr-3 text-orange-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-sm text-gray-900 block">Idempotency & State Verification</strong>
                  <span className="text-xs text-gray-500">Before executing any tool, the backend pulls the latest real-time payment status. If the payment is already successful, recovery immediately halts.</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 p-5 flex items-center">
            <GitBranch className="w-6 h-6 mr-3 text-gray-600" />
            <h2 className="text-lg font-bold text-gray-900">System Architecture Flow</h2>
          </div>
          <div className="p-6 bg-gray-900 text-green-400 font-mono text-xs leading-6 overflow-x-auto whitespace-pre h-full">
{`CUSTOMER → E-COMMERCE APP
              ↓
      FAILED RAZORPAY TEST
              ↓
       MONGODB DATABASE
              ↓
  RECOVERY WORKER PICKS UP CASE
              ↓
    PULLS CUSTOMER & HISTORY
              ↓
        DECISION ENGINE (GPT-4o)
              ↓
       BACKEND POLICY CHECK
       (Overrides if unsafe)
              ↓
        TOOL EXECUTOR
  ┌───────────┼───────────┐
  ↓           ↓           ↓
 REMINDER  PAY LINK   ESCALATE
  └───────────┼───────────┘
              ↓
       BULLMQ + REDIS 
    (Schedules Next Check)
              ↓
       PAYMENT SUCCESS?
        ↙          ↘
      YES          NO
       ↓            ↓
  STOP RECOVERY    AI LOOP`}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Architecture;
