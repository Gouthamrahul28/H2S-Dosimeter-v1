"""
h2s_dosimeter.tests.test_lead_acetate_model
===========================================
Unit & Regression Tests for Phase 5: Lead Acetate Calibration Models.

Tests:
1. Known valid fixture (strictly tagged data_type='TEST')
2. Known invalid fixture (missing required fields / wrong chemistry / invalid types)
3. Missing model in registry (KeyError / MODEL_UNAVAILABLE)
4. Wrong chemistry model (MODEL_CHEMISTRY_MISMATCH hard isolation)
5. Out-of-range input (OUTSIDE_CALIBRATION_RANGE / BELOW_CALIBRATION_RANGE / ABOVE_CALIBRATION_RANGE)
6. NaN and infinite input handling (PREDICTION_FAILED)
7. Missing environmental features (evaluates with standard nominal conditions & warning)
8. Group-aware train/test splitting (zero strip/batch leakage)
9. Simple models progression (Linear -> Polynomial -> Random Forest)
10. Uncalibrated state integrity (MODEL NOT TRAINED — CALIBRATION DATA REQUIRED, dose is None, NEVER 0.0 ppm)
"""

import math
import pytest
import numpy as np

from ..calibration.lead_acetate_model import (
    CHEMISTRY_LEAD_ACETATE,
    DATASET_VERSION_V1,
    MODEL_VERSION_V1,
    STATUS_VALID_ESTIMATE,
    STATUS_BELOW_CALIBRATION_RANGE,
    STATUS_ABOVE_CALIBRATION_RANGE,
    STATUS_CALIBRATION_UNAVAILABLE,
    STATUS_MODEL_CHEMISTRY_MISMATCH,
    STATUS_PREDICTION_FAILED,
    STATUS_NOT_TRAINED,
    LeadAcetateDataset,
    LeadAcetateSampleRecord,
    LeadAcetateLinearRegressionModel,
    LeadAcetatePolynomialModel,
    LeadAcetateRandomForestModel,
    LeadAcetateModelRegistry,
    create_test_plumbing_dataset,
    split_lead_acetate_dataset_group_aware
)


# --- 1. KNOWN VALID FIXTURE TEST ---
def test_known_valid_fixture():
    fixture = create_test_plumbing_dataset()
    assert fixture.data_type == "TEST"
    assert len(fixture) == 4
    for s in fixture.records:
        assert s.data_type == "TEST"
        assert s.sensor_chemistry == CHEMISTRY_LEAD_ACETATE
        assert s.reference_dose >= 0.0
        assert "L" in s.Lab
        assert "a" in s.Lab
        assert "b" in s.Lab


# --- 2. KNOWN INVALID FIXTURE TEST ---
def test_known_invalid_fixture():
    ds = LeadAcetateDataset(data_type="EXPERIMENTAL")

    # Wrong chemistry
    with pytest.raises(ValueError, match="CHEMISTRY_MISMATCH"):
        ds.add_sample({
            "sample_id": "INVALID_CHEM",
            "sensor_chemistry": "CU_PAN",  # Mismatched
            "exposure_concentration": 10.0,
            "exposure_duration": 60.0,
            "reference_dose": 10.0,
            "temperature": 25.0,
            "humidity": 50.0,
            "RGB": {"r": 200, "g": 200, "b": 200},
            "Lab": {"L": 80.0, "a": 1.0, "b": 5.0},
            "data_type": "EXPERIMENTAL"
        })

    # Data type mismatch (adding TEST sample to EXPERIMENTAL dataset)
    with pytest.raises(ValueError, match="DATA_TYPE_MISMATCH"):
        ds.add_sample({
            "sample_id": "INVALID_TYPE",
            "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
            "exposure_concentration": 10.0,
            "exposure_duration": 60.0,
            "reference_dose": 10.0,
            "temperature": 25.0,
            "humidity": 50.0,
            "RGB": {"r": 200, "g": 200, "b": 200},
            "Lab": {"L": 80.0, "a": 1.0, "b": 5.0},
            "data_type": "TEST"  # Mismatch with EXPERIMENTAL
        })


# --- 3. MISSING MODEL IN REGISTRY ---
def test_missing_model_in_registry():
    registry = LeadAcetateModelRegistry()
    with pytest.raises(KeyError, match="MODEL_UNAVAILABLE"):
        registry.load_model(CHEMISTRY_LEAD_ACETATE, model_name="non_existent_model_xyz", model_version="9.9.9")


# --- 4. WRONG CHEMISTRY MODEL (HARD ISOLATION) ---
def test_wrong_chemistry_model_rejection():
    registry = LeadAcetateModelRegistry()

    # Attempt to load model for Cu-PAN using Lead Acetate loader
    with pytest.raises(ValueError, match="MODEL_CHEMISTRY_MISMATCH"):
        registry.load_model("CU_PAN")

    # Fit fitted model and attempt cross-chemistry prediction
    model = LeadAcetateLinearRegressionModel()
    model.fit(create_test_plumbing_dataset())
    pred = model.predict({
        "sensor_chemistry": "CU_PAN",  # Injected Cu-PAN chemistry
        "deltaE00": 20.0
    })
    assert pred.status == STATUS_MODEL_CHEMISTRY_MISMATCH
    assert pred.dose_ppm_h is None
    assert "HARD ISOLATION VIOLATION" in pred.error


# --- 5. OUT-OF-RANGE INPUT (NO FALSE PRECISION / NO SILENT EXTRAPOLATION) ---
def test_out_of_range_input_handling():
    model = LeadAcetateLinearRegressionModel()
    fixture = create_test_plumbing_dataset()
    model.fit(fixture)

    # 1. Below range (deltaE00 = -5.0, below min anchor 0.0)
    pred_below = model.predict({
        "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
        "deltaE00": -5.0
    })
    assert pred_below.status == STATUS_BELOW_CALIBRATION_RANGE
    assert pred_below.is_calibrated_domain is False
    assert pred_below.confidence <= 0.30

    # 2. Above range (deltaE00 = 99.0, above max anchor 55.4)
    pred_above = model.predict({
        "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
        "deltaE00": 99.0
    })
    assert pred_above.status == STATUS_ABOVE_CALIBRATION_RANGE
    assert pred_above.is_calibrated_domain is False
    assert pred_above.confidence <= 0.30


# --- 6. NAN INPUT HANDLING ---
def test_nan_and_inf_input_rejection():
    model = LeadAcetateLinearRegressionModel()
    model.fit(create_test_plumbing_dataset())

    # NaN in optical feature
    pred_nan = model.predict({
        "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
        "deltaE00": float("nan")
    })
    assert pred_nan.status == STATUS_PREDICTION_FAILED
    assert pred_nan.dose_ppm_h is None
    assert "NaN or Inf" in pred_nan.error

    # Inf in temperature
    pred_inf = model.predict({
        "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
        "deltaE00": 25.0,
        "temperature": float("inf")
    })
    assert pred_inf.status == STATUS_PREDICTION_FAILED
    assert pred_inf.dose_ppm_h is None


# --- 7. MISSING ENVIRONMENTAL FEATURE HANDLING ---
def test_missing_environmental_feature():
    model = LeadAcetateLinearRegressionModel()
    model.fit(create_test_plumbing_dataset())

    # Predict with only deltaE00, omitting temperature and humidity
    pred = model.predict({
        "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
        "deltaE00": 20.0
    })
    assert pred.status == STATUS_VALID_ESTIMATE
    assert pred.dose_ppm_h is not None
    assert pred.warning is not None
    assert "Environmental parameters missing" in pred.warning


# --- 8. GROUP-AWARE SPLITTING (ZERO LEAKAGE) ---
def test_group_aware_strip_batch_splitting():
    fixture = create_test_plumbing_dataset()
    train_recs, val_recs, test_recs = split_lead_acetate_dataset_group_aware(fixture, train_ratio=0.50, val_ratio=0.0)

    train_strips = {r.strip_id for r in train_recs}
    test_strips = {r.strip_id for r in test_recs}

    # Verify zero strip leakage between train and test sets
    overlap = train_strips.intersection(test_strips)
    assert len(overlap) == 0, f"Data leakage detected! Strips {overlap} present in both train and test."


# --- 9. SIMPLE MODELS PROGRESSION & METRICS ---
def test_simple_models_progression():
    fixture = create_test_plumbing_dataset()

    # 1. Linear Regression Baseline
    m_linear = LeadAcetateLinearRegressionModel()
    m_linear.fit(fixture)
    meta_lin = m_linear.get_metadata()
    assert meta_lin["metrics"]["r2"] > 0.85
    assert meta_lin["metrics"]["mae"] >= 0.0

    # 2. Polynomial Regression (Degree 2)
    m_poly = LeadAcetatePolynomialModel(degree=2)
    m_poly.fit(fixture)
    meta_poly = m_poly.get_metadata()
    assert meta_poly["metrics"]["r2"] > meta_lin["metrics"]["r2"] or meta_poly["metrics"]["r2"] > 0.95

    # 3. Random Forest
    m_rf = LeadAcetateRandomForestModel(n_estimators=10, max_depth=3)
    m_rf.fit(fixture)
    meta_rf = m_rf.get_metadata()
    assert "r2" in meta_rf["metrics"]

    # Verify 10 Versioning Fields Stored
    required_version_fields = [
        "model_id", "chemistry", "dataset_version", "model_version",
        "features", "training_date", "metrics", "training_sample_count",
        "supported_range", "model_artifact_reference"
    ]
    for f in required_version_fields:
        assert f in meta_lin, f"Missing versioning field '{f}' in metadata"


# --- 10. UNCALIBRATED STATE INTEGRITY ---
def test_uncalibrated_state_integrity():
    uncalibrated = LeadAcetateLinearRegressionModel()
    assert uncalibrated.is_fitted is False
    assert uncalibrated.status == STATUS_NOT_TRAINED

    pred = uncalibrated.predict({
        "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
        "deltaE00": 20.0
    })
    assert pred.status == STATUS_CALIBRATION_UNAVAILABLE
    assert pred.dose_ppm_h is None  # STRICT: Never 0.0 ppm
    assert pred.dose_ppm_h != 0.0
