"""Low-back article publishing contracts: discovery, content, assets and provenance."""
import json
import re
import hashlib
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET
from test_site_article import Page, SITE

REL = 'articles/bol-v-poyasnice-uprazhneniya-i-nagruzka.html'
PUBLIC = 'https://docbratus.ru/' + REL


class ArticleText(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.active = False
        self.chunks = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        if tag == 'article':
            self.active = True

    def handle_endtag(self, tag):
        if tag == 'article':
            self.active = False

    def handle_data(self, value):
        if self.active:
            self.chunks.append(value)


class LowBackArticleTests(unittest.TestCase):
    def html(self):
        file = SITE / REL
        self.assertTrue(file.is_file(), 'Approved low-back page is not yet in site/')
        return file.read_text()

    def page(self):
        self.html()
        return Page(SITE / REL)

    def test_reader_can_find_low_back_from_existing_library_and_sitemap(self):
        self.html()
        self.assertIn(Path(REL).name, Page(SITE / 'articles/index.html').links)
        urls = [n.text for n in ET.parse(SITE / 'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertIn(PUBLIC, urls)

    def test_indexable_canonical_matches_the_served_route(self):
        p = self.page()
        self.assertEqual(p.canonical, PUBLIC)
        self.assertIn('index', p.robots)
        self.assertNotIn('noindex', p.robots)

    def test_author_date_and_article_schema(self):
        schema = self.page().schemas[0]
        article = next(x for x in schema if x['@type'] == 'Article')
        self.assertEqual(article['mainEntityOfPage'], PUBLIC)
        self.assertEqual(article['author']['name'], 'Михаил Андреевич Братусь')
        self.assertEqual(article['datePublished'], '2026-11-04')

    def test_all_internal_assets_and_anchors_exist(self):
        p = self.page()
        for href in p.links + p.assets:
            u = urlsplit(href)
            if u.netloc and u.netloc != 'docbratus.ru':
                continue
            if u.scheme and u.scheme != 'https':
                continue
            path = u.path.lstrip('/') if u.netloc or u.path.startswith('/') else str(Path(REL).parent / u.path)
            target = SITE / (path if u.path else REL)
            if target.is_dir():
                target /= 'index.html'
            self.assertTrue(target.is_file(), 'Broken link/asset: ' + href)
            if u.fragment:
                self.assertIn(u.fragment, Page(target).ids)

    def test_approved_body_paragraphs_are_preserved(self):
        text = self.html()
        released = ArticleText(text).chunks
        # Literal hash independently captured from the author-approved local preview.
        released = [s for s in released if not s.startswith('Опубликовано 4 ноября 2026 года.')]
        normalized = re.sub(r'\s+', ' ', ''.join(released)).strip()
        self.assertEqual(hashlib.sha256(normalized.encode()).hexdigest(), '50f2c0f0b01be5ac18e4fdd1cd9206ab1e9c24e3e9bef4a5b66009e40c9b3f72')

    def test_full_reading_sections_and_booking_are_exposed(self):
        p = self.page()
        for anchor in ['exercises', 'plan', 'memo', 'urgent', 'faq', 'consultation', 'sources']:
            self.assertIn(anchor, p.ids)
        self.assertIn('https://docbratus.ru/#booking', p.links)
        h = self.html()
        self.assertEqual(h.count('<summary>'), 7)  # Navigation, mobile TOC and five FAQs.
        self.assertIn('Записаться к Михаилу Братусь', h)

    def test_no_preview_markers_or_declined_author_name(self):
        h = self.html()
        self.assertNotRegex(h, r'Братус[юяе]')
        for marker in ['localhost', '127.0.0.1', 'не опубликован', 'Не опубликовано', 'на вычитке', 'из оформления статьи']:
            self.assertNotIn(marker, h)


if __name__ == '__main__':
    unittest.main()
