import React, { useState } from 'react';
import { ArrowUpDown, ChevronRight, User, AlertCircle, Layers, CheckCircle2, XCircle, Ban, Clock, Zap } from 'lucide-react';
import ThresholdBadge from './ThresholdBadge';

export default function WorkerTable({ workers = [], onSelectWorker }) {
  const [sortField, setSortField] = useState('lifeRemainingPercent');
  const [sortAsc, setSortAsc] = useState(true); // Default ascending for remaining life (lowest life first)

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'lifeRemainingPercent'); // Ascending for remaining life so lowest is at top
    }
  };

  const sortedWorkers = [...workers].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (valA === undefined || valA === null) valA = 999;
    if (valB === undefined || valB === null) valB = 999;

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
      {/* Table Subtitle with Sort Hint */}
      <div style={{ padding: '8px 16px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Click table headers to sort personnel fleet.</span>
        <button
          onClick={() => {
            setSortField('lifeRemainingPercent');
            setSortAsc(true);
          }}
          style={{
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: '4px',
            color: 'var(--accent-cyan)',
            padding: '3px 8px',
            fontSize: '0.72rem',
            cursor: 'pointer',
            fontWeight: '700'
          }}
        >
          Sort by Lowest Strip Life &uarr;
        </button>
      </div>

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
            <th style={{ textAlign: 'center' }}>Access Status</th>
            <th style={{ textAlign: 'center' }}>Assigned Strip</th>
            <th onClick={() => handleSort('lifeRemainingPercent')} style={{ cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--accent-cyan)' }}>
                Sensing Life Left <ArrowUpDown size={12} />
              </div>
            </th>
            <th onClick={() => handleSort('readingCount')} style={{ cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                Shifts <ArrowUpDown size={12} />
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
              <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                No worker exposure records found.
              </td>
            </tr>
          ) : (
            sortedWorkers.map((w) => {
              const isOver = w.overThreshold;
              const threshold = w.thresholdPpmHours || 80;
              const percent = Math.min(100, Math.round(((w.totalDosePpmHours || 0) / threshold) * 100));
              const status = w.status || 'ACTIVE';

              // Sensing capacity estimation
              const lifeRemaining = w.lifeRemainingPercent !== undefined
                ? w.lifeRemainingPercent
                : (w.stripLifeRemainingPercent !== undefined ? w.stripLifeRemainingPercent : (w.totalDosePpmHours ? Math.max(0, Math.round(100 * (1 - w.totalDosePpmHours / 160.0))) : 100));
              const isLowLife = lifeRemaining <= 30 && lifeRemaining > 10;
              const isExhaustedLife = lifeRemaining <= 10;

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
                          background: isOver ? 'rgba(244, 63, 94, 0.15)' : 'rgba(6, 182, 212, 0.12)',
                          border: isOver ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid rgba(6, 182, 212, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isOver ? 'var(--accent-rose)' : 'var(--accent-cyan)',
                          fontWeight: '700',
                          fontSize: '0.8rem',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        {w.workerId.slice(0, 3)}
                      </div>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {w.workerId}
                      </strong>
                    </div>
                  </td>

                  {/* Name & Department */}
                  <td>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{w.name}</div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{w.department}</span>
                  </td>

                  {/* Access Status */}
                  <td style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background:
                          status === 'ACTIVE'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : status === 'INACTIVE'
                            ? 'rgba(148, 163, 184, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        color:
                          status === 'ACTIVE'
                            ? '#34d399'
                            : status === 'INACTIVE'
                            ? '#94a3b8'
                            : '#f87171',
                        border:
                          status === 'ACTIVE'
                            ? '1px solid rgba(16, 185, 129, 0.3)'
                            : status === 'INACTIVE'
                            ? '1px solid rgba(148, 163, 184, 0.3)'
                            : '1px solid rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      {status === 'ACTIVE' && <CheckCircle2 size={12} />}
                      {status === 'INACTIVE' && <AlertCircle size={12} />}
                      {status === 'BLOCKED' && <Ban size={12} />}
                      <span>{status}</span>
                    </span>
                  </td>

                  {/* Assigned Cu-PAN Strip */}
                  <td style={{ textAlign: 'center' }}>
                    {w.assignedStripId ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--accent-cyan)',
                          background: 'rgba(6, 182, 212, 0.08)',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(6, 182, 212, 0.2)'
                        }}
                      >
                        <Layers size={12} /> {w.assignedStripId}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        No strip
                      </span>
                    )}
                  </td>

                  {/* Cu-PAN Sensing Life Remaining */}
                  <td style={{ textAlign: 'center' }}>
                    {w.assignedStripId ? (
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: '800',
                            fontSize: '0.92rem',
                            color: isExhaustedLife ? '#ef4444' : isLowLife ? '#f59e0b' : '#34d399'
                          }}
                        >
                          {lifeRemaining}%
                        </span>

                        {/* Mini Strip Life Bar */}
                        <div style={{ width: '70px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${lifeRemaining}%`,
                              background: isExhaustedLife ? '#ef4444' : isLowLife ? '#f59e0b' : '#10b981'
                            }}
                          />
                        </div>

                        <span style={{ fontSize: '0.65rem', fontWeight: '700', color: isExhaustedLife ? '#ef4444' : isLowLife ? '#f59e0b' : '#34d399' }}>
                          {isExhaustedLife ? 'REPLACE NOW' : isLowLife ? 'REPLACE SOON' : 'GOOD'}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>N/A</span>
                    )}
                  </td>

                  {/* Reading Count */}
                  <td style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        background: 'var(--bg-table-header)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        color: 'var(--text-secondary)',
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
                          color: isOver ? 'var(--accent-rose)' : percent >= 75 ? 'var(--accent-amber)' : 'var(--accent-cyan)'
                        }}
                      >
                        {(w.totalDosePpmHours || 0).toFixed(1)} <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-secondary)' }}>ppm·h</span>
                      </span>

                      {/* Mini Progress Bar */}
                      <div style={{ width: '90px', height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
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
