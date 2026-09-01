"""Pytest suite for Image Quality Gate and ROI pixel filtering."""

import pytest
import numpy as np

from ..camera.image_quality import evaluate_image_quality, compute_sharpness_score
from ..vision.roi import ROIExtractor
from ..camera.capture import generate_synthetic_calibration_frame


def test_quality_gate_clean_synthetic_frame():
    """Verify standard synthetic calibration frame passes quality gate with high score."""
    clean_frame = generate_synthetic_calibration_frame(noise_sigma=1.0)
    extractor = ROIExtractor()
    white_pixels = extractor.extract_patch(clean_frame, (0.1, 0.1, 0.3, 0.3))
    grey_pixels = extractor.extract_patch(clean_frame, (0.7, 0.1, 0.9, 0.3))
    strip_pixels = extractor.extract_patch(clean_frame, (0.38, 0.38, 0.62, 0.62))

    res = evaluate_image_quality(
        clean_frame,
        white_roi=white_pixels,
        grey_roi=grey_pixels,
        strip_roi=strip_pixels
    )

    assert res.passed is True
    assert res.overall_score >= 80.0
    assert len(res.reasons) == 0


def test_quality_gate_rejects_saturated_frame():
    """Verify frame with excessive glare/saturation (>250) is rejected."""
    sat_frame = generate_synthetic_calibration_frame()
    # Add strong specular glare patch over 15% of the frame
    sat_frame[100:250, 100:250] = 255

    res = evaluate_image_quality(sat_frame, max_saturation_ratio=0.03)
    assert res.passed is False
    assert any("saturation" in r.lower() or "glare" in r.lower() for r in res.reasons)


def test_quality_gate_rejects_underexposed_frame():
    """Verify heavily underexposed/dark frame is rejected."""
    dark_frame = np.full((480, 640, 3), 5, dtype=np.uint8)
    res = evaluate_image_quality(dark_frame, max_underexposed_ratio=0.05)
    assert res.passed is False
    assert any("underexposed" in r.lower() or "dark" in r.lower() for r in res.reasons)


def test_roi_extractor_glare_outlier_filtering():
    """Verify ROIExtractor successfully filters specular glare spikes (>2.5 sigma)."""
    extractor = ROIExtractor()
    # Base patch of 100 pixels around RGB 120, with 5 extreme glare outliers (255)
    patch = np.full((100, 3), 120.0)
    patch[:5] = [255.0, 255.0, 255.0]

    robust_rgb, stats = extractor.compute_robust_median_rgb(patch)
    assert pytest.approx(robust_rgb[0], abs=2.0) == 120.0
    assert stats["valid_pixels"] < 100
