"""End-to-end Cu-PAN Pipeline Integration Test Suite."""

import pytest
import numpy as np

from ..pipeline import H2SDosimeterEngine
from ..camera.capture import generate_synthetic_calibration_frame, CameraCaptureFrame


def test_full_pipeline_baseline_frame():
    """Verify unexposed Cu-PAN baseline frame (purple/violet) processes to 0.0 ppm·h SAFE reading."""
    engine = H2SDosimeterEngine()
    frame = generate_synthetic_calibration_frame(strip_lab=(42.50, 38.20, -28.40))

    result = engine.process_frame(
        frame=frame,
        camera_id="camera_default_fallback",
        temperature_c=25.0,
        humidity_percent=50.0
    )

    assert result.success is True
    assert result.chemistry == "Cu-PAN"
    assert result.estimated_dose_ppm_h == 0.0
    assert result.risk_zone.name == "SAFE"
    assert result.confidence_percent >= 80.0
    assert result.strip_metrics.delta_e00 <= 1.5

    # Verify structured dictionary serialization
    data = result.to_dict()
    assert "summary" in data
    assert "diagnostics" in data
    assert data["summary"]["chemistry"] == "Cu-PAN"
    assert data["summary"]["status"] == "SAFE"
    assert data["diagnostics"]["colorimetry_trace"]["cielab"] is not None


def test_full_pipeline_moderate_exposure_frame():
    """Verify exposed Cu-PAN strip (40.0 ppm·h target) accurately estimates dose and WARNING/ALERT tier."""
    engine = H2SDosimeterEngine()
    # Lab of Cu-PAN CAL-040: (64.50, 18.20, 36.80)
    frame = generate_synthetic_calibration_frame(strip_lab=(64.50, 18.20, 36.80))

    result = engine.process_frame(
        frame=frame,
        camera_id="camera_default_fallback",
        temperature_c=25.0,
        humidity_percent=50.0
    )

    assert result.success is True
    assert result.chemistry == "Cu-PAN"
    assert pytest.approx(result.estimated_dose_ppm_h, abs=3.0) == 40.0
    assert result.risk_zone.name in ["WARNING", "ALERT"]
    assert result.strip_metrics.delta_e00 >= 35.0
