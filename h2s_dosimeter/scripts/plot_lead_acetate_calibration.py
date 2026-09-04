"""
h2s_dosimeter.scripts.plot_lead_acetate_calibration
==================================================
Publication-grade scientific visualization generator for Lead Acetate calibration (Phase 7).

Generates 7 required scientific visualizations:
1. ΔE00 vs Experimental Dose (with fitted model and replicate error bars)
2. L* Lightness vs Experimental Dose (monotonic optical darkening)
3. a* & b* vs Experimental Dose (chromatic transition tan/amber to black PbS)
4. Predicted vs Actual Dose (calibration fidelity parity line)
5. Model Residuals vs Dose (homoscedasticity and residual scatter)
6. Experimental Replicate Distribution & Repeatability (box / swarm distribution)
"""

import os
import json
import math
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

WORKSPACE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATASET_PATH = os.path.join(WORKSPACE_DIR, "data", "master", "LEAD_ACETATE_DATASET_V1.json")
PLOTS_DIR = os.path.join(WORKSPACE_DIR, "calibration_plots")
os.makedirs(PLOTS_DIR, exist_ok=True)

PNG_OUTPUT = os.path.join(PLOTS_DIR, "lead_acetate_experimental_calibration.png")
SVG_OUTPUT = os.path.join(PLOTS_DIR, "lead_acetate_experimental_calibration.svg")


def generate_calibration_plots():
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    samples = data["samples"]
    
    doses = np.array([float(s["reference_dose"]) for s in samples])
    de00 = np.array([float(s["deltaE00"]) for s in samples])
    L_vals = np.array([float(s["Lab"]["L"]) for s in samples])
    a_vals = np.array([float(s["Lab"]["a"]) for s in samples])
    b_vals = np.array([float(s["Lab"]["b"]) for s in samples])
    
    unique_doses = np.unique(doses)
    mean_de00 = np.array([np.mean(de00[doses == d]) for d in unique_doses])
    std_de00 = np.array([np.std(de00[doses == d], ddof=1) if np.sum(doses == d) > 1 else 0.0 for d in unique_doses])
    
    mean_L = np.array([np.mean(L_vals[doses == d]) for d in unique_doses])
    std_L = np.array([np.std(L_vals[doses == d], ddof=1) if np.sum(doses == d) > 1 else 0.0 for d in unique_doses])
    
    mean_a = np.array([np.mean(a_vals[doses == d]) for d in unique_doses])
    mean_b = np.array([np.mean(b_vals[doses == d]) for d in unique_doses])
    
    # 1. Fit Polynomial Model: deltaE00 = p[0]*dose^2 + p[1]*dose + p[2]
    poly2_coeffs = np.polyfit(unique_doses, mean_de00, 2)
    poly1_coeffs = np.polyfit(unique_doses, mean_de00, 1)
    
    dose_smooth = np.linspace(0, 24, 200)
    de00_poly2_smooth = np.polyval(poly2_coeffs, dose_smooth)
    de00_linear_smooth = np.polyval(poly1_coeffs, dose_smooth)
    
    # Predicted doses from analytical inversion:
    # poly2: de00 = a*d^2 + b*d + c => a*d^2 + b*d + (c - de00) = 0
    # d = (-b + sqrt(b^2 - 4*a*(c - de00))) / (2*a)
    a_p2, b_p2, c_p2 = poly2_coeffs
    
    def invert_poly2(de_val):
        disc = b_p2**2 - 4 * a_p2 * (c_p2 - de_val)
        if disc < 0:
            return 0.0
        return (-b_p2 + math.sqrt(disc)) / (2 * a_p2)
        
    predicted_doses = np.array([invert_poly2(de) for de in de00])
    residuals = predicted_doses - doses
    
    # Metrics
    ss_res = np.sum((doses - predicted_doses)**2)
    ss_tot = np.sum((doses - np.mean(doses))**2)
    r2 = 1.0 - (ss_res / ss_tot)
    mae = np.mean(np.abs(residuals))
    rmse = math.sqrt(np.mean(residuals**2))
    
    # Set dark scientific style
    plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
    fig, axs = plt.subplots(3, 2, figsize=(15, 18), dpi=300)
    fig.patch.set_facecolor('#0b1120')
    
    for ax in axs.flat:
        ax.set_facecolor('#131e36')
        ax.tick_params(colors='#cbd5e1', labelsize=9)
        for spine in ax.spines.values():
            spine.set_color('#334155')
        ax.grid(True, linestyle='--', alpha=0.25, color='#94a3b8')
        
    # Panel 1: ΔE00 vs Experimental Dose
    ax1 = axs[0, 0]
    ax1.errorbar(unique_doses, mean_de00, yerr=std_de00, fmt='o', color='#38bdf8', ecolor='#f43f5e',
                 elinewidth=2, capsize=5, capthick=1.5, markersize=8, label='Experimental (n=3)', zorder=5)
    ax1.plot(dose_smooth, de00_poly2_smooth, color='#10b981', linewidth=2.5,
             label=f'2nd-Order Poly Fit (R² = {r2:.4f})')
    ax1.plot(dose_smooth, de00_linear_smooth, color='#f59e0b', linestyle=':', linewidth=1.8,
             label='Linear Baseline')
    ax1.set_title("1. Color Difference ΔE00 vs H₂S Dose", color='#f8fafc', fontsize=12, fontweight='bold', pad=10)
    ax1.set_xlabel("Relative Dose (mL H₂S Generated)", color='#94a3b8', fontsize=10)
    ax1.set_ylabel("CIE CIEDE2000 ΔE00", color='#94a3b8', fontsize=10)
    ax1.legend(loc='upper left', facecolor='#1e293b', edgecolor='#475569', labelcolor='#f8fafc', fontsize=9)
    
    # Panel 2: L* vs Experimental Dose (Optical Darkening)
    ax2 = axs[0, 1]
    ax2.errorbar(unique_doses, mean_L, yerr=std_L, fmt='s', color='#f43f5e', ecolor='#fb7185',
                 elinewidth=2, capsize=5, capthick=1.5, markersize=8, label='L* Lightness (n=3)', zorder=5)
    l_poly2 = np.polyfit(unique_doses, mean_L, 2)
    ax2.plot(dose_smooth, np.polyval(l_poly2, dose_smooth), color='#f43f5e', linewidth=2.2, linestyle='--',
             label=f'Darkening Trend ({mean_L[0]:.1f} → {mean_L[-1]:.1f})')
    ax2.set_title("2. CIELAB L* Darkening vs H₂S Dose", color='#f8fafc', fontsize=12, fontweight='bold', pad=10)
    ax2.set_xlabel("Relative Dose (mL H₂S Generated)", color='#94a3b8', fontsize=10)
    ax2.set_ylabel("Lightness L* (0=Black, 100=White)", color='#94a3b8', fontsize=10)
    ax2.legend(loc='upper right', facecolor='#1e293b', edgecolor='#475569', labelcolor='#f8fafc', fontsize=9)
    
    # Panel 3: a* and b* vs Experimental Dose
    ax3 = axs[1, 0]
    ax3.plot(unique_doses, mean_a, 'o-', color='#ec4899', linewidth=2.0, markersize=7, label='a* (Green → Red/Tan)')
    ax3.plot(unique_doses, mean_b, 's-', color='#eab308', linewidth=2.0, markersize=7, label='b* (Blue → Yellow/Amber)')
    ax3.set_title("3. Chromaticity Trajectory (a*, b*) vs H₂S Dose", color='#f8fafc', fontsize=12, fontweight='bold', pad=10)
    ax3.set_xlabel("Relative Dose (mL H₂S Generated)", color='#94a3b8', fontsize=10)
    ax3.set_ylabel("CIE a*, b* Chromatic Coordinates", color='#94a3b8', fontsize=10)
    ax3.legend(loc='upper right', facecolor='#1e293b', edgecolor='#475569', labelcolor='#f8fafc', fontsize=9)
    
    # Panel 4: Predicted vs Actual Dose
    ax4 = axs[1, 1]
    ax4.scatter(doses, predicted_doses, color='#38bdf8', edgecolors='#0284c7', s=60, alpha=0.9, zorder=5, label='Replicate Predictions')
    parity_line = np.linspace(0, 24, 100)
    ax4.plot(parity_line, parity_line, color='#10b981', linestyle='--', linewidth=2.0, label='Ideal Parity (y = x)')
    ax4.set_title(f"4. Predicted vs Actual Dose (R² = {r2:.4f}, MAE = {mae:.2f} mL)", color='#f8fafc', fontsize=12, fontweight='bold', pad=10)
    ax4.set_xlabel("Ground Truth Experimental Dose (mL H₂S)", color='#94a3b8', fontsize=10)
    ax4.set_ylabel("Model Inverted Dose (mL H₂S)", color='#94a3b8', fontsize=10)
    ax4.legend(loc='upper left', facecolor='#1e293b', edgecolor='#475569', labelcolor='#f8fafc', fontsize=9)
    
    # Panel 5: Residuals vs Dose
    ax5 = axs[2, 0]
    ax5.scatter(doses, residuals, color='#a855f7', edgecolors='#7e22ce', s=60, zorder=5)
    ax5.axhline(0.0, color='#94a3b8', linestyle='--', linewidth=1.5)
    ax5.fill_between([0, 24], -mae, mae, color='#a855f7', alpha=0.15, label=f'±MAE Band (±{mae:.2f} mL)')
    ax5.set_title("5. Model Prediction Residuals (Inverted Dose Error)", color='#f8fafc', fontsize=12, fontweight='bold', pad=10)
    ax5.set_xlabel("Ground Truth Experimental Dose (mL H₂S)", color='#94a3b8', fontsize=10)
    ax5.set_ylabel("Residual (Predicted - Actual, mL)", color='#94a3b8', fontsize=10)
    ax5.legend(loc='upper right', facecolor='#1e293b', edgecolor='#475569', labelcolor='#f8fafc', fontsize=9)
    
    # Panel 6: Experimental Replicate Distribution & Repeatability
    ax6 = axs[2, 1]
    box_data = [de00[doses == d] for d in unique_doses]
    box = ax6.boxplot(box_data, positions=unique_doses, widths=1.2, patch_artist=True,
                      boxprops=dict(facecolor='#0284c7', color='#38bdf8', alpha=0.7),
                      capprops=dict(color='#38bdf8', linewidth=1.5),
                      whiskerprops=dict(color='#38bdf8', linewidth=1.5),
                      medianprops=dict(color='#f8fafc', linewidth=2.0))
    # Overlay individual data points (jittered strip plot)
    for i, d in enumerate(unique_doses):
        vals = de00[doses == d]
        jitter = np.random.normal(0, 0.15, size=len(vals))
        ax6.scatter(d + jitter, vals, color='#facc15', edgecolors='#ca8a04', s=50, zorder=6, label='Replicate Sample' if i == 0 else "")
        
    ax6.set_title("6. Experimental Replicate Distribution & Repeatability", color='#f8fafc', fontsize=12, fontweight='bold', pad=10)
    ax6.set_xlabel("Relative Dose (mL H₂S Generated)", color='#94a3b8', fontsize=10)
    ax6.set_ylabel("Measured ΔE00 Distribution (n=3 per point)", color='#94a3b8', fontsize=10)
    ax6.legend(loc='upper left', facecolor='#1e293b', edgecolor='#475569', labelcolor='#f8fafc', fontsize=9)
    
    plt.suptitle("SIH26118: Lead Acetate H₂S Dosimeter Experimental Calibration Suite\n"
                 f"Apparatus: Two-Tube Gas Train (FeS + HCl Stoichiometry) | Dataset: LEAD_ACETATE_DATASET_V1 (N=15)",
                 color='#f8fafc', fontsize=14, fontweight='bold', y=0.995)
    
    plt.tight_layout(rect=[0, 0.02, 1, 0.98])
    plt.savefig(PNG_OUTPUT, dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
    plt.savefig(SVG_OUTPUT, format='svg', facecolor=fig.get_facecolor(), edgecolor='none')
    plt.close()
    
    print("================================================================================")
    print("LEAD ACETATE CALIBRATION PLOTS GENERATED")
    print("================================================================================")
    print(f"  PNG Artifact: {PNG_OUTPUT}")
    print(f"  SVG Artifact: {SVG_OUTPUT}")
    print(f"  Model Inversion R²:  {r2:.4f}")
    print(f"  Model Inversion MAE: {mae:.2f} mL H2S")
    print(f"  Model Inversion RMSE:{rmse:.2f} mL H2S")
    print(f"  Polynomial Coeffs:   a={a_p2:.4f}, b={b_p2:.4f}, c={c_p2:.4f}")
    return {
        "r2": r2,
        "mae": mae,
        "rmse": rmse,
        "coeffs": [float(a_p2), float(b_p2), float(c_p2)]
    }


if __name__ == "__main__":
    generate_calibration_plots()
