# Scientific Camera-Based H₂S Strip Color Calibration & Dosimetry Module

**Project:** SIH26118 — Passive Colorimetric H₂S Exposure-Dosimeter (MRPL)  
**Architecture:** Linear RGB → Camera Characterization (CCM) → XYZ → Bradford Chromatic Adaptation → CIELAB → CIEDE2000 → Experimental Dose Model

---

## 1. Scientific Pipeline Architecture

```
                       Camera Image (RGB)
                               ↓
          Crop & Validate Calibration Patch & Strip ROIs
                               ↓
     Reject Saturated (>0.98), Underexposed (<0.05) & Glare Pixels
                               ↓
                Linearize sRGB (Inverse Gamma 2.4)
                               ↓
            Estimate Source White Point (W_src) via Median
                               ↓
         Camera-Specific Color Correction Matrix (CCM @ RGB_lin)
                               ↓
             Bradford Chromatic Adaptation (W_src → D65)
                               ↓
               Standard CIE 1976 CIELAB (L*, a*, b*)
                               ↓
             CIEDE2000 Total Color Difference (ΔE00)
                               ↓
        Pluggable Calibration Model + Arrhenius Env Compensation
                               ↓
            Estimated Cumulative H₂S Dose [ppm·hours]
```

---

## 2. Scientific Principles & Rationale

### Why Simple RGB Normalization is Defective and Insufficient
A common naive approach normalizes RGB channels independently:
$$\text{R}_{\text{corr}} = \text{R}_{\text{raw}} \cdot \frac{255}{\text{R}_{\text{white}}}$$

This formula is **fundamentally flawed** for metrological optical dosimetry:
1. **Device & Sensor Dependency:** Camera sensors do not record absolute radiometric values; their spectral sensitivities ($R(\lambda), G(\lambda), B(\lambda)$) vary significantly across smartphone sensor models and IR-cut filters.
2. **Non-Linear Gamma Distortion:** Standard sRGB and JPEG images undergo non-linear gamma companding ($C \approx C_{\text{linear}}^{1/2.4}$). Multiplying non-linear values directly violates radiant flux superposition and causes massive color distortion.
3. **Hue and Chroma Shifts:** Per-channel scaling distorts the chromaticity angle and saturation, leading to large artificial dose variances when the scene lighting changes from warm sodium lamps (2700K) to daylight (6500K).

### Why the White Reference Patch is Required
The physical dosimeter badge incorporates a printed, chemically inert reference white patch alongside the active H₂S reaction strip:
```text
┌────────────────────────────────────────┐
│  WHITE REFERENCE PATCH  │  H₂S STRIP   │
└────────────────────────────────────────┘
```
Measuring the white patch in the **exact same frame** as the active strip captures the scene's instantaneous illuminant spectral distribution ($\mathbf{W}_{\text{src}}$). Outliers, dust, and glare are removed using statistical rejection, and the median linear intensity is computed to prevent single-pixel sensor noise.

### Why Bradford Chromatic Adaptation is Used
The Bradford transform projects tristimulus values into a modified cone response space ($\mathbf{\rho}, \mathbf{\gamma}, \mathbf{\beta}$) where chromatic adaptation occurs:
$$\mathbf{M}_{\text{Bradford}} = \begin{bmatrix} 0.8951 & 0.2664 & -0.1614 \\ -0.7502 & 1.7135 & 0.0367 \\ 0.0389 & -0.0685 & 1.0296 \end{bmatrix}$$

Given source white $\mathbf{W}_{\text{src}}$ and target reference white $\mathbf{W}_{\text{ref}}$ (D65: $[0.95047, 1.00000, 1.08883]$):
$$\mathbf{XYZ}_{\text{adapted}} = \mathbf{M}_{\text{Bradford}}^{-1} \operatorname{diag}\left(\frac{\mathbf{M}\mathbf{W}_{\text{ref}}}{\mathbf{M}\mathbf{W}_{\text{src}}}\right) \mathbf{M}_{\text{Bradford}} \mathbf{XYZ}_{\text{camera}}$$

This eliminates illumination color cast and guarantees invariant optical readings across varying industrial lighting environments.

### Why CIELAB and CIEDE2000 ($\Delta E_{00}$) are Used
1. **Perceptual Uniformity:** CIELAB maps colors into Lightness ($L^* \in [0, 100]$), green-red ($a^*$), and blue-yellow ($b^*$) axes.
2. **Standard Color Difference:** Standard Euclidean distance in RGB or Lab space distorts human and chemical perception. **CIEDE2000 ($\Delta E_{00}$)** incorporates lightness non-linearity ($S_L$), chroma-dependent weighting ($S_C$), hue rotation interaction terms ($R_T$), and hue-dependent weighting ($S_H$), delivering precision matching ISO/CIE 11664-6 standards.

### Why the PPM Mapping is Experimental
> **Crucial Rule:** The relationship between chemical strip darkening and H₂S exposure is formulation-, environment-, camera-, and exposure-dependent. Therefore, the color-to-dose mapping must be established **experimentally** for the developed strip.

The system does NOT hardcode arbitrary claims like `"brown = 10 ppm"`. Instead, it provides a pluggable calibration engine fitted against real gas chamber exposure datasets.

---

## 3. Mathematical Formulas

### sRGB Inverse Gamma (Linearization)
For normalized channel $C \in [0, 1]$:
$$C_{\text{linear}} = \begin{cases} \frac{C}{12.92} & C \le 0.04045 \\ \left(\frac{C + 0.055}{1.055}\right)^{2.4} & C > 0.04045 \end{cases}$$

### CIE 1976 XYZ to CIELAB
$$f(t) = \begin{cases} t^{1/3} & t > \left(\frac{6}{29}\right)^3 \approx 0.008856 \\ \frac{1}{3}\left(\frac{29}{6}\right)^2 t + \frac{4}{29} & \text{otherwise} \end{cases}$$
$$L^* = 116 f(Y / Y_n) - 16, \quad a^* = 500 [f(X / X_n) - f(Y / Y_n)], \quad b^* = 200 [f(Y / Y_n) - f(Z / Z_n)]$$

### Environmental Arrhenius Compensation
$$k_{\text{env}} = 1.0 + \alpha (T - 25.0^\circ\text{C}) + \beta (\text{RH} - 50.0\%)$$
$$\text{Dose}_{\text{calibrated}} = \frac{\text{Dose}_{\text{raw}}(\Delta E_{00})}{k_{\text{env}}}$$

---

## 4. Module Directory Structure

```text
h2s_dosimeter/
├── __init__.py
├── color/
│   ├── linear_rgb.py            # sRGB <-> Linear RGB decoding/encoding
│   ├── rgb_xyz.py               # Camera-specific Color Correction Matrix (CCM)
│   ├── bradford.py              # Bradford & Von Kries chromatic adaptation transform
│   ├── lab.py                   # Standard CIE XYZ -> CIELAB (L*, a*, b*)
│   └── delta_e.py               # CIEDE2000 (ΔE00) implementation per ISO 11664-6
│
├── vision/
│   ├── preprocessing.py         # Image decoding, normalization, validation
│   ├── strip_roi.py             # Rectangular ROI extraction, saturation/glare rejection
│   └── image_quality.py         # Focus sharpness, SNR, optical quality scoring
│
├── calibration/
│   ├── camera_matrix.py         # CCM config loader & validation
│   ├── white_reference.py       # Robust median white extraction & confidence evaluation
│   ├── calibration_dataset.py   # Experimental calibration dataset schema & JSON/CSV loader
│   └── calibration_model.py     # Piecewise interpolation & Polynomial surface regression
│
├── dosimetry/
│   ├── exposure.py              # Single-reading analyzer & diagnostic trace generator
│   ├── dose_model.py            # Cumulative temporal dosimeter timeline tracker
│   └── risk.py                  # Statutory risk thresholds (ACGIH, NIOSH, OSHA, DGMS)
│
├── config/
│   ├── color_calibration.json   # Calibration parameters & default camera CCM
│   └── calibration_dataset.json # Ground-truth experimental calibration points
│
├── scripts/
│   ├── train_calibration.py     # Model fitting script (outputs MAE, RMSE, R² & plots)
│   └── evaluate_stability.py    # Illumination invariance benchmarking script (2700K-7500K)
│
├── tests/
│   ├── test_color.py            # Colorimetric math unit tests (Sharma et al. test vectors)
│   ├── test_vision_calibration.py# ROI, outlier filtering, and calibration model tests
│   └── test_dosimetry_pipeline.py# End-to-end integration and dosimeter tracking tests
│
├── pipeline.py                  # High-level Python API (H2SDosimeterEngine)
├── cli.py                       # Command-line interface
└── README.md                    # This documentation
```

---

## 5. Usage Commands

### 1. Analyze an Image via CLI
```bash
python -m h2s_dosimeter.cli analyze --image path/to/wristband.jpg --temp 28.0 --rh 65.0
```

### 2. Analyze Direct RGB Vectors with Full JSON Diagnostic Trace
```bash
python -m h2s_dosimeter.cli analyze --rgb 92,85,68 --white 246,244,238 --temp 25.0 --rh 50.0 --json
```

### 3. Fit Calibration Models and Generate Validation Plots
```bash
python -m h2s_dosimeter.scripts.train_calibration --dataset h2s_dosimeter/config/calibration_dataset.json --output-dir calibration_plots
```

### 4. Run Optical Stability Benchmark (2700K to 7500K Illumination Spectrum)
```bash
python -m h2s_dosimeter.scripts.evaluate_stability
```

### 5. Run Full Automated Unit Test Suite
```bash
pytest -v h2s_dosimeter/tests
```

---

## 6. Python API Integration

```python
from h2s_dosimeter.pipeline import H2SDosimeterEngine

# Initialize engine
engine = H2SDosimeterEngine()

# Process captured image
result = engine.process_image(
    image_input="path/to/scan.jpg",
    temperature_c=27.5,
    humidity_percent=55.0,
    shift_hours=8.0
)

print(f"Status:          {result.status_label}")
print(f"Estimated Dose:  {result.estimated_dose_ppm_h:.2f} ppm·h")
print(f"CIELAB:          L*={result.lab['L']}, a*={result.lab['a']}, b*={result.lab['b']}")
print(f"ΔE00:            {result.deltaE00:.2f}")
print(f"Confidence:      {result.confidence_percentage:.1f}%")
print(f"Statutory Tier:  {result.statutory_compliance['statutory_tier']}")
```

---

## 7. Calibration Dataset Schema

Experimental calibration datasets are stored in JSON or CSV format:

```json
{
  "dataset_name": "MRPL-Chamber-Experimental-Calibration-v1",
  "formulation_version": "SIH26118-LeadAcetate-v1.2",
  "reference_baseline_lab": [95.4, -0.4, 4.2],
  "records": [
    {
      "sample_id": "CAL-000-CTRL",
      "dose_ppm_h": 0.0,
      "exposure_ppm": 0.0,
      "exposure_minutes": 0.0,
      "L": 95.4,
      "a": -0.4,
      "b": 4.2,
      "deltaE00": 0.0,
      "temperature_c": 25.0,
      "humidity_percent": 50.0,
      "notes": "Unexposed virgin reagent substrate baseline"
    },
    {
      "sample_id": "CAL-020-PEL",
      "dose_ppm_h": 20.0,
      "exposure_ppm": 20.0,
      "exposure_minutes": 60.0,
      "L": 42.1,
      "a": 1.8,
      "b": 11.8,
      "deltaE00": 44.8,
      "temperature_c": 25.0,
      "humidity_percent": 50.0,
      "notes": "OSHA PEL ceiling threshold marker"
    }
  ]
}
```

---

## 8. Metrological Limitations & Next Steps

1. **RAW Sensor Data:** When deployed on dedicated camera hardware, bypass smartphone JPEG ISP tone-curves and feed raw 10-bit/12-bit linear Bayer CFA sensor data directly to the pipeline.
2. **Camera Calibration:** Calibrate specific camera sensor Color Correction Matrices (CCM) using a Macbeth 24-patch ColorChecker under controlled D65 laboratory illumination.
3. **Chamber Gas Formulations:** Replace the initial reference dataset with newly synthesized chemical substrate chamber exposure test runs as batch formulations evolve.
