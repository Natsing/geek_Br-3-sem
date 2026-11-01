"""Publication checks for the author-approved MRI article, including SVG assets."""
import hashlib
import json
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

SITE = Path(__file__).resolve().parents[1] / 'site'
REL = 'articles/razbor-mrt-pozvonochnika.html'
PUBLIC = 'https://docbratus.ru/' + REL

class Page(HTMLParser):
    def __init__(self, file):
        super().__init__()
        self.refs, self.ids, self.schema = [], [], []
        self.h1, self.canonical, self.robots, self.data = 0, None, '', None
        self.feed(file.read_text(encoding='utf-8'))
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'): self.ids.append(a['id'])
        if tag == 'h1': self.h1 += 1
        if tag in ('a','image','link') and a.get('href'): self.refs.append(a['href'])
        if tag in ('img','script') and a.get('src'): self.refs.append(a['src'])
        if tag == 'link' and a.get('rel') == 'canonical': self.canonical = a.get('href')
        if tag == 'meta' and a.get('name') == 'robots': self.robots = a.get('content','')
        if tag == 'script' and a.get('type') == 'application/ld+json': self.data = ''
    def handle_data(self, data):
        if self.data is not None: self.data += data
    def handle_endtag(self, tag):
        if tag == 'script' and self.data is not None:
            data = json.loads(self.data)
            self.schema.extend(data if isinstance(data,list) else [data])
            self.data = None

class MRIArticleTests(unittest.TestCase):
    def setUp(self):
        self.file = SITE / REL
        self.text = self.file.read_text(encoding='utf-8')
        self.page = Page(self.file)
    def test_indexable_static_article(self):
        self.assertEqual(self.page.h1, 1)
        self.assertEqual(self.page.canonical, PUBLIC)
        self.assertNotIn('noindex',self.page.robots)
        for marker in ['Локальный макет','Не опубликовано','Черновик','127.0.0.1','@vite','/src/']:
            self.assertNotIn(marker,self.text)
        self.assertIn('персональную памятку',self.text)
        self.assertIn('лучше сохраняет воду',self.text)
        self.assertIn('Я провожу онлайн-разбор МРТ',self.text)
    def test_existing_library_and_sitemap_discovery(self):
        self.assertIn(Path(REL).name,Page(SITE/'articles/index.html').refs)
        urls = [x.text for x in ET.parse(SITE/'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertIn(PUBLIC,urls)
        self.assertEqual(urls.count(PUBLIC),1)
        self.assertIn('rehabilitaciya-posle-endoprotezirovaniya-tazobedrennogo-sustava.html',Page(SITE/'articles/index.html').refs)
    def test_every_internal_asset_link_and_anchor_resolves(self):
        self.assertEqual(len(self.page.ids),len(set(self.page.ids)))
        for href in self.page.refs:
            u = urlsplit(href)
            if u.netloc and u.netloc != 'docbratus.ru': continue
            if u.scheme and u.scheme not in ('http','https'): continue
            p = SITE / (u.path.lstrip('/') if u.netloc or u.path.startswith('/') else str(Path(REL).parent/u.path)) if u.path else self.file
            if p.is_dir(): p = p/'index.html'
            self.assertTrue(p.is_file(),href)
            if u.fragment: self.assertIn(u.fragment,Page(p).ids,href)
    def test_author_date_and_breadcrumb_schema(self):
        article = next(x for x in self.page.schema if x['@type']=='Article')
        self.assertEqual(article['url'],PUBLIC)
        self.assertEqual(article['mainEntityOfPage'],PUBLIC)
        self.assertEqual(article['datePublished'],'2026-11-01')
        self.assertEqual(article['author']['name'],'Михаил Андреевич Братусь')
        crumb = next(x for x in self.page.schema if x['@type']=='BreadcrumbList')
        self.assertEqual(crumb['itemListElement'][-1]['item'],PUBLIC)
    def test_original_mri_files_are_unchanged(self):
        expected = {'mri-spine-sagittal.jpg':'8289d33b23aba248f2a1175564cc3968f36d21be276f7a2124839db6545fd869','mri-spine-axial.jpg':'c3e43daa7a457d67786123b8bd3d59acf89feae866a9ad80f791815d848a3cea'}
        for name,digest in expected.items(): self.assertEqual(hashlib.sha256((SITE/'articles/assets'/name).read_bytes()).hexdigest(),digest)
        self.assertNotIn('stroke-dasharray',self.text)
    def test_real_cover_file_and_shared_navigation(self):
        cover = SITE/'articles/assets/mri-spine-consultation.jpg'
        self.assertTrue(cover.read_bytes().startswith(b'\xff\xd8\xff'))
        self.assertIn('navigation-v2.js',self.text)
        self.assertIn('aria-controls="db-navigation"',self.text)
        self.assertIn('https://docbratus.ru/#booking',self.page.refs)
    def test_fixed_navigation_has_existing_article_page_spacing(self):
        self.assertIn('<body class="db-article-page">',self.text)
    def test_no_react_runtime_needed_to_read_content(self):
        self.assertIn('Зачем смотреть мышцы спины на МРТ',self.text)
        self.assertIn('Если нашли грыжу, обязательно нужна операция?',self.text)
        self.assertNotIn('type="module"',self.text)
        self.assertNotIn('createRoot',self.text)

if __name__ == '__main__': unittest.main()
