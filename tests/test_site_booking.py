"""Contract tests for the approved DocBratus booking-contact corrections."""

from __future__ import annotations

import hashlib
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "site" / "index.html"


class BookingContactContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.html = HTML_PATH.read_text(encoding="utf-8")

    def test_booking_uses_the_personal_telegram_account(self) -> None:
        self.assertNotIn("https://t.me/Doc_Bratus", self.html)
        self.assertNotIn("@Doc_Bratus", self.html)
        self.assertEqual(self.html.count("https://t.me/DocBratus"), 3)
        self.assertGreaterEqual(self.html.count("@DocBratus"), 2)

    def test_removed_smp_med_address_is_not_shown(self) -> None:
        self.assertNotIn("Старокачаловская", self.html)
        self.assertIn('МЦ «СМП-Мед» (ул. Планерная, 7к1)', self.html)

    def test_booking_rows_use_the_approved_brand_marks(self) -> None:
        booking_start = self.html.index("<!-- ============ BOOKING")
        booking_end = self.html.index("</main>", booking_start)
        booking = self.html[booking_start:booking_end]

        self.assertIn('src="logos/la-salute-icon.png"', booking)
        self.assertIn('src="logos/smp-med-icon.png"', booking)
        self.assertIn('class="max-wordmark"', booking)
        self.assertIn('<span>DOC</span><span>BRATUS</span>', booking)
        self.assertNotIn('<div class="contact-ico max">M</div>', booking)
        self.assertNotIn('<div class="contact-ico clinic"><svg', booking)

        self.assertTrue((ROOT / "site" / "logos" / "la-salute-icon.png").is_file())
        self.assertTrue((ROOT / "site" / "logos" / "smp-med-icon.png").is_file())

    def test_smp_med_mark_uses_the_approved_centered_asset(self) -> None:
        path = ROOT / "site" / "logos" / "smp-med-icon.png"
        self.assertEqual(
            hashlib.sha256(path.read_bytes()).hexdigest(),
            "c4c0aa6fbeb8c3c6cf08bd023397641483e997b405c73d9cad5701848f7bf2ce",
        )


if __name__ == "__main__":
    unittest.main()
