"""Approved ACL publication: prevent missing content, discovery and illustration drift."""
import hashlib
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET
from test_site_article import Page, SITE
from test_site_low_back_illustration import Images

REL = 'articles/rehabilitaciya-posle-plastiki-pks.html'
PUBLIC = 'https://docbratus.ru/' + REL


class Text(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.active = False
        self.skip_tag = None
        self.skip_depth = 0
        self.parts = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if self.skip_tag:
            if tag == self.skip_tag:
                self.skip_depth += 1
            return
        if tag == 'article':
            self.active = True
        if self.active and (tag == 'figure' or attrs.get('id') == 'sources' or attrs.get('class') in ('mobile-toc', 'editorial-note')):
            self.skip_tag, self.skip_depth = tag, 1
            return
        if self.active and tag in ('p', 'li', 'h2', 'h3', 'summary'):
            self.parts.append(' ')

    def handle_endtag(self, tag):
        if self.skip_tag:
            if tag == self.skip_tag:
                self.skip_depth -= 1
                if not self.skip_depth:
                    self.skip_tag = None
            return
        if tag == 'article':
            self.active = False
        if self.active and tag in ('p', 'li', 'h2', 'h3', 'summary'):
            self.parts.append(' ')

    def handle_data(self, value):
        if self.active and not self.skip_tag:
            self.parts.append(value)


class ACLArticleTests(unittest.TestCase):
    def html(self):
        self.assertTrue((SITE / REL).is_file(), 'Approved ACL article not in site/')
        return (SITE / REL).read_text()

    def test_reader_can_find_acl_in_library_and_sitemap(self):
        self.html()
        self.assertIn(Path(REL).name, Page(SITE / 'articles/index.html').links)
        locs = [x.text for x in ET.parse(SITE / 'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
        self.assertEqual(locs.count(PUBLIC), 1)

    def test_search_metadata_identifies_author_and_current_route(self):
        self.html()
        page = Page(SITE / REL)
        self.assertEqual(page.canonical, PUBLIC)
        self.assertNotIn('noindex', page.robots)
        data = page.schemas[0]
        article = next(x for x in data if x['@type'] == 'Article')
        self.assertEqual(article['author']['name'], 'Михаил Андреевич Братусь')
        self.assertEqual(article['mainEntityOfPage'], PUBLIC)
        self.assertEqual(article['datePublished'], '2026-11-04')

    def test_all_approved_paragraphs_lists_and_questions_remain_readable(self):
        html = self.html()
        visible = re.sub(r'\s+', ' ', ''.join(Text(html).parts)).strip()
        # Literal derived independently from the immutable approved Markdown body,
        # not from the generated HTML or its builder. No external workspace fixture.
        self.assertEqual(hashlib.sha256(visible.encode()).hexdigest(), '6b6e6621415c24caa8bf133171e1d80b0a8b1b0bfc4b5234755afd5c0ee331bf')

    def test_toc_faq_and_existing_booking_are_available(self):
        h = self.html()
        p = Page(SITE / REL)
        for anchor in ['stage-1', 'stage-2', 'strength', 'running', 'sport', 'return', 'plan', 'memo', 'urgent', 'faq', 'consultation', 'sources', 'acl-diagram']:
            self.assertIn(anchor, p.ids)
        self.assertEqual(h.count('<summary>'), 7)  # services + mobile TOC + five FAQs
        self.assertIn('https://docbratus.ru/#booking', p.links)
        self.assertIn('Записаться на консультацию к Михаилу Братусь', h)

    def test_cover_is_shared_by_article_card_and_link_preview(self):
        self.html()
        page = Images(REL)
        cover = next(x for x in page.images if 'consultation-art' in x.get('class', ''))
        self.assertEqual(cover['src'], 'assets/acl-consultation.jpg')
        self.assertEqual((cover['width'], cover['height']), ('1536', '1024'))
        target = SITE / 'articles' / cover['src']
        self.assertTrue(target.read_bytes().startswith(b'\xff\xd8'))
        library = Images('articles/index.html')
        self.assertEqual(library.cards[Path(REL).name]['src'], cover['src'])
        expected = 'https://docbratus.ru/articles/' + cover['src']
        self.assertEqual(page.meta['og:image'], expected)
        self.assertEqual(page.article_images, [expected])

    def test_enlarged_preoperative_diagram_is_distinct_from_postoperative_scene(self):
        h = self.html()
        self.assertIn('class="acl-diagram-window"', h)
        self.assertIn('Повреждение ПКС до операции', h)
        images = Images(REL)
        diagram = next(x for x in images.images if x.get('class') == 'acl-diagram-image')
        self.assertEqual(diagram['src'], 'assets/acl-consultation.jpg')
        self.assertIn('до операции', diagram['alt'])

    def test_internal_assets_anchors_and_sources_resolve(self):
        self.html()
        p = Page(SITE / REL)
        for href in p.links + p.assets:
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
        for pmid in ['36731908', '34006577', '32005095']:
            self.assertIn('https://pubmed.ncbi.nlm.nih.gov/' + pmid + '/', p.links)

    def test_no_draft_markers_declined_surname_or_credentials(self):
        h = self.html()
        self.assertNotRegex(h, r'Братус[юяе]')
        for marker in ['localhost', '127.0.0.1', 'OPENAI_API_KEY', 'sk-proj-', 'на вычитке', 'не опубликован']:
            self.assertNotIn(marker, h)


if __name__ == '__main__':
    unittest.main()
