"""Synthetic fixtures only; no fixture data is imported into the live catalog."""
import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scrapers import sephora_scraper as scraper

URL = 'https://www.sephora.com/product/fixture-P12345'


def snapshot(product=None):
    product = product or {
        '@type': 'Product', 'url': URL, 'name': 'Fixture Foundation',
        'brand': {'name': 'Fixture Brand'}, 'category': 'Foundation',
        'image': 'https://www.sephora.com/productimages/fixture.jpg',
        'description': '<p>Light coverage.</p>',
        'offers': {'price': '24.90', 'priceCurrency': 'USD',
                   'availability': 'https://schema.org/InStock'},
    }
    return {'scripts': [json.dumps(product)], 'name': product['name']}


class ParsingTests(unittest.TestCase):
    def test_product_fields(self):
        result = scraper.parse_snapshot(snapshot(), URL)
        self.assertEqual(result['price']['amount'], '24.90')
        self.assertEqual(result['price']['currency'], 'USD')
        self.assertEqual(result['category'], 'foundation')
        self.assertEqual(result['availability'], 'in_stock')
        self.assertEqual(result['description'], 'Light coverage.')
        self.assertIn('ingredients section unavailable; no value inferred.', result['warnings'])

    def test_missing_fields_and_sold_out(self):
        s = {'name': 'Fixture Mascara', 'brand': 'Fixture', 'sold_out': True}
        result = scraper.parse_snapshot(s, URL)
        self.assertIsNone(result['price']['amount'])
        self.assertIsNone(result['image_url'])
        self.assertEqual(result['ingredients']['list'], [])
        self.assertEqual(result['availability'], 'out_of_stock')

    def test_missing_identity_is_error(self):
        with self.assertRaises(scraper.ScrapeError):
            scraper.parse_snapshot({'scripts': ['bad json']}, URL)

    def test_exact_variant(self):
        s = snapshot()
        s['scripts'].append(json.dumps({'productId': 'P12345',
            'productDetails': {'displayName': 'Fixture Foundation'},
            'currentSku': {'skuId': '1', 'listPrice': '$20'},
            'regularChildSkus': [
                {'skuId': '1', 'variationValue': 'Light', 'variationType': 'Color'},
                {'skuId': '2', 'variationValue': 'Deep', 'variationType': 'Color',
                 'listPrice': '$30.00', 'isOutOfStock': True,
                 'ingredientDesc': 'Water, Iron Oxides (CI 77491, CI 77492), Glycerin',
                 'skuImages': {'image1500': '/productimages/deep.jpg'}}]}))
        result = scraper.parse_snapshot(s, URL + '?skuId=2')
        self.assertEqual(result['price']['amount'], '30.00')
        self.assertEqual(result['image_url'], 'https://www.sephora.com/productimages/deep.jpg')
        self.assertEqual(result['ingredients']['list'], ['Water', 'Iron Oxides (CI 77491, CI 77492)', 'Glycerin'])
        self.assertEqual(len(result['shades']), 2)
        self.assertEqual(result['availability'], 'out_of_stock')

    def test_unresolved_variant_does_not_reuse_default_image_or_price(self):
        result = scraper.parse_snapshot(snapshot(), URL + '?skuId=missing')
        self.assertIsNone(result['price']['amount'])
        self.assertIsNone(result['image_url'])
        self.assertTrue(result['warnings'])

    def test_recommendation_ignored(self):
        s = snapshot()
        s['scripts'].insert(0, json.dumps({'@type': 'Product', 'url': '/product/other-P99999',
                                         'name': 'Other', 'offers': {'price': 999}}))
        self.assertEqual(scraper.parse_snapshot(s, URL)['price']['amount'], '24.90')

    def test_amounts_and_ranges(self):
        self.assertEqual(scraper.amount('$1,299.95'), '1299.95')
        self.assertIsNone(scraper.amount('$20 - $30'))
        self.assertIsNone(scraper.amount(None))
        self.assertIsNone(scraper.amount(True))
        self.assertIsNone(scraper.amount('-5.00'))
        self.assertIsNone(scraper.amount('4 payments of $10'))

    def test_group_offer_size_high_resolution_and_inci_claims(self):
        s = snapshot()
        group = json.loads(s['scripts'][0])
        del group['offers']
        group['@type'] = 'ProductGroup'
        group['hasVariant'] = [{'@type': 'Product', 'sku': '1',
                               'offers': {'price': '6', 'priceCurrency': 'USD'}}]
        s['scripts'] = [json.dumps(group), json.dumps({
            'productId': 'P12345', 'productDetails': {'displayName': 'Fixture Serum'},
            'currentSku': {'skuId': '1', 'variationType': 'Size', 'variationValue': '30 mL',
                           'ingredientDesc': '-Zinc: Controls oil.\nWater, Zinc PCA, Glycerin',
                           'skuImages': {'image250': '/small.jpg', 'imageUrl': '/large.jpg'}},
            'regularChildSkus': []})]
        result = scraper.parse_snapshot(s, URL)
        self.assertEqual(result['price']['currency'], 'USD')
        self.assertEqual(result['price']['amount'], '6.00')
        self.assertEqual(result['image_url'], 'https://www.sephora.com/large.jpg')
        self.assertEqual(result['ingredients']['list'], ['Water', 'Zinc PCA', 'Glycerin'])
        self.assertEqual(result['selected_size'], '30 mL')
        self.assertIsNone(result['selected_shade'])
        self.assertEqual(result['shades'], [])

    def test_url_validation(self):
        for url in ['http://www.sephora.com/product/a', 'https://evil.test/product/a',
                    'https://www.sephora.com:invalid/product/a', 'https://user@www.sephora.com/product/a']:
            with self.subTest(url=url), self.assertRaises(scraper.ScrapeError):
                scraper.validate_url(url)

    def test_access_restrictions(self):
        for status, body in [(403, ''), (429, ''), (200, 'Verify you are human')]:
            with self.subTest(status=status), self.assertRaises(scraper.BlockedPage):
                scraper.check_access({'body_start': body}, status)

    def test_atomic_json_output(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'raw.json'
            scraper.write_result({'name': 'ə'}, path)
            self.assertEqual(json.loads(path.read_text()), {'name': 'ə'})
            self.assertEqual(len(list(path.parent.iterdir())), 1)


class BrowserTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from playwright.async_api import async_playwright
        import shutil
        self.pw = await async_playwright().start()
        binary = shutil.which('chromium')
        self.browser = await self.pw.chromium.launch(**({'executable_path': binary} if binary else {}))
        self.context = await self.browser.new_context()
        self.page = await self.context.new_page()

    async def asyncTearDown(self):
        await self.browser.close()
        await self.pw.stop()

    async def test_dynamic_content_and_ingredient_tab(self):
        product = json.loads(snapshot()['scripts'][0])
        html = '''<html><body><div id="app"></div><script>
        setTimeout(() => {
          document.querySelector('#app').innerHTML = '<h1>Fixture Foundation</h1>';
          const data = document.createElement('script'); data.type='application/ld+json';
          data.textContent=PRODUCT; document.body.append(data);
        }, 100);</script>
        <button aria-controls="inci" onclick="document.getElementById('inci').hidden=false">Ingredients</button>
        <section id="inci" hidden>Water, Glycerin</section></body></html>'''.replace('PRODUCT', json.dumps(json.dumps(product)))
        await self.page.route('**/*', lambda route: route.fulfill(status=200, content_type='text/html', body=html))
        result = await scraper.collect_page(self.page, URL, 3000)
        self.assertEqual(result['ingredients']['list'], ['Water', 'Glycerin'])
        self.assertEqual(result['price']['amount'], '24.90')

    async def test_403_is_not_product_data(self):
        await self.page.route('**/*', lambda route: route.fulfill(status=403, body='Access denied'))
        with self.assertRaises(scraper.BlockedPage):
            await scraper.collect_page(self.page, URL, 1000)

    async def test_not_carried_and_not_found(self):
        await self.page.route('**/*', lambda route: route.fulfill(status=404, body='Not found'))
        with self.assertRaises(scraper.ProductUnavailable):
            await scraper.collect_page(self.page, URL, 1000)

    async def test_transient_retry_and_block_no_retry(self):
        # Use the real browser lifecycle while replacing only the collection boundary.
        from playwright.async_api import TimeoutError
        good = scraper.parse_snapshot(snapshot(), URL)
        with patch.object(scraper, 'collect_page', side_effect=[TimeoutError('fixture timeout'), good]) as collect:
            with patch.object(scraper.asyncio, 'sleep', return_value=None):
                result = await scraper.scrape(URL, retries=1)
            self.assertEqual(result['name'], good['name'])
            self.assertEqual(collect.call_count, 2)
        with patch.object(scraper, 'collect_page', side_effect=scraper.BlockedPage('blocked')) as collect:
            with self.assertRaises(scraper.BlockedPage):
                await scraper.scrape(URL, retries=2)
            self.assertEqual(collect.call_count, 1)


if __name__ == '__main__':
    unittest.main()
