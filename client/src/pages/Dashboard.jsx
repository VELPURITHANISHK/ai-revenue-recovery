import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats, resetDemo, getGlobalActivity, getFailedPayments, analyzePayment, startRecovery } from '../services/api';
import StatCard from '../components/StatCard';
import {
  DollarSign, AlertCircle, CheckCircle, Clock,
  Users, Activity, Zap, TrendingUp, RefreshCw, Trash2, Play
} from 'lucide-react';

const statusDot = {
  analyzed:   'bg-blue-400',
  scheduled:  'bg-yellow-400 animate-pulse',
  executed:   'bg-green-500',
  successful: 'bg-green-600',
  cancelled:  'bg-gray-400',
  failed:     'bg-red-500',
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats,    setStats]    = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [demoStarting, setDemoStarting] = useState(false);

  const fetchData = async () => {
    try {
      const [statsRes, activityRes] = await Promise.all([
        getStats(),
        getGlobalActivity()
      ]);
      setStats(statsRes.data);
      setActivity(activityRes.data.activities || []);
      setLoading(false);
      setError(null);
    } catch (err) {
      setError(`Error: ${err.message || 'Could not load dashboard stats'}`);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleReset = async () => {
    if (!window.confirm('WARNING: This will clear all AI recovery cases and attempts for demo purposes. E-commerce data will NOT be touched. Continue?')) return;
    try {
      await resetDemo();
      fetchData();
      alert('Demo data cleared.');
    } catch (err) {
      alert('Failed to reset demo data');
    }
  };

  const handleRunDemo = async () => {
    setDemoStarting(true);
    try {
      const { data } = await getFailedPayments();
      const pendingPayment = data.payments.find(p => p.status === 'FAILED' && (!p.recoveryCase || p.recoveryCase.status === 'PENDING'));
      
      if (!pendingPayment) {
        alert("No pending failed payments found. Please go to the Store and fail a checkout first.");
        setDemoStarting(false);
        return;
      }

      const paymentId = pendingPayment._id;
      // Step 1: Analyze
      await analyzePayment(paymentId);
      // Step 2: Start Recovery
      await startRecovery(paymentId);
      // Step 3: Redirect to case
      navigate(`/cases/${paymentId}`);
    } catch (err) {
      alert('Failed to start demo: ' + err.message);
      setDemoStarting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;
  if (error)   return <div className="p-8 text-red-500 text-center">{error}</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recovery Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-2">
            Real-time AI revenue recovery operations.
            {import.meta.env.VITE_DEMO_MODE === 'true' && <span className="bg-blue-100 text-blue-800 px-2 rounded font-bold text-xs">DEMO MODE ACTIVE</span>}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={handleReset} className="flex items-center space-x-2 text-gray-500 hover:text-red-600 transition text-sm">
            <Trash2 className="w-4 h-4" />
            <span>Reset Demo</span>
          </button>
          <div className="flex items-center space-x-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-medium text-sm">
            <Activity className="w-4 h-4 animate-pulse" />
            <span>Live — refreshes every 8s</span>
          </div>
          {import.meta.env.VITE_DEMO_MODE === 'true' && (
            <button 
              onClick={handleRunDemo} 
              disabled={demoStarting}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow transition disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>{demoStarting ? 'Starting...' : 'Run Full Recovery Demo'}</span>
            </button>
          )}
        </div>
      </div>


      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard
          title="Revenue at Risk"
          value={`₹${stats.revenueAtRisk.toLocaleString()}`}
          icon={AlertCircle}
          colorClass="bg-orange-100 text-orange-600"
        />
        <StatCard
          title="Recovered Revenue"
          value={`₹${stats.recoveredRevenue.toLocaleString()}`}
          icon={DollarSign}
          colorClass="bg-green-100 text-green-600"
        />
        <StatCard
          title="Recovery Rate"
          value={`${stats.recoveryRate}%`}
          subtitle="Of failed payment value"
          icon={TrendingUp}
          colorClass="bg-blue-100 text-blue-600"
        />
        <StatCard
          title="Failed Payments"
          value={stats.failedPayments}
          icon={Clock}
          colorClass="bg-red-100 text-red-600"
        />
        <StatCard
          title="Active Cases"
          value={stats.activeRecoveries}
          subtitle="In automated pipeline"
          icon={Zap}
          colorClass="bg-yellow-100 text-yellow-600"
        />
        <StatCard
          title="Successful Recoveries"
          value={stats.successfulRecoveries}
          icon={CheckCircle}
          colorClass="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          title="Escalations"
          value={stats.humanEscalations}
          icon={Users}
          colorClass="bg-purple-100 text-purple-600"
        />
        <StatCard
          title="Average Recovery Time"
          value={`${stats.avgRecoveryTimeHrs || 0} hrs`}
          icon={RefreshCw}
          colorClass="bg-indigo-100 text-indigo-600"
        />
      </div>

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="flex flex-col space-y-6">
          {/* Recovery Funnel (LIVE RECOVERY PIPELINE) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-indigo-500" /> LIVE RECOVERY PIPELINE
            </h2>
            
            <div className="space-y-4 relative">
              <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gray-100 z-0"></div>
              
              <div className="relative z-10 flex items-center bg-white">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold border-4 border-white">
                  {stats.pipeline?.failed || 0}
                </div>
                <div className="ml-4 flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100 flex justify-between items-center">
                  <span className="font-medium text-gray-700">PAYMENT FAILED</span>
                  <span className="text-xs font-bold text-gray-400">✕ Failed</span>
                </div>
              </div>

              <div className="relative z-10 flex items-center bg-white">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-4 border-white">
                  {stats.pipeline?.analyzing || 0}
                </div>
                <div className="ml-4 flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100 flex justify-between items-center">
                  <span className="font-medium text-gray-700">AI ANALYZING & DECISION</span>
                  <span className="text-xs font-bold text-blue-500">○ Pending</span>
                </div>
              </div>

              <div className="relative z-10 flex items-center bg-white">
                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 font-bold border-4 border-white">
                  {stats.pipeline?.active || 0}
                </div>
                <div className="ml-4 flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100 flex justify-between items-center">
                  <span className="font-medium text-gray-700">TOOL EXECUTED & AUTOMATION SCHEDULED</span>
                  <span className="text-xs font-bold text-yellow-500">● Running</span>
                </div>
              </div>

              <div className="relative z-10 flex items-center bg-white">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold border-4 border-white">
                  {stats.pipeline?.recovered || 0}
                </div>
                <div className="ml-4 flex-1 bg-green-50 rounded-lg p-3 border border-green-100 flex justify-between items-center">
                  <span className="font-medium text-green-700">RECOVERED</span>
                  <span className="text-xs font-bold text-green-600">✓ Completed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Strategy Performance */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-blue-500" /> RECOVERY BY STRATEGY
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                <span className="font-medium text-gray-700">Payment Link</span>
                <span className="font-bold text-green-600">₹{(stats.strategies?.PAYMENT_LINK || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                <span className="font-medium text-gray-700">Reminder</span>
                <span className="font-bold text-green-600">₹{(stats.strategies?.GENTLE_REMINDER || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                <span className="font-medium text-gray-700">Human Escalation</span>
                <span className="font-bold text-green-600">₹{(stats.strategies?.HUMAN_ESCALATION || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Activity Log */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col h-[500px]">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-yellow-500" /> LIVE AGENT ACTIVITY
          </h2>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {activity.map(act => (
              <div key={act._id} className="text-sm border-b pb-2">
                <div className="flex justify-between text-gray-500 text-xs mb-1">
                  <span>{new Date(act.createdAt).toLocaleTimeString()}</span>
                  <span className="font-mono bg-gray-100 px-1 rounded">{act.paymentId?._id?.substring(18)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${statusDot[act.status] || 'bg-gray-400'}`}></span>
                  <span className="font-medium text-gray-800">{
                    act.status === 'analyzed' ? `Decision: ${act.decision}` :
                    act.status === 'executed' ? `Tool executed: ${act.decision}` :
                    act.status === 'scheduled' ? `Automated follow-up scheduled` :
                    act.status === 'cancelled' ? `Automation stopped` : act.decision
                  }</span>
                </div>
                {act.reason && <div className="text-gray-500 text-xs mt-1 ml-4 truncate">{act.reason}</div>}
              </div>
            ))}
            {activity.length === 0 && <p className="text-gray-400 text-sm">No activity yet. Fail a payment to see the AI agent in action.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
