import React, { useState, useEffect } from 'react';
import { getCases, resetDemo, startRecovery, analyzePayment, stopRecovery } from '../services/api';

function DemoControl() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const { data } = await getCases();
      setCases(data.cases || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleReset = async () => {
    if (!window.confirm("Delete all data?")) return;
    await resetDemo();
    fetchCases();
  };

  const handleAction = async (paymentId, action) => {
    try {
      if (action === 'analyze') await analyzePayment(paymentId);
      if (action === 'start') await startRecovery(paymentId);
      if (action === 'stop') await stopRecovery(paymentId);
      fetchCases();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  if (import.meta.env.VITE_DEMO_MODE !== 'true') {
    return <div className="p-8"><h1>Demo Mode is disabled.</h1></div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">🛠️ Demo Control Center</h1>
        <div className="space-x-4">
          <button onClick={fetchCases} className="px-4 py-2 bg-blue-100 text-blue-800 rounded">Refresh Status</button>
          <button onClick={handleReset} className="px-4 py-2 bg-red-600 text-white rounded">Reset Demo</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-xl font-bold mb-4">Active & Failed Payments</h2>
        {loading ? <p>Loading...</p> : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th className="py-2">Payment ID</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.payment._id} className="border-b">
                  <td className="py-2">{c.payment._id}</td>
                  <td>₹{c.payment.amount}</td>
                  <td>
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm">{c.case?.status || c.payment.status}</span>
                  </td>
                  <td className="space-x-2">
                    {(!c.case || c.case.status === 'PENDING') && (
                      <button onClick={() => handleAction(c.payment._id, 'analyze')} className="text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded">Analyze AI</button>
                    )}
                    {c.case && c.case.status === 'ANALYZING' && (
                      <button onClick={() => handleAction(c.payment._id, 'start')} className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded">Start Recovery</button>
                    )}
                    {c.case && ['WAITING', 'IN_PROGRESS'].includes(c.case.status) && (
                      <button onClick={() => handleAction(c.payment._id, 'stop')} className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded">Stop Recovery</button>
                    )}
                    <a href={`/cases/${c.payment._id}`} className="text-sm text-blue-600 hover:underline px-2">View Case</a>
                  </td>
                </tr>
              ))}
              {cases.length === 0 && <tr><td colSpan="4" className="py-4 text-center">No payments found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default DemoControl;
