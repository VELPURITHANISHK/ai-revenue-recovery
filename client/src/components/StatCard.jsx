import React from 'react';

const StatCard = ({ title, value, subtitle, icon: Icon, colorClass }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-full ${colorClass}`}>
        {Icon && <Icon className="w-6 h-6" />}
      </div>
    </div>
  );
};

export default StatCard;
