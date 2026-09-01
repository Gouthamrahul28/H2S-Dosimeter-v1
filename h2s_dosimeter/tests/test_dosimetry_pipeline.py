"""
h2s_dosimeter.tests.test_dosimetry_pipeline
===========================================
End-to-end integration tests for Cu-PAN H2SDosimeterEngine, diagnostic traces,
and temporal cumulative dosimeter tracking.
"""

import numpy as np
import pytest

from ..pipeline import H2SDosimeterEngine
from ..dosimetry.dose_model import WorkerDosimeterTracker, ShiftExposureRecord
from ..dosimetry.risk import get_statutory_risk_level, DGMS_SHIFT_CUMULATIVE_LIMIT_PPM_HOURS


class TestDosimeterPipeline:
    """End-to-end Cu-PAN pipeline execution tests."""

    @pytest.fixture
    def engine(self):
        return H2SDosimeterEngine()

    def test_cu_pan_synthetic_image_end_to_end(self, engine):
        """Create a synthetic 3-patch image [White Ref | Active Cu-PAN Strip | Grey Ref] and process."""
        # Create 200x400 synthetic badge
        img = np.zeros((200, 400, 3), dtype=np.uint8)
        # White Reference (245, 245, 245) in ROI [0.10-0.30, 0.10-0.30]
        img[20:60, 40:120] = [245, 245, 245]
        # Active Cu-PAN Strip (210, 145, 60 - intermediate yellow-orange) in ROI [0.38-0.62, 0.38-0.62]
        img[76:124, 152:248] = [210, 145, 60]
        # Grey Reference (128, 128, 128) in ROI [0.70-0.90, 0.10-0.30]
        img[20:60, 280:360] = [128, 128, 128]
        
        res = engine.process_image(img, temperature_c=25.0, humidity_percent=50.0, shift_hours=8.0)
        
        assert res.success is True
        assert res.chemistry == "Cu-PAN"
        assert res.status_label == "VALID"
        assert res.estimated_dose_ppm_h > 0.0
        assert res.confidence_percentage > 70.0
        assert res.deltaE00 > 20.0
        assert len(res.source_white_xyz) == 3
        assert len(res.xyz_after_adaptation) == 3

    def test_cu_pan_raw_measurements_diagnostic_trace(self, engine):
        """Verify complete diagnostic trace generation for raw RGB inputs."""
        # Partially reacted Cu-PAN strip (amber/orange response)
        res = engine.process_raw_measurements(
            strip_rgb_8bit=[200, 140, 75],
            white_rgb_8bit=[245, 242, 235],
            temperature_c=30.0,
            humidity_percent=60.0,
            shift_hours=8.0
        )
        
        assert res.success is True
        assert res.chemistry == "Cu-PAN"
        assert res.status_label == "VALID"
        assert res.temperature_c == 30.0
        assert res.humidity_percent == 60.0
        assert res.env_kinetic_factor > 1.0
        assert "statutory_compliance" in res.to_dict()
        assert res.statutory_compliance["calculated_twa_ppm"] > 0.0

    def test_cu_pan_virgin_baseline(self, engine):
        """Unexposed virgin Cu-PAN strip (purple/violet: RGB ~ [139, 76, 148]) should yield zero dose."""
        res = engine.process_raw_measurements(
            strip_rgb_8bit=[139, 76, 148],
            white_rgb_8bit=[250, 250, 250],
            temperature_c=25.0,
            humidity_percent=50.0
        )
        assert res.success is True
        assert res.estimated_dose_ppm_h == 0.0
        assert res.deltaE00 < 1.0

    def test_worker_cumulative_dosimeter_tracker(self):
        """Verify cumulative multi-shift dose tracking and DGMS threshold alerting."""
        tracker = WorkerDosimeterTracker(
            worker_id="W1024",
            worker_name="Kiran Kumar",
            department="Desulfurization Unit 4",
            statutory_threshold_ppm_h=DGMS_SHIFT_CUMULATIVE_LIMIT_PPM_HOURS
        )
        
        # Shift 1: 25.0 ppm·h
        tracker.add_reading(ShiftExposureRecord(
            reading_id="R001", shift_id="2026-08-30-A", timestamp_iso="2026-08-30T14:00:00Z",
            shift_dose_ppm_h=25.0, temperature_c=26.0, humidity_percent=52.0,
            lab={"L": 58.2, "a": 21.8, "b": 19.4}, deltaE00=30.5, confidence_score=94.0,
            calibration_status="VALID", image_quality_label="EXCELLENT"
        ))
        
        # Shift 2: 30.0 ppm·h (Total = 55.0)
        tracker.add_reading(ShiftExposureRecord(
            reading_id="R002", shift_id="2026-08-31-A", timestamp_iso="2026-08-31T14:00:00Z",
            shift_dose_ppm_h=30.0, temperature_c=27.0, humidity_percent=55.0,
            lab={"L": 61.0, "a": 19.5, "b": 28.0}, deltaE00=38.0, confidence_score=92.0,
            calibration_status="VALID", image_quality_label="EXCELLENT"
        ))
        
        summary = tracker.get_summary()
        assert summary["total_cumulative_dose_ppm_h"] == 55.0
        assert summary["over_threshold"] is False
        assert summary["threshold_percentage"] == round((55.0 / 80.0) * 100.0, 1)
        
        # Shift 3: 35.0 ppm·h (Total = 90.0 > 80.0 DGMS Limit)
        tracker.add_reading(ShiftExposureRecord(
            reading_id="R003", shift_id="2026-09-01-A", timestamp_iso="2026-09-01T14:00:00Z",
            shift_dose_ppm_h=35.0, temperature_c=28.0, humidity_percent=60.0,
            lab={"L": 64.5, "a": 18.2, "b": 36.8}, deltaE00=44.2, confidence_score=90.0,
            calibration_status="VALID", image_quality_label="EXCELLENT"
        ))
        
        summary_over = tracker.get_summary()
        assert summary_over["total_cumulative_dose_ppm_h"] == 90.0
        assert summary_over["over_threshold"] is True
        assert tracker.is_over_statutory_threshold is True
