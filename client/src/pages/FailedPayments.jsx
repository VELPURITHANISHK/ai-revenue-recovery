import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFailedPayments } from '../services/api';
import { Bot, User, AlertTriangle } from 'lucide-react';

const FailedPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const { data } = await getFailedPayments();
        setPayments(data);
      } catch (err) {
        console.error('Failed to load payments', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading failed payments...</div>;
  if (error) return <div className="p-8 text-center text-red-500">API Error: {error}</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Failed Payments</h1>
        <p className="text-gray-500">Payments that require recovery action from the e-commerce database.</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Failure Reason</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                  No failed payments found. Run the e-commerce app and simulate a failed payment.
                </td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{p.user?.name || 'Unknown'}</div>
                      <div className="text-sm text-gray-500">{p.user?.email || 'N/A'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">₹{p.amount}</div>
                  <div className="text-xs text-gray-500">Order #{p.order?.orderId || 'N/A'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center text-sm text-red-600">
                    <AlertTriangle className="w-4 h-4 mr-1 flex-shrink-0" />
                    <span className="truncate max-w-[200px]">{p.failureReason || 'Unknown error'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(p.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => navigate(`/cases/${p._id}`)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Bot className="w-4 h-4 mr-2" />
                    {p.attemptCount > 0 ? 'View Case' : 'Analyze with AI'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FailedPayments;
