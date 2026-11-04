"""Booking navigation runtime behavior and homepage integration."""
import subprocess
import unittest
from pathlib import Path
from test_site_article import Page, SITE


class BookingScrollTests(unittest.TestCase):
    def test_homepage_loads_booking_alignment(self):
        self.assertIn('booking-scroll.js', Page(SITE / 'index.html').assets)

    def test_booking_navigation_runtime_cases(self):
        result = subprocess.run(['node', '--test', str(Path(__file__).with_name('booking_scroll.test.cjs'))], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
