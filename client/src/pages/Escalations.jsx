import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getEscalations, simulateSuccess, stopRecovery } from '../services/api';
import { AlertTriangle, User, CreditCard, Play, CheckCircle2, XCircle } from 'lucide-react';

const Escalations = () => {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEscalations = async () => {
    try {
      const res = await getEscalations();
      setEscalations(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscalations();
  }, []);

  const handleMarkRecovered = async (paymentId) => {
    if (!window.confirm('Mark this escalated case as manually recovered?')) return;
    try {
      await simulateSuccess(paymentId);
      fetchEscalations();
    } catch (err) {
      alert('Failed to update case');
    }
  };

  const handleCloseCase = async (paymentId) => {
    if (!window.confirm('Close this case without recovery?')) return;
    try {
      await stopRecovery(paymentId);
      fetchEscalations();
    } catch (err) {
      alert('Failed to update case');
    }
  };

  if (loading) return <div className="text-center py-20">Loading escalations...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <AlertTriangle className="w-8 h-8 text-orange-500" />
        <h1 className="text-3xl font-bold">Human Intervention Required</h1>
      </div>

      {escalations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
          No active human escalations.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {escalations.map((esc) => (
            <div key={esc._id} className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
              <div className="bg-red-50 border-b border-red-100 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-red-800">ESCALATED CASE</h3>
                    <p className="text-sm text-red-600 mt-1">Payment ID: {esc.paymentId?._id || esc.paymentId}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-800">
                      ₹{(esc.amount || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 block mb-1">Customer</span>
                    <div className="flex items-center font-medium">
                      <User className="w-4 h-4 mr-1 text-gray-400" />
                      {esc.userId?.name || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Order</span>
                    <div className="flex items-center font-medium">
                      <CreditCard className="w-4 h-4 mr-1 text-gray-400" />
                      {esc.orderId?.orderId || 'Unknown'}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase">Total Attempts</span>
                    <p className="font-medium text-gray-800">{esc.totalAttempts}</p>
                  </div>
                  
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase">AI Recommendation / Reason</span>
                    <p className="text-gray-700 mt-1 text-sm border-l-2 border-indigo-400 pl-3">
                      {esc.aiReason || 'Repeated payment failures exceeded automatic recovery limit.'}
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleMarkRecovered(esc.paymentId?._id || esc.paymentId)}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark Recovered
                  </button>
                  <button
                    onClick={() => handleCloseCase(esc.paymentId?._id || esc.paymentId)}
                    className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Close Case
                  </button>
                  <Link
                    to={`/cases/${esc.paymentId?._id || esc.paymentId}`}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 text-sm font-medium"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    View Timeline
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Escalations;
