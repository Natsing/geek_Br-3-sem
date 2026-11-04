"""Reader-facing cover identity across the article, its card and link previews."""
import json
import unittest
from html.parser import HTMLParser
from pathlib import PurePosixPath
from test_site_article import SITE


class Images(HTMLParser):
    def __init__(self, relative):
        super().__init__()
        self.images, self.cards, self.meta, self.article_images = [], {}, {}, []
        self.anchor, self.json_text = None, None
        self.feed((SITE / relative).read_text(encoding='utf-8'))

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'a':
            self.anchor = a.get('href')
        if tag == 'img':
            self.images.append(a)
            if self.anchor:
                self.cards[self.anchor] = a
        if tag == 'meta' and a.get('property'):
            self.meta[a['property']] = a.get('content')
        if tag == 'script' and a.get('type') == 'application/ld+json':
            self.json_text = ''

    def handle_data(self, value):
        if self.json_text is not None:
            self.json_text += value

    def handle_endtag(self, tag):
        if tag == 'a':
            self.anchor = None
        if tag == 'script' and self.json_text is not None:
            data = json.loads(self.json_text)
            for item in data if isinstance(data, list) else [data]:
                if item.get('@type') == 'Article':
                    self.article_images.extend(item.get('image', []))
            self.json_text = None


class LowBackIllustrationTests(unittest.TestCase):
    low = 'bol-v-poyasnice-uprazhneniya-i-nagruzka.html'
    mri = 'razbor-mrt-pozvonochnika.html'

    def cover(self, name):
        page = Images('articles/' + name)
        return page, next(i for i in page.images if 'consultation-art' in i.get('class', '').split())

    def test_reader_sees_distinct_cover_for_low_back_and_mri(self):
        _, low = self.cover(self.low)
        _, mri = self.cover(self.mri)
        self.assertNotEqual(low['src'], mri['src'], 'Different articles still show the same illustration')
        target = SITE / 'articles' / low['src']
        self.assertTrue(target.is_file())
        self.assertTrue(target.read_bytes().startswith(b'\xff\xd8'), 'Cover must be a real JPEG')
        self.assertEqual((low.get('width'), low.get('height')), ('1536', '1024'))
        self.assertIn('модел', low.get('alt', '').lower())

    def test_library_card_uses_article_cover_without_reusing_mri_card(self):
        _, low = self.cover(self.low)
        library = Images('articles/index.html')
        self.assertEqual(library.cards[self.low]['src'], low['src'])
        self.assertNotEqual(library.cards[self.low]['src'], library.cards[self.mri]['src'])
        self.assertIn('модел', library.cards[self.low].get('alt', '').lower())

    def test_link_previews_use_the_same_new_cover_as_the_article(self):
        page, cover = self.cover(self.low)
        expected = 'https://docbratus.ru/articles/' + cover['src']
        self.assertEqual(page.meta['og:image'], expected)
        self.assertEqual(page.article_images, [expected])
        self.assertNotEqual(PurePosixPath(page.meta['og:image']).name, 'mri-spine-consultation.jpg')


if __name__ == '__main__':
    unittest.main()
