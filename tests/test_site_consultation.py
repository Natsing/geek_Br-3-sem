"""Contracts for the approved consultation, memo, pricing and FAQ update."""

from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "site" / "index.html"


class ConsultationPageContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.html = HTML_PATH.read_text(encoding="utf-8")

    def section(self, marker: str, next_marker: str) -> str:
        self.assertIn(marker, self.html)
        self.assertIn(next_marker, self.html)
        return self.html[self.html.index(marker) : self.html.index(next_marker)]

    def test_consultation_and_memo_lead_into_existing_results(self) -> None:
        markers = (
            "<!-- ============ CONSULTATION",
            "<!-- ============ PERSONAL MEMO",
            "<!-- ============ RESULTS",
            "<!-- ============ ABOUT",
        )

        for marker in markers:
            self.assertIn(marker, self.html)
        positions = [self.html.index(marker) for marker in markers]
        self.assertEqual(positions, sorted(positions))

    def test_consultation_ends_with_the_personal_memo_outcome(self) -> None:
        consultation = self.section(
            "<!-- ============ CONSULTATION",
            "<!-- ============ PERSONAL MEMO",
        )

        for expected in (
            "Как проходит первичная консультация",
            "Жалобы и документы",
            "Осмотр и функциональное тестирование",
            "План восстановления",
            "Индивидуальная памятка",
            "фотографиями ваших упражнений",
            "ответы на вопросы",
            "формат консультации за 6 900 ₽",
        ):
            self.assertIn(expected, consultation)

    def test_memo_carousel_uses_two_real_preview_images(self) -> None:
        memo = self.section(
            "<!-- ============ PERSONAL MEMO",
            "<!-- ============ RESULTS",
        )

        self.assertIn("Пример персональной памятки", memo)
        self.assertIn("Иванова Ивана Ивановича", memo)
        self.assertIn('src="memo/ivanov-red-flags.png"', memo)
        self.assertIn('src="memo/ivanov-exercises.png"', memo)
        self.assertIn('aria-live="polite"', memo)
        self.assertTrue((ROOT / "site" / "memo" / "ivanov-red-flags.png").is_file())
        self.assertTrue((ROOT / "site" / "memo" / "ivanov-exercises.png").is_file())

    def test_memo_carousel_exposes_only_the_two_numbered_controls(self) -> None:
        memo = self.section(
            "<!-- ============ PERSONAL MEMO",
            "<!-- ============ RESULTS",
        )

        self.assertEqual(memo.count('class="memo-control memo-page'), 2)
        self.assertNotIn('id="memo-prev"', memo)
        self.assertNotIn('id="memo-next"', memo)
        self.assertNotIn('id="memo-toggle"', memo)
        self.assertNotIn(">Назад</button>", memo)
        self.assertNotIn(">Далее</button>", memo)
        self.assertNotIn(">Пауза</button>", memo)

    def test_expertise_section_includes_a_real_doctor_photo(self) -> None:
        about = self.section(
            "<!-- ============ ABOUT",
            "<!-- ============ QUALIFICATION",
        )

        self.assertIn('class="about-photo"', about)
        self.assertIn('src="doctor.jpg"', about)

    def test_pricing_shows_all_approved_formats(self) -> None:
        pricing = self.section(
            "<!-- ============ PRICING",
            "<!-- ============ REVIEWS",
        )

        for expected in (
            "Первичный приём",
            "4 500 ₽",
            "Приём + индивидуальная PDF-памятка",
            "6 900 ₽",
            "10 000 ₽",
            "в пределах МКАД · за МКАД — по согласованию",
            "Онлайн-консультация",
            "Разбор МРТ / КТ",
            "5 000 ₽",
            "14 900 ₽",
            "оплачиваются отдельно",
        ):
            self.assertIn(expected, pricing)

    def test_previsit_faq_answers_the_four_approved_questions(self) -> None:
        faq = self.section(
            "<!-- ============ FAQ",
            "<!-- ============ BOOKING",
        )

        expected_questions = (
            "Сколько длится приём?",
            "Нужно ли заранее делать МРТ или сдавать анализы?",
            "Что взять с собой?",
            "Можно ли провести консультацию онлайн?",
        )
        for question in expected_questions:
            self.assertIn(f"<summary>{question}</summary>", faq)
        self.assertEqual(faq.count("<details"), 4)
        self.assertNotIn("<details class=\"reveal\" open>", faq)

    def test_previsit_faq_is_a_single_vertical_accordion(self) -> None:
        self.assertIn(
            ".faq-grid{display:flex;flex-direction:column;gap:12px;max-width:900px;margin:40px auto 0}",
            self.html,
        )

    def test_mobile_memo_shows_the_carousel_before_supporting_details(self) -> None:
        mobile_start = self.html.index("@media (max-width:600px){")
        mobile_end = self.html.index("@media (max-width:760px){", mobile_start)
        mobile_rules = self.html[mobile_start:mobile_end]

        self.assertIn(".memo-copy{display:contents}", mobile_rules)
        self.assertIn(".memo-carousel{order:4}", mobile_rules)
        self.assertIn(".memo-points{order:5", mobile_rules)
        self.assertIn(".memo-demo-note{order:6", mobile_rules)


if __name__ == "__main__":
    unittest.main()
