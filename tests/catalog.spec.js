import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {validateCatalog,mergeCatalog,isCalendarDate} from '../src/lib/catalog-schema';
import {verifiedOffers} from '../src/lib/offers';
import {indexCatalog,queryCatalog,PAGE_SIZE} from '../src/lib/catalog-query';
const seed=JSON.parse(readFileSync(new URL('../data/products.json',import.meta.url),'utf8'));
const defaults=()=>({min:'',max:'',skin:[],tier:[],brands:[],stores:[],availability:'all',productType:'all'});
function fixtureCatalog(count=200){return Array.from({length:count},(_,i)=>({...structuredClone(seed[i%seed.length]),id:`test-only-${i}`,name:`TEST FIXTURE ${String(i).padStart(3,'0')}`,brand:i%2?'TEST Brand A':'TEST Brand B',price_azn:null,rating:null,shades:[],stores:[],dupes:[],finish:null,skin_type:[],images:[{url:`https://photos.fixture.test/${i}.svg`,sourceUrl:'https://source.fixture.test/test-data',license:'TEST ONLY — NOT AN AUTHENTIC PRODUCT',width:300,height:400,sources:[{url:`https://photos.fixture.test/${i}.svg?w=300`,width:300},{url:`https://photos.fixture.test/${i}.svg?w=600`,width:600}]}],image:`https://photos.fixture.test/${i}.svg`,provenance:{source_url:'https://source.fixture.test/test-data',retrieved_at:'2026-10-22',kind:'community',license:'TEST FIXTURE ONLY'}}));}
async function loadCatalog(page,products){await page.goto('/');await page.evaluate(data=>localStorage.setItem('shiny-catalog-v1',JSON.stringify(data)),products);await page.reload();}
test.beforeEach(async({page})=>{await page.route('https://photos.fixture.test/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40"><rect width="30" height="40" fill="pink"/></svg>'}));await page.addInitScript(()=>localStorage.setItem('shiny-language','"en"'));});
test('200 test-only records paginate, search, filter and lazy-load without requesting the whole image catalog',async({page})=>{
 const requests=new Set(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://photos.fixture.test/**',route=>{requests.add(new URL(route.request().url()).pathname);return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#eadce2"/></svg>'});});
 await loadCatalog(page,fixtureCatalog());await expect(page.locator('.product-card')).toHaveCount(PAGE_SIZE);await expect(page.locator('.results-toolbar')).toContainText('200');await expect(page.locator('.catalog-pagination')).toContainText('Page 1 of 12');expect(requests.size).toBeLessThanOrEqual(PAGE_SIZE);
 await page.getByRole('button',{name:'Next',exact:true}).click();await expect(page.locator('.catalog-pagination')).toContainText('Page 2 of 12');await expect(page.locator('.product-card').first()).toContainText('TEST FIXTURE 018');
 await page.locator('.catalog-search input').fill('  fixture   199 ');await expect(page.locator('.product-card')).toHaveCount(1);await expect(page.locator('.product-card').first()).toContainText('199');
 await page.locator('.catalog-search input').fill('');await page.getByLabel('TEST Brand A',{exact:true}).check();await expect(page.locator('.results-toolbar')).toContainText('100');
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);expect(errors).toEqual([]);
});
test('unknown prices and products with no shades open safely and do not pretend to cost zero',async({page})=>{
 await loadCatalog(page,fixtureCatalog(1));await expect(page.locator('.product-card')).toContainText('Price not verified');await page.locator('.image-open').click();await expect(page.locator('.modal-price')).toContainText('Price not verified');await expect(page.locator('.modal-details h4')).toContainText('No shade variants');await expect(page.locator('.no-verified-offers')).toBeVisible();await expect(page.locator('.modal-details .shade-picker button')).toHaveCount(0);
});
test('corrupt saved data falls back visibly, remains recoverable, and cannot crash cards',async({page})=>{
 const products=structuredClone(seed);products[0].rating='bad';const errors=[];page.on('pageerror',e=>errors.push(e.message));await loadCatalog(page,products);await expect(page.getByRole('status').filter({hasText:'Saved catalog is invalid'})).toBeVisible();await expect(page.locator('.product-card')).toHaveCount(seed.length);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shiny-catalog-v1'))[0].rating)).toBe('bad');expect(errors).toEqual([]);
});
test('bulk import previews and atomically upserts source-declared records, then survives reload',async({page})=>{
 await page.goto('/#admin');const input=fixtureCatalog(200);await page.getByLabel('Import catalog',{exact:true}).setInputFiles({name:'test-only-catalog.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(input))});await expect(page.locator('.import-preview')).toContainText('200 new');await page.getByRole('button',{name:'Save import',exact:true}).click();await expect(page.getByRole('status')).toContainText('Catalog imported');await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shiny-catalog-v1')).length)).toBe(215);
 await page.getByLabel('Import catalog',{exact:true}).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('[{"id":"bad"}]')});await expect(page.getByRole('alert')).toContainText('No changes');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shiny-catalog-v1')).length)).toBe(215);
});
test('missing shade images never reuse the other shade or base image, and valid SVG assets are displayed',async({page})=>{
 await page.route('**/products/authorized-test.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8" fill="pink"/></svg>'}));
 const products=structuredClone(seed);products[0].image='/products/authorized-test.svg';products[0].shades[0].image='/products/authorized-test.svg';await loadCatalog(page,products);await expect(page.locator('.product-card').first().locator('img')).toBeVisible();await page.locator('.image-open').first().click();await expect(page.locator('.modal-image img')).toHaveAttribute('src','/products/authorized-test.svg');await page.locator('.modal-details .shade-picker button').nth(1).click();await expect(page.locator('.modal-image .photo-placeholder')).toBeVisible();await expect(page.locator('.modal-image img')).toHaveCount(0);
});
test('browser back closes a product and admin navigation preserves its intended destination',async({page})=>{
 await page.goto('/');await page.locator('.image-open').first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.goBack();await expect(page.getByRole('dialog')).toHaveCount(0);await page.goto('/#admin');await page.reload();await page.getByRole('button',{name:'Beauty Calendar',exact:true}).click();await expect(page.locator('.admin-page')).toHaveCount(0);await expect(page.locator('.navbar nav button.active')).toHaveText('Beauty Calendar');
});
test('validation rejects malformed records, broken provenance and impossible dates',()=>{
 expect(validateCatalog(seed).valid).toBe(true);expect(validateCatalog(fixtureCatalog(),{requireProvenance:true}).valid).toBe(true);
 for(const bad of [null,{},[{...seed[0],rating:'bad'}],[{...seed[0],shades:[null]}],[{...seed[0],images:{bad:true}}]])expect(validateCatalog(bad,{requireProvenance:true}).valid).toBe(false);
 expect(validateCatalog([seed[0],seed[0]]).valid).toBe(false);expect(isCalendarDate('2026-02-30')).toBe(false);expect(isCalendarDate('2024-02-29')).toBe(true);
 const base={id:'test-only',name:'TEST',market:'AZ',currency:'AZN',shade:'X',size:'30 ml',price_azn:1,verified:true,url:'https://example.com/test',sourceUrl:'https://example.com/test',last_checked:'2026-02-30',online_available:true,physical_available:null};expect(verifiedOffers({offers:[base]},'X','30 ml')).toEqual([]);expect(verifiedOffers({offers:[{...base,last_checked:'2026-01-01',url:'https://'}]},'X','30 ml')).toEqual([]);
 const incoming=[{...fixtureCatalog(1)[0],id:seed[0].id}];const merged=mergeCatalog(seed,incoming);expect(merged.valid).toBe(true);expect(merged.products).toHaveLength(15);expect(merged.updated).toBe(1);
});
test('indexed search handles a 200-record workload within a measured budget',()=>{
 const products=fixtureCatalog(),start=performance.now(),index=indexCatalog(products);for(let i=0;i<100;i++)queryCatalog(index,{query:'fixture',filters:defaults(),sort:'priceAsc'});const elapsed=performance.now()-start;console.log(`200-record index + 100 queries: ${elapsed.toFixed(1)} ms`);expect(elapsed).toBeLessThan(1000);
});
test('CLI import dry run is read-only, writes atomically, and rejects records without provenance',async()=>{
 const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {execFileSync}=await import('node:child_process');
 const directory=mkdtempSync(join(tmpdir(),'shiny-import-test-'));try{
  const target=join(directory,'products.json'),input=join(directory,'incoming.json');writeFileSync(target,JSON.stringify(seed));writeFileSync(input,JSON.stringify(fixtureCatalog(200)));
  const command=['scripts/import-catalog.mjs',input,'--target',target];const report=JSON.parse(execFileSync(process.execPath,command,{encoding:'utf8'}));expect(report.total).toBe(215);expect(JSON.parse(readFileSync(target,'utf8'))).toHaveLength(15);
  execFileSync(process.execPath,[...command,'--write']);expect(JSON.parse(readFileSync(target,'utf8'))).toHaveLength(215);
  writeFileSync(input,JSON.stringify([seed[0]]));expect(()=>execFileSync(process.execPath,[...command,'--write'],{stdio:'pipe'})).toThrow();expect(JSON.parse(readFileSync(target,'utf8'))).toHaveLength(215);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('unknown product links and null-price dialogs stay usable in AZ, EN and RU on mobile',async({page})=>{
 const products=fixtureCatalog(1);await loadCatalog(page,products);await page.setViewportSize({width:360,height:800});await page.locator('.image-open').click();
 for(const lang of ['az','en','ru']){await page.locator('.modal-language').selectOption(lang);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await expect(page.locator('.modal-details .shade-picker button')).toHaveCount(0);}
 await page.keyboard.press('Escape');await page.goto('/#product=not-a-real-id');await expect(page.getByRole('alert')).toBeVisible();
});
test('verified minimum prices drive cards, exact-variant details and numeric filters consistently',async({page})=>{
 const products=fixtureCatalog(1);products[0].size='30 ml';products[0].offers=[{id:'test-offer',name:'TEST RETAILER',market:'AZ',currency:'AZN',shade:null,size:'30 ml',price_azn:40,verified:true,url:'https://example.com/test',sourceUrl:'https://example.com/test',last_checked:'2026-01-01',online_available:true,physical_available:null}];
 await loadCatalog(page,products);await expect(page.locator('.product-bottom')).toContainText('40.00');await page.getByLabel('Price range Max',{exact:true}).fill('50');await expect(page.locator('.product-card')).toHaveCount(1);await page.locator('.image-open').click();await expect(page.locator('.modal-price')).toContainText('40.00');await expect(page.locator('.verified-offer')).toHaveCount(1);
});
