# Scientific Camera-Based Cu-PAN H₂S Strip Color Calibration & Dosimetry Module

**Project:** SIH26118 — Passive Colorimetric Cu-PAN H₂S Exposure Dosimeter  
**Chemistry:** Copper(II) complex of 1-(2-pyridylazo)-2-naphthol (Cu-PAN) on porous cellulose/paper substrate  
**Architecture:** Linear RGB → Camera Characterization (CCM) → CIE XYZ → Bradford Chromatic Adaptation → CIELAB → ISO/CIE 11664-6 CIEDE2000 → Arrhenius Kinetics → Cumulative Dose (`ppm·h`)

---

## 1. Scientific Pipeline Architecture

```text
                       Camera Image (RGB)
                               ↓
         Crop & Validate 3-Patch Target ROIs [White | Strip | Grey]
                               ↓
    Reject Saturated (>0.98), Underexposed (<0.05) & Glare Outliers
                               ↓
              Linearize sRGB (IEC 61966-2-1 Inverse Gamma)
                               ↓
          Estimate Source White Point (W_src) via Robust Median
                               ↓
        Camera-Specific Color Correction Matrix (CCM @ RGB_lin)
                               ↓
            Bradford Chromatic Adaptation (W_src → D65)
                               ↓
              Standard CIE 1976 CIELAB (L*, a*, b*)
                               ↓
        ISO/CIE 11664-6:2022 CIEDE2000 Total Shift (ΔE₀₀)
                               ↓
      Arrhenius Environmental Kinetic Compensation k(T, RH)
                               ↓
      Piecewise Monotonic Spline & Polynomial Surface Regression
                               ↓
           Estimated Cumulative H₂S Dose [ppm·h] + Risk Policy
```

---

## 2. Chemical Sensing Principle & Color Transition

```text
Cu(II)-PAN complex (Purple/Violet)
        +
H₂S (Gas)
        ↓
Sulfide coordination & displacement
        ↓
CuS precipitation + Free H-PAN dye release
        ↓
Visible Chromatic Transition: PURPLE/VIOLET → YELLOW/ORANGE
```

- **Unexposed Virgin Baseline**: $L_0^* = 42.50, a_0^* = 38.20, b_0^* = -28.40$ (RGB $\approx [139, 76, 148]$).
- **Reacted Saturated Matrix**: $L^* = 72.80, a^* = 14.50, b^* = 62.00$ (RGB $\approx [225, 155, 45]$).
- **Dose Metric**: Cumulative exposure dose in **`ppm·h`** ($\text{Dose} = \int C(t) dt$).

---

## 3. Scientific Literature & Attribution

### Literature Citations
1. **Carpenter et al. (2017)**: *"Quantitative, colorimetric paper probe for hydrogen sulfide gas"*, *Sensors and Actuators B: Chemical*, 241, 1269–1274.  
   - *Reported in literature*: Gas-phase reaction of Cu-PAN immobilized on paper with $\text{H}_2\text{S}$, exhibiting purple-to-orange/yellow optical shift with laboratory limits of detection down to 16 ppb under controlled chamber flow.
2. **Niamnuy et al. (2023)**: *"Pineapple-Leaf-Derived, Copper-PAN-Modified Regenerated Cellulose Sheet Used as a Hydrogen Sulfide Indicator"*, *ACS Omega*, 8(15), 13615–13624.  
   - *Reported in literature*: Regenerated cellulose matrices loaded with Cu-PAN as colorimetric gas indicators.

> **Attribution Note**: Literature performance numbers reflect published paper findings under specified laboratory conditions. Device operational performance is determined empirically using our calibrated dataset spanning **0.0 to 160.0 ppm·h**.

---

## 4. Optical Principles & Mathematical Rigor

### sRGB Inverse Gamma (Linearization)
For normalized channel $C \in [0, 1]$:
$$C_{\text{linear}} = \begin{cases} \frac{C}{12.92}, & C \le 0.04045 \\ \left(\frac{C + 0.055}{1.055}\right)^{2.4}, & C > 0.04045 \end{cases}$$

### Camera Color Correction Matrix (CCM)
$$\begin{bmatrix} X \\ Y \\ Z \end{bmatrix} = \mathbf{M}_{\text{CCM}} \begin{bmatrix} R_{\text{lin}} \\ G_{\text{lin}} \\ B_{\text{lin}} \end{bmatrix}$$

### Bradford Chromatic Adaptation
$$\mathbf{M}_{\text{Bradford}} = \begin{bmatrix} 0.8951 & 0.2664 & -0.1614 \\ -0.7502 & 1.7135 & 0.0367 \\ 0.0389 & -0.0685 & 1.0296 \end{bmatrix}$$
$$\mathbf{XYZ}_{\text{adapted}} = \mathbf{M}_{\text{Bradford}}^{-1} \operatorname{diag}\left(\frac{\mathbf{M}\mathbf{W}_{\text{D65}}}{\mathbf{M}\mathbf{W}_{\text{src}}}\right) \mathbf{M}_{\text{Bradford}} \mathbf{XYZ}$$

### Environmental Arrhenius Compensation
$$k(T, RH) = \exp\left[-\frac{E_a}{R}\left(\frac{1}{T} - \frac{1}{T_{\text{ref}}}\right)\right] \cdot \left(\frac{RH}{RH_{\text{ref}}}\right)^\alpha$$
$$\Delta E_{00, \text{norm}} = \frac{\Delta E_{00}}{k(T, RH)}$$

---

## 5. Usage Commands

```bash
# Run pytest test suite (53 tests)
pytest -v h2s_dosimeter/tests

# Fit Cu-PAN calibration models and generate 8-panel kinetics diagnostic plots
python -m h2s_dosimeter.scripts.train_calibration

# Run dose calibration model fitting
python -m h2s_dosimeter.scripts.train_dose_model
```

---

## 6. Python API Example

```python
from h2s_dosimeter.pipeline import H2SDosimeterEngine

engine = H2SDosimeterEngine()

# Process captured frame or image
result = engine.process_raw_measurements(
    strip_rgb_8bit=[204, 142, 78],      # Reacted Cu-PAN (amber/orange)
    white_rgb_8bit=[250, 250, 250],      # Reference white
    temperature_c=28.0,
    humidity_percent=55.0,
    shift_hours=8.0
)

print(f"Chemistry:       {result.chemistry}")
print(f"Status:          {result.status_label}")
print(f"Estimated Dose:  {result.estimated_dose_ppm_h:.2f} ppm·h")
print(f"Optical Shift:   ΔE00 = {result.deltaE00:.2f}")
print(f"Risk Tier:       {result.statutory_compliance['statutory_tier']}")
```
