import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reconcileBundledPhotos} from '../src/catalog';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const products=read('../data/products.json'),attribution=read('../data/photo-attribution.json'),legacy=read('./fixtures/catalog-before-photos.json');
test('70 authentic product lines with reviewed photography cover all 12 categories with five or more each',()=>{
 expect(products).toHaveLength(70);const categories=new Map();
 for(const p of products){expect(p.gtin).toBeTruthy();if(p.image)expect(p.images[0].review.status).toBe('approved');else expect(p.image_reviews.some(r=>r.status==='rejected')).toBe(true);expect(p.provenance.source_url).toContain('openbeautyfacts.org/product/');expect(p.stores).toEqual([]);expect(p.price_azn).toBeNull();categories.set(p.category,(categories.get(p.category)||0)+1)}
 expect(categories.size).toBe(12);for(const count of categories.values())expect(count).toBeGreaterThanOrEqual(5);
 for(const photo of attribution.photos){expect(photo.author).toBeTruthy();expect(photo.license).toBe('CC-BY-SA-3.0');for(const f of photo.files){const bytes=readFileSync(new URL('../public'+f.url,import.meta.url));expect(createHash('sha256').update(bytes).digest('hex')).toBe(f.sha256);expect(bytes.subarray(0,2).toString('hex')).toBe('ffd8')}}
});
test('legacy snapshots gain new photos and products without overwriting custom admin edits',()=>{
 const saved=structuredClone(legacy);saved[0].price_azn=12;saved[0].image='data:image/webp;base64,YQ==';saved[10].price_azn=25;
 const result=reconcileBundledPhotos(saved);expect(result.filter(p=>products.some(source=>source.id===p.id&&source.image)&&p.image)).toHaveLength(41);expect(result.find(p=>p.id==='prod-1').price_azn).toBe(12);expect(result.find(p=>p.id==='prod-1').image).toBe(saved[0].image);expect(result.find(p=>p.id==='prod-11').price_azn).toBe(25);expect(result.find(p=>p.id==='prod-11').shades[0].name).toBe('04 Milk Chocolate');
 const standalone=[{...saved[0],dupes:[]}];expect(reconcileBundledPhotos(standalone)).toEqual(standalone);
});
test('all catalog pages display approved photos or clean placeholders and offer source attribution and catalog download',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('shiny-language','"en"'));await page.goto('/');
 for(let index=0;index<4;index++){
  const cards=page.locator('.product-card');await expect(cards).toHaveCount(index===3?16:18);
  for(const card of await cards.all()){await card.scrollIntoViewIfNeeded();const id=await card.getAttribute('data-product-id'),product=products.find(p=>p.id===id);if(product.image){await expect(card.locator('.product-photo img')).toBeVisible();await expect.poll(()=>card.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true)}else{await expect(card.locator('.photo-placeholder')).toBeVisible();await expect(card.locator('.product-photo img')).toHaveCount(0)}}
  if(index<3)await page.getByRole('button',{name:'Next',exact:true}).click();
 }
 const response=await page.request.get('/data/products.json');expect(response.ok()).toBe(true);expect(await response.json()).toHaveLength(70);await expect(page.locator('.photo-data-credit a[href*="creativecommons"]')).toBeAttached();
});
test('authentic shade selection changes exact SKU photo and survives language changes',async({page})=>{
 const product=products.find(p=>p.gtin==='4250947598283');await page.goto('/#product='+product.id);const shades=page.locator('.modal-details .shade-picker button');await expect(shades).toHaveCount(3);
 for(let index=0;index<3;index++){await shades.nth(index).click();const asset=product.shades[index].images[0];await expect(page.locator('.modal-image img')).toHaveAttribute('src',asset.detailUrl||asset.url);await expect(shades.nth(index)).toHaveAttribute('aria-pressed','true');await expect(page.locator('.modal-details h4')).toContainText(product.shades[index].name);await expect(page.locator('.modal-image img')).toBeVisible()}
 await page.locator('.modal-language').selectOption('ru');await expect(shades.nth(2)).toHaveAttribute('aria-pressed','true');await expect(page.locator('.product-source')).toContainText('CC-BY-SA-3.0');
});
