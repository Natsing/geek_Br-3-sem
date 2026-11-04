"""Booking navigation runtime behavior and homepage integration."""
import subprocess
import unittest
import hashlib
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from test_site_article import Page, SITE


class BookingScrollTests(unittest.TestCase):
    def test_homepage_loads_booking_alignment(self):
        self.assertTrue(any(urlsplit(a).path == 'booking-scroll.js' for a in Page(SITE / 'index.html').assets))

    def test_changed_script_gets_a_fresh_cache_url(self):
        asset = next(a for a in Page(SITE / 'index.html').assets if urlsplit(a).path == 'booking-scroll.js')
        expected = hashlib.sha256((SITE / 'booking-scroll.js').read_bytes()).hexdigest()[:12]
        self.assertEqual(parse_qs(urlsplit(asset).query).get('v'), [expected])

    def test_booking_navigation_runtime_cases(self):
        result = subprocess.run(['node', '--test', str(Path(__file__).with_name('booking_scroll.test.cjs'))], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
