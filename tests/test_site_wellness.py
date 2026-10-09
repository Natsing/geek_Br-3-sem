"""Routing and contact contracts for the approved separate wellness section."""
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

SITE = Path(__file__).resolve().parents[1] / 'site'

class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.links, self.assets, self.ids, self.contacts = [], [], set(), []
        self.canonical, self.robots = None, ''
        self.feed(path.read_text(encoding='utf-8'))

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'link' and a.get('rel') == 'canonical': self.canonical = a.get('href')
        if tag == 'meta' and a.get('name') == 'robots': self.robots = a.get('content', '')
        if a.get('id'): self.ids.add(a['id'])
        if tag == 'a' and a.get('href'):
            self.links.append(a['href'])
            if 'data-wellness-contact' in a: self.contacts.append(a['href'])
        if tag == 'link' and a.get('href'): self.assets.append(a['href'])
        if tag in ('img', 'script') and a.get('src'): self.assets.append(a['src'])

class WellnessTests(unittest.TestCase):
    def test_public_page_is_discoverable_at_its_canonical_url(self):
        page = Page(SITE / 'wellness.html')
        self.assertEqual(page.canonical, 'https://docbratus.ru/wellness.html')
        self.assertNotIn('noindex', page.robots)
        sitemap = ET.parse(SITE / 'sitemap.xml')
        urls = [el.text for el in sitemap.iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertIn(page.canonical, urls)

    def test_homepage_routes_to_separate_wellness_page(self):
        self.assertIn('wellness.html', Page(SITE / 'index.html').links)
        self.assertTrue((SITE / 'wellness.html').is_file())

    def test_new_page_links_and_assets_resolve(self):
        self.assertTrue((SITE / 'wellness.html').is_file(), 'Separate wellness page missing')
        page = Page(SITE / 'wellness.html')
        for href in page.links + page.assets:
            url = urlsplit(href)
            if url.scheme or url.netloc: continue
            target = SITE / (url.path or 'wellness.html')
            self.assertTrue(target.is_file(), href)
            if url.fragment: self.assertIn(url.fragment, Page(target).ids, href)
        self.assertIn('index.html#pricing', page.links)

    def test_all_five_formats_use_the_personal_contact(self):
        self.assertTrue((SITE / 'wellness.html').is_file(), 'Separate wellness page missing')
        self.assertEqual(Page(SITE / 'wellness.html').contacts, ['https://t.me/DocBratus'] * 5)

if __name__ == '__main__': unittest.main()
