import {test,expect} from './test-base';
import {readFileSync} from 'node:fs';
import {comparisonOffers,verifiedOffers} from '../src/lib/pricing';
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
 const product=fixture();product.stores=[store('Rossmann',null),store('BirMarket',-1)];
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
