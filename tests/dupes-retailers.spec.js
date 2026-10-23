import {test,expect} from './test-base';
import {readFileSync} from 'node:fs';
import {resolveAlternatives} from '../src/lib/dupes';
import {indexCatalog,queryCatalog} from '../src/lib/catalog-query';
import {defaultVariant,verifiedOffers} from '../src/lib/pricing';
import {validateCatalog} from '../src/lib/catalog-schema';
const products=JSON.parse(readFileSync(new URL('../data/products.json',import.meta.url),'utf8'));
const filters={min:'',max:'',skin:[],tier:[],brands:[],stores:[],availability:'all',productType:'all'};
const ruby=products.find(p=>p.id==='obf-0773602040605');
test('editorial pairs contain real same-category products, no invented match percentages, and exact Pioneer offers',()=>{
 const premium=products.filter(p=>resolveAlternatives(p,products).length);expect(premium).toHaveLength(8);expect(premium.flatMap(p=>resolveAlternatives(p,products))).toHaveLength(10);
 for(const p of premium)for(const r of resolveAlternatives(p,products)){expect(r.product.category).toBe(p.category);expect(r.relation.match_percentage).toBeNull();for(const lang of ['az','en','ru']){expect(r.relation.reason[lang]).toBeTruthy();expect(r.relation.difference[lang]).toBeTruthy()}expect(r.relation.sources.length).toBeGreaterThanOrEqual(2);expect(r.price.amount).toBeLessThan(p.price_azn)}
 const alternative=resolveAlternatives(ruby,products)[0];expect(alternative.variant.shade).toBe('20 Pioneer');expect(alternative.price.verified).toBe(true);expect(alternative.price.amount).toBe(20.49);expect(verifiedOffers(alternative.product,'65 Seductress','5ml')).toEqual([]);
 expect(validateCatalog(products).valid).toBe(true);const fixture=structuredClone(products);fixture.find(p=>p.id===ruby.id).dupes[0].sources[0].url='javascript:alert(1)';expect(validateCatalog(fixture).valid).toBe(false);
});
test('dupe search finds premium pairs by alternative brand and does not affect normal own-brand search',()=>{
 const index=indexCatalog(products);const options={filters,category:'all',query:'Maybelline'};expect(queryCatalog(index,{...options,view:'dupes'}).some(p=>p.id===ruby.id)).toBe(true);expect(queryCatalog(index,{...options,view:'discover'}).some(p=>p.id===ruby.id)).toBe(false);
 const budget=queryCatalog(index,{filters:{...filters,max:'25'},view:'dupes'});expect(budget.some(p=>p.id===ruby.id)).toBe(true);const brand=queryCatalog(index,{filters:{...filters,brands:['NYX']},view:'dupes'});expect(brand.map(p=>p.id)).toEqual(['obf-0810763030585','obf-0773602544172']);
 const edited=structuredClone(ruby);edited.dupes[0].alternative_shade='MISSING SHADE';expect(resolveAlternatives(edited,products)).toEqual([]);
});
test('dupe finder shows premium and alternatives together, deep-links the exact shade, and preserves locale',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('shiny-language','"en"'));await page.goto('/#dupes');await expect(page.locator('.dupe-pair')).toHaveCount(8);await expect(page.locator('.dupe-item')).toHaveCount(10);const pair=page.getByRole('region',{name:`${ruby.brand} ${ruby.name}`,exact:true});await expect(pair).toContainText('20 Pioneer');await expect(pair).toContainText('20.49');await expect(pair.locator('.match-pill')).toHaveCount(0);await pair.locator('.dupe-item>button.card-compare').click();await expect(page.locator('.modal-details h4')).toContainText('20 Pioneer');await expect(page.locator('.modal-price')).toContainText('20.49');await expect(page.locator('.verified-offer')).toHaveCount(1);await expect(page.locator('.verified-offer')).toContainText('Olivia');await expect(page.locator('.pending-retailer')).toHaveCount(2);await page.keyboard.press('Escape');await expect(page).toHaveURL(/#dupes$/);await page.reload();await expect(page.locator('.dupe-pair')).toHaveCount(8);await page.locator('.language select').selectOption('ru');await expect(page.locator('.dupe-intro')).toContainText('премиальный');await expect(page.locator('.dupe-sample-label').first()).toContainText('редакции');
});
test('dupe pairs support mobile and tablet without horizontal overflow',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('shiny-language','"en"'));for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:900});await page.goto('/#dupes');await expect(page.locator('.dupe-pair')).toHaveCount(8);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),`overflow at ${width}`).toBe(false)}
});
test('price comparison exposes confirmed offers and separately marks missing retailer quotes',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('shiny-language','"en"'));await page.goto('/#product=obf-30148093');await expect(page.locator('.verified-offer')).toHaveCount(1);await expect(page.locator('.verified-offer')).toContainText('20.49');await expect(page.locator('.pending-retailer')).toHaveCount(2);await expect(page.locator('.pending-retailers')).toContainText('Rossmann');await expect(page.locator('.pending-retailers')).toContainText('BirMarket');expect(await page.locator('.pending-retailers').innerText()).not.toContain('₼');await page.locator('.modal-language').selectOption('az');await expect(page.locator('.pending-retailers')).toContainText('təsdiqlənmiş təklif yoxdur');
 const v=defaultVariant(products.find(p=>p.id==='obf-30148093'));expect(v.shade).toBe('25 Red-Hot');
});
