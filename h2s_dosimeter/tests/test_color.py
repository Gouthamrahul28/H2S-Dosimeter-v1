"""
h2s_dosimeter.tests.test_color
==============================
Unit tests for colorimetric transformations:
- sRGB linearization and forward gamma roundtrip
- Camera Color Correction Matrix (CCM) application and inversion
- Bradford Chromatic Adaptation Transform (CAT)
- Standard CIE 1976 XYZ to CIELAB transformations
- CIEDE2000 (ΔE00) verification against published standard test vectors
"""

import numpy as np
import pytest

from ..color.linear_rgb import (
    srgb_to_linear,
    linear_to_srgb,
    normalize_8bit_to_unit,
    unit_to_8bit
)
from ..color.rgb_xyz import (
    linear_rgb_to_xyz,
    xyz_to_linear_rgb,
    DEFAULT_SRGB_TO_XYZ_MATRIX
)
from ..color.bradford import (
    bradford_adaptation,
    get_bradford_cat_matrix,
    D65_WHITE_POINT,
    D50_WHITE_POINT
)
from ..color.lab import xyz_to_lab, lab_to_xyz
from ..color.delta_e import ciede2000


class TestLinearRGB:
    """Tests for sRGB <-> Linear RGB conversions."""

    def test_srgb_linear_roundtrip(self):
        """Verify that forward and inverse gamma roundtrips with negligible numerical error."""
        srgb_test = np.linspace(0.0, 1.0, 256)
        linear = srgb_to_linear(srgb_test)
        srgb_recovered = linear_to_srgb(linear)
        np.testing.assert_allclose(srgb_test, srgb_recovered, atol=1e-5)

    def test_srgb_piecewise_threshold(self):
        """Verify exact piecewise transition threshold (0.04045)."""
        c_low = 0.03
        c_high = 0.50
        
        lin_low = srgb_to_linear(c_low)
        lin_high = srgb_to_linear(c_high)
        
        assert abs(lin_low - (c_low / 12.92)) < 1e-7
        assert abs(lin_high - (((c_high + 0.055) / 1.055) ** 2.4)) < 1e-7

    def test_8bit_conversion(self):
        """Verify 8-bit normalization and recovery."""
        rgb_8bit = [255, 128, 0]
        norm = normalize_8bit_to_unit(rgb_8bit)
        recovered = unit_to_8bit(norm)
        np.testing.assert_array_equal(rgb_8bit, recovered)


class TestRGBXYZ:
    """Tests for Linear RGB <-> XYZ conversions."""

    def test_white_point_mapping(self):
        """Linear unit white [1, 1, 1] under default sRGB matrix must map to standard D65 white."""
        unit_white = np.array([1.0, 1.0, 1.0])
        xyz_white = linear_rgb_to_xyz(unit_white)
        # Sum of row 1 (X) = 0.95047, row 2 (Y) = 1.00000, row 3 (Z) = 1.08883
        np.testing.assert_allclose(xyz_white, D65_WHITE_POINT, atol=1e-4)

    def test_xyz_roundtrip(self):
        """Verify RGB -> XYZ -> RGB roundtrip."""
        rgb_in = np.array([0.45, 0.65, 0.85])
        xyz = linear_rgb_to_xyz(rgb_in)
        rgb_out = xyz_to_linear_rgb(xyz)
        np.testing.assert_allclose(rgb_in, rgb_out, atol=1e-5)

    def test_batch_dimensions(self):
        """Verify support for batch 2D and 3D image arrays."""
        img = np.random.uniform(0.0, 1.0, size=(10, 20, 3))
        xyz_img = linear_rgb_to_xyz(img)
        assert xyz_img.shape == (10, 20, 3)


class TestBradfordAdaptation:
    """Tests for Bradford Chromatic Adaptation Transform."""

    def test_identity_adaptation(self):
        """Adapting from D65 to D65 must return identical XYZ coordinates."""
        xyz_sample = np.array([0.40, 0.50, 0.60])
        xyz_adapted = bradford_adaptation(
            xyz_camera=xyz_sample,
            src_white=D65_WHITE_POINT,
            ref_white=D65_WHITE_POINT
        )
        np.testing.assert_allclose(xyz_sample, xyz_adapted, atol=1e-6)

    def test_white_point_transduction(self):
        """Adapting the source white point W_src must yield the target reference white point W_ref."""
        w_src = np.array([1.05, 1.00, 0.70])  # Warm illuminant
        w_ref = D65_WHITE_POINT
        w_adapted = bradford_adaptation(xyz_camera=w_src, src_white=w_src, ref_white=w_ref)
        np.testing.assert_allclose(w_adapted, w_ref, atol=1e-5)

    def test_numerical_singularity_guard(self):
        """Verify CAT handles near-zero/zero white points gracefully without zero-division exceptions."""
        w_zero = np.array([0.0, 0.0, 0.0])
        sample = np.array([0.1, 0.1, 0.1])
        res = bradford_adaptation(sample, src_white=w_zero, ref_white=D65_WHITE_POINT)
        assert not np.isnan(res).any()
        assert not np.isinf(res).any()


class TestCIELAB:
    """Tests for CIE 1976 XYZ to CIELAB transformations."""

    def test_d65_white_is_pure_100_lightness(self):
        """Standard D65 reference white must produce L*=100.0, a*=0.0, b*=0.0."""
        lab_white = xyz_to_lab(D65_WHITE_POINT, white_point=D65_WHITE_POINT)
        np.testing.assert_allclose(lab_white, [100.0, 0.0, 0.0], atol=1e-3)

    def test_black_is_zero_lightness(self):
        """Zero XYZ must produce L*=0.0, a*=0.0, b*=0.0."""
        lab_black = xyz_to_lab([0.0, 0.0, 0.0], white_point=D65_WHITE_POINT)
        np.testing.assert_allclose(lab_black, [0.0, 0.0, 0.0], atol=1e-3)

    def test_lab_roundtrip(self):
        """Verify XYZ <-> CIELAB roundtrip across random test points."""
        lab_target = np.array([55.4, 14.2, -22.8])
        xyz = lab_to_xyz(lab_target, white_point=D65_WHITE_POINT)
        lab_recovered = xyz_to_lab(xyz, white_point=D65_WHITE_POINT)
        np.testing.assert_allclose(lab_target, lab_recovered, atol=1e-4)


class TestCIEDE2000:
    """
    Verification of CIEDE2000 against standard test pairs from:
    Sharma, Wu, Dalal, Color Research & Application (2005).
    """

    def test_identical_colors(self):
        """ΔE00 of identical colors must be exactly 0.0."""
        lab = [60.0, 12.0, -15.0]
        assert ciede2000(lab, lab) == 0.0

    def test_sharma_pair_1(self):
        """Sharma et al. 2005 Pair 1."""
        lab1 = [50.0000, 2.6772, -79.7751]
        lab2 = [50.0000, 0.0000, -82.7485]
        expected_de00 = 2.0425
        res = ciede2000(lab1, lab2)
        assert abs(res - expected_de00) < 0.001

    def test_sharma_pair_2(self):
        """Sharma et al. 2005 Pair 2."""
        lab1 = [50.0000, 3.1571, -77.2803]
        lab2 = [50.0000, 0.0000, -82.7485]
        expected_de00 = 2.8615
        res = ciede2000(lab1, lab2)
        assert abs(res - expected_de00) < 0.001

    def test_sharma_pair_near_grey(self):
        """Sharma et al. 2005 Pair 21 (near neutral gray axis)."""
        lab1 = [50.0000, 2.5000, 0.0000]
        lab2 = [73.0000, 25.0000, -18.0000]
        expected_de00 = 27.1492
        res = ciede2000(lab1, lab2)
        assert abs(res - expected_de00) < 0.005

    def test_batch_computation(self):
        """Verify vectorization over array pairs."""
        labs1 = np.array([
            [50.0, 2.6772, -79.7751],
            [50.0, 3.1571, -77.2803]
        ])
        labs2 = np.array([
            [50.0, 0.0000, -82.7485],
            [50.0, 0.0000, -82.7485]
        ])
        results = ciede2000(labs1, labs2)
        assert len(results) == 2
        assert abs(results[0] - 2.0425) < 0.001
        assert abs(results[1] - 2.8615) < 0.001
