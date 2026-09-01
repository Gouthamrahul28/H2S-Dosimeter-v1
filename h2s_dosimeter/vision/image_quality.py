"""
h2s_dosimeter.vision.image_quality
==================================
Evaluates optical capture quality, illumination sufficiency, focus sharpness,
and measurement reliability confidence scores.
"""

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional
import cv2
import numpy as np
from .strip_roi import PatchMetrics


@dataclass
class ImageQualityReport:
    """Quantitative optical quality audit."""
    quality_score: float         # 0.0 to 100.0 %
    quality_label: str           # "EXCELLENT", "GOOD", "ACCEPTABLE", "POOR", "INVALID"
    is_acceptable: bool          # True if quality >= acceptable_threshold
    sharpness_score: float       # Laplacian blur variance
    white_uniformity_score: float # White patch homogeneity
    exposure_quality_score: float # Dynamic range / non-saturation score
    rejection_reasons: List[str]

    def to_dict(self) -> Dict:
        return asdict(self)


def estimate_sharpness(image_rgb: np.ndarray) -> float:
    """
    Estimate image sharpness using the variance of the Laplacian operator.
    
    Args:
        image_rgb: RGB image array.
        
    Returns:
        float: Sharpness index (higher = sharper, < 50 typically indicates blur).
    """
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    return float(laplacian_var)


def compute_image_quality(
    image_rgb: np.ndarray,
    white_metrics: PatchMetrics,
    strip_metrics: PatchMetrics,
    min_acceptable_score: float = 60.0
) -> ImageQualityReport:
    """
    Compute comprehensive image capture quality report.
    
    Args:
        image_rgb: Full input image (H, W, 3).
        white_metrics: Extracted metrics for white reference patch.
        strip_metrics: Extracted metrics for active H2S strip.
        min_acceptable_score: Cutoff threshold for acceptable readings.
        
    Returns:
        ImageQualityReport instance.
    """
    rejections = []
    
    # 1. Check ROI extractions
    if not white_metrics.valid:
        rejections.append(f"White Reference invalid: {white_metrics.rejection_reason}")
    if not strip_metrics.valid:
        rejections.append(f"H2S Strip invalid: {strip_metrics.rejection_reason}")
        
    # 2. Sharpness / Focus
    sharpness = estimate_sharpness(image_rgb)
    sharpness_factor = min(1.0, max(0.1, sharpness / 150.0))
    if sharpness < 35.0:
        rejections.append(f"Image is severely blurred (sharpness {sharpness:.1f} < 35.0 min).")
        
    # 3. White Patch Quality (Saturation & Uniformity)
    w_valid_ratio = white_metrics.valid_ratio if white_metrics.valid else 0.0
    w_cv = white_metrics.uniformity_cv if white_metrics.valid else 1.0
    w_uniformity = max(0.0, 1.0 - w_cv * 3.0)
    
    # 4. Exposure & Dynamic Range
    total_sat = (white_metrics.saturation_ratio + strip_metrics.saturation_ratio) / 2.0
    total_under = (white_metrics.underexposed_ratio + strip_metrics.underexposed_ratio) / 2.0
    exposure_score = max(0.0, 1.0 - (total_sat * 1.5 + total_under * 1.2))
    
    if white_metrics.saturation_ratio > 0.40:
        rejections.append(f"Excessive glare/saturation on white reference ({white_metrics.saturation_ratio:.1%}).")
        
    # 5. Composite Score Calculation
    # Weights: White Patch (35%), Strip Validity (30%), Exposure Dynamic Range (20%), Sharpness (15%)
    raw_score = (
        0.35 * (w_valid_ratio * 0.6 + w_uniformity * 0.4) +
        0.30 * (strip_metrics.valid_ratio if strip_metrics.valid else 0.0) +
        0.20 * exposure_score +
        0.15 * sharpness_factor
    ) * 100.0
    
    if not white_metrics.valid or not strip_metrics.valid:
        final_score = min(raw_score, 35.0)
    else:
        final_score = float(np.clip(raw_score, 0.0, 100.0))
        
    if final_score >= 88.0:
        label = "EXCELLENT"
    elif final_score >= 75.0:
        label = "GOOD"
    elif final_score >= min_acceptable_score:
        label = "ACCEPTABLE"
    elif final_score >= 40.0:
        label = "POOR"
    else:
        label = "INVALID"
        
    is_acceptable = (final_score >= min_acceptable_score) and (len(rejections) == 0)
    
    return ImageQualityReport(
        quality_score=round(final_score, 1),
        quality_label=label,
        is_acceptable=is_acceptable,
        sharpness_score=round(sharpness, 1),
        white_uniformity_score=round(w_uniformity * 100.0, 1),
        exposure_quality_score=round(exposure_score * 100.0, 1),
        rejection_reasons=rejections
    )
