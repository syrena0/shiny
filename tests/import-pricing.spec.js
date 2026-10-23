import {verificationReport} from '../src/lib/image-review';
import {test,expect} from '@playwright/test';
import {readFileSync,mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';
import {parseCSV,writeCSV,planFeedImport,normalizeSourceFeed} from '../src/lib/feed-import';
import {variantPrice,catalogPrice,productVariants,numericPrice,verifiedOffers,allVerifiedOffers} from '../src/lib/pricing';
import {optimizeImage,checkRemoteURL,isPublicAddress} from '../scripts/lib/image-download.mjs';
const seed=JSON.parse(readFileSync(new URL('../data/products.json',import.meta.url),'utf8'));
const registry={sources:[{id:'test-supplier',enabled:true,kind:'retailer',terms_url:'https://supplier.test/license',license:'TEST PERMISSION',price_import:true,price_hosts:['retailer.test'],image_hosts:['images.supplier.test'],page_hosts:['supplier.test'],trusted_studio:true}]};
function fixture(){return {...structuredClone(seed.find(p=>p.gtin==='4250947598283')),id:'test-product',name:'TEST PRODUCT',brand:'TEST BRAND',price_azn:null,size:'30 ml',gtin:'1234567890123',default_shade:'Test A',shades:[{name:'Test A',hex:null,undertone:'unknown',size:'30 ml',gtin:'1234567890123'},{name:'Test B',hex:null,undertone:'unknown',size:'30 ml',gtin:'1234567890124'}],dupes:[],image:'',images:[]};}
function row(extra={}){return {source_id:'test-supplier',product_id:'test-product',gtin:'1234567890123',brand:'TEST BRAND',product_name:'TEST PRODUCT',shade:'Test A',size:'30 ml',store:'TEST RETAILER',price:'24.90',currency:'AZN',market:'AZ',price_verified:'true',purchase_url:'https://retailer.test/product',price_source_url:'https://retailer.test/product',last_checked:'2026-10-21',online_available:'true',physical_available:'false',...extra};}
const offer=(extra={})=>({id:'test-offer',name:'TEST RETAILER',market:'AZ',currency:'AZN',shade:'Test A',size:'30 ml',price_azn:24.9,verified:true,url:'https://retailer.test/product',sourceUrl:'https://retailer.test/product',last_checked:'2026-10-21',online_available:true,physical_available:false,...extra});
test('CSV parser handles BOM, quoted commas, escaped quotes and multiline fields, rejecting malformed records',()=>{
 const rows=[row({product_name:'TEST, "QUOTED"\nPRODUCT'})];expect(parseCSV(writeCSV(rows))).toEqual(rows.map(r=>Object.fromEntries(Object.keys(parseCSV(writeCSV(rows))[0]).map(k=>[k,r[k]||'']))));
 for(const csv of ['brand,brand,source_id,product_name\na,b,c,d','source_id,brand,product_name\na,b','source_id,brand,product_name\na,b,"open','source_id,brand,product_name\na,b,"closed"x'])expect(()=>parseCSV(csv)).toThrow();
});
test('matching is exact, transactional and variant scoped; no guesses or foreign-currency prices',()=>{
 const p=fixture(),source=structuredClone(p);const imported=planFeedImport([row()], [p],registry);expect(imported.valid).toBe(true);expect(p).toEqual(source);expect(catalogPrice(imported.products[0])).toBe(24.9);
 for(const change of [{brand:'WRONG BRAND'},{shade:'Wrong shade'},{currency:'USD'},{price:'NaN'},{price:'-1'},{price_verified:'false'},{last_checked:'2026-02-30'},{price_source_url:'https://unauthorized.test/item'},{gtin:'1234567890124'}])expect(planFeedImport([row(change)],[p],registry).valid,JSON.stringify(change)).toBe(false);
 const ambiguous=[p,{...structuredClone(p),id:'another'}];expect(planFeedImport([row({product_id:'',gtin:''})],ambiguous,registry).valid).toBe(false);
 const duplicate=planFeedImport([row(),row()],[p],registry);expect(duplicate.valid).toBe(false);expect(p.offers).toBeUndefined();
});
test('bulk 200-product CSV import preserves leading-zero GTINs and carries verified AZN prices',()=>{
 const rows=Array.from({length:200},(_,i)=>row({product_id:'feed-test-'+i,gtin:'00000000'+String(i).padStart(5,'0'),product_name:'TEST PRODUCT '+i,category:'tonal_krem',shade:'',size:'30 ml'}));
 const result=planFeedImport(parseCSV(writeCSV(rows)),[],registry);expect(result.valid).toBe(true);expect(result.products).toHaveLength(200);expect(result.products[0].gtin).toBe('0000000000000');expect(result.products.filter(p=>catalogPrice(p)===24.9)).toHaveLength(200);
});
test('image imports reject unlicensed hosts and non-studio roles without publishing remote images',()=>{
 const image={image_url:'https://images.supplier.test/product.jpg',image_source_url:'https://supplier.test/product',image_license:'TEST PERMISSION',image_author:'TEST PHOTOGRAPHER',image_type:'studio',background:'white',price:''};
 const good=planFeedImport([row(image)],[fixture()],registry);expect(good.valid).toBe(true);expect(good.jobs).toHaveLength(1);expect(good.products[0].image).toBe('');
 for(const role of ['review','influencer','collage','banner','screenshot']){const bad=planFeedImport([row({...image,image_type:role})],[fixture()],registry);expect(bad.jobs).toHaveLength(0);expect(bad.report[0].image_status).toBe('rejected');}
 for(const change of [{image_license:''},{image_url:'https://wrong.test/img.jpg'},{image_author:''},{image_source_url:'https://wrong.test/product'}])expect(planFeedImport([row({...image,...change})],[fixture()],registry).valid).toBe(false);
});
test('numeric parsing, unavailable offers and exact shade/size prevent cross-variant price leakage',()=>{
 for(const input of [undefined,null,'','NaN','24.9 USD',-1,Infinity,NaN])expect(numericPrice(input)).toBeNull();expect(allVerifiedOffers({offers:[null,{id:1,name:5,size:30},offer({name:4})]})).toEqual([]);expect(numericPrice('24,90')).toBe(24.9);expect(numericPrice(0)).toBe(0);
 const p=fixture();p.offers=[offer(),offer({id:'cheaper',price_azn:'20.90'}),offer({id:'wrong-shade',shade:'Test B',price_azn:1}),offer({id:'wrong-size',size:'10 ml',price_azn:2}),offer({id:'unavailable',price_azn:3,online_available:false,physical_available:false})];
 expect(variantPrice(p).amount).toBe(20.9);expect(variantPrice(p).from).toBe(true);expect(verifiedOffers(p,'Test A','50 ml')).toEqual([]);p.price_azn=40;expect(variantPrice({...p,offers:[]},productVariants(p)[1]).amount).toBeNull();
});
test('optimizer makes bounded WebP assets and rejects blank images and private destinations',async()=>{
 const bytes=await sharp(Buffer.from('<svg width="800" height="800"><rect width="800" height="800" fill="white"/><rect x="320" y="160" width="160" height="480" fill="#d19d81"/></svg>')).png().toBuffer();
 const result=await optimizeImage(bytes);expect(result.neutral_border).toBe(1);expect((await sharp(result.card).metadata()).width).toBe(600);expect((await sharp(result.detail).metadata()).format).toBe('webp');
 await expect(optimizeImage(await sharp({create:{width:500,height:500,channels:3,background:'white'}}).png().toBuffer())).rejects.toThrow('Blank');
 for(const address of ['127.0.0.1','10.1.2.3','169.254.169.254','::1','::ffff:127.0.0.1'])expect(isPublicAddress(address)).toBe(false);
 await expect(checkRemoteURL('https://127.0.0.1/img.jpg',['127.0.0.1'])).rejects.toThrow();await expect(checkRemoteURL('https://supplier.test/img?api_key=secret',['supplier.test'])).rejects.toThrow();
});
test('feed CLI rejects invalid data without changing the catalog and dry-run performs no downloads',()=>{
 const directory=mkdtempSync(join(tmpdir(),'shiny-feed-test-'));try{mkdirSync(join(directory,'data'));const catalog=join(directory,'data/products.json');writeFileSync(catalog,JSON.stringify([fixture()]));writeFileSync(join(directory,'data/import-sources.json'),JSON.stringify(registry));const input=join(directory,'feed.csv');writeFileSync(input,writeCSV([row()]));
 const args=['scripts/import-feed.mjs',input,'--root',directory];const before=readFileSync(catalog,'utf8');expect(JSON.parse(execFileSync(process.execPath,args,{encoding:'utf8'})).mode).toBe('dry-run');expect(readFileSync(catalog,'utf8')).toBe(before);execFileSync(process.execPath,[...args,'--write']);expect(catalogPrice(JSON.parse(readFileSync(catalog,'utf8'))[0])).toBe(24.9);writeFileSync(catalog,before);writeFileSync(input,writeCSV([row({currency:'USD'})]));expect(()=>execFileSync(process.execPath,[...args,'--write'],{stdio:'pipe'})).toThrow();expect(readFileSync(catalog,'utf8')).toBe(before);
 }finally{rmSync(directory,{recursive:true,force:true})}
});
test('cards and dialogs share exact-variant prices, sizes and compare links on mobile',async({page})=>{
 const p=fixture();p.offers=[offer(),offer({id:'second',price_azn:30}),offer({id:'other-shade',shade:'Test B',price_azn:12})];p.variants=[{id:'a30',shade:'Test A',size:'30 ml',images:[]},{id:'a50',shade:'Test A',size:'50 ml',images:[]},{id:'b30',shade:'Test B',size:'30 ml',images:[]}];
 await page.addInitScript(p=>{localStorage.setItem('shiny-catalog-v1',JSON.stringify([p]));localStorage.setItem('shiny-language','"en"')},p);await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('.product-bottom')).toContainText('24.90 ₼');await expect(page.locator('.product-bottom small')).toHaveText('From');await page.getByRole('button',{name:'Test B',exact:true}).click();await expect(page.locator('.product-bottom')).toContainText('12.00 ₼');await page.locator('.card-compare').click();await expect(page.locator('.modal-price')).toContainText('12.00 ₼');await expect(page.locator('.verified-offer')).toHaveCount(1);await page.locator('.modal-details .shade-picker button').first().click();await expect(page.locator('.modal-price')).toContainText('24.90 ₼');await page.getByLabel('Size',{exact:true}).selectOption('1');await expect(page.locator('.modal-price')).toContainText('Price unavailable');await expect(page.locator('.verified-offer')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
test('verification dashboard previews CSV, blocks invalid sources and supports localized reports',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('shiny-language','"en"'));await page.goto('/#admin');await page.locator('.verification-panel summary').click();await expect(page.locator('.verification-panel summary')).toContainText(`${verificationReport(seed).filter(p=>p.image_status==='ready').length}/70`);await expect(page.locator('.verification-panel summary')).toContainText('3/70');await expect(page.locator('.verification-row')).toHaveCount(20);
 await page.getByLabel('Import supplier CSV',{exact:true}).setInputFiles({name:'test.csv',mimeType:'text/csv',buffer:Buffer.from(writeCSV([row()]))});await expect(page.locator('.feed-preview')).toContainText('Source is not authorized');await expect(page.getByRole('button',{name:'Apply catalog updates',exact:true})).toBeDisabled();await page.locator('.language select').selectOption('az');await expect(page.locator('.verification-panel summary')).toContainText('Şəkil və qiymət');
});

test('configured JSON API and supplier CSV mappings preserve exact identity',()=>{
 const source={id:'test-supplier',records_path:'products',field_map:{gtin:'barcode',brand:'brand.label',product_name:'title'},defaults:{category:'mascara'}};
 expect(normalizeSourceFeed({products:[{barcode:'0012345678901',brand:{label:'TEST'},title:'TEST ITEM'}]},source)).toEqual([{source_id:'test-supplier',category:'mascara',gtin:'0012345678901',brand:'TEST',product_name:'TEST ITEM'}]);
 expect(()=>normalizeSourceFeed({products:[{barcode:123,brand:{label:'TEST'},title:'TEST'}]},source)).toThrow('strings');
 const csv=parseCSV('sku,title,brand\n000123,TEST ITEM,TEST\n',{supplier:true});expect(normalizeSourceFeed(csv,{id:'test-supplier',field_map:{gtin:'sku',product_name:'title',brand:'brand'}})[0].gtin).toBe('000123');
});
test('dashboard approval and rejection change primary images without altering prices',async({page})=>{
 const p=structuredClone(seed[0]),asset=p.images[0];p.image='';p.images=[];p.shades[0].image='';p.shades[0].images=[];p.image_reviews=[{variant_key:'shade-0',shade:p.shades[0].name,size:p.size,status:'needs-review',candidate:asset}];
 await page.addInitScript(p=>{localStorage.setItem('shiny-catalog-v1',JSON.stringify([p]));localStorage.setItem('shiny-language','"en"')},p);await page.goto('/#admin');await page.locator('.verification-panel summary').click();await expect(page.locator('.verification-row>.photo-placeholder')).toBeVisible();await page.getByRole('button',{name:'Approve studio image',exact:true}).click();await expect(page.locator('.verification-row>.product-photo img')).toBeVisible();await page.getByRole('button',{name:'Reject image',exact:true}).click();await expect(page.locator('.verification-row>.photo-placeholder')).toBeVisible();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('shiny-catalog-v1'))[0]);expect(saved.price_azn).toBe(p.price_azn);expect(saved.image).toBe('');expect(saved.image_reviews[0].status).toBe('rejected');
});
test('previously saved consumer photos are quarantined even when they have source metadata',async({page})=>{
 const p=structuredClone(seed.find(p=>p.id==='prod-13'));const candidate=p.image_reviews.find(r=>r.candidate).candidate;p.image=candidate.url;p.images=[candidate];p.shades=[];let requested=false;await page.route('**/products/authentic/3337875598996*',route=>{requested=true;return route.abort()});await page.addInitScript(p=>localStorage.setItem('shiny-catalog-v1',JSON.stringify([p])),p);await page.goto('/');await expect(page.locator('.product-card .photo-placeholder')).toBeVisible();await page.locator('.image-open').click();await expect(page.locator('.modal-image .photo-placeholder')).toBeVisible();expect(requested).toBe(false);
});

test('enriching one shade size or adding another size preserves every existing shade',()=>{
 const p=fixture();delete p.size;for(const s of p.shades)delete s.size;
 const enriched=planFeedImport([row()],[p],registry);expect(enriched.valid).toBe(true);expect(productVariants(enriched.products[0])).toHaveLength(2);expect(productVariants(enriched.products[0])[0].size).toBe('30 ml');expect(productVariants(enriched.products[0])[1].shade).toBe('Test B');
 const sized=planFeedImport([row({gtin:'1234567890125',size:'50 ml'})],enriched.products,registry);expect(sized.valid).toBe(true);expect(productVariants(sized.products[0]).map(v=>[v.shade,v.size])).toEqual([['Test A','30 ml'],['Test B',undefined],['Test A','50 ml']]);
});

test('dashboard hash links work from an already open storefront and browser Back returns to shop',async({page})=>{
 await page.goto('/');await page.goto('/#admin');await expect(page.locator('.verification-panel')).toBeVisible();await page.goBack();await expect(page.locator('.admin-page')).toHaveCount(0);await expect(page.locator('.product-card')).toHaveCount(18);
});
