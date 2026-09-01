import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  UserCheck,
  FileSpreadsheet,
  Shield,
  Activity,
  Radio,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Sun,
  Moon,
  HelpCircle,
  Sparkles,
  Layers,
  Scale
} from 'lucide-react';
import Overview from './pages/Overview';
import WorkerHistory from './pages/WorkerHistory';
import DGMSReport from './pages/DGMSReport';
import StandardsPage from './pages/StandardsPage';
import OnboardingModal from './components/OnboardingModal';

export default function App() {
  const [currentPage, setCurrentPage] = useState('overview'); // 'overview' | 'history' | 'dgms' | 'standards'
  const [selectedWorkerId, setSelectedWorkerId] = useState('W1001');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('h2s_dashboard_theme');
    return saved ? saved === 'dark' : true;
  });
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Apply theme to document element
  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('h2s_dashboard_theme', theme);
  }, [isDarkMode]);

  // Check if first-time user for orientation modal
  useEffect(() => {
    const hasSeenIntro = localStorage.getItem('h2s_seen_intro_v2');
    if (!hasSeenIntro) {
      setShowOnboarding(true);
      localStorage.setItem('h2s_seen_intro_v2', 'true');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

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
          width: '270px',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px', paddingLeft: '8px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(6, 182, 212, 0.4)',
              flexShrink: 0
            }}
          >
            <Shield size={22} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              H₂S DOSIMETER
            </h2>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: '700', letterSpacing: '0.06em' }}>
              SAFETY SUITE (MRPL)
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
              border: currentPage === 'overview' ? '1px solid var(--border-active)' : '1px solid transparent',
              background: currentPage === 'overview' ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
              color: currentPage === 'overview' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
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
              border: currentPage === 'history' ? '1px solid var(--border-active)' : '1px solid transparent',
              background: currentPage === 'history' ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
              color: currentPage === 'history' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
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
              border: currentPage === 'dgms' ? '1px solid var(--border-active)' : '1px solid transparent',
              background: currentPage === 'dgms' ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
              color: currentPage === 'dgms' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
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

          <button
            onClick={() => setCurrentPage('standards')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              border: currentPage === 'standards' ? '1px solid var(--border-active)' : '1px solid transparent',
              background: currentPage === 'standards' ? 'rgba(6, 182, 212, 0.12)' : 'transparent',
              color: currentPage === 'standards' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'left'
            }}
          >
            <Scale size={18} />
            <span>Standards & TWA</span>
          </button>
        </nav>

        {/* Middle Help / Orientation Action */}
        <div style={{ marginTop: '20px' }}>
          <button
            onClick={() => setShowOnboarding(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)',
              border: '1px solid var(--border-active)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <Sparkles size={16} color="var(--accent-cyan)" />
            <span>Orientation Guide</span>
          </button>
        </div>

        {/* Bottom System Status & Theme Controls */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Theme Switcher Button */}
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {isDarkMode ? <Sun size={15} color="#eab308" /> : <Moon size={15} color="#6366f1" />}
            <span>Theme: {isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
          </button>

          <div className="glass-card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Radio size={14} color="#10b981" />
              <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#10b981' }}>
                TELEMETRY ACTIVE
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Backend: <code>localhost:5000</code><br />
              Standard: <strong>ACGIH / OSHA / DGMS</strong>
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

        {currentPage === 'standards' && (
          <StandardsPage />
        )}
      </main>

      {/* Interactive New Joiner Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
}
