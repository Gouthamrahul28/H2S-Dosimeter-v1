"""Worker cumulative exposure dosimeter tracker.

Tracks shift dose progression and regulatory enforcement.
"""

from typing import Dict, List, Optional
from datetime import datetime


class ExposureReadingRecord:
    """Represents a single verified dosimeter reading."""

    def __init__(
        self,
        reading_id: str,
        timestamp: datetime,
        estimated_dose_ppm_h: float,
        incremental_dose_ppm_h: float,
        temperature_c: float,
        humidity_percent: float,
        confidence_percent: float,
        risk_tier: str
    ):
        self.reading_id = reading_id
        self.timestamp = timestamp
        self.estimated_dose_ppm_h = estimated_dose_ppm_h
        self.incremental_dose_ppm_h = incremental_dose_ppm_h
        self.temperature_c = temperature_c
        self.humidity_percent = humidity_percent
        self.confidence_percent = confidence_percent
        self.risk_tier = risk_tier


class WorkerDosimeterSession:
    """Manages an 8-hour shift dosimetry tracking session for an industrial worker."""

    def __init__(self, worker_id: str, worker_name: str, shift_id: str, shift_limit_ppm_h: float = 80.0):
        self.worker_id = worker_id
        self.worker_name = worker_name
        self.shift_id = shift_id
        self.shift_limit_ppm_h = shift_limit_ppm_h
        self.readings: List[ExposureReadingRecord] = []
        self.cumulative_dose_ppm_h: float = 0.0

    def add_reading(self, reading: ExposureReadingRecord):
        self.readings.append(reading)
        self.cumulative_dose_ppm_h = max(self.cumulative_dose_ppm_h, reading.estimated_dose_ppm_h)

    @property
    def shift_utilization_percent(self) -> float:
        return min(100.0, round((self.cumulative_dose_ppm_h / self.shift_limit_ppm_h) * 100.0, 1))

    @property
    def is_limit_exceeded(self) -> bool:
        return self.cumulative_dose_ppm_h >= self.shift_limit_ppm_h
