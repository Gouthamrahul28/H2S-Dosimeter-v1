import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Building,
  RefreshCw,
  Award,
  Settings,
  CheckCircle2,
  Lock
} from 'lucide-react';
import ThresholdBadge from '../components/ThresholdBadge';
import { getDGMSReport } from '../services/api';

function formatDateInput(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DGMSReport() {
  const todayStr = formatDateInput(new Date());
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = formatDateInput(thirtyDaysAgo);

  const [fromDate, setFromDate] = useState(thirtyDaysAgoStr);
  const [toDate, setToDate] = useState(todayStr);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Facility & Statutory Metadata State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [facilityConfig, setFacilityConfig] = useState({
    facilityName: 'High-Pressure Sour Gas Extraction & Refining Facility, Block A',
    assetCode: 'DGMS-ASSET-OG-2026-081',
    zone: 'Directorate General of Mines Safety — Western Zone',
    officerName: 'Dr. Arvind Menon, CIH',
    officerRegId: 'OISD-REG-2018-912'
  });

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await getDGMSReport(fromDate, toDate);
      setReportData(data || []);
    } catch (err) {
      console.error('Failed to load DGMS report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [fromDate, toDate]);

  // Export CSV
  const handleExportCSV = () => {
    if (!reportData || reportData.length === 0) return;

    const headers = [
      'Worker ID',
      'Full Name',
      'Department',
      'Logged Shifts',
      'Cumulative Dose (ppm*h)',
      'DGMS Threshold (ppm*h)',
      'Over Threshold Flag'
    ];
    const rows = reportData.map((r) => [
      r.workerId,
      `"${r.name || ''}"`,
      `"${r.department || ''}"`,
      r.readingCount,
      (r.totalDosePpmHours || 0).toFixed(1),
      r.thresholdPpmHours,
      r.overThreshold ? 'YES' : 'NO'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DGMS_H2S_Report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print PDF
  const handlePrintPDF = () => {
    window.print();
  };

  // Summary Metrics
  const totalAudited = reportData.length;
  const overThresholdTotal = reportData.filter((r) => r.overThreshold).length;
  const compliantTotal = totalAudited - overThresholdTotal;
  const complianceRate = totalAudited > 0 ? Math.round((compliantTotal / totalAudited) * 100) : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Controls Bar (Hidden during Print) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#f8fafc', letterSpacing: '-0.02em' }}>
            DGMS / OISD Statutory Compliance Register
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '4px' }}>
            Official occupational health exposure audit register conforming to DGMS & OISD-STD-114 norms.
          </p>
        </div>

        {/* Date Filter & Export Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowConfigModal(true)}
            className="btn-secondary"
            title="Configure facility & auditor metadata"
          >
            <Settings size={16} />
            <span>Facility Metadata</span>
          </button>

          <div className="glass-card" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={15} color="#06b6d4" />
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>From:</span>
            <input
              type="date"
              className="input-control"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
            />
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>To:</span>
            <input
              type="date"
              className="input-control"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
            />
          </div>

          <button onClick={handleExportCSV} className="btn-secondary" title="Export as CSV spreadsheet">
            <Download size={16} />
            <span>Export CSV</span>
          </button>

          <button onClick={handlePrintPDF} className="btn-primary" title="Print or save as official PDF">
            <Printer size={16} />
            <span>Print Statutory PDF</span>
          </button>
        </div>
      </div>

      {/* Official Statutory Header (Visible in web + print format) */}
      <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid #06b6d4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Building size={18} color="#06b6d4" />
              <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#38bdf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {facilityConfig.zone} &bull; OISD-STD-114
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#f8fafc' }}>
              Form VI-B: Statutory Cumulative Toxic Gas Register (Hydrogen Sulfide)
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '6px', lineHeight: '1.5' }}>
              <strong>Certified Asset / Facility:</strong> {facilityConfig.facilityName} ({facilityConfig.assetCode})<br />
              <strong>Audit Period:</strong> {fromDate} to {toDate} &bull; <strong>Cumulative Permissible Limit:</strong> 80.0 ppm·hours
            </div>
          </div>

          <div style={{ textAlign: 'right', minWidth: '200px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Report Tracking ID</span>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#f8fafc' }}>
              DGMS-H2S-{fromDate.replace(/-/g, '')}-{toDate.replace(/-/g, '')}
            </strong>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
              Auditor: <strong>{facilityConfig.officerName}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Summary KPI Highlights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>Audited Cohort</span>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#f8fafc', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
            {totalAudited}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>Compliant Personnel</span>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#34d399', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
            {compliantTotal}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px', border: overThresholdTotal > 0 ? '1px solid rgba(244,63,94,0.4)' : '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>Statutory Violations (&gt;80 ppm·h)</span>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: overThresholdTotal > 0 ? '#fb7185' : '#f8fafc', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
            {overThresholdTotal}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>Compliance Index</span>
          <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#38bdf8', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
            {complianceRate}%
          </div>
        </div>
      </div>

      {/* Main Tabular Register */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#f8fafc' }}>
            Certified Exposure Schedule
          </h3>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Audited Records: {reportData.length}
          </span>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sr.</th>
                <th>Worker ID</th>
                <th>Full Name</th>
                <th>Department / Unit</th>
                <th style={{ textAlign: 'center' }}>Logged Shifts</th>
                <th style={{ textAlign: 'right' }}>Cumulative Exposure (ppm·h)</th>
                <th style={{ textAlign: 'center' }}>Statutory Threshold</th>
                <th style={{ textAlign: 'center' }}>Audit Status</th>
              </tr>
            </thead>
            <tbody>
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No exposure records found for the selected date window.
                  </td>
                </tr>
              ) : (
                reportData.map((row, idx) => (
                  <tr key={row.workerId} className={row.overThreshold ? 'row-over-threshold' : ''}>
                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>{idx + 1}</td>
                    <td>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                        {row.workerId}
                      </strong>
                    </td>
                    <td>
                      <strong style={{ color: '#f1f5f9' }}>{row.name}</strong>
                    </td>
                    <td>
                      <span style={{ color: '#94a3b8' }}>{row.department}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>
                        {row.readingCount}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '1rem',
                          color: row.overThreshold ? '#fb7185' : '#f8fafc'
                        }}
                      >
                        {(row.totalDosePpmHours || 0).toFixed(1)}
                      </strong>
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
                      {row.thresholdPpmHours || 80}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <ThresholdBadge
                        totalDosePpmHours={row.totalDosePpmHours}
                        thresholdPpmHours={row.thresholdPpmHours}
                        overThreshold={row.overThreshold}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Regulatory Statutory Notes */}
        <div style={{ marginTop: '20px', padding: '14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', fontSize: '0.78rem', color: '#94a3b8', lineHeight: '1.5' }}>
          <strong>Statutory Compliance Requirement:</strong> Conforming to DGMS Circular No. 3 (Occupational Health & Hygiene) and OISD-STD-114 Standards, this report certifies the passive dosimeter optical readings registered during the specified audit cycle. Workers flagged as 'OVER LIMIT' require immediate removal from sour operations and mandatory spirometric re-examination.
        </div>

        {/* Official Printable Sign-off Block */}
        <div className="print-sign-off" style={{ display: 'none', marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #000000' }}>
          <div>
            <div style={{ width: '220px', borderBottom: '1px solid #000000', marginBottom: '6px' }}></div>
            <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>{facilityConfig.officerName}</div>
            <div style={{ fontSize: '9pt' }}>Certified Occupational Safety Assessor ({facilityConfig.officerRegId})</div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ width: '220px', borderBottom: '1px solid #000000', marginBottom: '6px', marginLeft: 'auto' }}></div>
            <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>Mines / Installation Manager</div>
            <div style={{ fontSize: '9pt' }}>Complex Stamp & Statutory Seal</div>
          </div>
        </div>
      </div>

      {/* Facility Configuration Modal */}
      {showConfigModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px'
          }}
        >
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '24px', background: '#0e1422' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#f8fafc', marginBottom: '4px' }}>
              Statutory Facility & Auditor Metadata
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '18px' }}>
              Configure facility particulars and certifying assessor credentials for printed DGMS / OISD registers.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Facility / Asset Name
                </label>
                <input
                  type="text"
                  className="input-control"
                  style={{ width: '100%' }}
                  value={facilityConfig.facilityName}
                  onChange={(e) => setFacilityConfig({ ...facilityConfig, facilityName: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Statutory Asset Code
                </label>
                <input
                  type="text"
                  className="input-control"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                  value={facilityConfig.assetCode}
                  onChange={(e) => setFacilityConfig({ ...facilityConfig, assetCode: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                  DGMS Regulatory Zone
                </label>
                <input
                  type="text"
                  className="input-control"
                  style={{ width: '100%' }}
                  value={facilityConfig.zone}
                  onChange={(e) => setFacilityConfig({ ...facilityConfig, zone: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Certifying Officer
                  </label>
                  <input
                    type="text"
                    className="input-control"
                    style={{ width: '100%' }}
                    value={facilityConfig.officerName}
                    onChange={(e) => setFacilityConfig({ ...facilityConfig, officerName: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Officer Reg ID
                  </label>
                  <input
                    type="text"
                    className="input-control"
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                    value={facilityConfig.officerRegId}
                    onChange={(e) => setFacilityConfig({ ...facilityConfig, officerRegId: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowConfigModal(false)}
                >
                  <CheckCircle2 size={16} /> Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
