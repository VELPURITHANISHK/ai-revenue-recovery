import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, AlertTriangle, ShieldCheck, Users } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-indigo-900 text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link to="/" className="text-xl font-bold flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-green-400" />
            <span>AI Revenue Recovery</span>
          </Link>
          <span className="px-2 py-1 bg-yellow-500 text-yellow-900 text-xs font-bold rounded">RAZORPAY TEST MODE</span>
          {import.meta.env.VITE_DEMO_MODE === 'true' && (
            <span className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded">DEMO MODE</span>
          )}
        </div>
        <div className="flex space-x-6 items-center">
          <Link 
            to="/" 
            className={`flex items-center space-x-1 hover:text-indigo-200 transition ${isActive('/') ? 'text-indigo-200 font-semibold' : ''}`}
          >
            <Activity className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <Link 
            to="/architecture" 
            className={`flex items-center space-x-1 hover:text-indigo-200 transition ${isActive('/architecture') ? 'text-indigo-200 font-semibold' : ''}`}
          >
            <span>Architecture</span>
          </Link>
          <Link 
            to="/failed" 
            className={`flex items-center space-x-1 hover:text-indigo-200 transition ${isActive('/failed') ? 'text-indigo-200 font-semibold' : ''}`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Failed Payments</span>
          </Link>
          <Link 
            to="/escalations" 
            className={`flex items-center space-x-1 hover:text-indigo-200 transition ${isActive('/escalations') ? 'text-indigo-200 font-semibold' : ''}`}
          >
            <Users className="w-4 h-4" />
            <span>Escalations</span>
          </Link>
          {import.meta.env.VITE_DEMO_MODE === 'true' && (
            <Link to="/demo-control" className="px-3 py-1 bg-indigo-700 hover:bg-indigo-600 rounded text-sm font-semibold transition">
              Demo Control
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
