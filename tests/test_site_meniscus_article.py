"""Meniscus article routing, search identity and image/link integration."""
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit
from test_site_article import Page, SITE
from test_site_low_back_illustration import Images

REL = 'articles/povrezhdenie-meniska-uprazhneniya-i-vosstanovlenie.html'
PUBLIC = 'https://docbratus.ru/' + REL


class MeniscusArticleTests(unittest.TestCase):
    def page(self):
        self.assertTrue((SITE / REL).is_file(), 'Meniscus publication page is missing')
        return Page(SITE / REL)

    def test_reader_and_search_can_reach_the_canonical_article(self):
        page = self.page()
        self.assertIn(Path(REL).name, Page(SITE / 'articles/index.html').links)
        locs = [x.text for x in ET.parse(SITE / 'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertEqual(locs.count(PUBLIC), 1)
        self.assertEqual(page.canonical, PUBLIC)
        self.assertNotIn('noindex', page.robots)
        article = next(x for x in page.schemas[0] if x['@type'] == 'Article')
        self.assertEqual(article['mainEntityOfPage'], PUBLIC)
        self.assertEqual(article['author']['name'], 'Михаил Андреевич Братусь')

    def test_navigation_and_assets_do_not_send_readers_to_missing_targets(self):
        page = self.page()
        self.assertIn('https://docbratus.ru/#booking', page.links)
        self.assertIn('https://docbratus.ru/articles/rehabilitaciya-posle-plastiki-pks.html', page.links)
        for href in page.links + page.assets:
            u = urlsplit(href)
            if u.netloc and u.netloc != 'docbratus.ru':
                continue
            path = u.path.lstrip('/') if u.netloc or u.path.startswith('/') else str(Path(REL).parent / u.path)
            target = SITE / (path if u.path else REL)
            if target.is_dir():
                target /= 'index.html'
            self.assertTrue(target.is_file(), href)
            if u.fragment:
                self.assertIn(u.fragment, Page(target).ids, href)

    def test_article_library_and_social_preview_use_the_same_available_image(self):
        self.page()
        images = Images(REL)
        cover = next(x for x in images.images if 'consultation-art' in x.get('class', ''))
        library = Images('articles/index.html')
        self.assertEqual(library.cards[Path(REL).name]['src'], cover['src'])
        target = SITE / 'articles' / cover['src']
        self.assertTrue(target.read_bytes().startswith(b'\xff\xd8'))
        expected = 'https://docbratus.ru/articles/' + cover['src']
        self.assertEqual(images.meta['og:image'], expected)
        self.assertEqual(images.article_images, [expected])


if __name__ == '__main__':
    unittest.main()
