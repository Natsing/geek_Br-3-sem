"""Contract tests for the approved DocBratus booking-contact corrections."""

from __future__ import annotations

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


if __name__ == "__main__":
    unittest.main()
