import React, { useState } from 'react';
import WorkerIdScreen from './screens/WorkerIdScreen';
import CaptureScreen from './screens/CaptureScreen';
import ResultScreen from './screens/ResultScreen';
import { ShieldCheck, Wifi, WifiOff } from 'lucide-react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('worker-id'); // 'worker-id' | 'capture' | 'result'
  const [workerData, setWorkerData] = useState({
    workerId: 'W1023',
    workerName: 'Rajesh Kumar',
    department: 'Drilling & Extraction',
    shiftId: '2026-08-31-A'
  });
  const [readingResult, setReadingResult] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Top Mobile App Header */}
      <header
        style={{
          padding: '12px 16px',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 30
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 10px rgba(6, 182, 212, 0.4)'
            }}
          >
            <ShieldCheck size={18} color="#ffffff" />
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#f8fafc', letterSpacing: '-0.02em', display: 'block', lineHeight: 1.1 }}>
              H₂S DOSIMETER
            </span>
            <span style={{ fontSize: '0.65rem', color: '#06b6d4', fontWeight: '600', letterSpacing: '0.04em' }}>
              FIELD CAPTURE
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isOnline ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#34d399', background: 'rgba(16,185,129,0.1)', padding: '3px 8px', borderRadius: '9999px', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Wifi size={12} />
              <span>LIVE</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#fb7185', background: 'rgba(244,63,94,0.1)', padding: '3px 8px', borderRadius: '9999px', border: '1px solid rgba(244,63,94,0.2)' }}>
              <WifiOff size={12} />
              <span>OFFLINE</span>
            </div>
          )}
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
      </main>
    </div>
  );
}
