"""Vision and optical ROI analysis package."""

from .roi import ROIExtractor
from .reference_detection import ReferenceTargetExtractor, TARGET_LAYOUT
from .strip_analysis import StripOpticalMetrics, analyze_strip_color

__all__ = [
    "ROIExtractor",
    "ReferenceTargetExtractor",
    "TARGET_LAYOUT",
    "StripOpticalMetrics",
    "analyze_strip_color"
]
