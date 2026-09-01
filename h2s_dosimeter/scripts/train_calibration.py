"""
h2s_dosimeter.scripts.train_calibration
=======================================
Training and validation script for fitting experimental H₂S strip calibration datasets.

OUTPUTS:
- Mathematical fit error metrics (MAE, RMSE, R²)
- Calibration curve parameter export
- Diagnostic kinetics plots (H₂S dose vs L*, a*, b*, and ΔE00)
"""

import argparse
import os
import sys
import numpy as np
import matplotlib
matplotlib.use("Agg")  # Non-GUI headless backend for robust CI/CLI execution
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
    """Generate high-resolution validation curves."""
    os.makedirs(output_dir, exist_ok=True)
    
    labs, delta_es, doses, envs = dataset.get_arrays()
    if len(doses) == 0:
        return
        
    plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
    
    # Figure 1: 4-Panel Kinetics Overview
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(12, 10))
    fig.suptitle(f"H2S Chemical Dosimeter Calibration: {dataset.dataset_name}", fontsize=14, fontweight='bold')
    
    # 1. Dose vs Lightness L*
    ax1.plot(doses, labs[:, 0], 'o-', color='#0284c7', linewidth=2, markersize=7, label='Measured L*')
    ax1.set_xlabel('H2S Cumulative Dose (ppm*h)', fontweight='bold')
    ax1.set_ylabel('CIELAB Lightness L* (0-100)', fontweight='bold')
    ax1.set_title('Darkening Kinetics: Dose vs Lightness (L*)')
    ax1.grid(True, linestyle='--', alpha=0.6)
    ax1.legend()
    
    # 2. Dose vs Chroma a* & b*
    ax2.plot(doses, labs[:, 1], 's-', color='#e11d48', linewidth=2, markersize=6, label='a* (Red-Green)')
    ax2.plot(doses, labs[:, 2], '^-', color='#d97706', linewidth=2, markersize=6, label='b* (Yellow-Blue)')
    ax2.set_xlabel('H2S Cumulative Dose (ppm*h)', fontweight='bold')
    ax2.set_ylabel('CIELAB Chromaticity Coordinates', fontweight='bold')
    ax2.set_title('Chromatic Shift: Dose vs a* & b*')
    ax2.grid(True, linestyle='--', alpha=0.6)
    ax2.legend()
    
    # 3. Dose vs CIEDE2000 (ΔE00)
    ax3.plot(doses, delta_es, 'D-', color='#7c3aed', linewidth=2, markersize=7, label='Measured deltaE00')
    ax3.set_xlabel('H2S Cumulative Dose (ppm*h)', fontweight='bold')
    ax3.set_ylabel('Perceptual Difference deltaE00', fontweight='bold')
    ax3.set_title('Total Color Difference: Dose vs CIEDE2000 (deltaE00)')
    ax3.grid(True, linestyle='--', alpha=0.6)
    ax3.legend()
    
    # 4. Model Predictions vs Ground Truth Dose
    model_interp = PiecewiseInterpolationModel().fit(dataset)
    model_poly = PolynomialRegressionModel().fit(dataset)
    
    pred_interp = [model_interp.predict(lab=[r.L, r.a, r.b], deltaE00=r.deltaE00).estimated_dose_ppm_h for r in dataset.records]
    pred_poly = [model_poly.predict(lab=[r.L, r.a, r.b], deltaE00=r.deltaE00).estimated_dose_ppm_h for r in dataset.records]
    
    ax4.plot(doses, doses, '--', color='#64748b', label='Ideal 1:1 Identity', linewidth=1.5)
    ax4.plot(doses, pred_interp, 'o', color='#06b6d4', markersize=8, label=f'Piecewise (R²={model_interp.evaluate(dataset)["r2"]:.4f})')
    ax4.plot(doses, pred_poly, '^', color='#f59e0b', markersize=7, label=f'Polynomial (R²={model_poly.evaluate(dataset)["r2"]:.4f})')
    ax4.set_xlabel('Actual Chamber Dose (ppm·h)', fontweight='bold')
    ax4.set_ylabel('Model Estimated Dose (ppm·h)', fontweight='bold')
    ax4.set_title('Model Calibration Accuracy')
    ax4.grid(True, linestyle='--', alpha=0.6)
    ax4.legend()
    
    plt.tight_layout()
    plot_file = os.path.join(output_dir, "calibration_kinetics_overview.png")
    fig.savefig(plot_file, dpi=200)
    plt.close(fig)
    print(f"  ✓ Saved validation curves to: {plot_file}")


def main():
    parser = argparse.ArgumentParser(description="Train and evaluate H2S strip color calibration models")
    parser.add_argument("--dataset", type=str, default=DEFAULT_CALIBRATION_DATASET_PATH, help="Path to calibration dataset JSON/CSV")
    parser.add_argument("--output-dir", type=str, default="calibration_plots", help="Directory to save generated validation plots")
    args = parser.parse_args()
    
    print("============================================================")
    print("       H₂S DOSIMETER CALIBRATION MODEL FITTING TOOL         ")
    print("============================================================")
    print(f"Loading dataset: {args.dataset}")
    dataset = load_calibration_dataset(args.dataset)
    print(f"Dataset Name:    {dataset.dataset_name}")
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
    print("\nGenerating calibration kinetics validation plots...")
    plot_calibration_curves(dataset, args.output_dir)
    print("Calibration fitting complete!\n")


if __name__ == "__main__":
    main()
