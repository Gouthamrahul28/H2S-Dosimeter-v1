"""
h2s_dosimeter.scripts.train_calibration
=======================================
Training and validation script for fitting experimental Cu-PAN H₂S strip calibration datasets.

Cu-PAN REACTION PRINCIPLE:
Cu(II)-PAN + H₂S -> CuS + H-PAN (Purple/Violet -> Yellow/Orange)

REQUIRED CALIBRATION GRAPHICS (Section 17):
1. H₂S dose vs L*
2. H₂S dose vs a*
3. H₂S dose vs b*
4. H₂S dose vs ΔE00
5. Temperature vs response
6. Humidity vs response
7. Predicted vs actual dose
8. Residual plot

Calculates: MAE, RMSE, R²
"""

import argparse
import os
import sys
import numpy as np
import matplotlib
matplotlib.use("Agg")  # Non-GUI headless backend for robust execution
import matplotlib.pyplot as plt

# Ensure Windows terminal handles UTF-8 safely
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from ..calibration.calibration_dataset import load_calibration_dataset, CalibrationDataset
from ..calibration.calibration_model import (
    PiecewiseInterpolationModel,
    PolynomialRegressionModel
)
from ..config import DEFAULT_CALIBRATION_DATASET_PATH


def plot_calibration_curves(dataset: CalibrationDataset, output_dir: str) -> None:
    """Generate high-resolution Cu-PAN validation curves covering all 8 required metrics."""
    os.makedirs(output_dir, exist_ok=True)
    
    labs, delta_es, doses, envs = dataset.get_arrays()
    if len(doses) == 0:
        return
        
    plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
    
    # Fits models
    model_interp = PiecewiseInterpolationModel().fit(dataset)
    model_poly = PolynomialRegressionModel().fit(dataset)
    
    pred_interp = np.array([model_interp.predict(lab=[r.L, r.a, r.b], temperature_c=r.temperature_c, humidity_percent=r.humidity_percent, deltaE00=r.deltaE00).estimated_dose_ppm_h for r in dataset.records])
    pred_poly = np.array([model_poly.predict(lab=[r.L, r.a, r.b], temperature_c=r.temperature_c, humidity_percent=r.humidity_percent, deltaE00=r.deltaE00).estimated_dose_ppm_h for r in dataset.records])
    
    residuals_interp = pred_interp - doses
    residuals_poly = pred_poly - doses
    
    # -------------------------------------------------------------
    # Figure 1: 8-Panel Master Kinetics and Diagnostics Grid (2x4)
    # -------------------------------------------------------------
    fig, axes = plt.subplots(2, 4, figsize=(20, 10))
    fig.suptitle(f"Cu-PAN H₂S Colorimetric Sensor Calibration Diagnostics ({dataset.dataset_name})", fontsize=16, fontweight='bold')
    
    # 1. H₂S dose vs L* (Lightness increases as purple dark matrix transitions to yellow/orange)
    ax1 = axes[0, 0]
    ax1.plot(doses, labs[:, 0], 'o-', color='#7c3aed', linewidth=2, markersize=6, label='Measured L*')
    ax1.set_xlabel('H₂S Dose (ppm·h)', fontweight='bold')
    ax1.set_ylabel('CIELAB Lightness L*', fontweight='bold')
    ax1.set_title('1. H₂S Dose vs L* (Purple -> Yellow)', fontweight='bold')
    ax1.grid(True, linestyle='--', alpha=0.6)
    ax1.legend()
    
    # 2. H₂S dose vs a* (Red-green shift)
    ax2 = axes[0, 1]
    ax2.plot(doses, labs[:, 1], 's-', color='#e11d48', linewidth=2, markersize=6, label='Measured a*')
    ax2.set_xlabel('H₂S Dose (ppm·h)', fontweight='bold')
    ax2.set_ylabel('CIELAB a* (Red-Green)', fontweight='bold')
    ax2.set_title('2. H₂S Dose vs a*', fontweight='bold')
    ax2.grid(True, linestyle='--', alpha=0.6)
    ax2.legend()
    
    # 3. H₂S dose vs b* (Blue-yellow shift: massive shift from negative violet towards positive yellow)
    ax3 = axes[0, 2]
    ax3.plot(doses, labs[:, 2], '^-', color='#d97706', linewidth=2, markersize=6, label='Measured b*')
    ax3.set_xlabel('H₂S Dose (ppm·h)', fontweight='bold')
    ax3.set_ylabel('CIELAB b* (Blue-Yellow)', fontweight='bold')
    ax3.set_title('3. H₂S Dose vs b* (Yellow Formation)', fontweight='bold')
    ax3.grid(True, linestyle='--', alpha=0.6)
    ax3.legend()
    
    # 4. H₂S dose vs ΔE00 (Total perceptual color difference from unexposed Cu-PAN baseline)
    ax4 = axes[0, 3]
    ax4.plot(doses, delta_es, 'D-', color='#0284c7', linewidth=2, markersize=6, label='Measured ΔE₀₀')
    ax4.set_xlabel('H₂S Dose (ppm·h)', fontweight='bold')
    ax4.set_ylabel('CIEDE2000 ΔE₀₀', fontweight='bold')
    ax4.set_title('4. H₂S Dose vs ΔE₀₀', fontweight='bold')
    ax4.grid(True, linestyle='--', alpha=0.6)
    ax4.legend()
    
    # 5. Temperature vs Response
    ax5 = axes[1, 0]
    temps = envs[:, 0]
    # Synthetic temp sweep at constant mid-dose
    temp_sweep = np.linspace(10, 50, 25)
    temp_factors = [model_interp.compute_env_factor(t, 50.0) for t in temp_sweep]
    ax5.plot(temp_sweep, temp_factors, '-', color='#f97316', linewidth=2, label='k(T) Rate Factor')
    ax5.scatter(temps, [model_interp.compute_env_factor(t, rh) for t, rh in envs], color='#b45309', zorder=5, label='Sample Points')
    ax5.set_xlabel('Temperature (°C)', fontweight='bold')
    ax5.set_ylabel('Kinetic Rate Factor k(T)', fontweight='bold')
    ax5.set_title('5. Temperature vs Response', fontweight='bold')
    ax5.grid(True, linestyle='--', alpha=0.6)
    ax5.legend()
    
    # 6. Humidity vs Response
    ax6 = axes[1, 1]
    rh_sweep = np.linspace(15, 90, 25)
    rh_factors = [model_interp.compute_env_factor(25.0, rh) for rh in rh_sweep]
    ax6.plot(rh_sweep, rh_factors, '-', color='#06b6d4', linewidth=2, label='k(RH) Rate Factor')
    ax6.scatter(envs[:, 1], [model_interp.compute_env_factor(t, rh) for t, rh in envs], color='#0891b2', zorder=5, label='Sample Points')
    ax6.set_xlabel('Relative Humidity (% RH)', fontweight='bold')
    ax6.set_ylabel('Kinetic Rate Factor k(RH)', fontweight='bold')
    ax6.set_title('6. Humidity vs Response', fontweight='bold')
    ax6.grid(True, linestyle='--', alpha=0.6)
    ax6.legend()
    
    # 7. Predicted vs Actual Dose
    ax7 = axes[1, 2]
    eval_interp = model_interp.evaluate(dataset)
    eval_poly = model_poly.evaluate(dataset)
    
    ax7.plot([0, max(doses)], [0, max(doses)], '--', color='#64748b', linewidth=1.5, label='Ideal 1:1 Identity')
    ax7.plot(doses, pred_interp, 'o', color='#0284c7', markersize=6, label=f'Piecewise (R²={eval_interp["r2"]:.4f})')
    ax7.plot(doses, pred_poly, '^', color='#f59e0b', markersize=6, label=f'Polynomial (R²={eval_poly["r2"]:.4f})')
    ax7.set_xlabel('Actual Chamber Dose (ppm·h)', fontweight='bold')
    ax7.set_ylabel('Predicted Dose (ppm·h)', fontweight='bold')
    ax7.set_title('7. Predicted vs Actual Dose', fontweight='bold')
    ax7.grid(True, linestyle='--', alpha=0.6)
    ax7.legend()
    
    # 8. Residual Plot
    ax8 = axes[1, 3]
    ax8.axhline(0, color='#64748b', linestyle='--', linewidth=1.5)
    ax8.scatter(doses, residuals_interp, color='#0284c7', label=f'Piecewise (MAE={eval_interp["mae"]:.2f})', alpha=0.8)
    ax8.scatter(doses, residuals_poly, color='#f59e0b', marker='^', label=f'Polynomial (MAE={eval_poly["mae"]:.2f})', alpha=0.8)
    ax8.set_xlabel('Actual Chamber Dose (ppm·h)', fontweight='bold')
    ax8.set_ylabel('Residual Error (ppm·h)', fontweight='bold')
    ax8.set_title('8. Residual Error Plot', fontweight='bold')
    ax8.grid(True, linestyle='--', alpha=0.6)
    ax8.legend()
    
    plt.tight_layout()
    plot_file = os.path.join(output_dir, "cupan_calibration_kinetics_overview.png")
    fig.savefig(plot_file, dpi=200)
    plt.close(fig)
    print(f"  ✓ Saved 8-panel Cu-PAN validation curves to: {plot_file}")


def main():
    parser = argparse.ArgumentParser(description="Train and evaluate Cu-PAN H2S strip color calibration models")
    parser.add_argument("--dataset", type=str, default=DEFAULT_CALIBRATION_DATASET_PATH, help="Path to Cu-PAN calibration dataset JSON/CSV")
    parser.add_argument("--output-dir", type=str, default="calibration_plots", help="Directory to save generated validation plots")
    args = parser.parse_args()
    
    print("============================================================")
    print("     Cu-PAN H₂S DOSIMETER CALIBRATION MODEL FITTING TOOL    ")
    print("============================================================")
    print(f"Loading dataset: {args.dataset}")
    dataset = load_calibration_dataset(args.dataset)
    print(f"Dataset Name:    {dataset.dataset_name}")
    print(f"Chemistry:       {dataset.chemistry}")
    print(f"Indicator:       {dataset.indicator}")
    print(f"Substrate:       {dataset.substrate}")
    print(f"Formulation:     {dataset.formulation_version}")
    print(f"Sample Points:   {len(dataset)}")
    print("------------------------------------------------------------")
    
    # 1. Piecewise Model
    m_interp = PiecewiseInterpolationModel()
    m_interp.fit(dataset)
    res_interp = m_interp.evaluate(dataset)
    
    print("\nModel 1: Piecewise Monotonic Spline Interpolation")
    print(f"  MAE:   {res_interp['mae']:.3f} ppm·h")
    print(f"  RMSE:  {res_interp['rmse']:.3f} ppm·h")
    print(f"  R²:    {res_interp['r2']:.4f}")
    
    # 2. Polynomial Surface Model
    m_poly = PolynomialRegressionModel(degree=2, alpha=1e-3)
    m_poly.fit(dataset)
    res_poly = m_poly.evaluate(dataset)
    
    print("\nModel 2: 2nd-Order Polynomial Surface Regression (Ridge alpha=1e-3)")
    print(f"  MAE:   {res_poly['mae']:.3f} ppm·h")
    print(f"  RMSE:  {res_poly['rmse']:.3f} ppm·h")
    print(f"  R²:    {res_poly['r2']:.4f}")
    print("------------------------------------------------------------")
    
    # 3. Generate Diagnostic Plots
    print("\nGenerating Cu-PAN calibration kinetics validation plots (8 panels)...")
    plot_calibration_curves(dataset, args.output_dir)
    print("Cu-PAN Calibration fitting complete!\n")


if __name__ == "__main__":
    main()
