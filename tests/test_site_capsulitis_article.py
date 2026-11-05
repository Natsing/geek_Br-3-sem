"""Owner-approved frozen shoulder article, canonical routing and supplied cover."""
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit
from test_site_article import Page, SITE
from test_site_low_back_illustration import Images

REL = 'articles/adgezivnyj-kapsulit-zamorozhennoe-plecho.html'
PUBLIC = 'https://docbratus.ru/' + REL


class CapsulitisArticleTests(unittest.TestCase):
    def page(self):
        self.assertTrue((SITE / REL).is_file(), 'Capsulitis publication page is missing')
        return Page(SITE / REL)

    def test_readers_and_search_can_reach_one_canonical_article(self):
        page = self.page()
        self.assertIn(Path(REL).name, Page(SITE / 'articles/index.html').links)
        locs = [x.text for x in ET.parse(SITE / 'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertEqual(locs.count(PUBLIC), 1)
        self.assertEqual(page.canonical, PUBLIC)
        self.assertNotIn('noindex', page.robots)
        article = next(x for x in page.schemas[0] if x['@type'] == 'Article')
        self.assertEqual(article['mainEntityOfPage'], PUBLIC)
        self.assertEqual(article['author']['name'], 'Михаил Андреевич Братусь')

    def test_navigation_and_assets_have_real_destinations(self):
        page = self.page()
        self.assertIn('https://docbratus.ru/#booking', page.links)
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

    def test_article_library_and_social_preview_share_the_supplied_image(self):
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
