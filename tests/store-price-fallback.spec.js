import {test,expect} from './test-base';
import {readFileSync} from 'node:fs';
import {comparisonOffers,demoComparisonOffers,verifiedOffers,productVariants} from '../src/lib/pricing';
const seed=JSON.parse(readFileSync(new URL('../data/products.json',import.meta.url),'utf8'));
const offer=(extra={})=>({id:'exact',name:'Olivia',market:'AZ',currency:'AZN',shade:'Shade A',size:'30 ml',price_azn:35,verified:true,url:'https://olivia.az/test-product',sourceUrl:'https://olivia.az/test-product',last_checked:'2026-01-01',online_available:true,physical_available:null,...extra});
const store=(name,price_azn)=>({name,price_azn,in_stock:true,last_checked:'2026-01-01'});
const fixture=()=>({...structuredClone(seed[0]),id:'fallback-test',name:'STORE FALLBACK TEST',dupes:[],size:'30 ml',default_shade:'Shade A',variants:undefined,default_variant:undefined,shades:[{name:'Shade A',hex:'#eed5bd',undertone:'neutral'},{name:'Shade B',hex:'#ca9e74',undertone:'warm'}],offers:[offer()],stores:[store('Olivia',20),store('Rossmann',25),store('BirMarket',23)]});

test('each store prefers its exact variant quote then falls back to its own general price',()=>{
 const product=fixture();
 expect(comparisonOffers(product,'Shade A','30 ml').map(o=>[o.name,o.price_azn,o.price_scope])).toEqual([
  ['BirMarket',23,'product'],['Rossmann',25,'product'],['Olivia',35,'variant'],
 ]);
 expect(comparisonOffers(product,'Shade B','30 ml').map(o=>[o.name,o.price_azn,o.price_scope])).toEqual([
  ['Olivia',20,'product'],['BirMarket',23,'product'],['Rossmann',25,'product'],
 ]);
 // A general comparison price must not be passed off as a verified variant price.
 expect(verifiedOffers(product,'Shade B','30 ml')).toEqual([]);
});

test('general verified offers work without shade or size, with case-insensitive store matching',()=>{
 const product=fixture();product.offers.push(offer({id:'general',name:' OLIVIA ',shade:undefined,size:undefined,price_azn:22}));
 const offers=comparisonOffers(product,'Shade B','30 ml');
 expect(offers.filter(o=>o.name.trim().toLowerCase()==='olivia')).toHaveLength(1);
 expect(offers[0]).toMatchObject({id:'general',price_azn:22,price_scope:'product',verified:true});
});

test('no other shade, incompatible size, invalid amount, or foreign currency becomes a fallback',()=>{
 const product=fixture();product.price_azn=null;product.stores=[store('Rossmann',null),store('BirMarket',-1)];
 product.offers.push(offer({id:'wrong-size',shade:null,size:'50 ml',price_azn:1}),offer({id:'foreign',shade:null,currency:'USD',price_azn:2}));
 expect(comparisonOffers(product,'Shade B','30 ml')).toEqual([]);
 expect(comparisonOffers({offers:[],stores:[]},null,undefined)).toEqual([]);
 expect(comparisonOffers({stores:[store('Olivia',0)]},'Shade B',undefined)[0].price_azn).toBe(0);
});

for(const width of [390,1440])test(`modal store prices update on shade selection at ${width}px`,async({page})=>{
 const product=fixture();
 await page.addInitScript(product=>{localStorage.setItem('shiny-catalog-v1',JSON.stringify([product]));localStorage.setItem('shiny-language','"en"')},product);
 await page.setViewportSize({width,height:900});await page.goto('/#product=fallback-test');
 const offers=page.locator('.verified-offer');
 await expect(offers).toHaveCount(3);await expect(page.locator('.pending-retailer')).toHaveCount(0);
 const olivia=offers.filter({has:page.locator('b',{hasText:'Olivia'})});
 await expect(olivia).toContainText('35.00 ₼');await expect(olivia).toHaveAttribute('data-price-scope','variant');
 await page.locator('.modal-details .shade-picker button').nth(1).click();
 await expect(olivia).toContainText('20.00 ₼');await expect(olivia).toHaveAttribute('data-price-scope','product');await expect(olivia).toContainText('General product price');
 await expect(offers.filter({hasText:'Rossmann'})).toContainText('25.00 ₼');await expect(offers.filter({hasText:'BirMarket'})).toContainText('23.00 ₼');
 await expect(offers.first()).toContainText('Olivia');
 await page.locator('.modal-language').selectOption('az');await expect(olivia).toContainText('Məhsulun ümumi qiyməti');
 await page.locator('.modal-language').selectOption('ru');await expect(olivia).toContainText('Общая цена товара');
 await page.locator('.modal-details .shade-picker button').first().click();await expect(olivia).toContainText('35,00 ₼');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test('prod-11 falls back to its base price and never marks the reference as verified',()=>{
 const product=seed.find(p=>p.id==='prod-11');
 expect(product.price_azn).toBe(19);
 for(const shade of [product.default_shade,'Another shade']){
  expect(comparisonOffers(product,shade,product.size)).toEqual([expect.objectContaining({
   name:'Olivia',price_azn:19,price_scope:'reference',verified:false,url:'https://olivia.az/',
   online_available:null,physical_available:null,
  })]);
 }
 for(const price_azn of [null,undefined,-1,'invalid'])expect(comparisonOffers({price_azn},null)).toEqual([]);
 expect(comparisonOffers({price_azn:0},null)).toEqual([]);
 expect(comparisonOffers({price_azn:'19.00'},null)[0].price_azn).toBe(19);
 const exact=fixture();exact.price_azn=19;
 expect(comparisonOffers(exact,'Shade A','30 ml').some(o=>o.price_scope==='reference')).toBe(false);
});

for(const width of [390,1440])test(`prod-11 displays three sorted demo-price rows at ${width}px`,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('shiny-language','"en"'));
 await page.setViewportSize({width,height:900});await page.goto('/#product=prod-11');
 await expect(page.locator('.modal-price')).toContainText('19.00 ₼');
 const rows=page.locator('.verified-offer'),row=rows.filter({hasText:'Olivia'});
 await expect(rows).toHaveCount(3);await expect(row).toContainText('Olivia');
 await expect(row).toContainText('19.00 ₼');await expect(row).toHaveAttribute('data-price-scope','demo');
 await expect(row).toContainText('Demo price');await expect(page.locator('.demo-price-notice')).toContainText('not real retailer offers');
 await expect(rows.nth(0)).toContainText('BirMarket');await expect(rows.nth(0)).toContainText('17.86 ₼');await expect(rows.nth(2)).toContainText('20.90 ₼');
 await expect(row.getByRole('link')).toHaveAttribute('href','https://olivia.az/');
 await expect(page.locator('.lowest-badge')).toHaveText('Cheapest offer');await expect(page.locator('.no-verified-offers')).toHaveCount(0);
 await expect(page.locator('.pending-retailer')).toHaveCount(0);
 await page.locator('.modal-language').selectOption('az');await expect(row).toContainText('Demo qiymət');await expect(page.locator('.lowest-badge')).toHaveText('Ən ucuz təklif');
 await page.locator('.modal-language').selectOption('ru');await expect(row).toContainText('Демонстрационная цена');
});

test('all catalog products and variants get a linked base-price fallback when store prices are missing',()=>{
 expect(seed).toHaveLength(70);
 for(const product of seed){
  expect(product.price_azn,product.id).toBeGreaterThan(0);
  // Includes missing, null and empty store data from any future import/API record.
  for(const empty of [undefined,null,[]]){
   const unpriced={...product,stores:empty,offers:empty};
   for(const variant of [...productVariants(product),{shade:'New shade',size:'New size'}]){
    const offers=comparisonOffers(unpriced,variant.shade,variant.size);
    expect(offers,product.id).toHaveLength(1);
    expect(offers[0],product.id).toMatchObject({name:'Olivia',price_azn:product.price_azn,
     url:'https://olivia.az/',price_scope:'reference',verified:false});
   }
  }
 }
 const added={id:'newly-imported-product',price_azn:27.5,shades:[],stores:[]};
 expect(comparisonOffers(added,null)[0]).toMatchObject({price_azn:27.5,url:'https://olivia.az/'});
});

test('all 70 database-backed modals show a linked price row without explicit store or shade prices',async({page})=>{
 test.setTimeout(120000);
 const products=seed.map(p=>({...p,offers:[],stores:[],shades:p.shades.map(s=>{const copy={...s};delete copy.price_azn;return copy;})}));
 await page.addInitScript(products=>{localStorage.setItem('shiny-catalog-v1',JSON.stringify(products));localStorage.setItem('shiny-language','"en"')},products);
 // Use the database response directly so published-data reconciliation cannot mask missing offers.
 await page.route('https://dmexjkfdvmyrpkclhbpy.supabase.co/rest/v1/products**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(products)}));
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 for(const product of products){
  await page.evaluate(id=>{location.hash='product='+encodeURIComponent(id)},product.id);
  await expect(page.locator('#product-title')).toHaveText(product.name);
  const rows=page.locator('#store-comparison .verified-offer'),row=rows.filter({hasText:'Olivia'});
  await expect(rows,product.id).toHaveCount(3);
  await expect(row,product.id).toContainText(product.price_azn.toFixed(2)+' ₼');
  await expect(row).toHaveAttribute('data-price-scope','demo');
  await expect(row.getByRole('link')).toHaveAttribute('href','https://olivia.az/');
  await expect(page.locator('.no-verified-offers')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
 }
 expect(errors).toEqual([]);
});

test('demo prices cover every product and variant, round to cents, and never alter source data',()=>{
 const before=JSON.stringify(seed);
 for(const product of seed)for(const variant of productVariants(product)){
  const offers=demoComparisonOffers(product,variant.shade,variant.size);
  expect(offers.length,product.id).toBeGreaterThanOrEqual(3);
  expect(offers.map(o=>o.price_azn)).toEqual(offers.map(o=>o.price_azn).sort((a,b)=>a-b));
  for(const offer of offers.filter(o=>o.price_scope==='demo')){
   expect(offer.verified).toBe(false);expect(offer.last_checked).toBeUndefined();
   expect(offer.online_available).toBeNull();expect(offer.physical_available).toBeNull();
   expect(Number(offer.price_azn.toFixed(2))).toBe(offer.price_azn);
  }
 }
 expect(demoComparisonOffers({price_azn:19},null).map(o=>[o.name,o.price_azn])).toEqual([
  ['BirMarket',17.86],['Olivia',19],['Rossmann',20.9],
 ]);
 expect(demoComparisonOffers({price_azn:null},null)).toEqual([]);
 expect(JSON.stringify(seed)).toBe(before);
});

test('real retailer quotes take priority and three real stores need no generated data',()=>{
 const product=fixture();product.stores=[];product.price_azn=19;
 let offers=demoComparisonOffers(product,'Shade A','30 ml');
 expect(offers).toHaveLength(3);expect(offers.find(o=>o.name==='Olivia')).toMatchObject({price_azn:35,price_scope:'variant',verified:true});
 product.offers.push(offer({id:'bir',name:'BirMarket',price_azn:5}),offer({id:'ross',name:'Rossmann',price_azn:7}));
 offers=demoComparisonOffers(product,'Shade A','30 ml');
 expect(offers.map(o=>o.price_azn)).toEqual([5,7,35]);expect(offers.every(o=>o.price_scope!=='demo')).toBe(true);
});
