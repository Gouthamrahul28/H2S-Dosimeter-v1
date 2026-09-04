"""Calibration and metrological regression package."""

from .regression import DoseCalibrationModel, PiecewiseMonotonicDoseModel, PolynomialDoseModel
from .strip_calibration import StripCalibrationDataset
from .validation import ValidationMetricsReport, compute_validation_metrics
from .lead_acetate_model import (
    CHEMISTRY_LEAD_ACETATE,
    DATASET_VERSION_V1,
    MODEL_VERSION_V1,
    LeadAcetateSampleRecord,
    LeadAcetateDataset,
    LeadAcetatePrediction,
    BaseLeadAcetateCalibrationModel,
    LeadAcetateLinearRegressionModel,
    LeadAcetatePolynomialModel,
    LeadAcetateRandomForestModel,
    LeadAcetateModelRegistry,
    default_lead_acetate_registry,
    create_test_plumbing_dataset,
    split_lead_acetate_dataset_group_aware
)

__all__ = [
    "DoseCalibrationModel",
    "PiecewiseMonotonicDoseModel",
    "PolynomialDoseModel",
    "StripCalibrationDataset",
    "ValidationMetricsReport",
    "compute_validation_metrics",
    "CHEMISTRY_LEAD_ACETATE",
    "DATASET_VERSION_V1",
    "MODEL_VERSION_V1",
    "LeadAcetateSampleRecord",
    "LeadAcetateDataset",
    "LeadAcetatePrediction",
    "BaseLeadAcetateCalibrationModel",
    "LeadAcetateLinearRegressionModel",
    "LeadAcetatePolynomialModel",
    "LeadAcetateRandomForestModel",
    "LeadAcetateModelRegistry",
    "default_lead_acetate_registry",
    "create_test_plumbing_dataset",
    "split_lead_acetate_dataset_group_aware"
]
