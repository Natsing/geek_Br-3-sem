"""Contract tests for the approved DocBratus v8 hero.

These tests catch a regression where the approved hero no longer renders its
required content, CTA anchors, source assets, or where a hero edit reaches
the lower page sections.
"""

from __future__ import annotations

import hashlib
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "site" / "index.html"
APPROACH_MARKER = "<!-- ============ APPROACH"
EXPECTED_TAIL_SHA256 = "f9621d63b2ef40eab5b0e72e8e48abd342a8e1418781f773869997e114fff9d7"
ASSET_SHA256 = {
    "doctor-clinic.jpg": "36721f59678b3d5a1b766badb2c575122747acbca9f2d983be89571c63f899c6",
    "doctor-cutout.png": "b061cf8b19a1719ccc0f9ec82ef3682ffc549ae4fd841b26f0d475a9841f2c25",
}


class ApprovedHeroContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.html = HTML_PATH.read_text(encoding="utf-8")
        hero_start = cls.html.index("<!-- ============ HERO")
        hero_end = cls.html.index(APPROACH_MARKER)
        cls.hero = cls.html[hero_start:hero_end]

    def test_approved_hero_content_and_structure_are_present(self) -> None:
        required_classes = (
            "hero",
            "hero-copy",
            "hero-visual",
            "hero-photo-bg",
            "hero-person",
            "experience-badge",
            "hero-trust",
            "media-chip",
        )
        required_text = (
            "Доктор Михаил Братусь",
            "ВРАЧ-РЕАБИЛИТОЛОГ · МОСКВА",
            "Верну вас",
            "к жизни",
            "без боли",
            "5,0",
            "Главный врач",
            "МЦ «СМП-Мед»",
            "Медицинский эксперт",
            "НТВ · «За гранью»",
            "Пятый канал · «Ваше здоровье»",
        )

        for class_name in required_classes:
            self.assertRegex(self.html, rf'class="[^"]*\b{re.escape(class_name)}\b')
        self.assertRegex(self.html, r'DOC\s*<span>BRATUS</span>')
        for text in required_text:
            self.assertIn(text, self.html)
        self.assertIn('src="doctor-clinic.jpg"', self.hero)
        self.assertIn('src="doctor-cutout.png"', self.hero)

    def test_hero_contains_both_approved_anchor_actions(self) -> None:
        self.assertIn('href="#booking"', self.hero)
        self.assertIn('href="#results"', self.hero)

    def test_lower_page_html_is_unchanged_from_approach_marker(self) -> None:
        tail = self.html[self.html.index(APPROACH_MARKER) :]
        self.assertEqual(hashlib.sha256(tail.encode("utf-8")).hexdigest(), EXPECTED_TAIL_SHA256)

    def test_approved_assets_are_copied_without_changes(self) -> None:
        for filename, expected_hash in ASSET_SHA256.items():
            asset = ROOT / "site" / filename
            self.assertTrue(asset.is_file(), f"Missing approved hero asset: {filename}")
            self.assertEqual(hashlib.sha256(asset.read_bytes()).hexdigest(), expected_hash)


if __name__ == "__main__":
    unittest.main()
