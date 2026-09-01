"""Standardized 3-patch optical reference target detection and extraction.

Target Architecture (Section 6):
┌────────────────────────┬────────────────────────┐
│ WHITE REFERENCE PATCH  │ GREY REFERENCE PATCH   │
│ (Top-Left: 10%-30%)    │ (Top-Right: 70%-90%)   │
├────────────────────────┴────────────────────────┤
│             ACTIVE H2S CHEMICAL STRIP           │
│                (Center: 38%-62%)                │
└─────────────────────────────────────────────────┘
"""

from typing import Dict, Optional, Tuple
import numpy as np
from .roi import ROIExtractor

# Standard normalized bounding boxes (x1, y1, x2, y2) in [0.0, 1.0]
TARGET_LAYOUT = {
    "white_patch": (0.10, 0.10, 0.30, 0.30),
    "grey_patch": (0.70, 0.10, 0.90, 0.30),
    "h2s_strip": (0.38, 0.38, 0.62, 0.62)
}


class ReferenceTargetExtractor:
    """Extracts and verifies the 3-zone colorimetric target patches."""

    def __init__(self, extractor: Optional[ROIExtractor] = None):
        self.extractor = extractor or ROIExtractor()

    def extract_target_zones(
        self,
        image: np.ndarray
    ) -> Dict[str, dict]:
        """Extracts all patches from the target frame.

        Args:
            image: Full frame uint8 or float image (H, W, 3).

        Returns:
            Dict containing raw pixel patches, median RGBs, and quality stats.
        """
        results = {}

        for zone_name, bbox in TARGET_LAYOUT.items():
            pixels = self.extractor.extract_patch(image, bbox)
            median_rgb, stats = self.extractor.compute_robust_median_rgb(pixels)
            results[zone_name] = {
                "bbox": bbox,
                "pixels": pixels,
                "median_rgb": median_rgb,
                "stats": stats
            }

        return results

    def verify_neutral_balance(
        self,
        white_rgb: np.ndarray,
        grey_rgb: np.ndarray,
        max_chroma_spread: float = 25.0
    ) -> Tuple[bool, str]:
        """Verifies neutral balance of reference patches."""
        w_spread = float(np.max(white_rgb) - np.min(white_rgb))
        g_spread = float(np.max(grey_rgb) - np.min(grey_rgb))

        if w_spread > max_chroma_spread:
            return False, f"White patch exhibits chromatic cast (spread {w_spread:.1f} > {max_chroma_spread:.1f})"
        if g_spread > max_chroma_spread:
            return False, f"Grey patch exhibits chromatic cast (spread {g_spread:.1f} > {max_chroma_spread:.1f})"

        return True, "Neutral reference patches verified"
