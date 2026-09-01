import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Smartphone,
  UploadCloud,
  Layers,
  X,
  Sliders,
  ExternalLink
} from 'lucide-react';
import {
  getApiBaseUrl,
  setCustomApiBaseUrl,
  checkBackendHealth,
  testImageUpload,
  getWorkers
} from '../services/api';

export default function NetworkStatusModal({ isOpen, onClose }) {
  const [activeBaseUrl, setActiveBaseUrl] = useState(getApiBaseUrl());
  const [customInputUrl, setCustomInputUrl] = useState(getApiBaseUrl());
  const [isTesting, setIsTesting] = useState(false);

  const [healthStatus, setHealthStatus] = useState(null);
  const [testResults, setTestResults] = useState({
    frontend: { status: 'PASS', details: window.location.origin },
    backendHealth: { status: 'IDLE', latency: 0, details: '' },
    workersApi: { status: 'IDLE', details: '' },
    testUpload: { status: 'IDLE', details: '' }
  });

  // Run initial health check on modal open
  useEffect(() => {
    if (isOpen) {
      handleRunAllTests();
    }
  }, [isOpen]);

  const handleRunAllTests = async () => {
    setIsTesting(true);

    const currentUrl = getApiBaseUrl();
    setActiveBaseUrl(currentUrl);

    // 1. Test Health API
    const health = await checkBackendHealth();
    setHealthStatus(health);

    const updated = {
      frontend: { status: 'PASS', details: window.location.origin },
      backendHealth: {
        status: health.isConnected ? 'PASS' : 'FAIL',
        latency: health.latencyMs,
        details: health.isConnected
          ? `${health.service} (${health.latencyMs} ms)`
          : health.error || 'Connection Refused'
      },
      workersApi: { status: 'PENDING', details: 'Checking...' },
      testUpload: { status: 'PENDING', details: 'Checking...' }
    };
    setTestResults({ ...updated });

    // 2. Test Workers API
    if (health.isConnected) {
      try {
        const workers = await getWorkers();
        updated.workersApi = {
          status: 'PASS',
          details: `${workers.length || 0} registered field workers found`
        };
      } catch (err) {
        updated.workersApi = {
          status: 'FAIL',
          details: err.message
        };
      }

      // 3. Test Minimal Upload API
      try {
        const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        const uploadRes = await testImageUpload(dummyBase64);
        updated.testUpload = {
          status: 'PASS',
          details: `Received ${uploadRes.size_bytes || 68} bytes (${uploadRes.content_type || 'image/png'})`
        };
      } catch (err) {
        updated.testUpload = {
          status: 'FAIL',
          details: err.message
        };
      }
    } else {
      updated.workersApi = { status: 'SKIPPED', details: 'Backend unreachable' };
      updated.testUpload = { status: 'SKIPPED', details: 'Backend unreachable' };
    }

    setTestResults(updated);
    setIsTesting(false);
  };

  const handleSaveCustomUrl = () => {
    setCustomApiBaseUrl(customInputUrl);
    setActiveBaseUrl(getApiBaseUrl());
    handleRunAllTests();
  };

  const handleResetUrl = () => {
    setCustomApiBaseUrl('');
    const defaultUrl = getApiBaseUrl();
    setCustomInputUrl(defaultUrl);
    setActiveBaseUrl(defaultUrl);
    handleRunAllTests();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '420px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '16px',
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              System Status & Network Audit
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Connectivity Summary Card */}
        <div
          style={{
            padding: '14px',
            borderRadius: '12px',
            background: healthStatus?.isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            border: `1px solid ${healthStatus?.isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {healthStatus?.isConnected ? (
              <Wifi size={24} color="#10b981" />
            ) : (
              <WifiOff size={24} color="#f43f5e" />
            )}
            <div>
              <strong style={{ display: 'block', fontSize: '0.88rem', color: healthStatus?.isConnected ? '#10b981' : '#f43f5e' }}>
                Backend {healthStatus?.isConnected ? 'CONNECTED' : 'NOT CONNECTED'}
              </strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {healthStatus?.isConnected ? `Latency: ${healthStatus.latencyMs} ms` : healthStatus?.error || 'Failed to fetch'}
              </span>
            </div>
          </div>

          <button
            onClick={handleRunAllTests}
            disabled={isTesting}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '0.72rem',
              fontWeight: '700',
              color: 'var(--accent-cyan)',
              cursor: isTesting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RefreshCw size={12} className={isTesting ? 'animate-spin' : ''} />
            <span>{isTesting ? 'Testing...' : 'Test Now'}</span>
          </button>
        </div>

        {/* Test Matrix */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
            ENDPOINTS & DIAGNOSTIC MATRIX
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
            {/* Frontend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div>
                <strong style={{ color: '#f8fafc' }}>Frontend Host</strong>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{testResults.frontend.details}</div>
              </div>
              <span style={{ color: '#10b981', fontWeight: '800' }}>PASS</span>
            </div>

            {/* Backend Health API */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div>
                <strong style={{ color: '#f8fafc' }}>Health Check API (<code>/health</code>)</strong>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{testResults.backendHealth.details || 'Pending test...'}</div>
              </div>
              <span style={{ color: testResults.backendHealth.status === 'PASS' ? '#10b981' : testResults.backendHealth.status === 'FAIL' ? '#f43f5e' : 'var(--text-muted)', fontWeight: '800' }}>
                {testResults.backendHealth.status}
              </span>
            </div>

            {/* Workers API */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div>
                <strong style={{ color: '#f8fafc' }}>Workers API (<code>/api/v1/workers</code>)</strong>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{testResults.workersApi.details || 'Pending test...'}</div>
              </div>
              <span style={{ color: testResults.workersApi.status === 'PASS' ? '#10b981' : testResults.workersApi.status === 'FAIL' ? '#f43f5e' : 'var(--text-muted)', fontWeight: '800' }}>
                {testResults.workersApi.status}
              </span>
            </div>

            {/* Test Upload API */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div>
                <strong style={{ color: '#f8fafc' }}>Minimal Upload API (<code>/test-upload</code>)</strong>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{testResults.testUpload.details || 'Pending test...'}</div>
              </div>
              <span style={{ color: testResults.testUpload.status === 'PASS' ? '#10b981' : testResults.testUpload.status === 'FAIL' ? '#f43f5e' : 'var(--text-muted)', fontWeight: '800' }}>
                {testResults.testUpload.status}
              </span>
            </div>
          </div>
        </div>

        {/* Backend API Configuration (Dev Controls) */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            BACKEND URL CONFIGURATION (DEV CONTROL)
          </span>

          <input
            type="text"
            value={customInputUrl}
            onChange={(e) => setCustomInputUrl(e.target.value)}
            placeholder="http://192.168.x.x:5000/api/v1 or /api/v1"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: '#38bdf8',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              marginBottom: '8px'
            }}
          />

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSaveCustomUrl}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #0284c7, #06b6d4)',
                border: 'none',
                color: '#ffffff',
                padding: '8px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Save & Test
            </button>

            <button
              onClick={handleResetUrl}
              style={{
                flex: 1,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                padding: '8px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Reset Auto (LAN)
            </button>
          </div>
        </div>

        {/* Troubleshooting Guidance */}
        {!healthStatus?.isConnected && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              fontSize: '0.72rem',
              color: '#fecdd3',
              lineHeight: '1.4'
            }}
          >
            <strong>Mobile Wi-Fi Troubleshooting:</strong>
            <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
              <li>Ensure your phone is connected to the same Wi-Fi as your laptop.</li>
              <li>Verify laptop LAN IP is reachable: <code>http://192.168.0.148:5000/health</code></li>
              <li>Ensure mobile data / VPN does not bypass local subnet.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
