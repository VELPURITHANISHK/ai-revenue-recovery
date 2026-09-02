import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCaseDetail, analyzePayment, startRecovery, stopRecovery, simulateSuccess } from '../services/api';
import {
  Bot, ArrowLeft, Loader2, StopCircle, User, CreditCard,
  History, AlertTriangle, Play, CheckCircle2, XCircle, Wrench,
  DollarSign, Users
} from 'lucide-react';

// ─── Tool Result Panel ────────────────────────────────────────────────────────
const ToolResultPanel = ({ toolExecution }) => {
  if (!toolExecution) return null;
  const ok = toolExecution.status === 'SUCCESS';

  const toolLabel = {
    sendReminder:      'sendReminder()',
    createPaymentLink: 'createPaymentLink()',
    retryPayment:      'retryPayment()',
    escalateToHuman:   'escalateToHuman()',
    stopRecovery:      'stopRecovery()',
    SEND_REMINDER:     'sendReminder()',
    CREATE_PAYMENT_LINK:'createPaymentLink()',
    RETRY_PAYMENT:     'retryPayment()',
    ESCALATE_TO_HUMAN: 'escalateToHuman()',
    STOP_RECOVERY:     'stopRecovery()',
  }[toolExecution.tool] || `${toolExecution.tool}()`;

  return (
    <div className={`rounded-lg border-2 overflow-hidden ${ok ? 'border-green-200' : 'border-red-200'}`}>
      <div className={`px-5 py-3 flex items-center justify-between ${ok ? 'bg-green-50' : 'bg-red-50'}`}>
        <div className="flex items-center space-x-2">
          <Wrench className={`w-4 h-4 ${ok ? 'text-green-600' : 'text-red-600'}`} />
          <span className="font-mono text-sm font-bold">{toolLabel}</span>
        </div>
        <div className="flex items-center space-x-1">
          {ok
            ? <><CheckCircle2 className="w-4 h-4 text-green-600" /><span className="text-xs font-semibold text-green-700">Executed</span></>
            : <><XCircle className="w-4 h-4 text-red-600" /><span className="text-xs font-semibold text-red-700">Failed</span></>
          }
        </div>
      </div>
      <div className="px-5 py-4 bg-white">
        <p className={`text-sm ${ok ? 'text-gray-800' : 'text-red-700'}`}>{toolExecution.message}</p>
        {toolExecution.data?.paymentLinkUrl && (
          <a
            href={toolExecution.data.paymentLinkUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-indigo-600 underline text-sm"
          >
            Open Payment Link →
          </a>
        )}
      </div>
    </div>
  );
};

const AnalysisPanel = ({ analysis }) => {
  if (!analysis) return null;
  const riskColor = {
    HIGH:   'bg-red-100 text-red-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    LOW:    'bg-green-100 text-green-800',
  }[analysis.riskLevel] || 'bg-gray-100 text-gray-800';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 pb-4 border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Customer Profile</p>
          <p className="text-sm font-bold text-indigo-700">{analysis.customerSegment?.replace(/_/g, ' ') || 'UNKNOWN'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Failure Category</p>
          <p className="text-sm font-bold text-gray-800">{analysis.failureCategory?.replace(/_/g, ' ') || 'UNKNOWN'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Payment Risk</p>
          <span className={`px-2 py-1 rounded text-xs font-bold inline-block ${riskColor}`}>{analysis.riskLevel || 'UNKNOWN'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">AI Recommendation</p>
          <p className="text-sm font-bold text-gray-900">{analysis.aiDecision || analysis.decision}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Backend Decision</p>
          <p className={`text-sm font-bold ${analysis.policyOverride ? 'text-red-600' : 'text-green-600'}`}>
            {analysis.decision}
          </p>
        </div>
      </div>

      {analysis.policyOverride && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 mt-3">
          <p className="text-xs text-red-700 uppercase font-bold mb-1">Policy Override: YES</p>
          <p className="text-sm text-red-800">{analysis.overrideReason}</p>
        </div>
      )}

      {analysis.reason && (
        <div className="mt-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Reason</p>
          <p className="text-gray-800 bg-gray-50 p-3 rounded border border-gray-100 text-sm leading-relaxed">{analysis.reason}</p>
        </div>
      )}

      {analysis.expectedOutcome && (
        <div className="mt-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Expected Outcome</p>
          <p className="text-gray-600 text-sm italic">{analysis.expectedOutcome}</p>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const RecoveryCase = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [caseData,      setCaseData]      = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [analyzing,     setAnalyzing]     = useState(false);
  const [running,       setRunning]       = useState(false);
  const [simulating,    setSimulating]    = useState(false);
  const [error,         setError]         = useState(null);
  const [liveResult,    setLiveResult]    = useState(null); // Phase 4 real-time result

  const fetchDetail = async () => {
    try {
      const { data } = await getCaseDetail(id);
      setCaseData(data);
      setError(null);
    } catch (err) {
      setError('Could not load case details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, 10000);
    return () => clearInterval(interval);
  }, [id]);

  // Phase 3: Analyze only
  const handleAnalyze = async () => {
    setAnalyzing(true);
    setLiveResult(null);
    try {
      const { data } = await analyzePayment(id);
      setLiveResult({ mode: 'analyze', analysis: data.analysis });
      await fetchDetail();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to run AI analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  // Phase 4: Analyze + execute tool
  const handleRunRecovery = async () => {
    if (!window.confirm('This will run the AI agent and execute the recommended recovery action immediately. Continue?')) return;
    setRunning(true);
    setLiveResult(null);
    try {
      const { data } = await startRecovery(id);
      setLiveResult({
        mode: 'run',
        analysis: data.analysis,
        toolExecution: data.toolExecution,
        automation: data.automation,
      });
      await fetchDetail();
    } catch (err) {
      // 409 = already running
      if (err.response?.status === 409) {
        alert(`⚡ Automation already running!\n\n${err.response.data.message}\nNext: ${err.response.data.nextAction}`);
        await fetchDetail();
      } else {
        alert(err.response?.data?.message || 'Failed to run AI recovery');
      }
    } finally {
      setRunning(false);
    }
  };

  const handleSimulate = async () => {
    if (!window.confirm('This will simulate a Razorpay Webhook marking the payment as SUCCESS. Use this because local dev cannot receive real webhooks.')) return;
    setSimulating(true);
    try {
      await simulateSuccess(id);
      alert('Payment marked as CAPTURED!');
      await fetchDetail();
    } catch (err) {
      alert('Failed to simulate success');
    } finally {
      setSimulating(false);
    }
  };

  const handleStop = async () => {
    if (!window.confirm('Stop automated recovery for this payment?')) return;
    try {
      await stopRecovery(id);
      await fetchDetail();
    } catch (err) {
      alert('Failed to stop recovery');
    }
  };

  if (loading && !caseData) return (
    <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" /></div>
  );
  if (error) return <div className="p-8 text-red-500 text-center">{error}</div>;
  if (!caseData?.payment) return <div className="p-8 text-center">Payment not found.</div>;

  const { payment, customer, order, history, attempts = [] } = caseData;
  const isRecovered = payment.status === 'CAPTURED';

  // Latest executed tool action (from DB)
  const executedAttempts = attempts.filter(a => a.status === 'executed');
  const latestExecuted   = executedAttempts[executedAttempts.length - 1];

  // Latest AI analysis (from DB)
  const latestAnalysis = attempts.filter(a => a.status === 'analyzed').slice(-1)[0];

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <button onClick={() => navigate('/failed')} className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Failed Payments
      </button>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recovery Case</h1>
          <p className="text-gray-500 text-sm mt-1">Payment ID: {payment.id || payment._id}</p>
          <div className="flex items-center mt-2 space-x-3">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${isRecovered ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isRecovered ? '✓ Captured' : '✗ Failed'}
            </span>
          </div>
        </div>

        {!isRecovered && caseData?.case?.status !== 'ESCALATED' && (
          <div className="flex space-x-3">
            <button
              onClick={handleSimulate}
              disabled={simulating || payment.status === 'CAPTURED'}
              className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-emerald-300 font-medium text-sm transition"
            >
              {simulating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Simulate Customer Paid
            </button>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || running}
              className="flex items-center px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 disabled:opacity-50 transition"
            >
              {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
              {analyzing ? 'Analyzing...' : 'Analyze with AI'}
            </button>
            <button
              onClick={handleRunRecovery}
              disabled={analyzing || running}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition"
            >
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {running ? 'Running Recovery...' : 'Run AI Recovery'}
            </button>
            <button
              onClick={handleStop}
              disabled={analyzing || running || !['WAITING', 'IN_PROGRESS', 'ANALYZING'].includes(caseData.case?.status)}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 transition"
            >
              <StopCircle className="w-4 h-4 mr-2" /> Stop
            </button>
          </div>
        )}
      </div>

      {isRecovered && (
        <div className="mb-8 p-6 bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-lg text-white flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-extrabold flex items-center mb-2">
              <DollarSign className="w-8 h-8 mr-2" />
              PAYMENT RECOVERED
            </h2>
            <div className="flex gap-4 opacity-90 text-sm font-medium">
              <span>Amount: ₹{payment.amount}</span>
              <span>Recovery attempts: {attempts.filter(a => a.status === 'executed').length}</span>
              <span>Automation: STOPPED</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-90 mb-1">Recovered Revenue</div>
            <div className="text-4xl font-black">↑ ₹{payment.amount}</div>
          </div>
        </div>
      )}

      {caseData?.case?.status === 'ESCALATED' && (
        <div className="mb-8 p-6 bg-red-600 rounded-xl shadow-lg text-white flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-extrabold flex items-center mb-2">
              <Users className="w-8 h-8 mr-2" />
              HUMAN INTERVENTION REQUIRED
            </h2>
            <div className="flex gap-4 opacity-90 text-sm font-medium">
              <span>Reason: Automatic recovery limit reached.</span>
              <span>AI recommendation: Contact customer manually.</span>
            </div>
          </div>
          <button 
            onClick={() => navigate('/escalations')}
            className="bg-white text-red-600 px-6 py-2 rounded-lg font-bold shadow hover:bg-red-50"
          >
            View Escalations
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Context */}
        <div className="lg:col-span-1 space-y-5">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold flex items-center mb-3 text-gray-800">
              <User className="w-4 h-4 mr-2 text-gray-400" /> Customer
            </h3>
            <div className="text-sm space-y-1.5">
              <p><span className="text-gray-400">Name:</span> {customer?.name}</p>
              <p><span className="text-gray-400">Email:</span> {customer?.email}</p>
              <p><span className="text-gray-400">Phone:</span> {customer?.phone || 'N/A'}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold flex items-center mb-3 text-gray-800">
              <CreditCard className="w-4 h-4 mr-2 text-gray-400" /> Payment
            </h3>
            <div className="text-sm space-y-1.5">
              <p><span className="text-gray-400">Amount:</span> <span className="font-semibold">₹{payment.amount}</span></p>
              <p><span className="text-gray-400">Order:</span> #{order?.orderId}</p>
              <p className="text-red-600 bg-red-50 p-2 rounded text-xs mt-2 border border-red-100">{payment.failureReason}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold flex items-center mb-3 text-gray-800">
              <History className="w-4 h-4 mr-2 text-gray-400" /> History
            </h3>
            <div className="text-sm space-y-1.5">
              <p><span className="text-gray-400">Successful:</span> {history?.successful}</p>
              <p><span className="text-gray-400">Total Spent:</span> ₹{history?.totalPaid}</p>
              <p><span className="text-gray-400">Failures:</span> {history?.failed}</p>
            </div>
          </div>
        </div>

        {/* Right: AI Recovery Panel */}
        <div className="lg:col-span-2 space-y-5">
          {/* Live result (from this session's button click) */}
          {liveResult && (
            <div className="bg-white rounded-lg shadow-sm border-2 border-indigo-200 overflow-hidden">
              <div className="bg-indigo-50 border-b border-indigo-100 p-4 flex items-center">
                <Bot className="w-5 h-5 mr-2 text-indigo-600" />
                <h3 className="font-bold text-indigo-900">
                  {liveResult.mode === 'run' ? 'AI RECOVERY RESULT' : 'AI RECOVERY ANALYSIS'}
                </h3>
              </div>
              <div className="p-5 space-y-5">
                <AnalysisPanel analysis={liveResult.analysis} />
                {liveResult.toolExecution && <ToolResultPanel toolExecution={liveResult.toolExecution} />}
                {liveResult.automation && (
                  <div className={`flex items-center p-3 rounded-lg border text-sm ${
                    liveResult.automation.scheduled
                      ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}>
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 flex-shrink-0 ${liveResult.automation.scheduled ? 'bg-yellow-400 animate-pulse' : 'bg-gray-400'}`} />
                    {liveResult.automation.message}
                  </div>
                )}
                {liveResult.mode === 'analyze' && (
                  <div className="flex items-center p-3 bg-orange-50 text-orange-800 rounded-lg border border-orange-200 text-sm">
                    <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                    Recommendation only — click "Run AI Recovery" to execute the action.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scheduled next action */}
          {(() => {
            const scheduled = (attempts || []).filter(a => a.status === 'scheduled');
            if (!scheduled.length) return null;
            const next = scheduled[scheduled.length - 1];
            const runAt = next.scheduledFor ? new Date(next.scheduledFor) : null;
            const secsLeft = runAt ? Math.max(0, Math.round((runAt - Date.now()) / 1000)) : null;
            return (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center space-x-3">
                <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 animate-pulse flex-shrink-0"></span>
                <div>
                  <p className="font-semibold text-yellow-800 text-sm">Automation Active</p>
                  <p className="text-yellow-700 text-xs mt-0.5">
                    Next: <span className="font-mono font-bold">{next.decision}</span>
                    {secsLeft !== null && secsLeft > 0 && ` — in ~${secsLeft}s`}
                    {runAt && ` at ${runAt.toLocaleTimeString()}`}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Automation Timeline */}
          {attempts && attempts.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex justify-between items-center">
                <h3 className="font-semibold text-gray-700 text-sm">Recovery Action History</h3>
              </div>
              <div className="p-5">
                <div className="space-y-4">
                  {/* Payment Failed Event */}
                  <div className="flex text-sm">
                    <div className="mr-3 mt-0.5 text-red-500">✗</div>
                    <div>
                      <div className="font-medium text-gray-800">Payment failed</div>
                      <div className="text-gray-400 text-xs">{new Date(payment.createdAt).toLocaleTimeString()}</div>
                    </div>
                  </div>

                  {attempts.map((a) => {
                    const ok = a.status === 'executed' || a.status === 'successful';
                    const isPending = a.status === 'scheduled';
                    const isFail = a.result?.success === false && !isPending;
                    const isRecovered = a.status === 'successful' && a.result?.recovered;

                    return (
                      <div key={a._id} className="flex text-sm">
                        <div className={`mr-3 mt-0.5 ${
                          isRecovered ? 'text-green-500 text-base' :
                          ok ? 'text-green-500' :
                          isPending ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                          {isRecovered ? '💰' : ok ? '✓' : isPending ? '⏳' : '✗'}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-800">
                              {a.decision === 'SEND_REMINDER' ? 'Reminder sent' :
                               a.decision === 'CREATE_PAYMENT_LINK' ? 'Payment link created' :
                               a.decision === 'CHECK_PAYMENT' ? 'Payment checked' :
                               a.decision === 'ESCALATE_TO_HUMAN' ? 'Escalated to human' :
                               a.decision === 'STOP_RECOVERY' && a.result?.recovered ? 'Payment successful' :
                               a.decision === 'STOP_RECOVERY' ? 'Recovery stopped' :
                               a.decision || 'AI analyzed payment'}
                            </span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                              ok ? 'bg-green-100 text-green-700' : 
                              isPending ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {a.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-gray-400 text-xs mt-0.5">
                            {new Date(a.createdAt).toLocaleTimeString()}
                          </div>
                          {isRecovered && (
                            <div className="mt-1 font-bold text-green-600">
                              ₹{(payment.amount || 0).toLocaleString()} recovered
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!liveResult && executedAttempts.length === 0 && (
            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg h-56 flex flex-col items-center justify-center text-gray-400">
              <Bot className="w-12 h-12 text-gray-300 mb-3" />
              <p className="font-medium">No recovery actions yet</p>
              <p className="text-sm mt-1">Click "Analyze with AI" or "Run AI Recovery" to start</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecoveryCase;
