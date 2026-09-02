import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import FailedPayments from './pages/FailedPayments';
import RecoveryCase from './pages/RecoveryCase';
import Escalations from './pages/Escalations';
import Architecture from './pages/Architecture';
import DemoControl from './pages/DemoControl';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col text-gray-800 bg-gray-50">
        <Navbar />
        <main className="flex-grow container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/failed" element={<FailedPayments />} />
            <Route path="/cases/:id" element={<RecoveryCase />} />
            <Route path="/escalations" element={<Escalations />} />
            <Route path="/architecture" element={<Architecture />} />
            <Route path="/demo-control" element={<DemoControl />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
