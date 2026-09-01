"""Pytest suite for Dosimetry, Arrhenius Kinetics, and Risk Policy."""

import pytest
import numpy as np

from ..calibration.strip_calibration import StripCalibrationDataset
from ..dosimetry.risk import RiskPolicyEngine
from ..dosimetry.confidence import compute_confidence_score


def test_strip_calibration_monotonic_prediction():
    """Verify dose increases monotonically with increasing ΔE00."""
    dataset = StripCalibrationDataset()

    delta_vals = [0.0, 5.0, 15.0, 30.0, 50.0, 70.0]
    doses = [dataset.estimate_dose(d, 25.0, 50.0)[0] for d in delta_vals]

    # Verify strictly monotonic non-decreasing
    for i in range(len(doses) - 1):
        assert doses[i] <= doses[i + 1]


def test_strip_calibration_out_of_range_handling():
    """Verify out-of-range extreme delta (>78.5) is flagged with status."""
    dataset = StripCalibrationDataset()
    dose, in_range, status, k = dataset.estimate_dose(95.0, 25.0, 50.0)

    assert in_range is False
    assert "OUT OF CALIBRATION RANGE" in status


def test_arrhenius_temperature_compensation():
    """Verify higher temperature accelerates reaction rate factor k(T, RH) > 1.0."""
    dataset = StripCalibrationDataset()

    k_cold, _, _ = dataset.compute_environmental_rate_factor(15.0, 50.0)
    k_ref, _, _ = dataset.compute_environmental_rate_factor(25.0, 50.0)
    k_hot, _, _ = dataset.compute_environmental_rate_factor(40.0, 50.0)

    assert k_cold < k_ref
    assert k_ref == 1.0
    assert k_hot > k_ref


def test_risk_policy_engine_tiers():
    """Verify statutory risk policy correctly categorizes exposure tiers."""
    risk_engine = RiskPolicyEngine()

    assert risk_engine.evaluate_risk(0.0).name == "SAFE"
    assert risk_engine.evaluate_risk(5.0).name == "SAFE"
    assert risk_engine.evaluate_risk(15.0).name == "CAUTION"
    assert risk_engine.evaluate_risk(30.0).name == "WARNING"
    assert risk_engine.evaluate_risk(60.0).name == "ALERT"
    assert risk_engine.evaluate_risk(90.0).name == "DANGER"
    assert risk_engine.evaluate_risk(200.0).name == "LIFE_THREATENING"


def test_confidence_score_breakdown():
    """Verify confidence score combines all 4 factors."""
    conf, breakdown = compute_confidence_score(
        quality_score=95.0,
        reference_stability_cv=0.02,
        is_camera_characterized=True,
        is_in_calibration_range=True,
        is_env_valid=True
    )
    assert conf >= 90.0
    assert breakdown["is_camera_characterized"] is True
