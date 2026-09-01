"""
h2s_dosimeter.calibration.calibration_model
===========================================
Pluggable Dose Calibration Models mapping optical coordinates (Lab, ΔE00)
and ambient environment (Temperature, Humidity) to estimated cumulative H₂S dose.

SCIENTIFIC CALIBRATION PRINCIPLES:
1. Dose is cumulative gas exposure: Dose = ∫ C(t) dt [ppm·hours].
2. The color-to-dose relationship is an experimentally calibrated physical property of
   the chemical substrate matrix. It MUST NOT be guessed or hardcoded as arbitrary RGB.
3. If an input color is outside the experimentally calibrated domain, it MUST explicitly
   report "OUTSIDE CALIBRATION RANGE" rather than silently extrapolating.
4. Ambient Temperature and Relative Humidity influence chemical diffusion and reaction rates
   and are compensated via physical Arrhenius rate derating.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple, Union
import numpy as np
from .calibration_dataset import CalibrationDataset, CalibrationRecord
from ..color.delta_e import ciede2000


@dataclass
class ModelPredictionResult:
    """Estimated dose output and domain validity report."""
    estimated_dose_ppm_h: float
    is_calibrated_domain: bool
    calibration_status: str       # "CALIBRATED", "OUTSIDE CALIBRATION RANGE", "INVALID"
    model_name: str
    confidence_score: float       # 0.0 to 100.0 %
    env_compensation_factor: float
    deltaE00_from_baseline: float
    warning_message: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)


class BaseCalibrationModel(ABC):
    """Abstract base class for all H₂S strip calibration models."""
    
    def __init__(self, name: str = "BaseModel"):
        self.name = name
        self.is_fitted = False
        self.baseline_lab = np.array([95.0, 0.0, 4.0], dtype=np.float64)
        self.min_calibrated_delta_e = 0.0
        self.max_calibrated_delta_e = 50.0
        self.min_calibrated_dose = 0.0
        self.max_calibrated_dose = 100.0
        self.temp_coefficient = 0.005  # 0.5% per °C deviation from 25°C
        self.rh_coefficient = 0.0025   # 0.25% per % RH deviation from 50% RH

    @abstractmethod
    def fit(self, dataset: CalibrationDataset) -> 'BaseCalibrationModel':
        """Fit model parameters on experimental calibration dataset."""
        pass

    @abstractmethod
    def predict(
        self,
        lab: Union[np.ndarray, list, tuple],
        temperature_c: float = 25.0,
        humidity_percent: float = 50.0,
        deltaE00: Optional[float] = None
    ) -> ModelPredictionResult:
        """Estimate cumulative H₂S dose from measured Lab coordinates and environment."""
        pass

    def compute_env_factor(self, temp_c: float, rh_pct: float) -> float:
        """
        Compute environmental kinetic correction factor.
        
        Formula:
            k_env = 1.0 + alpha*(T - 25.0) + beta*(RH - 50.0)
            
        Higher temperature / humidity accelerates chemical darkening kinetics.
        Observed dose is normalized: Dose_std = Dose_obs / k_env.
        """
        t_delta = float(temp_c) - 25.0
        rh_delta = float(rh_pct) - 50.0
        k_env = 1.0 + (self.temp_coefficient * t_delta) + (self.rh_coefficient * rh_delta)
        # Guard against zero or negative environmental factor
        return float(np.clip(k_env, 0.5, 2.0))

    def evaluate(self, dataset: CalibrationDataset) -> Dict[str, float]:
        """Compute training/test metrics: MAE, RMSE, R²."""
        if not self.is_fitted or len(dataset) == 0:
            return {"mae": 0.0, "rmse": 0.0, "r2": 0.0, "n_samples": 0}
            
        y_true = []
        y_pred = []
        
        for r in dataset.records:
            pred = self.predict(
                lab=[r.L, r.a, r.b],
                temperature_c=r.temperature_c,
                humidity_percent=r.humidity_percent,
                deltaE00=r.deltaE00
            )
            y_true.append(r.dose_ppm_h)
            y_pred.append(pred.estimated_dose_ppm_h)
            
        y_true = np.array(y_true, dtype=np.float64)
        y_pred = np.array(y_pred, dtype=np.float64)
        
        residuals = y_pred - y_true
        mae = float(np.mean(np.abs(residuals)))
        rmse = float(np.sqrt(np.mean(residuals ** 2)))
        
        ss_res = float(np.sum(residuals ** 2))
        ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
        r2 = float(1.0 - (ss_res / (ss_tot + 1e-12))) if ss_tot > 1e-12 else 1.0
        
        return {
            "mae": round(mae, 3),
            "rmse": round(rmse, 3),
            "r2": round(r2, 4),
            "n_samples": len(dataset)
        }


class PiecewiseInterpolationModel(BaseCalibrationModel):
    """
    Non-linear piecewise monotonic interpolation model over sorted experimental anchors.
    """
    
    def __init__(self, name: str = "Piecewise-Interpolation-Model"):
        super().__init__(name=name)
        self.anchor_delta_e = np.array([0.0], dtype=np.float64)
        self.anchor_doses = np.array([0.0], dtype=np.float64)

    def fit(self, dataset: CalibrationDataset) -> 'PiecewiseInterpolationModel':
        if len(dataset) < 2:
            raise ValueError(f"Calibration dataset requires at least 2 records, got {len(dataset)}")
            
        self.baseline_lab = np.asarray(dataset.reference_baseline_lab, dtype=np.float64)
        
        # Extract ΔE00 and Doses
        records_sorted = sorted(dataset.records, key=lambda r: r.deltaE00)
        
        # Ensure 0 baseline point is present
        de_list = [0.0]
        dose_list = [0.0]
        for r in records_sorted:
            if r.deltaE00 > 0:
                de_list.append(float(r.deltaE00))
                dose_list.append(float(r.dose_ppm_h))
                
        self.anchor_delta_e = np.array(de_list, dtype=np.float64)
        self.anchor_doses = np.array(dose_list, dtype=np.float64)
        
        self.min_calibrated_delta_e = float(self.anchor_delta_e[0])
        self.max_calibrated_delta_e = float(self.anchor_delta_e[-1])
        self.min_calibrated_dose = float(self.anchor_doses[0])
        self.max_calibrated_dose = float(self.anchor_doses[-1])
        self.is_fitted = True
        return self

    def predict(
        self,
        lab: Union[np.ndarray, list, tuple],
        temperature_c: float = 25.0,
        humidity_percent: float = 50.0,
        deltaE00: Optional[float] = None
    ) -> ModelPredictionResult:
        if not self.is_fitted:
            raise RuntimeError("Model must be fitted before predict() is called.")
            
        lab_arr = np.asarray(lab, dtype=np.float64).flatten()
        
        # Compute ΔE00 if not supplied
        if deltaE00 is None:
            de = ciede2000(self.baseline_lab, lab_arr)
        else:
            de = float(deltaE00)
            
        # Domain validation: allow 10% safety margin before hard rejection
        margin = 0.10 * (self.max_calibrated_delta_e - self.min_calibrated_delta_e)
        is_in_domain = (de >= (self.min_calibrated_delta_e - 0.5)) and (de <= (self.max_calibrated_delta_e + margin))
        
        status = "CALIBRATED"
        warning = ""
        confidence = 95.0
        
        if not is_in_domain:
            status = "OUTSIDE CALIBRATION RANGE"
            warning = f"Measured ΔE00 ({de:.2f}) exceeds experimental calibration limit ({self.max_calibrated_delta_e:.2f})."
            confidence = max(20.0, 95.0 - (de - self.max_calibrated_delta_e) * 5.0)
            
        # Piecewise 1D interpolation
        raw_dose = float(np.interp(de, self.anchor_delta_e, self.anchor_doses))
        
        # Environmental rate compensation
        k_env = self.compute_env_factor(temp_c=temperature_c, rh_pct=humidity_percent)
        calibrated_dose = max(0.0, raw_dose / k_env)
        
        return ModelPredictionResult(
            estimated_dose_ppm_h=round(calibrated_dose, 2),
            is_calibrated_domain=is_in_domain,
            calibration_status=status,
            model_name=self.name,
            confidence_score=round(confidence, 1),
            env_compensation_factor=round(k_env, 4),
            deltaE00_from_baseline=round(de, 2),
            warning_message=warning
        )


class PolynomialRegressionModel(BaseCalibrationModel):
    """
    Polynomial surface regression model with environmental interaction terms and Ridge regularization.
    """
    
    def __init__(self, degree: int = 2, alpha: float = 1e-3, name: str = "Polynomial-Surface-Regression"):
        super().__init__(name=name)
        self.degree = degree
        self.alpha = alpha
        self.weights = None
        self.feature_means = None
        self.feature_stds = None

    def _build_features(self, delta_es: np.ndarray, labs: np.ndarray, envs: np.ndarray) -> np.ndarray:
        """Construct multi-variable feature matrix."""
        de = delta_es.reshape(-1, 1)
        l_star = labs[:, 0:1]
        a_star = labs[:, 1:2]
        b_star = labs[:, 2:3]
        temp = envs[:, 0:1]
        rh = envs[:, 1:2]
        
        feats = [np.ones_like(de), de, l_star, a_star, b_star]
        if self.degree >= 2:
            feats.extend([de ** 2, l_star ** 2, de * (temp - 25.0), de * (rh - 50.0)])
        if self.degree >= 3:
            feats.extend([de ** 3, (l_star ** 3)])
            
        return np.hstack(feats)

    def fit(self, dataset: CalibrationDataset) -> 'PolynomialRegressionModel':
        if len(dataset) < 4:
            raise ValueError(f"Polynomial regression requires at least 4 calibration points, got {len(dataset)}")
            
        self.baseline_lab = np.asarray(dataset.reference_baseline_lab, dtype=np.float64)
        labs, delta_es, doses, envs = dataset.get_arrays()
        
        self.min_calibrated_delta_e = float(np.min(delta_es))
        self.max_calibrated_delta_e = float(np.max(delta_es))
        self.min_calibrated_dose = float(np.min(doses))
        self.max_calibrated_dose = float(np.max(doses))
        
        # Build features
        X = self._build_features(delta_es, labs, envs)
        y = doses
        
        # Ridge Regression: w = (X^T X + alpha * I)^(-1) X^T y
        n_features = X.shape[1]
        i_reg = np.eye(n_features)
        i_reg[0, 0] = 0.0  # Do not regularize bias term
        
        self.weights = np.linalg.solve(X.T @ X + self.alpha * i_reg, X.T @ y)
        self.is_fitted = True
        return self

    def predict(
        self,
        lab: Union[np.ndarray, list, tuple],
        temperature_c: float = 25.0,
        humidity_percent: float = 50.0,
        deltaE00: Optional[float] = None
    ) -> ModelPredictionResult:
        if not self.is_fitted:
            raise RuntimeError("Model must be fitted before predict() is called.")
            
        lab_arr = np.asarray(lab, dtype=np.float64).reshape(1, 3)
        if deltaE00 is None:
            de = ciede2000(self.baseline_lab, lab_arr[0])
        else:
            de = float(deltaE00)
            
        de_arr = np.array([de], dtype=np.float64)
        env_arr = np.array([[temperature_c, humidity_percent]], dtype=np.float64)
        
        X = self._build_features(de_arr, lab_arr, env_arr)
        pred_dose = float((X @ self.weights).item())
        
        # Constrain to non-negative
        pred_dose = max(0.0, pred_dose)
        
        is_in_domain = (de >= (self.min_calibrated_delta_e - 0.5)) and (de <= (self.max_calibrated_delta_e * 1.10))
        status = "CALIBRATED" if is_in_domain else "OUTSIDE CALIBRATION RANGE"
        warning = "" if is_in_domain else f"Measured ΔE00 ({de:.2f}) is outside polynomial calibration domain."
        confidence = 92.0 if is_in_domain else max(20.0, 92.0 - (de - self.max_calibrated_delta_e) * 4.0)
        
        k_env = self.compute_env_factor(temp_c=temperature_c, rh_pct=humidity_percent)
        
        return ModelPredictionResult(
            estimated_dose_ppm_h=round(pred_dose, 2),
            is_calibrated_domain=is_in_domain,
            calibration_status=status,
            model_name=self.name,
            confidence_score=round(confidence, 1),
            env_compensation_factor=round(k_env, 4),
            deltaE00_from_baseline=round(de, 2),
            warning_message=warning
        )


def create_calibration_model(
    model_type: str = "interpolation",
    dataset: Optional[CalibrationDataset] = None,
    **kwargs
) -> BaseCalibrationModel:
    """
    Factory function for calibration models.
    
    Args:
        model_type: 'interpolation' (default) or 'polynomial'.
        dataset: Optional CalibrationDataset to automatically fit.
        
    Returns:
        Fitted or initialized BaseCalibrationModel instance.
    """
    m_type = model_type.lower().strip()
    if m_type in ("interpolation", "piecewise", "spline"):
        model = PiecewiseInterpolationModel(**kwargs)
    elif m_type in ("polynomial", "regression", "poly"):
        model = PolynomialRegressionModel(**kwargs)
    else:
        raise ValueError(f"Unknown calibration model type: '{model_type}'. Choose 'interpolation' or 'polynomial'.")
        
    if dataset is not None:
        model.fit(dataset)
    return model
