"""Public page contracts for the author-approved award and original certificate."""
import hashlib
from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class Nodes(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.nodes = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.nodes.append((tag, dict(attrs)))


class WebsiteAwardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (ROOT / "site/index.html").read_text()
        cls.nodes = Nodes(cls.html).nodes

    def test_home_award_link_reaches_existing_about_without_replacing_booking(self):
        cards = [a for tag, a in self.nodes if tag == "a" and "award-card" in a.get("class", "").split()]
        self.assertEqual(len(cards), 1, "Missing approved award navigation card")
        self.assertEqual(cards[0]["href"], "#about")
        self.assertIn(("section", {"class": "section", "id": "about", "aria-labelledby": "bio-title"}), self.nodes)
        self.assertIn('href="#booking" class="btn btn-primary btn-lg"', self.html)
        self.assertIn('id="booking"', self.html)

    def test_certificate_has_fullsize_nojs_fallback_and_identified_dialog(self):
        links = [a for tag, a in self.nodes if tag == "a" and "cert-button" in a.get("class", "").split()]
        self.assertEqual(len(links), 1, "Missing full-size certificate fallback")
        self.assertEqual(links[0]["href"], "award-prodoctorov-2026.jpg")
        images = [a for tag, a in self.nodes if tag == "img" and a.get("id") == "award-img"]
        self.assertEqual(len(images), 1)
        self.assertEqual((images[0]["width"], images[0]["height"]), ("3555", "2528"))
        self.assertEqual(images[0]["src"], links[0]["href"])
        self.assertIn("Москвы", images[0]["alt"])
        self.assertTrue(any(tag == "dialog" and a.get("id") == "cert-view" and a.get("aria-label") for tag, a in self.nodes))

    def test_award_exposes_provenance_and_original_image(self):
        self.assertIn("Рейтинг на 1 ноября 2026 года", self.html)
        self.assertTrue(any(tag == "a" and a.get("href") == "https://prodoctorov.ru/moskva/vrach/882297-bratus/" and a.get("target") == "_blank" and "noopener" in a.get("rel", "") for tag, a in self.nodes))
        image = ROOT / "site/award-prodoctorov-2026.jpg"
        self.assertTrue(image.is_file(), "Missing original certificate file")
        original = ROOT.parent / "output/award-2026/certificate.jpg"
        self.assertEqual(hashlib.sha256(image.read_bytes()).digest(), hashlib.sha256(original.read_bytes()).digest())

    def test_award_progressive_assets_are_served_by_the_site(self):
        self.assertTrue(any(tag == "script" and a.get("src") == "award-2026.js" and "defer" in a for tag, a in self.nodes))
        self.assertTrue(any(tag == "link" and a.get("href") == "award-2026.css" for tag, a in self.nodes))
        for name in ("award-2026.js", "award-2026.css"):
            self.assertTrue((ROOT / "site" / name).is_file())


if __name__ == "__main__":
    unittest.main()
