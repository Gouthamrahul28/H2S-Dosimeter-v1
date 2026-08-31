import React, { useState } from 'react';
import { ArrowUpDown, ChevronRight, User, AlertCircle } from 'lucide-react';
import ThresholdBadge from './ThresholdBadge';

export default function WorkerTable({ workers = [], onSelectWorker }) {
  const [sortField, setSortField] = useState('totalDosePpmHours');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // Default descending for doses
    }
  };

  const sortedWorkers = [...workers].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <div className="data-table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('workerId')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                Worker ID <ArrowUpDown size={12} />
              </div>
            </th>
            <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                Worker Name <ArrowUpDown size={12} />
              </div>
            </th>
            <th onClick={() => handleSort('department')} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                Department <ArrowUpDown size={12} />
              </div>
            </th>
            <th onClick={() => handleSort('readingCount')} style={{ cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                Logged Shifts <ArrowUpDown size={12} />
              </div>
            </th>
            <th onClick={() => handleSort('totalDosePpmHours')} style={{ cursor: 'pointer', textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                Cumulative Dose <ArrowUpDown size={12} />
              </div>
            </th>
            <th style={{ textAlign: 'center' }}>DGMS Status</th>
            <th style={{ textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {sortedWorkers.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                No worker exposure records found.
              </td>
            </tr>
          ) : (
            sortedWorkers.map((w) => {
              const isOver = w.overThreshold;
              const threshold = w.thresholdPpmHours || 80;
              const percent = Math.min(100, Math.round(((w.totalDosePpmHours || 0) / threshold) * 100));

              return (
                <tr
                  key={w.workerId}
                  className={isOver ? 'row-over-threshold' : ''}
                  onClick={() => onSelectWorker(w.workerId)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Worker ID */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isOver ? 'rgba(244, 63, 94, 0.2)' : 'rgba(6, 182, 212, 0.15)',
                          border: isOver ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid rgba(6, 182, 212, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isOver ? '#fb7185' : '#38bdf8',
                          fontWeight: '700',
                          fontSize: '0.8rem',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        {w.workerId.slice(0, 3)}
                      </div>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92rem', color: '#f8fafc' }}>
                        {w.workerId}
                      </strong>
                    </div>
                  </td>

                  {/* Name */}
                  <td>
                    <div style={{ fontWeight: '600', color: '#f1f5f9' }}>{w.name}</div>
                  </td>

                  {/* Department */}
                  <td>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{w.department}</span>
                  </td>

                  {/* Reading Count */}
                  <td style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        color: '#cbd5e1',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {w.readingCount || 0}
                    </span>
                  </td>

                  {/* Cumulative Dose */}
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                      <span
                        style={{
                          fontWeight: '800',
                          fontSize: '1rem',
                          fontFamily: 'var(--font-mono)',
                          color: isOver ? '#fb7185' : percent >= 75 ? '#fbbf24' : '#38bdf8'
                        }}
                      >
                        {(w.totalDosePpmHours || 0).toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: '500', color: '#94a3b8' }}>ppm·h</span>
                      </span>

                      {/* Mini Progress Bar */}
                      <div style={{ width: '90px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${percent}%`,
                            background: isOver ? '#f43f5e' : percent >= 75 ? '#f59e0b' : '#06b6d4'
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td style={{ textAlign: 'center' }}>
                    <ThresholdBadge
                      totalDosePpmHours={w.totalDosePpmHours}
                      thresholdPpmHours={w.thresholdPpmHours}
                      overThreshold={w.overThreshold}
                    />
                  </td>

                  {/* Action */}
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectWorker(w.workerId);
                      }}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    >
                      History <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
