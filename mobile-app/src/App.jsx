import React, { useState, useEffect } from 'react';
import WorkerIdScreen from './screens/WorkerIdScreen';
import CaptureScreen from './screens/CaptureScreen';
import ResultScreen from './screens/ResultScreen';
import MobileDebugScreen from './screens/MobileDebugScreen';
import CameraCalibrationScreen from './screens/CameraCalibrationScreen';
import MobileOnboardingModal from './components/MobileOnboardingModal';
import NetworkStatusModal from './components/NetworkStatusModal';
import { checkBackendHealth } from './services/api';
import {
  ShieldCheck,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Sparkles,
  Cpu,
  Sliders,
  Activity
} from 'lucide-react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('worker-id'); // 'worker-id' | 'capture' | 'result' | 'debug' | 'calibration'
  const [workerData, setWorkerData] = useState({
    workerId: 'W1001',
    workerName: 'Rajesh Kumar',
    department: 'Drilling & Wellhead Operations',
    shiftId: '2026-09-01-A'
  });
  const [readingResult, setReadingResult] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [backendHealth, setBackendHealth] = useState({ isConnected: false, latencyMs: 0 });
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('h2s_mobile_theme');
    return saved ? saved === 'dark' : true;
  });
  const [showOrientation, setShowOrientation] = useState(false);

  // Apply theme
  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('h2s_mobile_theme', theme);
  }, [isDarkMode]);

  // First-time onboarding check
  useEffect(() => {
    const hasSeen = localStorage.getItem('h2s_mobile_seen_intro_v2');
    if (!hasSeen) {
      setShowOrientation(true);
      localStorage.setItem('h2s_mobile_seen_intro_v2', 'true');
    }
  }, []);

  // Periodic Backend Health Check
  useEffect(() => {
    const pollHealth = async () => {
      const res = await checkBackendHealth();
      setBackendHealth(res);
      setIsOnline(res.isConnected);
    };

    pollHealth();
    const interval = setInterval(pollHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleProceedToCapture = (data) => {
    setWorkerData(data);
    setCurrentScreen('capture');
  };

  const handleCaptureComplete = (result, data) => {
    setReadingResult(result);
    setWorkerData(data);
    setCurrentScreen('result');
  };

  const handleRetryCapture = () => {
    setCurrentScreen('capture');
  };

  const handleNextWorker = () => {
    setReadingResult(null);
    setCurrentScreen('worker-id');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', background: 'var(--bg-primary)' }}>
      {/* Top Mobile App Header */}
      <header
        style={{
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 30
        }}
      >
        <div
          onClick={() => setCurrentScreen('worker-id')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 10px rgba(6, 182, 212, 0.4)',
              flexShrink: 0
            }}
          >
            <ShieldCheck size={18} color="#ffffff" />
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'block', lineHeight: 1.1 }}>
              H₂S DOSIMETER
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', fontWeight: '700', letterSpacing: '0.04em' }}>
              FIELD APP (MRPL)
            </span>
          </div>
        </div>

        {/* Right Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Camera Calibration UX Button */}
          <button
            onClick={() => setCurrentScreen('calibration')}
            style={{
              background: currentScreen === 'calibration' ? 'rgba(6, 182, 212, 0.25)' : 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
            title="Camera Calibration UX"
          >
            <Sliders size={13} color="var(--accent-cyan)" />
          </button>

          {/* Developer Debug HUD Button */}
          <button
            onClick={() => setCurrentScreen(currentScreen === 'debug' ? 'worker-id' : 'debug')}
            style={{
              background: currentScreen === 'debug' ? 'rgba(56, 189, 248, 0.25)' : 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
            title="Mobile Camera Debug"
          >
            <Cpu size={13} color="#38bdf8" />
          </button>

          {/* Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
            title={`Switch to ${isDarkMode ? 'Light' : 'Dark'} Mode`}
          >
            {isDarkMode ? <Sun size={13} color="#eab308" /> : <Moon size={13} color="#6366f1" />}
          </button>

          {/* Backend Connection Status Badge (Click to open Network Audit) */}
          <button
            onClick={() => setShowNetworkModal(true)}
            style={{
              background: backendHealth.isConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
              border: `1px solid ${backendHealth.isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
              borderRadius: '9999px',
              padding: '3px 7px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.62rem',
              fontWeight: '800',
              color: backendHealth.isConnected ? '#10b981' : '#f43f5e',
              cursor: 'pointer'
            }}
            title="Click to view Backend Status & Network Diagnostics"
          >
            {backendHealth.isConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
            <span>{backendHealth.isConnected ? `${backendHealth.latencyMs}ms` : 'OFFLINE'}</span>
          </button>
        </div>
      </header>

      {/* Main Screen Container */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentScreen === 'worker-id' && (
          <WorkerIdScreen
            initialWorkerId={workerData.workerId}
            initialShiftId={workerData.shiftId}
            onProceed={handleProceedToCapture}
          />
        )}

        {currentScreen === 'capture' && (
          <CaptureScreen
            workerData={workerData}
            onBack={() => setCurrentScreen('worker-id')}
            onComplete={handleCaptureComplete}
          />
        )}

        {currentScreen === 'result' && (
          <ResultScreen
            result={readingResult}
            workerData={workerData}
            onRetryCapture={handleRetryCapture}
            onNextWorker={handleNextWorker}
          />
        )}

        {currentScreen === 'debug' && (
          <MobileDebugScreen onBack={() => setCurrentScreen('worker-id')} />
        )}

        {currentScreen === 'calibration' && (
          <CameraCalibrationScreen
            onBack={() => setCurrentScreen('worker-id')}
            onSaveProfile={(p) => console.log('Saved profile:', p)}
          />
        )}
      </main>

      {/* Network Status & Audit Modal */}
      <NetworkStatusModal
        isOpen={showNetworkModal}
        onClose={() => setShowNetworkModal(false)}
      />

      {/* Orientation Modal */}
      <MobileOnboardingModal
        isOpen={showOrientation}
        onClose={() => setShowOrientation(false)}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
}
