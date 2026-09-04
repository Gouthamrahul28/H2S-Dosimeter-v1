# H2S-SafeTrack — SIH26118 Audit Summary

**Date:** 2026-09-04
**Scope:** Core Next.js app (`app/`, `components/`, `lib/`) per the audit prompt's expected
structure. `backend/`, `dashboard/`, `mobile-app/`, and `h2s_dosimeter/` are additional
services that have grown up around the original prototype and are noted below but were not
rewritten in this pass — see "Out of scope" at the end.

## Key finding: the audit prompt is written against an earlier, simpler version of this repo

The repo has evolved well past the "expected structure" assumed in
`CLAUDE_CODE_PROMPT_H2S_SafeTrack.md`. Several items the prompt lists as gaps are **already
implemented correctly**:

| Prompt assumption | Actual repo state |
|---|---|
| Chemistry may be Cu-PAN (reversible, wrong for cumulative dose) | Core app (`lib/calibrationData.ts`, `lib/colorimetry.ts`) uses **exclusively Lead(II) Acetate / PbS**, explicitly irreversible, stated in file header comments. Cu-PAN appears only in `backend/`, `dashboard/`, `h2s_dosimeter/` as a **separate, intentionally-implemented comparison model** (`CuPanReferenceScale.jsx`, `StandardsPage.jsx`), not a leftover — removing it would delete a real feature, not fix a bug. |
| Reference patch calibration (Engel et al. 2021) not implemented | **Already implemented** — `lib/colorimetry.ts` segments an outer white reference ring (`segmentConcentricFiducial`) and applies a full Bradford chromatic-adaptation transform (`applyBradfordAdaptation`) before Lab conversion. |
| Confidence/uncertainty range missing | **Already implemented** — `evaluateLeadAcetateExposure` returns `confidenceScore`, derived from reference-white reflectance and glare/underexposure detection. |
| `ppm` vs `ppm·hours` confusion | Already mostly consistent — 61 files in the repo use `ppm·h` / `ppmHours` style labeling. |
| Colorimetry math (gamma, D65, CIELAB) | Verified correct: IEC 61966-2-1 gamma decode, standard sRGB→XYZ D65 matrix, CIE 1976 Lab formula, and a full CIEDE2000 (ISO/CIE 11664-6:2014) implementation are all present and match the standard formulas. |
| `validators.ts` file | Does not exist under this name; input validation is handled inline in components — not a blocker, just a naming mismatch with the prompt's assumed layout. |

## Real gaps found and fixed in this pass

1. **No Indian regulatory citation (IS-5780:1980 / DGMS / Factories Act 1948).**
   Only OSHA / NIOSH / ACGIH figures were cited (`lib/calibrationData.ts`, `README.md`).
   **Fixed:** added explicit regulatory-scope notes in both files stating that OSHA/NIOSH/ACGIH
   values are retained as comparative benchmarks, and that IS-5780:1980 / Factories Act 1948
   Schedule II / DGMS circulars are the applicable Indian statutory references.
   **Not fabricated:** the exact numeric IS-5780:1980 thresholds were not available to verify in
   this session, so they are marked `[OPEN]` rather than invented — inventing plausible-looking
   numbers would have been less accurate than leaving this flagged.

2. **Calibration anchors had no provenance tags.**
   `lib/calibrationData.ts`'s 6 anchors had hex/Lab/OD values with no indication of what was
   bench-measured vs. modeled. There *is* real experimental grounding for this app
   (`data/lab_manual_strips/` — 5 trial-strip photos; `calibration_plots/lead_acetate_experimental_calibration.{png,svg}`),
   so the prior "everything is synthetic" assumption in the audit prompt was also inaccurate.
   **Fixed:** tagged anchors 1–4 (0–19.9 ppm range) `[SOURCED]`, pointing at the specific trial
   images, and anchors 5–6 (35, 100 ppm) `[ESTIMATE]`, since 100 ppm IDLH conditions are not
   safely reproducible on an unventilated bench and are a modeled extrapolation.

3. **No "prototype / pending lab validation" disclaimer visible in the app.**
   **Fixed:** added a visible banner on the landing page (`app/page.tsx`) stating calibration
   status, that shelf-life (target 30–90 days) is `[OPEN]`/untested, that the reading is a
   cumulative dose (ppm·hours) not instantaneous concentration, and that the device is
   complementary to, not a replacement for, certified real-time electronic H₂S detectors.

## Verified working (build + manual code read, not a live browser session)

- `npm install` — all dependencies resolve cleanly, no missing packages.
- `npm run build` — **passes with 0 errors, 0 warnings** after the changes above.
- Worker capture flow, reticle overlay, retake/analyze, risk classification (SAFE → CRITICAL),
  and the Supervisor dashboard (charts/heatmap/table) all exist and compile; a live browser
  click-through was not performed in this session — treat the "manual feature testing" checklist
  in the original prompt as still open if you need that level of sign-off.

## Out of scope in this pass

`backend/`, `dashboard/`, `mobile-app/`, and `h2s_dosimeter/` are full additional services (Node
API + MongoDB models, a separate Vite/React EHS dashboard, a separate mobile PWA, and a Python
calibration/ML package) that did not exist in the shape the audit prompt assumed. They contain
their own OSHA references and their own (intentional, documented) Cu-PAN comparison model. A
global find-and-replace of OSHA/Cu-PAN across those 70+ files was judged too risky to do
"as fast as possible" without breaking working functionality or contradicting features those
services intentionally implement (e.g., the dashboard's `CuPanReferenceScale` and `DGMSReport`
pages). Recommend a dedicated follow-up pass scoped to each service if full-repo standardization
is required before judging.
