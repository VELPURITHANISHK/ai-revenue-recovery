import React from 'react';
import { CheckCircle, Clock, AlertCircle, XCircle, Mail, Link as LinkIcon, RotateCcw, StopCircle } from 'lucide-react';

const getActionIcon = (action, status) => {
  if (status === 'failed') return <XCircle className="w-5 h-5 text-red-500" />;
  if (status === 'scheduled') return <Clock className="w-5 h-5 text-blue-500" />;
  
  switch(action) {
    case 'reminder': return <Mail className="w-5 h-5 text-blue-600" />;
    case 'payment_link': return <LinkIcon className="w-5 h-5 text-indigo-500" />;
    case 'retry': return <RotateCcw className="w-5 h-5 text-orange-500" />;
    case 'escalation': return <AlertCircle className="w-5 h-5 text-red-600" />;
    case 'stopped': return <StopCircle className="w-5 h-5 text-gray-500" />;
    default: return <CheckCircle className="w-5 h-5 text-green-500" />;
  }
};

const formatActionName = (action) => {
  const map = {
    'reminder': 'Email Reminder',
    'payment_link': 'Payment Link Created',
    'retry': 'Retry Scheduled',
    'escalation': 'Human Escalation',
    'stopped': 'Recovery Stopped'
  };
  return map[action] || action;
};

const ActivityLog = ({ activities = [] }) => {
  if (!activities.length) {
    return <p className="text-gray-500 italic">No activity yet.</p>;
  }

  return (
    <div className="relative border-l border-gray-200 ml-3 space-y-6">
      {activities.map((act, i) => (
        <div key={i} className="mb-6 ml-6 relative">
          <span className="absolute -left-9 flex items-center justify-center w-6 h-6 bg-white rounded-full ring-8 ring-white">
            {getActionIcon(act.action, act.status)}
          </span>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-1">
            <h4 className="font-medium text-gray-900">{formatActionName(act.action)}</h4>
            <time className="text-xs text-gray-500 sm:ml-4 whitespace-nowrap">
              {new Date(act.createdAt).toLocaleString()}
            </time>
          </div>
          <p className="text-sm text-gray-600 mt-1">{act.reason}</p>
          
          {act.status === 'scheduled' && (
            <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              Scheduled
            </span>
          )}
          {act.status === 'successful' && (
            <span className="inline-block mt-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              Successful
            </span>
          )}
          
          {act.aiDecision && (
            <div className="mt-2 bg-indigo-50 p-3 rounded text-sm text-indigo-900 border border-indigo-100">
              <span className="font-semibold block mb-1">AI Recommendation:</span>
              {act.aiDecision}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ActivityLog;
