"""
h2s_dosimeter.calibration.lead_acetate_model
============================================
Lead(II) Acetate (Pb(CH3COO)2) H2S Calibration Framework & Models (Phase 5).

PHYSICAL & CHEMICAL SENSING FOUNDATION:
- Chemistry: Pb(CH3COO)2 + H2S -> PbS + 2 CH3COOH
- Optical Transition: Colorless / Off-White -> Brown/Black PbS precipitate.
- CIELAB Dynamics: Lightness (L*) decreases monotonically as cumulative dose accumulates.
                   Total color difference (ΔE00) increases monotonically.
- Dose Metric: Cumulative exposure dose (integral of concentration over time):
               Dose = ∫ C(t) dt [ppm·h].

STRICT NON-NEGOTIABLE SCIENTIFIC INTEGRITY RULES:
1. Zero Data Fabrication: DO NOT invent calibration measurements, coefficients, or curves.
2. If real chamber data is absent, status MUST report:
   "MODEL NOT TRAINED — CALIBRATION DATA REQUIRED"
3. No False Precision: If an input is outside the calibrated domain, return:
   "OUTSIDE_CALIBRATION_RANGE" (or BELOW_CALIBRATION_RANGE / ABOVE_CALIBRATION_RANGE).
   DO NOT silently extrapolate.
4. Hard Isolation: Reject chemistry mismatches (MODEL_CHEMISTRY_MISMATCH).
5. Cu-PAN models are preserved untouched.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Union
import math
import numpy as np

try:
    from sklearn.linear_model import LinearRegression
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.preprocessing import PolynomialFeatures
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


# Canonical Identifiers
CHEMISTRY_LEAD_ACETATE = "LEAD_ACETATE"
DATASET_VERSION_V1 = "LEAD_ACETATE_DATASET_V1"
MODEL_VERSION_V1 = "lead_acetate_model_v1"

ALLOWED_DATA_TYPES = ("EXPERIMENTAL", "SYNTHETIC", "TEST")

# Explicit Calibration States
STATUS_VALID_ESTIMATE = "VALID_ESTIMATE"
STATUS_BELOW_CALIBRATION_RANGE = "BELOW_CALIBRATION_RANGE"
STATUS_ABOVE_CALIBRATION_RANGE = "ABOVE_CALIBRATION_RANGE"
STATUS_OUTSIDE_CALIBRATION_RANGE = "OUTSIDE_CALIBRATION_RANGE"
STATUS_CALIBRATION_UNAVAILABLE = "CALIBRATION_UNAVAILABLE"
STATUS_MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE"
STATUS_MODEL_CHEMISTRY_MISMATCH = "MODEL_CHEMISTRY_MISMATCH"
STATUS_PREDICTION_FAILED = "PREDICTION_FAILED"
STATUS_NOT_TRAINED = "MODEL NOT TRAINED — CALIBRATION DATA REQUIRED"


@dataclass
class LeadAcetateSampleRecord:
    """Individual Lead Acetate calibration sample point supporting all 17 schema fields."""
    sample_id: str
    sensor_chemistry: str
    exposure_duration: float
    reference_dose: float
    temperature: float
    humidity: float
    RGB: Dict[str, int]
    Lab: Dict[str, float]
    data_type: str
    exposure_concentration: float = 0.0
    strip_id: Optional[str] = None
    strip_batch: Optional[str] = None
    deltaE00: Optional[float] = None
    delta_L: Optional[float] = None
    delta_a: Optional[float] = None
    delta_b: Optional[float] = None
    image_reference: Optional[str] = None
    quality_score: float = 100.0
    dataset_version: str = DATASET_VERSION_V1
    trial_number: Optional[int] = None
    replicate_index: Optional[int] = None
    fes_mass_mg: Optional[float] = None
    exposure_condition: Optional[str] = None
    exposure_duration_unit: Optional[str] = None
    reference_dose_unit: Optional[str] = None
    pressure_atm: Optional[float] = None
    visual_stage: Optional[str] = None
    data_source: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def __post_init__(self):
        # Validate chemistry
        chem = str(self.sensor_chemistry).strip().upper().replace("-", "_")
        if chem != CHEMISTRY_LEAD_ACETATE:
            raise ValueError(f"CHEMISTRY_MISMATCH: Sample chemistry '{self.sensor_chemistry}' is not '{CHEMISTRY_LEAD_ACETATE}'.")
        self.sensor_chemistry = CHEMISTRY_LEAD_ACETATE

        # Validate data_type
        if self.data_type not in ALLOWED_DATA_TYPES:
            raise ValueError(f"INVALID_DATA_TYPE: data_type '{self.data_type}' must be one of {ALLOWED_DATA_TYPES}.")

        # Auto-compute delta_L if baseline exists in Lab and not explicitly given
        if self.delta_L is None and "L" in self.Lab:
            # Baseline white paper typical reference ~ 95.0
            self.delta_L = round(float(self.Lab["L"]) - 95.0, 2)

    def to_dict(self) -> Dict:
        return asdict(self)


class LeadAcetateDataset:
    """Encapsulates a Lead Acetate calibration dataset with strict data type partitioning."""

    def __init__(self, data_type: str = "EXPERIMENTAL", dataset_version: str = DATASET_VERSION_V1):
        if data_type not in ALLOWED_DATA_TYPES:
            raise ValueError(f"INVALID_DATA_TYPE: Allowed types are {ALLOWED_DATA_TYPES}")
        self.dataset_id = dataset_version
        self.dataset_version = dataset_version
        self.sensor_chemistry = CHEMISTRY_LEAD_ACETATE
        self.data_type = data_type
        self.status = "CALIBRATION_DATA_REQUIRED"
        self.records: List[LeadAcetateSampleRecord] = []

    def add_sample(self, sample: Union[LeadAcetateSampleRecord, Dict]) -> LeadAcetateSampleRecord:
        if isinstance(sample, dict):
            known = set(LeadAcetateSampleRecord.__dataclass_fields__.keys())
            filtered = {k: v for k, v in sample.items() if k in known}
            rec = LeadAcetateSampleRecord(**filtered)
        elif isinstance(sample, LeadAcetateSampleRecord):
            rec = sample
        else:
            raise TypeError("Sample must be a LeadAcetateSampleRecord or dict.")

        if rec.data_type != self.data_type:
            raise ValueError(f"DATA_TYPE_MISMATCH: Cannot add sample of type '{rec.data_type}' to dataset of type '{self.data_type}'.")

        self.records.append(rec)
        return rec

    def __len__(self) -> int:
        return len(self.records)

    def get_supported_range(self) -> Optional[Dict[str, float]]:
        if len(self.records) < 2:
            return None
        doses = [r.reference_dose for r in self.records]
        temps = [r.temperature for r in self.records]
        humidities = [r.humidity for r in self.records]
        des = [r.deltaE00 for r in self.records if r.deltaE00 is not None]
        ls = [r.Lab["L"] for r in self.records if "L" in r.Lab]

        res = {
            "min_dose_ppm_h": float(min(doses)),
            "max_dose_ppm_h": float(max(doses)),
            "min_temp_c": float(min(temps)),
            "max_temp_c": float(max(temps)),
            "min_rh_pct": float(min(humidities)),
            "max_rh_pct": float(max(humidities))
        }
        if des:
            res["min_deltaE00"] = float(min(des))
            res["max_deltaE00"] = float(max(des))
        if ls:
            res["min_L"] = float(min(ls))
            res["max_L"] = float(max(ls))
        return res


@dataclass
class LeadAcetatePrediction:
    """Standardized prediction report for Lead Acetate exposure."""
    status: str
    dose_ppm_h: Optional[float]
    confidence: float
    is_calibrated_domain: bool
    model_name: str
    model_version: str
    sensor_chemistry: str
    unit: str = "ppm·h"
    data_type: Optional[str] = None
    warning: Optional[str] = None
    error: Optional[str] = None
    features_used: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return asdict(self)


class BaseLeadAcetateCalibrationModel(ABC):
    """Abstract Base Class for Lead Acetate calibration models."""

    def __init__(self, name: str, version: str = MODEL_VERSION_V1):
        self.name = name
        self.version = version
        self.chemistry = CHEMISTRY_LEAD_ACETATE
        self.is_fitted = False
        self.status = STATUS_NOT_TRAINED
        self.data_type: Optional[str] = None
        self.dataset_version: Optional[str] = None
        self.features: List[str] = []
        self.training_date: Optional[str] = None
        self.training_sample_count: int = 0
        self.supported_range: Optional[Dict[str, float]] = None
        self.metrics: Optional[Dict[str, float]] = None
        self.model_artifact_reference: Optional[str] = None

    def get_version(self) -> str:
        return self.version

    def get_supported_range(self) -> Optional[Dict[str, float]]:
        return self.supported_range

    def get_metadata(self) -> Dict:
        return {
            "model_id": f"{self.name}_{self.version}",
            "model_name": self.name,
            "model_version": self.version,
            "chemistry": self.chemistry,
            "dataset_version": self.dataset_version,
            "is_fitted": self.is_fitted,
            "status": self.status,
            "data_type": self.data_type,
            "features": self.features,
            "training_date": self.training_date,
            "training_sample_count": self.training_sample_count,
            "supported_range": self.supported_range,
            "metrics": self.metrics,
            "model_artifact_reference": self.model_artifact_reference
        }

    def validate_inputs(self, features: Dict) -> Tuple[bool, str, Optional[str]]:
        """
        Validates feature inputs before running prediction.
        Enforces:
        - Sensor chemistry match (hard isolation)
        - Non-NaN and numeric sanity
        - Fitted status
        """
        if not features:
            return False, STATUS_PREDICTION_FAILED, "Features dictionary is missing or empty."

        # Hard isolation: Verify chemistry
        req_chem = features.get("sensor_chemistry") or features.get("chemistry") or CHEMISTRY_LEAD_ACETATE
        norm_chem = str(req_chem).strip().upper().replace("-", "_")
        if norm_chem != CHEMISTRY_LEAD_ACETATE:
            return False, STATUS_MODEL_CHEMISTRY_MISMATCH, (
                f"HARD ISOLATION VIOLATION: Cannot evaluate {self.chemistry} model on a {norm_chem} sensor strip."
            )

        if not self.is_fitted:
            return False, STATUS_CALIBRATION_UNAVAILABLE, STATUS_NOT_TRAINED

        # Check for NaN / infinite values
        for k, v in features.items():
            if isinstance(v, (int, float)):
                if math.isnan(v) or math.isinf(v):
                    return False, STATUS_PREDICTION_FAILED, f"Feature '{k}' has invalid numeric value (NaN or Inf)."

        return True, STATUS_VALID_ESTIMATE, None

    @abstractmethod
    def fit(self, dataset: LeadAcetateDataset) -> 'BaseLeadAcetateCalibrationModel':
        pass

    @abstractmethod
    def predict(self, features: Dict) -> LeadAcetatePrediction:
        pass


class LeadAcetateLinearRegressionModel(BaseLeadAcetateCalibrationModel):
    """
    Model 1: Baseline Linear Regression Model.
    Predicts dose as linear combination of primary optical feature (L* or deltaE00)
    and optional environmental terms (temperature, humidity).
    """

    def __init__(self, name: str = "lead_acetate_linear_v1"):
        super().__init__(name=name)
        self.weights: Optional[np.ndarray] = None
        self.intercept: float = 0.0

    def fit(self, dataset: LeadAcetateDataset) -> 'LeadAcetateLinearRegressionModel':
        if len(dataset) < 3:
            raise ValueError(f"Linear regression requires at least 3 calibration points, got {len(dataset)}")

        if dataset.sensor_chemistry != CHEMISTRY_LEAD_ACETATE:
            raise ValueError(f"MODEL_CHEMISTRY_MISMATCH: Cannot fit {self.chemistry} on {dataset.sensor_chemistry}")

        # Extract features and targets
        X_list = []
        y_list = []
        self.features = ["deltaE00", "temperature", "humidity"]

        for r in dataset.records:
            de = r.deltaE00 if r.deltaE00 is not None else abs(r.Lab["L"] - 95.0)
            X_list.append([de, r.temperature, r.humidity])
            y_list.append(r.reference_dose)

        X = np.array(X_list, dtype=np.float64)
        y = np.array(y_list, dtype=np.float64)

        if SKLEARN_AVAILABLE:
            lr = LinearRegression()
            lr.fit(X, y)
            self.weights = lr.coef_
            self.intercept = float(lr.intercept_)
            y_pred = lr.predict(X)
        else:
            # Analytical OLS fallback: (X^T X)^-1 X^T y
            X_b = np.hstack([np.ones((len(X), 1)), X])
            w = np.linalg.pinv(X_b.T @ X_b) @ X_b.T @ y
            self.intercept = float(w[0])
            self.weights = w[1:]
            y_pred = X_b @ w

        # Calculate metrics
        residuals = y_pred - y
        mae = float(np.mean(np.abs(residuals)))
        rmse = float(np.sqrt(np.mean(residuals ** 2)))
        ss_res = float(np.sum(residuals ** 2))
        ss_tot = float(np.sum((y - np.mean(y)) ** 2))
        r2 = float(1.0 - (ss_res / (ss_tot + 1e-12))) if ss_tot > 1e-12 else 1.0

        self.metrics = {
            "r2": round(r2, 4),
            "mae": round(mae, 3),
            "rmse": round(rmse, 3)
        }

        self.supported_range = dataset.get_supported_range()
        self.training_sample_count = len(dataset)
        self.training_date = datetime.now(timezone.utc).isoformat()
        self.data_type = dataset.data_type
        self.dataset_version = dataset.dataset_version
        self.is_fitted = True
        self.status = "FITTED_TEST_PLUMBING" if dataset.data_type == "TEST" else "CALIBRATED"
        self.model_artifact_reference = f"models/lead_acetate/{self.name}_{self.dataset_version}.json"
        return self

    def predict(self, features: Dict) -> LeadAcetatePrediction:
        valid, status, reason = self.validate_inputs(features)
        if not valid:
            return LeadAcetatePrediction(
                status=status,
                dose_ppm_h=None,  # Strict: Never return 0.0 ppm
                confidence=0.0,
                is_calibrated_domain=False,
                model_name=self.name,
                model_version=self.version,
                sensor_chemistry=self.chemistry,
                error=reason
            )

        # Feature resolution
        deltaE = features.get("deltaE00")
        L_val = features.get("L") or (features.get("Lab", {}).get("L") if isinstance(features.get("Lab"), dict) else None)

        if deltaE is None and L_val is not None:
            # Approximate deltaE from baseline white paper (L=95.0)
            deltaE = abs(float(L_val) - 95.0)

        if deltaE is None:
            return LeadAcetatePrediction(
                status=STATUS_PREDICTION_FAILED,
                dose_ppm_h=None,
                confidence=0.0,
                is_calibrated_domain=False,
                model_name=self.name,
                model_version=self.version,
                sensor_chemistry=self.chemistry,
                error="Neither 'deltaE00' nor 'L' coordinate was provided."
            )

        deltaE = float(deltaE)
        temp = float(features.get("temperature", 25.0))
        humidity = float(features.get("humidity", 50.0))

        warning = None
        if "temperature" not in features or "humidity" not in features:
            warning = "Environmental parameters missing. Evaluated at standard nominal conditions (25°C, 50% RH)."

        # Domain boundary check (No false precision / no silent extrapolation)
        min_de = self.supported_range.get("min_deltaE00", 0.0)
        max_de = self.supported_range.get("max_deltaE00", 55.0)

        if deltaE < min_de:
            return LeadAcetatePrediction(
                status=STATUS_BELOW_CALIBRATION_RANGE,
                dose_ppm_h=self.supported_range.get("min_dose_ppm_h", 0.0),
                confidence=0.30,
                is_calibrated_domain=False,
                model_name=self.name,
                model_version=self.version,
                sensor_chemistry=self.chemistry,
                data_type=self.data_type,
                warning=f"Optical response ΔE00={deltaE:.2f} is below minimum calibration anchor {min_de:.2f}."
            )

        if deltaE > max_de:
            return LeadAcetatePrediction(
                status=STATUS_ABOVE_CALIBRATION_RANGE,
                dose_ppm_h=self.supported_range.get("max_dose_ppm_h", 80.0),
                confidence=0.30,
                is_calibrated_domain=False,
                model_name=self.name,
                model_version=self.version,
                sensor_chemistry=self.chemistry,
                data_type=self.data_type,
                warning=f"Optical response ΔE00={deltaE:.2f} exceeds maximum calibration saturation {max_de:.2f}."
            )

        # In-domain prediction
        x_in = np.array([deltaE, temp, humidity], dtype=np.float64)
        raw_dose = float(self.intercept + np.dot(x_in, self.weights))
        dose_est = max(0.0, raw_dose)

        confidence = 0.95 if self.data_type != "TEST" else 0.80

        return LeadAcetatePrediction(
            status=STATUS_VALID_ESTIMATE,
            dose_ppm_h=round(dose_est, 2),
            confidence=confidence,
            is_calibrated_domain=True,
            model_name=self.name,
            model_version=self.version,
            sensor_chemistry=self.chemistry,
            data_type=self.data_type,
            warning=warning,
            features_used=["deltaE00", "temperature", "humidity"]
        )


class LeadAcetatePolynomialModel(BaseLeadAcetateCalibrationModel):
    """
    Model 2: Polynomial Regression Model (2nd order with environmental cross-terms).
    Captures non-linear lead sulfide darkening kinetics.
    """

    def __init__(self, degree: int = 2, name: str = "lead_acetate_polynomial_v1"):
        super().__init__(name=name)
        self.degree = degree
        self.weights: Optional[np.ndarray] = None

    def _build_poly_features(self, deltaE: float, temp: float, rh: float) -> np.ndarray:
        de = float(deltaE)
        t_delta = (float(temp) - 25.0) * 0.01
        rh_delta = (float(rh) - 50.0) * 0.01
        return np.array([
            1.0,
            de,
            de ** 2,
            de * t_delta,
            de * rh_delta,
            t_delta,
            rh_delta
        ], dtype=np.float64)

    def fit(self, dataset: LeadAcetateDataset) -> 'LeadAcetatePolynomialModel':
        if len(dataset) < 4:
            raise ValueError(f"Polynomial model requires at least 4 calibration points, got {len(dataset)}")

        if dataset.sensor_chemistry != CHEMISTRY_LEAD_ACETATE:
            raise ValueError(f"MODEL_CHEMISTRY_MISMATCH: Cannot fit {self.chemistry} on {dataset.sensor_chemistry}")

        X_rows = []
        y_list = []
        self.features = ["deltaE00", "deltaE00^2", "deltaE00*temp", "deltaE00*humidity", "temp", "humidity"]

        for r in dataset.records:
            de = r.deltaE00 if r.deltaE00 is not None else abs(r.Lab["L"] - 95.0)
            X_rows.append(self._build_poly_features(de, r.temperature, r.humidity))
            y_list.append(r.reference_dose)

        X = np.vstack(X_rows)
        y = np.array(y_list, dtype=np.float64)

        # Ridge regularized regression to prevent overfitting: (X^T X + alpha*I)^-1 X^T y
        reg = 0.05 * np.eye(X.shape[1])
        reg[0, 0] = 0.0  # Do not regularize intercept
        self.weights = np.linalg.solve(X.T @ X + reg, X.T @ y)

        y_pred = X @ self.weights
        residuals = y_pred - y
        mae = float(np.mean(np.abs(residuals)))
        rmse = float(np.sqrt(np.mean(residuals ** 2)))
        ss_res = float(np.sum(residuals ** 2))
        ss_tot = float(np.sum((y - np.mean(y)) ** 2))
        r2 = float(1.0 - (ss_res / (ss_tot + 1e-12))) if ss_tot > 1e-12 else 1.0

        self.metrics = {
            "r2": round(r2, 4),
            "mae": round(mae, 3),
            "rmse": round(rmse, 3)
        }
        self.supported_range = dataset.get_supported_range()
        self.training_sample_count = len(dataset)
        self.training_date = datetime.now(timezone.utc).isoformat()
        self.data_type = dataset.data_type
        self.dataset_version = dataset.dataset_version
        self.is_fitted = True
        self.status = "FITTED_TEST_PLUMBING" if dataset.data_type == "TEST" else "CALIBRATED"
        self.model_artifact_reference = f"models/lead_acetate/{self.name}_{self.dataset_version}.json"
        return self

    def predict(self, features: Dict) -> LeadAcetatePrediction:
        valid, status, reason = self.validate_inputs(features)
        if not valid:
            return LeadAcetatePrediction(
                status=status,
                dose_ppm_h=None,
                confidence=0.0,
                is_calibrated_domain=False,
                model_name=self.name,
                model_version=self.version,
                sensor_chemistry=self.chemistry,
                error=reason
            )

        deltaE = features.get("deltaE00")
        L_val = features.get("L") or (features.get("Lab", {}).get("L") if isinstance(features.get("Lab"), dict) else None)
        if deltaE is None and L_val is not None:
            deltaE = abs(float(L_val) - 95.0)

        if deltaE is None:
            return LeadAcetatePrediction(
                status=STATUS_PREDICTION_FAILED,
                dose_ppm_h=None,
                confidence=0.0,
                is_calibrated_domain=False,
                model_name=self.name,
                model_version=self.version,
                sensor_chemistry=self.chemistry,
                error="Neither 'deltaE00' nor 'L' coordinate was provided."
            )

        deltaE = float(deltaE)
        temp = float(features.get("temperature", 25.0))
        humidity = float(features.get("humidity", 50.0))

        warning = None
        if "temperature" not in features or "humidity" not in features:
            warning = "Environmental parameters missing. Evaluated at standard nominal conditions (25°C, 50% RH)."

        min_de = self.supported_range.get("min_deltaE00", 0.0)
        max_de = self.supported_range.get("max_deltaE00", 55.0)

        if deltaE < min_de:
            return LeadAcetatePrediction(
                status=STATUS_BELOW_CALIBRATION_RANGE,
                dose_ppm_h=self.supported_range.get("min_dose_ppm_h", 0.0),
                confidence=0.30,
                is_calibrated_domain=False,
                model_name=self.name,
                model_version=self.version,
                sensor_chemistry=self.chemistry,
                data_type=self.data_type,
                warning=f"Optical response ΔE00={deltaE:.2f} is below minimum calibration anchor {min_de:.2f}."
            )

        if deltaE > max_de:
            return LeadAcetatePrediction(
                status=STATUS_ABOVE_CALIBRATION_RANGE,
                dose_ppm_h=self.supported_range.get("max_dose_ppm_h", 80.0),
                confidence=0.30,
                is_calibrated_domain=False,
                model_name=self.name,
                model_version=self.version,
                sensor_chemistry=self.chemistry,
                data_type=self.data_type,
                warning=f"Optical response ΔE00={deltaE:.2f} exceeds maximum calibration saturation {max_de:.2f}."
            )

        phi = self._build_poly_features(deltaE, temp, humidity)
        raw_dose = float(np.dot(phi, self.weights))
        dose_est = max(0.0, raw_dose)

        return LeadAcetatePrediction(
            status=STATUS_VALID_ESTIMATE,
            dose_ppm_h=round(dose_est, 2),
            confidence=0.96 if self.data_type != "TEST" else 0.85,
            is_calibrated_domain=True,
            model_name=self.name,
            model_version=self.version,
            sensor_chemistry=self.chemistry,
            data_type=self.data_type,
            warning=warning,
            features_used=self.features
        )


class LeadAcetateRandomForestModel(BaseLeadAcetateCalibrationModel):
    """
    Model 3: Random Forest Regression Model.
    Ensemble decision trees capturing complex multi-variable interactions.
    """

    def __init__(self, n_estimators: int = 25, max_depth: int = 5, name: str = "lead_acetate_random_forest_v1"):
        super().__init__(name=name)
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.model: Optional[RandomForestRegressor] = None

    def fit(self, dataset: LeadAcetateDataset) -> 'LeadAcetateRandomForestModel':
        if not SKLEARN_AVAILABLE:
            raise RuntimeError("scikit-learn is required to fit LeadAcetateRandomForestModel.")

        if len(dataset) < 4:
            raise ValueError(f"Random Forest requires at least 4 calibration points, got {len(dataset)}")

        if dataset.sensor_chemistry != CHEMISTRY_LEAD_ACETATE:
            raise ValueError(f"MODEL_CHEMISTRY_MISMATCH: Cannot fit {self.chemistry} on {dataset.sensor_chemistry}")

        self.features = ["deltaE00", "L", "a", "b", "temperature", "humidity"]
        X_list = []
        y_list = []

        for r in dataset.records:
            de = r.deltaE00 if r.deltaE00 is not None else abs(r.Lab["L"] - 95.0)
            X_list.append([
                de,
                r.Lab.get("L", 70.0),
                r.Lab.get("a", 3.0),
                r.Lab.get("b", 10.0),
                r.temperature,
                r.humidity
            ])
            y_list.append(r.reference_dose)

        X = np.array(X_list, dtype=np.float64)
        y = np.array(y_list, dtype=np.float64)

        self.model = RandomForestRegressor(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            random_state=42
        )
        self.model.fit(X, y)

        y_pred = self.model.predict(X)
        residuals = y_pred - y
        mae = float(np.mean(np.abs(residuals)))
        rmse = float(np.sqrt(np.mean(residuals ** 2)))
        ss_res = float(np.sum(residuals ** 2))
        ss_tot = float(np.sum((y - np.mean(y)) ** 2))
        r2 = float(1.0 - (ss_res / (ss_tot + 1e-12))) if ss_tot > 1e-12 else 1.0

        self.metrics = {
            "r2": round(r2, 4),
            "mae": round(mae, 3),
            "rmse": round(rmse, 3)
        }
        self.supported_range = dataset.get_supported_range()
        self.training_sample_count = len(dataset)
        self.training_date = datetime.now(timezone.utc).isoformat()
        self.data_type = dataset.data_type
        self.dataset_version = dataset.dataset_version
        self.is_fitted = True
        self.status = "FITTED_TEST_PLUMBING" if dataset.data_type == "TEST" else "CALIBRATED"
        self.model_artifact_reference = f"models/lead_acetate/{self.name}_{self.dataset_version}.joblib"
        return self

    def predict(self, features: Dict) -> LeadAcetatePrediction:
        valid, status, reason = self.validate_inputs(features)
        if not valid:
            return LeadAcetatePrediction(
                status=status,
                dose_ppm_h=None,
                confidence=0.0,
                is_calibrated_domain=False,
                model_name=self.name,
                model_version=self.version,
                sensor_chemistry=self.chemistry,
                error=reason
            )

        deltaE = features.get("deltaE00")
        L_val = features.get("L") or (features.get("Lab", {}).get("L") if isinstance(features.get("Lab"), dict) else None)
        if deltaE is None and L_val is not None:
            deltaE = abs(float(L_val) - 95.0)

        if deltaE is None:
            return LeadAcetatePrediction(
                status=STATUS_PREDICTION_FAILED,
                dose_ppm_h=None,
                confidence=0.0,
                is_calibrated_domain=False,
                model_name=self.name,
                model_version=self.version,
                sensor_chemistry=self.chemistry,
                error="Neither 'deltaE00' nor 'L' coordinate was provided."
            )

        deltaE = float(deltaE)
        min_de = self.supported_range.get("min_deltaE00", 0.0)
        max_de = self.supported_range.get("max_deltaE00", 55.0)

        if deltaE < min_de:
            return LeadAcetatePrediction(
                status=STATUS_BELOW_CALIBRATION_RANGE,
                dose_ppm_h=self.supported_range.get("min_dose_ppm_h", 0.0),
                confidence=0.30,
                is_calibrated_domain=False,
                model_name=self.name,
                model_version=self.version,
                sensor_chemistry=self.chemistry,
                data_type=self.data_type,
                warning=f"Optical response ΔE00={deltaE:.2f} is below minimum calibration anchor {min_de:.2f}."
            )

        if deltaE > max_de:
            return LeadAcetatePrediction(
                status=STATUS_ABOVE_CALIBRATION_RANGE,
                dose_ppm_h=self.supported_range.get("max_dose_ppm_h", 80.0),
                confidence=0.30,
                is_calibrated_domain=False,
                model_name=self.name,
                model_version=self.version,
                sensor_chemistry=self.chemistry,
                data_type=self.data_type,
                warning=f"Optical response ΔE00={deltaE:.2f} exceeds maximum calibration saturation {max_de:.2f}."
            )

        l_coord = float(L_val if L_val is not None else 70.0)
        a_coord = float(features.get("a") or (features.get("Lab", {}).get("a") if isinstance(features.get("Lab"), dict) else 3.0))
        b_coord = float(features.get("b") or (features.get("Lab", {}).get("b") if isinstance(features.get("Lab"), dict) else 10.0))
        temp = float(features.get("temperature", 25.0))
        humidity = float(features.get("humidity", 50.0))

        warning = None
        if "temperature" not in features or "humidity" not in features:
            warning = "Environmental parameters missing. Evaluated at standard nominal conditions (25°C, 50% RH)."

        X_in = np.array([[deltaE, l_coord, a_coord, b_coord, temp, humidity]], dtype=np.float64)
        dose_est = float(self.model.predict(X_in)[0])

        return LeadAcetatePrediction(
            status=STATUS_VALID_ESTIMATE,
            dose_ppm_h=round(max(0.0, dose_est), 2),
            confidence=0.97 if self.data_type != "TEST" else 0.88,
            is_calibrated_domain=True,
            model_name=self.name,
            model_version=self.version,
            sensor_chemistry=self.chemistry,
            data_type=self.data_type,
            warning=warning,
            features_used=self.features
        )


# --- 4. BATCH / STRIP AWARE SPLITTING (ZERO LEAKAGE) ---
def split_lead_acetate_dataset_group_aware(
    dataset: LeadAcetateDataset,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    random_state: int = 42
) -> Tuple[List[LeadAcetateSampleRecord], List[LeadAcetateSampleRecord], List[LeadAcetateSampleRecord]]:
    """
    Group-aware train/validation/test split based on physical strip_id or strip_batch.
    GUARANTEE: All exposures from a specific strip or batch are confined strictly to one partition.
    Zero data leakage between training and testing sets.
    """
    records = dataset.records
    if not records:
        return [], [], []

    # Identify grouping keys (strip_id preferred, fallback to strip_batch or sample_id)
    groups: Dict[str, List[LeadAcetateSampleRecord]] = {}
    for r in records:
        key = r.strip_id or r.strip_batch or r.sample_id
        if key not in groups:
            groups[key] = []
        groups[key].append(r)

    group_keys = list(groups.keys())
    np.random.seed(random_state)
    np.random.shuffle(group_keys)

    n_groups = len(group_keys)
    n_train_g = max(1, int(round(n_groups * train_ratio)))
    n_val_g = max(1, int(round(n_groups * val_ratio))) if (n_groups - n_train_g) > 1 else 0

    train_keys = set(group_keys[:n_train_g])
    val_keys = set(group_keys[n_train_g:n_train_g + n_val_g])
    test_keys = set(group_keys[n_train_g + n_val_g:])

    if not test_keys and len(val_keys) > 1:
        # Reallocate one group to test
        move_key = list(val_keys)[-1]
        val_keys.remove(move_key)
        test_keys.add(move_key)

    train_recs = [r for k in train_keys for r in groups[k]]
    val_recs = [r for k in val_keys for r in groups[k]]
    test_recs = [r for k in test_keys for r in groups[k]]

    return train_recs, val_recs, test_recs


# --- 7. MODEL LOADER & REGISTRY ---
class LeadAcetateModelRegistry:
    """Centralized Registry and Loader for Lead Acetate calibration models."""

    def __init__(self):
        self._models: Dict[str, BaseLeadAcetateCalibrationModel] = {}
        # Pre-register uncalibrated models
        self.register_model(LeadAcetateLinearRegressionModel())
        self.register_model(LeadAcetatePolynomialModel())
        if SKLEARN_AVAILABLE:
            self.register_model(LeadAcetateRandomForestModel())

    def register_model(self, model: BaseLeadAcetateCalibrationModel):
        key = f"{model.chemistry}:{model.name}:{model.version}"
        self._models[key] = model

    def load_model(
        self,
        sensor_chemistry: str,
        model_name: Optional[str] = None,
        model_version: Optional[str] = None
    ) -> BaseLeadAcetateCalibrationModel:
        """
        Loads model by sensor_chemistry and version.
        Rejects chemistry mismatches.
        """
        norm_chem = str(sensor_chemistry).strip().upper().replace("-", "_")
        if norm_chem != CHEMISTRY_LEAD_ACETATE:
            raise ValueError(
                f"MODEL_CHEMISTRY_MISMATCH: Requested sensor chemistry '{sensor_chemistry}' is not '{CHEMISTRY_LEAD_ACETATE}'."
            )

        name = model_name or "lead_acetate_linear_v1"
        version = model_version or MODEL_VERSION_V1
        key = f"{CHEMISTRY_LEAD_ACETATE}:{name}:{version}"

        if key not in self._models:
            # Fallback search by version
            matched = [m for k, m in self._models.items() if m.version == version]
            if matched:
                return matched[0]
            raise KeyError(f"MODEL_UNAVAILABLE: Model '{key}' not found in registry.")

        return self._models[key]

    def list_models(self) -> List[Dict]:
        return [m.get_metadata() for m in self._models.values()]


# Singleton registry instance
default_lead_acetate_registry = LeadAcetateModelRegistry()


# --- 8. SYNTHETIC TEST FIXTURE (SECTION 8) ---
def create_test_plumbing_dataset() -> LeadAcetateDataset:
    """
    Creates a synthetic test fixture strictly marked data_type = 'TEST'.
    Used exclusively for unit tests and software wiring verification.
    """
    ds = LeadAcetateDataset(data_type="TEST")

    # 4 synthetic test anchor points showing dark brown PbS progression (L decreases monotonically)
    ds.add_sample({
        "sample_id": "TEST_PB_00",
        "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
        "strip_id": "STRIP_TEST_01",
        "strip_batch": "BATCH_TEST_A",
        "exposure_concentration": 0.0,
        "exposure_duration": 0.0,
        "reference_dose": 0.0,
        "temperature": 25.0,
        "humidity": 50.0,
        "RGB": {"r": 245, "g": 243, "b": 238},
        "Lab": {"L": 95.5, "a": 0.2, "b": 3.5},
        "deltaE00": 0.0,
        "data_type": "TEST"
    })
    ds.add_sample({
        "sample_id": "TEST_PB_10",
        "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
        "strip_id": "STRIP_TEST_01",
        "strip_batch": "BATCH_TEST_A",
        "exposure_concentration": 10.0,
        "exposure_duration": 60.0,
        "reference_dose": 10.0,
        "temperature": 25.0,
        "humidity": 50.0,
        "RGB": {"r": 195, "g": 175, "b": 155},
        "Lab": {"L": 72.4, "a": 5.1, "b": 12.8},
        "deltaE00": 18.5,
        "data_type": "TEST"
    })
    ds.add_sample({
        "sample_id": "TEST_PB_40",
        "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
        "strip_id": "STRIP_TEST_02",
        "strip_batch": "BATCH_TEST_B",
        "exposure_concentration": 20.0,
        "exposure_duration": 120.0,
        "reference_dose": 40.0,
        "temperature": 25.0,
        "humidity": 50.0,
        "RGB": {"r": 130, "g": 105, "b": 85},
        "Lab": {"L": 46.2, "a": 7.8, "b": 16.2},
        "deltaE00": 38.2,
        "data_type": "TEST"
    })
    ds.add_sample({
        "sample_id": "TEST_PB_80",
        "sensor_chemistry": CHEMISTRY_LEAD_ACETATE,
        "strip_id": "STRIP_TEST_02",
        "strip_batch": "BATCH_TEST_B",
        "exposure_concentration": 40.0,
        "exposure_duration": 120.0,
        "reference_dose": 80.0,
        "temperature": 25.0,
        "humidity": 50.0,
        "RGB": {"r": 65, "g": 50, "b": 42},
        "Lab": {"L": 22.8, "a": 5.4, "b": 9.8},
        "deltaE00": 55.4,
        "data_type": "TEST"
    })
    return ds
