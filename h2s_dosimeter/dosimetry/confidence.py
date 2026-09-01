"""Multi-factor Measurement Confidence Scoring Engine.

Combines:
1. Image Quality Gate Score (35% weight)
2. White & Grey Reference Stability (25% weight)
3. Camera Characterization Status (20% weight: 1.0 for calibrated CCM, 0.65 for fallback)
4. Calibration Domain Proximity & Environmental Bounds (20% weight)
"""

from typing import Dict, Optional, Tuple
import numpy as np


def compute_confidence_score(
    quality_score: float,
    reference_stability_cv: float,
    is_camera_characterized: bool,
    is_in_calibration_range: bool,
    is_env_valid: bool
) -> Tuple[float, dict]:
    """Calculates composite measurement confidence score (0 to 100%).

    Returns:
        Tuple[float, dict]: (Composite confidence percentage [0.0, 100.0], factor breakdown).
    """
    # 1. Quality factor (0 to 35 pts)
    q_pts = float(np.clip((quality_score / 100.0) * 35.0, 0.0, 35.0))

    # 2. Reference stability factor (0 to 25 pts)
    # Target CV <= 0.05 is full points, CV >= 0.20 drops to 0
    ref_penalty = min(25.0, max(0.0, (reference_stability_cv - 0.03) / 0.15 * 25.0))
    ref_pts = float(25.0 - ref_penalty)

    # 3. Camera characterization factor (0 to 20 pts)
    cam_pts = 20.0 if is_camera_characterized else 13.0

    # 4. Domain & Environmental factor (0 to 20 pts)
    domain_pts = 20.0
    if not is_in_calibration_range:
        domain_pts -= 12.0
    if not is_env_valid:
        domain_pts -= 8.0
    domain_pts = max(0.0, domain_pts)

    total_confidence = float(np.clip(q_pts + ref_pts + cam_pts + domain_pts, 0.0, 100.0))

    breakdown = {
        "overall_confidence": round(total_confidence, 1),
        "quality_score_pts": round(q_pts, 1),
        "reference_stability_pts": round(ref_pts, 1),
        "camera_characterization_pts": round(cam_pts, 1),
        "domain_validity_pts": round(domain_pts, 1),
        "is_camera_characterized": is_camera_characterized,
        "is_in_range": is_in_calibration_range
    }

    return round(total_confidence, 1), breakdown
