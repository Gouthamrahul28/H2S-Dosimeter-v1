"""Experimental Dose Calibration Model Training and Validation Script.

Fits piecewise monotonic interpolation and polynomial models, computes
formal validation metrics (MAE, RMSE, R²), and outputs validation plots.
"""

from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt

from ..calibration.strip_calibration import StripCalibrationDataset
from ..calibration.validation import compute_validation_metrics

OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "calibration_plots"


def run_dose_model_training():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    dataset = StripCalibrationDataset()

    print("=" * 60)
    print("  H2S Strip Calibration Model Training & Validation")
    print(f"  Strip Reagent: {dataset.strip_type}")
    print(f"  Calibration Version: {dataset.version}")
    print("=" * 60)

    deltas = np.array([p["delta_e00"] for p in dataset.points], dtype=np.float64)
    doses = np.array([p["dose_ppm_h"] for p in dataset.points], dtype=np.float64)

    # 1. Evaluate Piecewise Monotonic Interpolation Model
    pred_mono = np.array([dataset.model.predict(d)[0] for d in deltas])
    report_mono = compute_validation_metrics(doses, pred_mono, "Piecewise Monotonic Spline")

    print("\n--- Model Performance: Piecewise Monotonic Spline ---")
    print(f"  Number of Calibration Points: {report_mono.num_samples}")
    print(f"  Mean Absolute Error (MAE):    {report_mono.mae:.3f} ppm·h")
    print(f"  Root Mean Squared Error (RMSE): {report_mono.rmse:.3f} ppm·h")
    print(f"  R² Coefficient of Det:        {report_mono.r_squared:.4f}")
    print(f"  Maximum Absolute Error:       {report_mono.max_error:.3f} ppm·h")

    # 2. Generate publication-quality validation plot
    fig, axes = plt.subplots(1, 2, figsize=(12, 5), dpi=200)

    # Plot A: Chemical Kinetics (ΔE00 vs Dose)
    dense_delta = np.linspace(0.0, 78.5, 200)
    dense_dose = np.array([dataset.model.predict(d)[0] for d in dense_delta])

    axes[0].plot(dense_delta, dense_dose, color="#0284c7", linewidth=2.5, label="Piecewise Monotonic Fit")
    axes[0].scatter(deltas, doses, color="#e11d48", s=60, zorder=5, label="Chamber Data (25°C, 50% RH)")
    axes[0].set_title("H₂S Chemical Response Curve", fontsize=12, fontweight="bold")
    axes[0].set_xlabel("Optical Shift ΔE₀₀ (ISO/CIE 11664-6)", fontsize=10)
    axes[0].set_ylabel("Cumulative Dose (ppm·hours)", fontsize=10)
    axes[0].grid(True, alpha=0.3)
    axes[0].legend(frameon=True)

    # Plot B: Parity Plot (True Dose vs Predicted Dose)
    axes[1].plot([0, 160], [0, 160], 'k--', alpha=0.6, label="1:1 Ideal Parity")
    axes[1].scatter(doses, pred_mono, color="#059669", s=60, zorder=5, label=f"Model (R² = {report_mono.r_squared:.4f})")
    axes[1].set_title("Experimental Validation Parity", fontsize=12, fontweight="bold")
    axes[1].set_xlabel("True Chamber Dose (ppm·hours)", fontsize=10)
    axes[1].set_ylabel("Estimated Model Dose (ppm·hours)", fontsize=10)
    axes[1].grid(True, alpha=0.3)
    axes[1].legend(frameon=True)

    plt.tight_layout()
    plot_path = OUTPUT_DIR / "dose_calibration_kinetics.png"
    plt.savefig(plot_path)
    plt.close()

    print(f"\n[+] Saved validation kinetics plot to: {plot_path}")


if __name__ == "__main__":
    run_dose_model_training()
