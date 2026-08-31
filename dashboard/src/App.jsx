import React, { useState } from 'react';
import {
  LayoutDashboard,
  UserCheck,
  FileSpreadsheet,
  Shield,
  Activity,
  Radio,
  ExternalLink,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import Overview from './pages/Overview';
import WorkerHistory from './pages/WorkerHistory';
import DGMSReport from './pages/DGMSReport';

export default function App() {
  const [currentPage, setCurrentPage] = useState('overview'); // 'overview' | 'history' | 'dgms'
  const [selectedWorkerId, setSelectedWorkerId] = useState('W1023');

  const handleSelectWorkerFromOverview = (workerId) => {
    setSelectedWorkerId(workerId);
    setCurrentPage('history');
  };

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: 'var(--bg-app)' }}>
      {/* Left Navigation Sidebar */}
      <aside
        className="no-print"
        style={{
          width: '260px',
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 16px',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh'
        }}
      >
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', paddingLeft: '8px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(6, 182, 212, 0.4)'
            }}
          >
            <Shield size={22} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#f8fafc', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              H₂S DOSIMETER
            </h2>
            <span style={{ fontSize: '0.7rem', color: '#06b6d4', fontWeight: '700', letterSpacing: '0.06em' }}>
              SAFETY DASHBOARD
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => setCurrentPage('overview')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              border: currentPage === 'overview' ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid transparent',
              background: currentPage === 'overview' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              color: currentPage === 'overview' ? '#38bdf8' : '#94a3b8',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left'
            }}
          >
            <LayoutDashboard size={18} />
            <span>Fleet Overview</span>
          </button>

          <button
            onClick={() => setCurrentPage('history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              border: currentPage === 'history' ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid transparent',
              background: currentPage === 'history' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              color: currentPage === 'history' ? '#38bdf8' : '#94a3b8',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left'
            }}
          >
            <UserCheck size={18} />
            <span>Worker History</span>
          </button>

          <button
            onClick={() => setCurrentPage('dgms')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              border: currentPage === 'dgms' ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid transparent',
              background: currentPage === 'dgms' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
              color: currentPage === 'dgms' ? '#38bdf8' : '#94a3b8',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left'
            }}
          >
            <FileSpreadsheet size={18} />
            <span>DGMS / OISD Report</span>
          </button>
        </nav>

        {/* Bottom System Status Box */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="glass-card" style={{ padding: '14px', background: 'rgba(15, 23, 42, 0.7)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Radio size={14} color="#10b981" />
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#34d399' }}>
                TELEMETRY CONNECTED
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: '1.4' }}>
              Backend API: <code>localhost:5000</code><br />
              Standard: <strong>DGMS / OISD-114</strong>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Page Area */}
      <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', maxHeight: '100vh' }}>
        {currentPage === 'overview' && (
          <Overview onSelectWorker={handleSelectWorkerFromOverview} />
        )}

        {currentPage === 'history' && (
          <WorkerHistory
            initialWorkerId={selectedWorkerId}
            onBack={() => setCurrentPage('overview')}
          />
        )}

        {currentPage === 'dgms' && (
          <DGMSReport />
        )}
      </main>
    </div>
  );
}
