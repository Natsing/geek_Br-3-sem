"""Owner-approved wellness price revision; medical prices are a separate scope."""
import re
import unittest
from pathlib import Path

PAGE = Path(__file__).resolve().parents[1] / 'site' / 'wellness.html'


class WellnessPriceRevisionTests(unittest.TestCase):
    def test_all_published_format_amounts_match_owner_approved_revision(self):
        # Any stale amount in a real format card must fail, not a copied fixture.
        html = PAGE.read_text(encoding='utf-8')
        prices = re.findall(r'<p class="well-price">([\d ]+)&nbsp;₽', html)
        self.assertEqual([int(p.replace(' ', '')) for p in prices],
                         [6000, 8000, 6900, 15000, 14900])

    def test_first_card_explicitly_covers_introductory_and_repeat_sessions(self):
        html = PAGE.read_text(encoding='utf-8')
        card = re.search(r'<article[^>]+id="intro">(.*?)</article>', html, re.S).group(1)
        self.assertRegex(card, r'<h3>Вводное или повторное[^<]*занятие</h3>')
        self.assertIn('Без медицинской диагностики и врачебного заключения.', card)

    def test_author_surname_is_not_declined_in_metadata_or_body(self):
        self.assertNotRegex(PAGE.read_text(encoding='utf-8'), r'Братус[юяе]')

    def test_online_session_explicitly_includes_the_owner_approved_memo(self):
        html = PAGE.read_text(encoding='utf-8')
        card = re.search(r'<article[^>]+id="online">(.*?)</article>', html, re.S).group(1)
        self.assertIn('Онлайн-занятие с индивидуальной памяткой', card)
        self.assertIn('PDF-памятка с упражнениями, техникой и согласованной нагрузкой входит в стоимость.', card)
