"""
h2s_dosimeter.tests.test_vision_calibration
===========================================
Unit tests for vision preprocessing, ROI outlier filtering, white reference estimation,
and calibration dataset/model fitting.
"""

import numpy as np
import pytest

from ..vision.strip_roi import (
    ROIDefinition,
    filter_patch_pixels,
    extract_patch_metrics,
    extract_roi_pixels
)
from ..vision.image_quality import compute_image_quality, estimate_sharpness
from ..calibration.white_reference import estimate_source_white
from ..calibration.camera_matrix import load_camera_matrix, get_default_camera_config
from ..calibration.calibration_dataset import (
    CalibrationRecord,
    CalibrationDataset,
    load_calibration_dataset
)
from ..calibration.calibration_model import (
    PiecewiseInterpolationModel,
    PolynomialRegressionModel,
    create_calibration_model
)
from ..config import DEFAULT_CALIBRATION_DATASET_PATH


class TestVisionFiltering:
    """Tests for pixel outlier rejection (saturation, glare, underexposure)."""

    def test_saturation_rejection(self):
        """Pixels exceeding upper saturation threshold must be filtered out."""
        # 100 pixels: 80 clean gray (180, 180, 180) and 20 blown-out specular highlights (255, 255, 255)
        clean = np.full((80, 3), 180, dtype=np.uint8)
        saturated = np.full((20, 3), 255, dtype=np.uint8)
        patch = np.vstack([clean, saturated])
        
        valid, stats = filter_patch_pixels(patch, saturation_threshold=250)
        assert stats["total"] == 100
        assert stats["sat_ratio"] == 0.20
        assert len(valid) == 80
        np.testing.assert_allclose(valid[0], [180/255.0, 180/255.0, 180/255.0], atol=1e-3)

    def test_underexposure_rejection(self):
        """Pixels below minimum underexposure threshold must be rejected."""
        clean = np.full((70, 3), 120, dtype=np.uint8)
        dark = np.full((30, 3), 5, dtype=np.uint8)
        patch = np.vstack([clean, dark])
        
        valid, stats = filter_patch_pixels(patch, underexposed_threshold=15)
        assert stats["total"] == 100
        assert stats["under_ratio"] == 0.30
        assert len(valid) == 70

    def test_roi_metric_extraction(self):
        """Verify robust median calculation from synthetic image patch."""
        img = np.full((100, 100, 3), 150, dtype=np.uint8)
        # Inject specular noise
        img[10:20, 10:20] = 255
        
        roi = ROIDefinition(name="TestROI", x_min=0.0, y_min=0.0, x_max=1.0, y_max=1.0)
        metrics = extract_patch_metrics(img, roi)
        
        assert metrics.valid is True
        assert metrics.median_rgb_8bit == [150, 150, 150]
        assert metrics.saturation_ratio > 0.0


class TestWhiteReferenceEstimation:
    """Tests for source white point W_src estimation."""

    def test_clean_white_patch(self):
        """Clean white patch should yield high confidence score."""
        img = np.full((200, 200, 3), 240, dtype=np.uint8)
        roi = ROIDefinition(name="WhiteRef", x_min=0.1, y_min=0.1, x_max=0.9, y_max=0.9)
        
        res = estimate_source_white(img, roi)
        assert res.valid is True
        assert res.confidence_score >= 80.0
        assert res.source_white_rgb_8bit == [240, 240, 240]

    def test_dark_underexposed_patch_rejection(self):
        """Severely underexposed patch must be rejected with valid=False."""
        img = np.full((200, 200, 3), 15, dtype=np.uint8)
        roi = ROIDefinition(name="WhiteRef", x_min=0.1, y_min=0.1, x_max=0.9, y_max=0.9)
        
        res = estimate_source_white(img, roi)
        assert res.valid is False
        assert len(res.rejection_reason) > 0

    def test_auto_detect_source_white(self):
        """Image with white card margin should auto-detect white point without explicit ROI."""
        from ..calibration.white_reference import auto_detect_source_white
        # Create image with dark background and white card in the center
        img = np.full((300, 300, 3), 40, dtype=np.uint8)
        img[50:250, 50:250] = [240, 240, 240]  # White card
        img[100:200, 100:200] = [110, 95, 80]   # Darkened strip in middle
        
        res = auto_detect_source_white(img)
        assert res.valid is True
        assert res.confidence_score >= 50.0
        assert res.source_white_rgb_8bit[0] >= 230


class TestCalibrationModels:
    """Tests for Dose Calibration Models (Piecewise & Polynomial)."""

    @pytest.fixture
    def dataset(self):
        return load_calibration_dataset(DEFAULT_CALIBRATION_DATASET_PATH)

    def test_piecewise_model_anchors(self, dataset):
        """Piecewise model must reproduce calibrated anchor points exactly."""
        model = PiecewiseInterpolationModel().fit(dataset)
        
        # Test zero baseline
        pred_0 = model.predict([95.4, -0.4, 4.2], deltaE00=0.0)
        assert pred_0.estimated_dose_ppm_h == 0.0
        assert pred_0.is_calibrated_domain is True
        assert pred_0.calibration_status == "CALIBRATED"
        
        # Test 20.0 ppm·h anchor
        rec_20 = next(r for r in dataset.records if r.dose_ppm_h == 20.0)
        pred_20 = model.predict([rec_20.L, rec_20.a, rec_20.b], deltaE00=rec_20.deltaE00)
        assert abs(pred_20.estimated_dose_ppm_h - 20.0) < 0.1

    def test_out_of_range_handling(self, dataset):
        """Out of range ΔE00 must report 'OUTSIDE CALIBRATION RANGE' and not silently extrapolate."""
        model = PiecewiseInterpolationModel().fit(dataset)
        
        # ΔE00 of 150 is far beyond the 69.8 maximum in the calibration dataset
        pred_out = model.predict([5.0, 0.0, 0.0], deltaE00=150.0)
        assert pred_out.is_calibrated_domain is False
        assert pred_out.calibration_status == "OUTSIDE CALIBRATION RANGE"
        assert "exceeds" in pred_out.warning_message.lower()

    def test_temperature_humidity_compensation(self, dataset):
        """Higher temperature accelerates reaction kinetics, yielding a normalized lower dose for the same darkness."""
        model = PiecewiseInterpolationModel().fit(dataset)
        
        pred_std = model.predict([58.6, 1.1, 11.2], temperature_c=25.0, humidity_percent=50.0, deltaE00=32.1)
        pred_hot = model.predict([58.6, 1.1, 11.2], temperature_c=45.0, humidity_percent=70.0, deltaE00=32.1)
        
        # k_env > 1.0 at elevated temperature and humidity
        assert pred_hot.env_compensation_factor > pred_std.env_compensation_factor
        assert pred_hot.estimated_dose_ppm_h < pred_std.estimated_dose_ppm_h

    def test_polynomial_model_fitting(self, dataset):
        """Polynomial model must achieve high R² on dataset."""
        model = PolynomialRegressionModel(degree=2, alpha=1e-3).fit(dataset)
        metrics = model.evaluate(dataset)
        assert metrics["r2"] > 0.95
        assert metrics["mae"] < 2.0
