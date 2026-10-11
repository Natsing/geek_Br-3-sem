"""Published article routing: prevent orphan pages, broken assets and preview indexing rules."""
import json
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

SITE = Path(__file__).resolve().parents[1] / 'site'
ARTICLE = 'articles/rehabilitaciya-posle-endoprotezirovaniya-tazobedrennogo-sustava.html'
PUBLIC = 'https://docbratus.ru/' + ARTICLE

class Page(HTMLParser):
    def __init__(self, file):
        super().__init__()
        self.links, self.assets, self.ids, self.schemas = [], [], set(), []
        self.canonical, self.robots, self._json = None, '', None
        self.feed(file.read_text(encoding='utf-8'))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'): self.ids.add(attrs['id'])
        if tag == 'a' and attrs.get('href'): self.links.append(attrs['href'])
        if tag in ('img', 'script') and attrs.get('src'): self.assets.append(attrs['src'])
        if tag == 'link':
            if attrs.get('rel') == 'canonical': self.canonical = attrs.get('href')
            elif attrs.get('href'): self.assets.append(attrs['href'])
        if tag == 'meta' and attrs.get('name') == 'robots': self.robots = attrs.get('content', '')
        if tag == 'script' and attrs.get('type') == 'application/ld+json': self._json = ''

    def handle_data(self, data):
        if self._json is not None: self._json += data

    def handle_endtag(self, tag):
        if tag == 'script' and self._json is not None:
            self.schemas.append(json.loads(self._json))
            self._json = None

class ArticleTests(unittest.TestCase):
    def article(self):
        self.assertTrue((SITE / ARTICLE).is_file(), 'Approved article is not published in site/')
        return Page(SITE / ARTICLE)

    def test_reader_can_reach_article_from_homepage(self):
        page = Page(SITE / 'index.html')
        self.assertIn(ARTICLE, page.links, 'Article must not be an orphan page')
        self.article()

    def test_search_discovery_matches_served_url(self):
        page = self.article()
        self.assertEqual(page.canonical, PUBLIC)
        self.assertNotIn('noindex', page.robots)
        urls = [e.text for e in ET.parse(SITE / 'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertIn(PUBLIC, urls)
        article = next(s for s in page.schemas if s.get('@type') == 'Article')
        self.assertEqual(article['mainEntityOfPage'], PUBLIC)
        self.assertEqual(article['author']['@type'], 'Person')

    def test_all_article_assets_navigation_and_contents_resolve(self):
        page = self.article()
        self.assertGreaterEqual(len(page.assets), 4)
        for href in page.assets + page.links:
            url = urlsplit(href)
            if url.netloc and url.netloc != 'docbratus.ru': continue
            if url.scheme and url.scheme not in ('https', 'http'): continue
            relative = url.path.lstrip('/') if url.netloc or url.path.startswith('/') else str(Path(ARTICLE).parent / url.path)
            target = SITE / (relative if url.path else ARTICLE)
            if target.is_dir(): target = target / 'index.html'
            self.assertTrue(target.is_file(), f'Broken target: {href}')
            if url.fragment: self.assertIn(url.fragment, Page(target).ids, href)

    def test_consultation_routes_to_existing_medical_booking(self):
        page = self.article()
        booking = [href for href in page.links if urlsplit(href).fragment == 'booking']
        self.assertGreaterEqual(len(booking), 2)
        self.assertIn('booking', Page(SITE / 'index.html').ids)

if __name__ == '__main__': unittest.main()
