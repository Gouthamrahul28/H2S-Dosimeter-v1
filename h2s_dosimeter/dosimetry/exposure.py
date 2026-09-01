"""
h2s_dosimeter.dosimetry.exposure
================================
Core exposure analysis pipeline executing the complete colorimetric chain:
Linear RGB -> CCM -> XYZ -> Bradford CAT -> CIELAB -> CIEDE2000 -> Calibrated Dose.
"""

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Union
import numpy as np

from ..color.linear_rgb import srgb_to_linear, normalize_8bit_to_unit
from ..color.rgb_xyz import linear_rgb_to_xyz
from ..color.bradford import bradford_adaptation, D65_WHITE_POINT
from ..color.lab import xyz_to_lab
from ..color.delta_e import ciede2000
from ..vision.strip_roi import ROIDefinition, PatchMetrics, extract_patch_metrics
from ..vision.image_quality import compute_image_quality, ImageQualityReport
from ..calibration.camera_matrix import CameraCalibrationConfig, load_camera_matrix
from ..calibration.white_reference import estimate_source_white, WhiteReferenceResult
from ..calibration.calibration_model import BaseCalibrationModel, ModelPredictionResult
from .risk import get_statutory_risk_level


@dataclass
class ExposureAnalysisResult:
    """Full scientific diagnostic trace and dose estimate for a dosimeter reading."""
    success: bool
    status_label: str             # "CALIBRATED", "OUTSIDE CALIBRATION RANGE", "INVALID"
    estimated_dose_ppm_h: float
    confidence_percentage: float  # 0.0 to 100.0 %
    
    # Colorimetric coordinates
    lab: Dict[str, float]         # {"L": ..., "a": ..., "b": ...}
    deltaE00: float               # Perceptual distance from unexposed baseline
    
    # Diagnostic Trace
    raw_rgb_8bit: List[int]
    linear_rgb: List[float]
    white_reference_rgb_8bit: List[int]
    source_white_xyz: List[float]
    xyz_before_adaptation: List[float]
    xyz_after_adaptation: List[float]
    
    # Environmental & Modeling
    temperature_c: float
    humidity_percent: float
    env_kinetic_factor: float
    model_name: str
    
    # Quality & Regulatory
    image_quality: Dict
    white_quality: Dict
    strip_quality: Dict
    statutory_compliance: Dict
    rejection_reasons: List[str]
    warnings: List[str]

    def to_dict(self) -> Dict:
        return asdict(self)


def analyze_strip_exposure(
    image_rgb: np.ndarray,
    white_roi: ROIDefinition,
    strip_roi: ROIDefinition,
    calibration_model: BaseCalibrationModel,
    camera_config: Optional[CameraCalibrationConfig] = None,
    temperature_c: float = 25.0,
    humidity_percent: float = 50.0,
    shift_hours: float = 8.0,
    target_reference_white: np.ndarray = D65_WHITE_POINT
) -> ExposureAnalysisResult:
    """
    Execute end-to-end scientific colorimetric analysis on an H2S dosimeter image.
    
    Args:
        image_rgb: Source image (H, W, 3) in RGB format.
        white_roi: Bounding box for printed White Reference patch.
        strip_roi: Bounding box for active H2S chemical indicator strip.
        calibration_model: Fitted BaseCalibrationModel instance.
        camera_config: Camera calibration profile containing CCM.
        temperature_c: Ambient temperature during exposure (°C).
        humidity_percent: Ambient relative humidity during exposure (% RH).
        shift_hours: Duration of work shift in hours.
        target_reference_white: Reference white point (default D65).
        
    Returns:
        ExposureAnalysisResult instance containing comprehensive diagnostic trace.
    """
    rejections = []
    warnings = []
    
    if camera_config is None:
        camera_config = load_camera_matrix(None)
    ccm = camera_config.ccm_matrix
    
    if camera_config.is_fallback:
        warnings.append("Using fallback sRGB matrix. For metrological certification, calibrate camera CCM.")
        
    # 1. White Reference Extraction & Source White Estimation
    white_res: WhiteReferenceResult = estimate_source_white(
        image_rgb=image_rgb,
        white_roi=white_roi,
        ccm=ccm,
        min_confidence=40.0
    )
    
    if not white_res.valid:
        rejections.append(f"White Reference invalid: {white_res.rejection_reason}")
        
    # 2. Strip ROI Extraction & Pixel Filtering
    strip_metrics: PatchMetrics = extract_patch_metrics(
        image_rgb=image_rgb,
        roi=strip_roi,
        min_valid_pixels=30,
        min_valid_ratio=0.30
    )
    
    if not strip_metrics.valid:
        rejections.append(f"Strip ROI invalid: {strip_metrics.rejection_reason}")
        
    # 3. Compute Image Quality Report
    white_patch_metrics = extract_patch_metrics(image_rgb=image_rgb, roi=white_roi)
    quality_report = compute_image_quality(
        image_rgb=image_rgb,
        white_metrics=white_patch_metrics,
        strip_metrics=strip_metrics
    )
    
    if not quality_report.is_acceptable:
        for r in quality_report.rejection_reasons:
            if r not in rejections:
                rejections.append(r)
                
    # If unrecoverable failure in ROI extraction, return early with structured failure report
    if not white_res.valid or not strip_metrics.valid:
        return ExposureAnalysisResult(
            success=False,
            status_label="INVALID",
            estimated_dose_ppm_h=0.0,
            confidence_percentage=0.0,
            lab={"L": 0.0, "a": 0.0, "b": 0.0},
            deltaE00=0.0,
            raw_rgb_8bit=strip_metrics.median_rgb_8bit if strip_metrics else [0, 0, 0],
            linear_rgb=strip_metrics.median_rgb_linear if strip_metrics else [0.0, 0.0, 0.0],
            white_reference_rgb_8bit=white_res.source_white_rgb_8bit,
            source_white_xyz=white_res.source_white_xyz.tolist(),
            xyz_before_adaptation=[0.0, 0.0, 0.0],
            xyz_after_adaptation=[0.0, 0.0, 0.0],
            temperature_c=temperature_c,
            humidity_percent=humidity_percent,
            env_kinetic_factor=1.0,
            model_name=calibration_model.name,
            image_quality=quality_report.to_dict(),
            white_quality=white_res.to_dict(),
            strip_quality=strip_metrics.to_dict() if strip_metrics else {},
            statutory_compliance=get_statutory_risk_level(0.0, shift_hours),
            rejection_reasons=rejections,
            warnings=warnings
        )
        
    # 4. Colorimetric Transformation Pipeline
    # a. Linear RGB of Strip (already linearized in extract_patch_metrics)
    strip_linear = np.asarray(strip_metrics.median_rgb_linear, dtype=np.float64)
    
    # b. Camera Linear RGB -> Camera XYZ
    xyz_camera = linear_rgb_to_xyz(strip_linear, ccm=ccm)
    
    # c. Bradford Chromatic Adaptation: W_src -> W_ref (D65)
    xyz_adapted = bradford_adaptation(
        xyz_camera=xyz_camera,
        src_white=white_res.source_white_xyz,
        ref_white=target_reference_white,
        method="bradford"
    )
    
    # d. XYZ_adapted -> CIELAB (L*, a*, b*)
    lab = xyz_to_lab(xyz_adapted, white_point=target_reference_white)
    lab_dict = {
        "L": round(float(lab[0]), 2),
        "a": round(float(lab[1]), 2),
        "b": round(float(lab[2]), 2)
    }
    
    # e. Compute CIEDE2000 (ΔE00) relative to unexposed substrate baseline
    delta_e = float(ciede2000(calibration_model.baseline_lab, lab))
    
    # 5. Experimental Dose Calibration Prediction
    model_pred: ModelPredictionResult = calibration_model.predict(
        lab=lab,
        temperature_c=temperature_c,
        humidity_percent=humidity_percent,
        deltaE00=delta_e
    )
    
    if model_pred.warning_message:
        warnings.append(model_pred.warning_message)
        
    # 6. Composite Confidence Score
    # Integrates: White quality (30%), Strip quality (25%), Image sharpness/dynamic range (25%), Calibration domain (20%)
    domain_factor = 1.0 if model_pred.is_calibrated_domain else 0.4
    composite_confidence = (
        0.30 * (white_res.confidence_score / 100.0) +
        0.25 * (strip_metrics.valid_ratio) +
        0.25 * (quality_report.quality_score / 100.0) +
        0.20 * domain_factor
    ) * 100.0
    composite_confidence = float(np.clip(composite_confidence, 0.0, 100.0))
    
    # 7. Statutory Risk Assessment
    risk_report = get_statutory_risk_level(model_pred.estimated_dose_ppm_h, shift_hours)
    
    return ExposureAnalysisResult(
        success=True,
        status_label=model_pred.calibration_status,
        estimated_dose_ppm_h=model_pred.estimated_dose_ppm_h,
        confidence_percentage=round(composite_confidence, 1),
        lab=lab_dict,
        deltaE00=round(delta_e, 2),
        raw_rgb_8bit=strip_metrics.median_rgb_8bit,
        linear_rgb=[round(float(x), 5) for x in strip_linear],
        white_reference_rgb_8bit=white_res.source_white_rgb_8bit,
        source_white_xyz=[round(float(x), 5) for x in white_res.source_white_xyz],
        xyz_before_adaptation=[round(float(x), 5) for x in xyz_camera],
        xyz_after_adaptation=[round(float(x), 5) for x in xyz_adapted],
        temperature_c=float(temperature_c),
        humidity_percent=float(humidity_percent),
        env_kinetic_factor=model_pred.env_compensation_factor,
        model_name=calibration_model.name,
        image_quality=quality_report.to_dict(),
        white_quality=white_res.to_dict(),
        strip_quality=strip_metrics.to_dict(),
        statutory_compliance=risk_report,
        rejection_reasons=rejections,
        warnings=warnings
    )
