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

    def test_header_cta_uses_the_approved_scoped_metrics(self) -> None:
        expected_rule = (
            ".nav-cta .btn{padding:12px 20px;border:0;border-radius:11px;"
            "font-size:16px;font-weight:800;line-height:1;"
            "box-shadow:0 8px 18px rgba(55,152,199,.2)}"
        )

        self.assertIn(expected_rule, self.html)
        self.assertIn(".nav-cta .btn:not(.burger){display:none}", self.html)

    def test_hero_eyebrow_and_lead_override_legacy_metrics(self) -> None:
        eyebrow_rule = (
            ".hero .eyebrow{padding:7px 13px;border:1px solid #7abddd;"
            "color:#2184b6;background:rgba(255,255,255,.7);font-size:10px;"
            "font-weight:850;letter-spacing:.11em;line-height:normal;margin-bottom:0}"
        )
        lead_rule = ".hero-sub{max-width:480px;color:#315675;font-size:15px;line-height:1.48;margin:0}"
        mobile_start = self.html.rindex("@media (max-width:760px){")
        mobile_end = self.html.index("\n}\n\n.ico", mobile_start)
        mobile_rules = self.html[mobile_start:mobile_end]

        self.assertIn(eyebrow_rule, self.html)
        self.assertIn(lead_rule, self.html)
        self.assertIn(".hero-sub strong{color:var(--blue);font-weight:850}", self.html)
        self.assertIn(".hero .eyebrow{padding:5px 8px;font-size:", mobile_rules)
        self.assertIn(".hero-sub{font-size:", mobile_rules)

    def test_hero_copy_tracks_nav_alignment_on_wide_desktops(self) -> None:
        expected_rule = (
            ".hero-copy{position:relative;z-index:4;width:55%;"
            "padding:39px 24px 24px max(28px,calc((100vw - var(--maxw))/2 + 28px))}"
        )
        expected_left_insets = {956: 28, 1440: 178}

        self.assertIn(expected_rule, self.html)
        for viewport, expected in expected_left_insets.items():
            calculated = max(28, (viewport - 1140) / 2 + 28)
            self.assertEqual(calculated, expected)

        mobile_start = self.html.rindex("@media (max-width:760px){")
        mobile_end = self.html.index("\n}\n\n.ico", mobile_start)
        mobile_rules = self.html[mobile_start:mobile_end]
        self.assertIn(".hero-copy{order:1;width:auto;padding:16px 14px 8px}", mobile_rules)

    def test_v8_color_tokens_are_scoped_to_nav_and_hero(self) -> None:
        root_start = self.html.index(":root{")
        root_end = self.html.index("\n}", root_start)
        root_rules = self.html[root_start:root_end]

        self.assertIn(".nav,.hero{--navy:#173b64;--blue:#3798c7;--muted:#55708b}", self.html)
        self.assertIn("--navy:#0f3457", root_rules)
        self.assertIn("--blue:#2196c4", root_rules)
        self.assertIn("--muted:#5a7a92", root_rules)

    def test_experience_badge_is_exposed_to_assistive_technology(self) -> None:
        visual_tag = re.search(r'<div class="hero-visual"[^>]*>', self.hero)

        self.assertIsNotNone(visual_tag)
        self.assertNotIn("aria-hidden", visual_tag.group(0))
        self.assertIn("<strong>7+</strong><span>лет практики</span>", self.hero)
        self.assertIn('class="hero-photo-bg" src="doctor-clinic.jpg" alt=""', self.hero)
        self.assertIn('class="hero-person" src="doctor-cutout.png" alt=""', self.hero)

    def test_headline_and_responsive_layout_match_the_v8_composition(self) -> None:
        """Catch the geometry regressions in the approved desktop/mobile hero."""
        mobile_start = self.html.rindex("@media (max-width:760px){")
        mobile_end = self.html.index("\n}\n\n.ico", mobile_start)
        mobile_rules = self.html[mobile_start:mobile_end]

        self.assertRegex(self.hero, r"<h1>Верну вас<br\s*/?>\s*к жизни")
        self.assertNotIn('class="container hero-copy', self.hero)
        self.assertIn(".hero{min-height:730px", self.html)
        self.assertIn(".hero h1{margin:19px 0 14px;font-size:57px", self.html)
        self.assertIn(".hero{display:flex;flex-direction:column", mobile_rules)
        self.assertIn(".hero-copy{order:1", mobile_rules)
        self.assertIn(".hero-visual{position:relative;order:2", mobile_rules)
        self.assertIn(".hero-cta{display:grid;grid-template-columns:1fr", mobile_rules)
        self.assertIn(".hero-cta .btn{width:100%", mobile_rules)

    def test_v8_micro_layout_css_is_scoped_for_desktop_and_mobile(self) -> None:
        """Protect the v8 wordmark, trust-card density, and breakpoint resets."""
        mobile_start = self.html.rindex("@media (max-width:760px){")
        mobile_end = self.html.index("\n}\n\n.ico", mobile_start)
        mobile_rules = self.html[mobile_start:mobile_end]

        self.assertIn(".nav-inner{display:flex;align-items:center;justify-content:space-between;height:80px;padding:0 28px}", self.html)
        self.assertIn(".nav .logo-text .wordmark span{font-size:inherit;font-weight:inherit;letter-spacing:inherit;text-transform:inherit;color:var(--blue)}", self.html)
        self.assertIn("line-height:normal;margin-bottom:0}", self.html)
        self.assertIn(".hero-trust{width:490px;margin-top:20px}", self.html)
        self.assertIn(".trust-title,.credential-title,.media-chip{line-height:1.15}", self.html)
        self.assertIn(".trust-sub{margin-top:3px;color:var(--muted);font-size:9.5px;line-height:1.2}", self.html)
        self.assertIn(".nav-inner{height:72px;padding:0 14px}", mobile_rules)
        self.assertIn(".hero-trust{width:auto;max-width:100%;margin-top:9px}", mobile_rules)

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
