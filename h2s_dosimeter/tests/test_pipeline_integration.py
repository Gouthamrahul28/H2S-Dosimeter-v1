"""End-to-end Pipeline Integration Test Suite."""

import pytest
import numpy as np

from ..pipeline import H2SDosimeterEngine
from ..camera.capture import generate_synthetic_calibration_frame, CameraCaptureFrame


def test_full_pipeline_baseline_frame():
    """Verify unexposed baseline frame processes to 0.0 ppm·h SAFE reading with full diagnostics."""
    engine = H2SDosimeterEngine()
    frame = generate_synthetic_calibration_frame(strip_lab=(95.4, -0.42, 4.18))

    result = engine.process_frame(
        frame=frame,
        camera_id="camera_default_fallback",
        temperature_c=25.0,
        humidity_percent=50.0
    )

    assert result.success is True
    assert result.estimated_dose_ppm_h == 0.0
    assert result.risk_zone.name == "SAFE"
    assert result.confidence_percent >= 80.0
    assert result.strip_metrics.delta_e00 <= 1.2

    # Verify structured dictionary serialization
    data = result.to_dict()
    assert "summary" in data
    assert "diagnostics" in data
    assert data["summary"]["status"] == "SAFE"
    assert data["diagnostics"]["colorimetry_trace"]["cielab"] is not None


def test_full_pipeline_moderate_exposure_frame():
    """Verify exposed strip (40.0 ppm·h target) accurately estimates dose and WARNING tier."""
    engine = H2SDosimeterEngine()
    # Lab of CAL-040: (58.6, 11.2, 32.5)
    frame = generate_synthetic_calibration_frame(strip_lab=(58.6, 11.2, 32.5))

    result = engine.process_frame(
        frame=frame,
        camera_id="camera_default_fallback",
        temperature_c=25.0,
        humidity_percent=50.0
    )

    assert result.success is True
    assert pytest.approx(result.estimated_dose_ppm_h, abs=2.0) == 40.0
    assert result.risk_zone.name in ["WARNING", "ALERT"]
    assert result.strip_metrics.delta_e00 >= 30.0
