import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { TrendingUp, BarChart2 } from 'lucide-react';

/**
 * Custom Tooltip for Exposure Charts
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '10px 14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          fontSize: '0.82rem'
        }}
      >
        <strong style={{ color: '#f8fafc', display: 'block', marginBottom: '4px', fontFamily: 'var(--font-mono)' }}>
          Shift: {data.shiftId || label}
        </strong>
        <div style={{ color: '#38bdf8', marginBottom: '2px' }}>
          Shift Dose: <strong>{data.shiftDose} ppm·h</strong>
        </div>
        {data.cumulativeDose !== undefined && (
          <div style={{ color: data.cumulativeDose > 80 ? '#fb7185' : '#34d399', marginBottom: '2px' }}>
            Cumulative Total: <strong>{data.cumulativeDose} ppm·h</strong>
          </div>
        )}
        <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '4px' }}>
          Date: {new Date(data.date).toLocaleDateString()} &bull; {data.temp}°C / {data.humidity}% RH
        </div>
      </div>
    );
  }
  return null;
};

export default function ExposureChart({ readings = [], threshold = 80 }) {
  const [chartType, setChartType] = useState('cumulative'); // 'cumulative' or 'bar'

  // Prepare chart dataset chronologically (oldest to newest)
  const sortedReadings = [...readings].sort((a, b) => new Date(a.capturedAt || a.createdAt) - new Date(b.capturedAt || b.createdAt));

  let runningTotal = 0;
  const chartData = sortedReadings.map((r, idx) => {
    const shiftDose = Number(r.estimatedDosePpmHours) || 0;
    runningTotal = Math.round((runningTotal + shiftDose) * 10) / 10;

    return {
      name: r.shiftId,
      shiftId: r.shiftId,
      shiftDose: shiftDose,
      cumulativeDose: runningTotal,
      threshold: threshold,
      date: r.capturedAt || r.createdAt,
      temp: r.ambientTemp || 25,
      humidity: r.ambientHumidity || 50
    };
  });

  if (chartData.length === 0) {
    return (
      <div
        className="glass-card"
        style={{
          padding: '36px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '260px'
        }}
      >
        <TrendingUp size={36} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.5 }} />
        <p>No exposure time-series readings available for this worker.</p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '20px' }}>
      {/* Chart Header & Mode Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {chartType === 'cumulative' ? 'Cumulative Exposure Progression' : 'Shift-by-Shift Dosimetry'}
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            DGMS Occupational Limit: {threshold} ppm·hours
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-table-header)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setChartType('cumulative')}
            style={{
              background: chartType === 'cumulative' ? 'rgba(6, 182, 212, 0.25)' : 'transparent',
              border: chartType === 'cumulative' ? '1px solid rgba(6, 182, 212, 0.5)' : 'none',
              color: chartType === 'cumulative' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <TrendingUp size={14} />
            <span>Cumulative Trend</span>
          </button>

          <button
            onClick={() => setChartType('bar')}
            style={{
              background: chartType === 'bar' ? 'rgba(6, 182, 212, 0.25)' : 'transparent',
              border: chartType === 'bar' ? '1px solid rgba(6, 182, 212, 0.5)' : 'none',
              color: chartType === 'bar' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <BarChart2 size={14} />
            <span>Shift Bars</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ width: '100%', height: '280px' }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'cumulative' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cumulativeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} domain={[0, 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={threshold}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{ value: `DGMS Limit (${threshold} ppm·h)`, fill: '#fb7185', fontSize: 10, position: 'insideTopRight' }}
              />
              <Area
                type="monotone"
                dataKey="cumulativeDose"
                stroke="#06b6d4"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#cumulativeGrad)"
              />
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} domain={[0, 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="shiftDose" fill="#0284c7" radius={[6, 6, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
