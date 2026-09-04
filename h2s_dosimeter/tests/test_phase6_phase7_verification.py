"""
h2s_dosimeter.tests.test_phase6_phase7_verification
===================================================
Automated verification tests for:
Phase 6: Definitive 0.0 PPM Investigation & True Virgin Baseline Distinction.
Phase 7: Real Lead Acetate Experimental Dataset Import, Validation & Model Fitting.
"""

import json
from pathlib import Path
import numpy as np
import pytest

from ..calibration.lead_acetate_model import (
    CHEMISTRY_LEAD_ACETATE,
    DATASET_VERSION_V1,
    STATUS_VALID_ESTIMATE,
    STATUS_BELOW_CALIBRATION_RANGE,
    STATUS_ABOVE_CALIBRATION_RANGE,
    STATUS_NOT_TRAINED,
    STATUS_CALIBRATION_UNAVAILABLE,
    LeadAcetateDataset,
    LeadAcetateSampleRecord,
    LeadAcetatePolynomialModel,
    LeadAcetateRandomForestModel,
    split_lead_acetate_dataset_group_aware,
)


@pytest.fixture
def real_dataset_path():
    p = Path(__file__).resolve().parents[2] / "data" / "master" / "LEAD_ACETATE_DATASET_V1.json"
    assert p.exists(), f"LEAD_ACETATE_DATASET_V1.json not found at {p}"
    return p


def test_lead_acetate_experimental_dataset_completeness(real_dataset_path):
    """Phase 7: Verify real experimental dataset structure, completeness, and lack of synthetic fabrication."""
    with open(real_dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert data["dataset_id"] == "LEAD_ACETATE_DATASET_V1"
    assert data["dataset_version"] == "1.0.0"
    assert data["data_type"] == "EXPERIMENTAL"
    assert data["sensor_chemistry"] == "LEAD_ACETATE"
    assert data["dose_unit"] == "mL_H2S"

    samples = data["samples"]
    assert len(samples) == 15, "Expected 15 experimental samples across 5 dose levels (3 replicates each)"

    sample_ids = [s["sample_id"] for s in samples]
    assert len(set(sample_ids)) == 15, "Duplicate sample_ids detected!"

    # Group by dose
    doses = sorted(list(set(s["reference_dose"] for s in samples)))
    assert doses == [0.0, 5.6, 11.1, 16.7, 22.3], f"Unexpected dose levels: {doses}"

    # Verify each sample has strictly valid physical values
    for s in samples:
        assert s["sensor_chemistry"] == "LEAD_ACETATE"
        assert s["data_type"] == "EXPERIMENTAL"
        assert 0 <= s["RGB"]["r"] <= 255
        assert 0 <= s["RGB"]["g"] <= 255
        assert 0 <= s["RGB"]["b"] <= 255
        assert 0.0 <= s["Lab"]["L"] <= 100.0
        assert -128.0 <= s["Lab"]["a"] <= 127.0
        assert -128.0 <= s["Lab"]["b"] <= 127.0
        assert 0.0 <= s["deltaE00"] <= 100.0
        assert s["quality_score"] >= 90


def test_lead_acetate_physical_monotonicity(real_dataset_path):
    """Phase 7: Verify optical physical response is strictly monotonic (PbS darkening)."""
    with open(real_dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    samples = data["samples"]

    # Calculate means per dose
    doses = sorted(list(set(s["reference_dose"] for s in samples)))
    mean_L = []
    mean_dE = []
    for d in doses:
        subset = [s for s in samples if s["reference_dose"] == d]
        mean_L.append(np.mean([s["Lab"]["L"] for s in subset]))
        mean_dE.append(np.mean([s["deltaE00"] for s in subset]))

    # L* must strictly decrease as dose increases (darkening)
    for i in range(len(mean_L) - 1):
        assert mean_L[i] > mean_L[i + 1], f"L* is not decreasing from dose {doses[i]} to {doses[i+1]}"

    # deltaE00 must strictly increase as dose increases
    for i in range(len(mean_dE) - 1):
        assert mean_dE[i] < mean_dE[i + 1], f"deltaE00 is not increasing from dose {doses[i]} to {doses[i+1]}"


def test_phase6_uncalibrated_model_never_fabricates_zero():
    """Phase 6: Uncalibrated Lead Acetate model returns None dose and CALIBRATION_UNAVAILABLE, NEVER 0.0 ppm."""
    model = LeadAcetatePolynomialModel(degree=2)
    assert not model.is_fitted
    pred = model.predict({
        "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
        "deltaE00": 15.0,
        "Lab": {"L": 70.0, "a": 5.0, "b": 12.0}
    })
    assert pred.status == STATUS_CALIBRATION_UNAVAILABLE
    assert pred.dose_ppm_h is None, "Uncalibrated model must NEVER return a numerical dose (especially 0.0)"
    assert pred.is_calibrated_domain is False


def test_phase7_experimental_model_fitting_and_accuracy(real_dataset_path):
    """Phase 7: Fit 2nd-order polynomial on real experimental data and verify R² > 0.99."""
    with open(real_dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    dataset = LeadAcetateDataset(data_type="EXPERIMENTAL", dataset_version=DATASET_VERSION_V1)
    for s in data["samples"]:
        dataset.add_sample(s)

    assert len(dataset) == 15

    poly = LeadAcetatePolynomialModel(degree=2)
    poly.fit(dataset)
    assert poly.is_fitted
    meta = poly.get_metadata()
    assert meta["metrics"]["r2"] > 0.99, f"Expected R² > 0.99, got {meta['metrics']['r2']}"
    assert meta["metrics"]["mae"] < 1.0, f"Expected MAE < 1.0 mL H2S, got {meta['metrics']['mae']}"

    # Virgin baseline test: deltaE00 = 0.0 should predict close to 0.0 mL H2S
    pred_zero = poly.predict({
        "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
        "deltaE00": 0.0,
        "Lab": {"L": 92.6, "a": -0.89, "b": 3.51}
    })
    assert pred_zero.status == STATUS_VALID_ESTIMATE
    assert abs(pred_zero.dose_ppm_h) < 1.0, f"Virgin baseline prediction deviated: {pred_zero.dose_ppm_h}"

    # High exposure test: deltaE00 = 66.75 should predict near 22.3 mL H2S
    pred_high = poly.predict({
        "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
        "deltaE00": 66.75,
        "Lab": {"L": 20.65, "a": 2.67, "b": 8.09}
    })
    assert pred_high.status == STATUS_VALID_ESTIMATE
    assert abs(pred_high.dose_ppm_h - 22.3) < 1.5, f"High exposure prediction deviated: {pred_high.dose_ppm_h}"

    # Out-of-range above: deltaE00 > 80 should flag ABOVE_CALIBRATION_RANGE
    pred_oor = poly.predict({
        "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
        "deltaE00": 85.0,
        "Lab": {"L": 15.0, "a": 2.0, "b": 8.0}
    })
    assert pred_oor.status == STATUS_ABOVE_CALIBRATION_RANGE
