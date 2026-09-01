"""Pytest suite for Colorimetry modules conforming to CIE 015, ISO 17321-1, and ISO/CIE 11664-6."""

import pytest
import numpy as np

from ..colorimetry.linear_rgb import srgb_to_linear, linear_to_srgb
from ..colorimetry.rgb_to_xyz import rgb_to_xyz, xyz_to_rgb, SRGB_D65_MATRIX
from ..colorimetry.chromatic_adaptation import bradford_adaptation, M_BRADFORD, ILLUMINANTS
from ..colorimetry.xyz_to_lab import xyz_to_lab, lab_to_xyz, WHITE_POINT_D65
from ..colorimetry.delta_e import ciede2000


def test_srgb_linearization_roundtrip():
    """Verify IEC 61966-2-1 inverse/forward gamma roundtrip."""
    test_vals = np.array([0, 10, 50, 128, 200, 255], dtype=np.float64)
    linear = srgb_to_linear(test_vals)
    recon = linear_to_srgb(linear, to_255=True)
    np.testing.assert_allclose(recon, test_vals, atol=1.0)


def test_srgb_linearization_analytical():
    """Verify exact piecewise threshold in sRGB linearization."""
    # Value below 0.04045 threshold: 10/255 ≈ 0.0392157
    val_low = np.array([10.0 / 255.0])
    lin_low = srgb_to_linear(val_low)
    expected_low = (10.0 / 255.0) / 12.92
    assert pytest.approx(lin_low[0], abs=1e-5) == expected_low

    # Value above 0.04045 threshold: 128/255 ≈ 0.50196
    val_high = np.array([128.0 / 255.0])
    lin_high = srgb_to_linear(val_high)
    expected_high = ((val_high[0] + 0.055) / 1.055) ** 2.4
    assert pytest.approx(lin_high[0], abs=1e-5) == expected_high


def test_rgb_to_xyz_white_mapping():
    """Verify D65 white linear RGB [1, 1, 1] maps to standard D65 XYZ [0.95047, 1.0, 1.08883]."""
    white_lin = np.array([1.0, 1.0, 1.0])
    xyz = rgb_to_xyz(white_lin, ccm=SRGB_D65_MATRIX)
    np.testing.assert_allclose(xyz, WHITE_POINT_D65, rtol=1e-3)


def test_xyz_to_lab_white_point():
    """Verify D65 white point maps to Lab [100.0, 0.0, 0.0]."""
    lab = xyz_to_lab(WHITE_POINT_D65, white_point=WHITE_POINT_D65)
    assert pytest.approx(lab[0], abs=1e-2) == 100.0
    assert pytest.approx(lab[1], abs=1e-2) == 0.0
    assert pytest.approx(lab[2], abs=1e-2) == 0.0


def test_xyz_to_lab_roundtrip():
    """Verify XYZ -> Lab -> XYZ roundtrip conversion."""
    sample_xyz = np.array([0.25, 0.30, 0.15])
    lab = xyz_to_lab(sample_xyz)
    recon_xyz = lab_to_xyz(lab)
    np.testing.assert_allclose(recon_xyz, sample_xyz, rtol=1e-4)


def test_bradford_adaptation_identity():
    """Verify Bradford adaptation with identical white points returns unchanged XYZ."""
    sample_xyz = np.array([0.40, 0.45, 0.30])
    adapted = bradford_adaptation(sample_xyz, white_source="D65", white_target="D65")
    np.testing.assert_allclose(adapted, sample_xyz, atol=1e-6)


def test_ciede2000_identical_colors():
    """Verify CIEDE2000 of identical color coordinates is 0.0."""
    lab = (50.0, 10.0, -20.0)
    assert ciede2000(lab, lab) == 0.0


def test_ciede2000_sharma_reference_vectors():
    """Verify CIEDE2000 against published Sharma et al. (2005) reference test vectors."""
    # Test Pair 1: Sharma et al. (2005) Pair #1
    # Standard: [50.0000, 2.6772, -79.7751], Sample: [50.0000, 0.0000, -82.7485]
    # Expected ΔE00 = 2.0425
    lab_std_1 = [50.0000, 2.6772, -79.7751]
    lab_smp_1 = [50.0000, 0.0000, -82.7485]
    delta_e_1 = ciede2000(lab_std_1, lab_smp_1)
    assert pytest.approx(delta_e_1, abs=0.001) == 2.0425

    # Test Pair 2: Sharma et al. (2005) Pair #2
    # Standard: [50.0000, 3.1571, -77.2803], Sample: [50.0000, 0.0000, -82.7485]
    # Expected ΔE00 = 2.8615
    lab_std_2 = [50.0000, 3.1571, -77.2803]
    lab_smp_2 = [50.0000, 0.0000, -82.7485]
    delta_e_2 = ciede2000(lab_std_2, lab_smp_2)
    assert pytest.approx(delta_e_2, abs=0.001) == 2.8615
