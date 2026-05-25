"""Vendor normalization and merchant fingerprinting tests."""

from __future__ import annotations

from ledgerlens.services.vendor_normalization import (
    AMBIGUOUS_VENDORS,
    detect_vendor_family,
    is_ambiguous_vendor,
    merchant_fingerprint,
    normalize_merchant_name,
    strip_payment_noise,
)


class TestStripPaymentNoise:
    def test_ach_prefix(self) -> None:
        assert strip_payment_noise("ACH DEBIT EVERSOURCE ENERGY") == "EVERSOURCE ENERGY"

    def test_debit_card_purchase_prefix(self) -> None:
        assert strip_payment_noise("DEBIT CARD PURCHASE SHELL OIL 1234") == "SHELL OIL 1234"

    def test_pos_prefix(self) -> None:
        assert strip_payment_noise("POS PURCHASE NAPA AUTO PARTS") == "NAPA AUTO PARTS"

    def test_sq_prefix(self) -> None:
        assert strip_payment_noise("SQ *JOES COFFEE SHOP") == "JOES COFFEE SHOP"

    def test_tst_prefix(self) -> None:
        result = strip_payment_noise("TST* TOAST TAB #1234")
        assert "TOAST TAB" in result
        assert "TST*" not in result

    def test_web_prefix(self) -> None:
        assert strip_payment_noise("WEB PAYMENT GEICO") == "PAYMENT GEICO"

    def test_trailing_store_number(self) -> None:
        result = strip_payment_noise("STAPLES STORE #1234")
        assert "#1234" not in result
        assert "STAPLES" in result

    def test_trailing_ref(self) -> None:
        result = strip_payment_noise("ADP PAYROLL REF:ABC123")
        assert "REF" not in result
        assert "ADP" in result

    def test_trailing_zip(self) -> None:
        result = strip_payment_noise("STARBUCKS COFFEE NH 03301")
        assert "03301" not in result
        assert "STARBUCKS" in result

    def test_trailing_long_number(self) -> None:
        result = strip_payment_noise("STRIPE TRANSFER 8765432109")
        assert "8765432109" not in result
        assert "STRIPE" in result

    def test_trailing_date(self) -> None:
        result = strip_payment_noise("COMCAST PAYMENT 03/15/2026")
        assert "03/15/2026" not in result

    def test_preserves_meaningful_content(self) -> None:
        assert strip_payment_noise("NAPA AUTO PARTS") == "NAPA AUTO PARTS"

    def test_empty_string(self) -> None:
        assert strip_payment_noise("") == ""


class TestNormalizeMerchantName:
    def test_uppercases(self) -> None:
        assert normalize_merchant_name("napa auto parts") == "NAPA AUTO PARTS"

    def test_strips_noise_and_special_chars(self) -> None:
        result = normalize_merchant_name("ACH DEBIT EVERSOURCE ENERGY #12345")
        assert result == "EVERSOURCE ENERGY"

    def test_collapses_whitespace(self) -> None:
        result = normalize_merchant_name("SHELL   OIL   STATION")
        assert result == "SHELL OIL STATION"

    def test_removes_special_chars(self) -> None:
        result = normalize_merchant_name("O'REILLY AUTO PARTS")
        assert "REILLY AUTO PARTS" in result
        assert "'" not in result

    def test_messy_bank_description(self) -> None:
        raw = "POS PURCHASE AUTOZONE COMMERCIAL #4567 NH 03301"
        result = normalize_merchant_name(raw)
        assert "AUTOZONE" in result
        assert "#4567" not in result
        assert "03301" not in result


class TestMerchantFingerprint:
    def test_uses_merchant_when_provided(self) -> None:
        fp = merchant_fingerprint("ACH DEBIT ADP PAYROLL", merchant="ADP")
        assert fp == "ADP"

    def test_falls_back_to_description(self) -> None:
        fp = merchant_fingerprint("ACH DEBIT ADP PAYROLL")
        assert "ADP" in fp

    def test_stable_across_noise_variants(self) -> None:
        fp1 = merchant_fingerprint("NAPA AUTO PARTS #1234 NH 03301")
        fp2 = merchant_fingerprint("POS NAPA AUTO PARTS STORE #5678")
        assert "NAPA" in fp1
        assert "NAPA" in fp2


class TestDetectVendorFamily:
    def test_napa(self) -> None:
        match = detect_vendor_family("NAPA AUTO PARTS #1234")
        assert match is not None
        assert match.family == "NAPA"

    def test_autozone(self) -> None:
        match = detect_vendor_family("AUTOZONE COMMERCIAL #456")
        assert match is not None
        assert match.family == "AUTOZONE"

    def test_adp(self) -> None:
        match = detect_vendor_family("ADP PAYROLL PROCESSING")
        assert match is not None
        assert match.family == "ADP"

    def test_eversource(self) -> None:
        match = detect_vendor_family("EVERSOURCE ENERGY PAYMENT")
        assert match is not None
        assert match.family == "EVERSOURCE"

    def test_comcast(self) -> None:
        match = detect_vendor_family("COMCAST BUSINESS INTERNET")
        assert match is not None
        assert match.family == "COMCAST"

    def test_amazon(self) -> None:
        match = detect_vendor_family("AMZN MKTP US*AB1CD2EF3")
        assert match is not None
        assert match.family == "AMAZON"

    def test_stripe(self) -> None:
        match = detect_vendor_family("STRIPE TRANSFER")
        assert match is not None
        assert match.family == "STRIPE"

    def test_square(self) -> None:
        match = detect_vendor_family("SQ *JOES GARAGE")
        assert match is not None
        assert match.family == "SQUARE"

    def test_uber_eats_before_uber(self) -> None:
        match = detect_vendor_family("UBER EATS ORDER")
        assert match is not None
        assert match.family == "UBER_EATS"

    def test_uber_ride(self) -> None:
        match = detect_vendor_family("UBER TRIP HELP.UBER.COM")
        assert match is not None
        assert match.family == "UBER"

    def test_unknown_vendor(self) -> None:
        match = detect_vendor_family("RANDOM LOCAL SHOP ABC")
        assert match is None

    def test_waste_management(self) -> None:
        match = detect_vendor_family("WASTE MANAGEMENT RESIDENTIAL")
        assert match is not None
        assert match.family == "WASTE_MANAGEMENT"

    def test_insurance_hanover(self) -> None:
        match = detect_vendor_family("HANOVER INSURANCE GROUP")
        assert match is not None
        assert match.family == "HANOVER_INSURANCE"

    def test_fuel_irving(self) -> None:
        match = detect_vendor_family("IRVING OIL STATION")
        assert match is not None
        assert match.family == "IRVING"


class TestAmbiguousVendor:
    def test_amazon_is_ambiguous(self) -> None:
        assert is_ambiguous_vendor("AMAZON")

    def test_home_depot_is_ambiguous(self) -> None:
        assert is_ambiguous_vendor("HOME_DEPOT")

    def test_napa_is_not_ambiguous(self) -> None:
        assert not is_ambiguous_vendor("NAPA")

    def test_none_is_not_ambiguous(self) -> None:
        assert not is_ambiguous_vendor(None)

    def test_ambiguous_set_is_frozen(self) -> None:
        assert isinstance(AMBIGUOUS_VENDORS, frozenset)
