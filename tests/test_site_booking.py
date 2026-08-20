"""Contract tests for the approved DocBratus booking-contact corrections."""

from __future__ import annotations

import hashlib
import json
import subprocess
import textwrap
import unittest
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "site" / "index.html"
METRIKA_SCRIPT_PATH = ROOT / "site" / "booking-metrika.js"


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

    def test_booking_metrika_script_is_loaded(self) -> None:
        self.assertTrue(
            METRIKA_SCRIPT_PATH.is_file(),
            "The booking-goal script must ship with the published site",
        )
        self.assertIn(
            '<script defer src="booking-metrika.js"></script>',
            self.html,
        )

    def test_booking_metrika_script_sends_the_selected_goal(self) -> None:
        runner = textwrap.dedent(
            """
            const fs = require('fs');
            const vm = require('vm');
            let clickHandler;
            const calls = [];
            const document = {
              addEventListener: (name, handler) => {
                if (name === 'click') clickHandler = handler;
              }
            };
            const window = {ym: (...args) => calls.push(args)};

            vm.runInNewContext(fs.readFileSync(process.argv[1], 'utf8'), {document, window});
            if (typeof clickHandler !== 'function') {
              throw new Error('booking click handler was not registered');
            }

            const link = {
              getAttribute: (name) => name === 'data-metrika-goal' ? 'click_telegram' : null
            };
            const child = {
              closest: (selector) => selector === '[data-metrika-goal]' ? link : null
            };
            clickHandler({target: child});
            process.stdout.write(JSON.stringify(calls));
            """
        )
        completed = subprocess.run(
            ["node", "-e", runner, str(METRIKA_SCRIPT_PATH)],
            check=False,
            capture_output=True,
            text=True,
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual(
            json.loads(completed.stdout),
            [[109936294, "reachGoal", "click_telegram"]],
        )

    def test_every_booking_channel_link_has_its_goal(self) -> None:
        class LinkParser(HTMLParser):
            def __init__(self) -> None:
                super().__init__()
                self.links: list[dict[str, str]] = []

            def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
                if tag == "a":
                    self.links.append({key: value or "" for key, value in attrs})

        expected = {
            "https://t.me/DocBratus": ("click_telegram", 3),
            "tel:+79657616543": ("click_phone", 2),
            "https://max.ru/u/f9LHodD0cOIYP3iUbW0GfaIq2jl4-wySOhNgUIDmhHStp5VsUGOHNSoeUzE": ("click_max", 2),
            "https://lasalute-clinic.ru/team/bratus-mihail-andreevich": ("click_lasalute", 2),
            "https://klientiks.ru/app2/OOOSMPMED": ("click_smp_med", 2),
        }
        parser = LinkParser()
        parser.feed(self.html)

        for href, (goal, expected_count) in expected.items():
            matching = [link for link in parser.links if link.get("href") == href]
            self.assertEqual(len(matching), expected_count, href)
            self.assertTrue(
                all(link.get("data-metrika-goal") == goal for link in matching),
                f"Every {href} link must send {goal}",
            )


if __name__ == "__main__":
    unittest.main()
