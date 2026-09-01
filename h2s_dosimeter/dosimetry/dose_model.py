"""
h2s_dosimeter.dosimetry.dose_model
==================================
Temporal dosimeter state tracker managing shift-by-shift cumulative exposure histories.

DOSIMETRY PRINCIPLE:
A dosimeter is distinct from an instantaneous spot-gas detector. It integrates
exposure over time to quantify cumulative biological burden:
    Total Dose = ∑ (Shift Dose_i) [ppm·hours]
    8-hr TWA   = (Total Dose) / 8.0 [ppm]
"""

from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import Dict, List, Optional
from .risk import DGMS_SHIFT_CUMULATIVE_LIMIT_PPM_HOURS, get_statutory_risk_level


@dataclass
class ShiftExposureRecord:
    """Individual shift reading entry in the worker's exposure timeline."""
    reading_id: str
    shift_id: str
    timestamp_iso: str
    shift_dose_ppm_h: float
    temperature_c: float
    humidity_percent: float
    lab: Dict[str, float]
    deltaE00: float
    confidence_score: float
    calibration_status: str
    image_quality_label: str
    notes: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class WorkerDosimeterTracker:
    """Cumulative exposure log for an individual worker."""
    worker_id: str
    worker_name: str
    department: str
    statutory_threshold_ppm_h: float = DGMS_SHIFT_CUMULATIVE_LIMIT_PPM_HOURS
    readings: List[ShiftExposureRecord] = field(default_factory=list)

    @property
    def total_cumulative_dose_ppm_h(self) -> float:
        """Sum of all shift doses."""
        return float(sum(r.shift_dose_ppm_h for r in self.readings))

    @property
    def is_over_statutory_threshold(self) -> bool:
        """True if cumulative dose exceeds DGMS/OISD limit."""
        return self.total_cumulative_dose_ppm_h >= self.statutory_threshold_ppm_h

    @property
    def threshold_percentage(self) -> float:
        """Percentage of statutory dose ceiling reached."""
        if self.statutory_threshold_ppm_h <= 0:
            return 0.0
        return float((self.total_cumulative_dose_ppm_h / self.statutory_threshold_ppm_h) * 100.0)

    def add_reading(self, reading: ShiftExposureRecord) -> None:
        """Append a new shift reading to the timeline."""
        self.readings.append(reading)

    def get_summary(self) -> Dict:
        """Generate cumulative health summary."""
        total = self.total_cumulative_dose_ppm_h
        risk = get_statutory_risk_level(total, shift_duration_hours=max(8.0, len(self.readings) * 8.0))
        return {
            "worker_id": self.worker_id,
            "worker_name": self.worker_name,
            "department": self.department,
            "logged_shifts": len(self.readings),
            "total_cumulative_dose_ppm_h": round(total, 2),
            "statutory_threshold_ppm_h": self.statutory_threshold_ppm_h,
            "threshold_percentage": round(self.threshold_percentage, 1),
            "over_threshold": self.is_over_statutory_threshold,
            "statutory_compliance": risk,
            "readings": [r.to_dict() for r in self.readings]
        }
