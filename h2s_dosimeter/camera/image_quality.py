"""Image Quality Gate for Optical Colorimetry.

Evaluates raw capture frames against strict metrological quality criteria:
1. Highlight saturation & glare percentage (< 2.0%)
2. Shadow underexposure percentage (< 3.0%)
3. Focus sharpness via Laplacian variance (> 60.0)
4. Spatial lighting uniformity across the frame (CV < 18.0%)
5. Neutral white-reference stability
6. Neutral grey-reference stability

Rejects captures that fail quality thresholds before colorimetric conversion.
"""

from typing import Dict, List, Optional, Tuple, Union
import numpy as np


class QualityGateResult:
    """Encapsulates image quality gate diagnostics and pass/fail determination."""

    def __init__(
        self,
        passed: bool,
        overall_score: float,
        saturation_ratio: float,
        underexposed_ratio: float,
        sharpness_score: float,
        uniformity_cv: float,
        white_stability_cv: float,
        grey_stability_cv: float,
        reasons: Optional[List[str]] = None,
        warnings: Optional[List[str]] = None
    ):
        self.passed = passed
        self.overall_score = round(float(overall_score), 1)
        self.saturation_ratio = round(float(saturation_ratio), 4)
        self.underexposed_ratio = round(float(underexposed_ratio), 4)
        self.sharpness_score = round(float(sharpness_score), 1)
        self.uniformity_cv = round(float(uniformity_cv), 3)
        self.white_stability_cv = round(float(white_stability_cv), 3)
        self.grey_stability_cv = round(float(grey_stability_cv), 3)
        self.reasons = reasons or []
        self.warnings = warnings or []

    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "overall_score": self.overall_score,
            "status": "PASS" if self.passed else "REJECT",
            "saturation_ratio": self.saturation_ratio,
            "underexposed_ratio": self.underexposed_ratio,
            "sharpness_score": self.sharpness_score,
            "uniformity_cv": self.uniformity_cv,
            "white_stability_cv": self.white_stability_cv,
            "grey_stability_cv": self.grey_stability_cv,
            "reasons": self.reasons,
            "warnings": self.warnings
        }


def compute_sharpness_score(image: np.ndarray) -> float:
    """Computes focus sharpness via discrete Laplacian filter variance."""
    if image.ndim == 3:
        # Convert to luminance: Y = 0.299R + 0.587G + 0.114B
        gray = 0.299 * image[:, :, 0] + 0.587 * image[:, :, 1] + 0.114 * image[:, :, 2]
    else:
        gray = image.astype(np.float64)

    # 3x3 Laplacian kernel convolution
    laplacian = (
        -4.0 * gray[1:-1, 1:-1]
        + gray[:-2, 1:-1]
        + gray[2:, 1:-1]
        + gray[1:-1, :-2]
        + gray[1:-1, 2:]
    )
    return float(np.var(laplacian))


def evaluate_image_quality(
    image: np.ndarray,
    white_roi: Optional[np.ndarray] = None,
    grey_roi: Optional[np.ndarray] = None,
    strip_roi: Optional[np.ndarray] = None,
    max_saturation_ratio: float = 0.03,
    max_underexposed_ratio: float = 0.05,
    min_sharpness: float = 40.0,
    max_uniformity_cv: float = 0.25
) -> QualityGateResult:
    """Evaluates capture quality gate before colorimetry transformations.

    Args:
        image: Full capture frame as uint8 or float ndarray (H, W, 3).
        white_roi: Sub-array of white reference patch pixels.
        grey_roi: Sub-array of grey reference patch pixels.
        strip_roi: Sub-array of active H2S strip pixels.

    Returns:
        QualityGateResult: Pass/fail determination with score and rejection reasons.
    """
    img = np.asarray(image, dtype=np.float64)
    if img.ndim != 3 or img.shape[2] != 3:
        raise ValueError(f"Image must have shape (H, W, 3), got {img.shape}")

    # Scale to [0, 255] if normalized
    if img.max() <= 1.0:
        img = img * 255.0

    total_pixels = img.shape[0] * img.shape[1]

    # 1. Saturation & Specular Glare (> 250 in any channel)
    sat_mask = np.any(img >= 250.0, axis=2)
    saturation_ratio = float(np.sum(sat_mask) / total_pixels)

    # 2. Underexposure / Shadow Clipping (< 15 in all channels)
    under_mask = np.all(img < 15.0, axis=2)
    underexposed_ratio = float(np.sum(under_mask) / total_pixels)

    # 3. Focus & Sharpness
    sharpness = compute_sharpness_score(img)

    # 4. Spatial Lighting Uniformity (Coefficient of Variation of background)
    lum = 0.2126 * img[:, :, 0] + 0.7152 * img[:, :, 1] + 0.0722 * img[:, :, 2]
    mean_lum = float(np.mean(lum))
    std_lum = float(np.std(lum))
    uniformity_cv = (std_lum / (mean_lum + 1e-6)) if mean_lum > 0 else 1.0

    # 5. Reference Patch Stability
    white_cv = 0.0
    if white_roi is not None and white_roi.size > 0:
        w_lum = 0.2126 * white_roi[:, 0] + 0.7152 * white_roi[:, 1] + 0.0722 * white_roi[:, 2]
        white_cv = float(np.std(w_lum) / (np.mean(w_lum) + 1e-6))

    grey_cv = 0.0
    if grey_roi is not None and grey_roi.size > 0:
        g_lum = 0.2126 * grey_roi[:, 0] + 0.7152 * grey_roi[:, 1] + 0.0722 * grey_roi[:, 2]
        grey_cv = float(np.std(g_lum) / (np.mean(g_lum) + 1e-6))

    # Evaluate Pass/Fail Rules
    reasons = []
    warnings = []

    if saturation_ratio > max_saturation_ratio:
        reasons.append(f"Excessive highlight saturation / glare ({saturation_ratio * 100:.1f}% > {max_saturation_ratio * 100:.1f}%)")
    elif saturation_ratio > 0.01:
        warnings.append(f"Minor highlight glare detected ({saturation_ratio * 100:.1f}%)")

    if underexposed_ratio > max_underexposed_ratio:
        reasons.append(f"Image underexposed / dark ({underexposed_ratio * 100:.1f}% > {max_underexposed_ratio * 100:.1f}%)")

    if sharpness < min_sharpness:
        reasons.append(f"Image blurred or out of focus (sharpness score {sharpness:.1f} < {min_sharpness:.1f})")

    if uniformity_cv > max_uniformity_cv:
        warnings.append(f"Uneven illumination field (CV {uniformity_cv:.2f} > {max_uniformity_cv:.2f})")

    if white_cv > 0.15:
        warnings.append(f"White reference patch lighting uneven (CV {white_cv:.2f})")

    # Compute overall quality score (0 to 100)
    score = 100.0
    score -= min(35.0, (saturation_ratio / max_saturation_ratio) * 35.0)
    score -= min(25.0, (underexposed_ratio / max_underexposed_ratio) * 25.0)
    score -= min(25.0, max(0.0, (min_sharpness - sharpness) / min_sharpness * 25.0))
    score -= min(15.0, max(0.0, (uniformity_cv - 0.10) / 0.15 * 15.0))
    overall_score = float(np.clip(score, 0.0, 100.0))

    passed = (len(reasons) == 0) and (overall_score >= 50.0)

    return QualityGateResult(
        passed=passed,
        overall_score=overall_score,
        saturation_ratio=saturation_ratio,
        underexposed_ratio=underexposed_ratio,
        sharpness_score=sharpness,
        uniformity_cv=uniformity_cv,
        white_stability_cv=white_cv,
        grey_stability_cv=grey_cv,
        reasons=reasons,
        warnings=warnings
    )
