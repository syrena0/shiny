import {test,expect} from '@playwright/test';
import {calendarMonths,resolveMonth} from '../src/data/calendar';
import {readFileSync} from 'node:fs';
import {verifiedOffers} from '../src/lib/offers';
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('shiny-language','"en"'));await page.clock.setFixedTime(new Date('2026-10-22T12:00:00Z'));});
test('all twelve chocolates flip and reveal exactly three editorial or empty slots',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Beauty Calendar',exact:true}).click();await expect(page.locator('.month-chocolate')).toHaveCount(12);
 for(let i=0;i<12;i++){
  await page.locator('.month-chocolate').nth(i).click();await expect(page.locator('#month-title')).toContainText(['January','February','March','April','May','June','July','August','September','October','November','December'][i]);await expect(page.locator('#month-title')).toBeFocused();await expect(page.locator('.month-chocolate[aria-pressed=true]')).toHaveCount(1);await expect(page.locator('.calendar-pick-card')).toHaveCount(3);
  if(i<10){await expect(page.locator('.reveal-heading')).toContainText('Editorial selection');await expect(page.locator('.calendar-image-link')).toHaveCount(3)}else{await expect(page.locator('.calendar-empty-image')).toHaveCount(3);await expect(page.locator('.reveal-heading')).toContainText('Coming soon')}
 }
 await page.getByRole('button',{name:'Back to candy box'}).click();await expect(page.locator('.calendar-pick-card')).toHaveCount(0);await expect(page.locator('.month-chocolate').last()).toBeFocused();expect(errors).toEqual([]);
});
test('keyboard, locale persistence, favorites, deep links and comparison',async({page})=>{
 await page.goto('/');const feb=page.locator('.month-chocolate').nth(1);await feb.focus();await page.keyboard.press('Enter');await expect(page.locator('#month-title')).toContainText('February');await page.locator('.language select').selectOption('ru');await expect(page.locator('#month-title')).toContainText('Февраль');await expect(feb).toHaveAttribute('aria-pressed','true');
 await page.locator('.language select').selectOption('en');await page.locator('.calendar-pick-card .favorite-button').first().click();await expect(page.locator('.calendar-pick-card .favorite-button').first()).toHaveAttribute('aria-pressed','true');await page.locator('.calendar-card-actions').first().getByRole('button',{name:'Compare prices'}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('.no-verified-offers')).toContainText('No verified store offers');await expect(page).toHaveURL(/#product=obf-3348901607339/);await page.reload();await expect(page.locator('#product-title')).toContainText('Rouge Blush');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('mobile, tablet and desktop layouts support reduced motion without overflow',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:900});await page.goto('/');await page.locator('.month-chocolate').first().click();await expect(page.locator('.calendar-pick-card')).toHaveCount(3);expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),`overflow at ${width}`).toBe(false)}
 await page.locator('#beauty-calendar').screenshot({path:'/tmp/shiny-calendar-desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('#beauty-calendar').screenshot({path:'/tmp/shiny-calendar-mobile.png'});
});
test('image errors, gallery switching and shade state across languages',async({page})=>{
 const catalog=JSON.parse(readFileSync(new URL('./fixtures/catalog-before-photos.json',import.meta.url),'utf8'));
 await page.goto('/');
 const images=await page.evaluate(()=>['#dfbbab','#ad6b7d'].map(color=>{const c=document.createElement('canvas');c.width=30;c.height=30;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,30,30);return c.toDataURL('image/png')}));
 catalog[0].shades[1].images=[...images,'https://images.invalid/missing.png'];
 await page.route('https://images.invalid/**',route=>route.abort());
 await page.evaluate(data=>localStorage.setItem('shiny-catalog-v1',JSON.stringify(data)),catalog);
 await page.goto('/#product=prod-1');await page.reload();await expect(page.locator('.modal-image .photo-placeholder')).toBeVisible();
 await page.locator('.modal-details .shade-picker button').nth(1).click();await expect(page.locator('.gallery-thumbnails button')).toHaveCount(3);await expect(page.locator('.modal-image img')).toHaveAttribute('src',images[0]);
 await page.locator('.gallery-thumbnails button').nth(1).click();await expect(page.locator('.modal-image img')).toHaveAttribute('src',images[1]);await page.locator('.modal-language').selectOption('ru');await expect(page.locator('.modal-details .shade-picker button').nth(1)).toHaveAttribute('aria-pressed','true');await expect(page.locator('.gallery-thumbnails button').nth(1)).toHaveAttribute('aria-pressed','true');
 await page.locator('.gallery-thumbnails button').nth(2).click();await expect(page.locator('.modal-image .photo-placeholder')).toBeVisible();await expect(page.locator('.modal-image')).toContainText('официальное');
});
test('data guards never turn missing evidence or future months into best sellers',()=>{
 const now=new Date('2026-10-22T12:00:00Z');expect(calendarMonths).toHaveLength(12);expect(calendarMonths.every(m=>m.productIds.length===3)).toBe(true);expect(resolveMonth(calendarMonths[10],now).kind).toBe('coming-soon');
 expect(resolveMonth({...calendarMonths[0],kind:'verified'},now).kind).toBe('coming-soon');expect(resolveMonth({...calendarMonths[0],kind:'verified',evidence:{market:'Test market',periodStart:'2026-01-01',periodEnd:'2026-01-31',metric:'units_sold',sourceUrl:'https://example.com/test-report',verifiedAt:'2026-02-02'}},now).kind).toBe('verified');
 const offers=[{market:'AZ',currency:'AZN',id:'test',name:'Test retailer',shade:'Test shade',size:'30 ml',price_azn:25,verified:true,url:'https://example.com/product',sourceUrl:'https://example.com/source',last_checked:'2026-01-01',online_available:true,physical_available:null}];expect(verifiedOffers({offers},'Other shade','30 ml')).toEqual([]);expect(verifiedOffers({offers},'Test shade',undefined)).toEqual([]);expect(verifiedOffers({offers:[{...offers[0],verified:false}]},'Test shade','30 ml')).toEqual([]);expect(verifiedOffers({offers},'Test shade','30 ml')).toHaveLength(1);
});
test('verified offer fixtures are sorted, scoped to the variant, and power store filters',async({page})=>{
 const catalog=JSON.parse(readFileSync(new URL('./fixtures/catalog-before-photos.json',import.meta.url),'utf8'));
 const offer={market:'AZ',currency:'AZN',id:'expensive-test',name:'Test retailer A',shade:catalog[0].shades[0].name,size:'30 ml',price_azn:60,verified:true,url:'https://example.com/test-offer',sourceUrl:'https://example.com/test-source',last_checked:'2026-10-01',online_available:true,physical_available:null};
 catalog[0].size='30 ml';catalog[0].offers=[offer,{...offer,id:'cheap-test',name:'Test retailer B',price_azn:40},{...offer,id:'different-variant',price_azn:5,shade:'Different shade'}];
 await page.goto('/');await page.evaluate(data=>localStorage.setItem('shiny-catalog-v1',JSON.stringify(data)),catalog);await page.goto('/#product=prod-1');await page.reload();await expect(page.locator('.verified-offer')).toHaveCount(2);await expect(page.locator('.verified-offer').first()).toContainText('40.00');await expect(page.locator('.lowest-badge')).toHaveText('Lowest verified price');await expect(page.locator('.verified-offer').first().getByRole('link',{name:'Visit retailer'})).toHaveAttribute('href','https://example.com/test-offer');await page.locator('.modal-details .shade-picker button').nth(1).click();await expect(page.locator('.verified-offer')).toHaveCount(0);
 await page.keyboard.press('Escape');await page.getByLabel('Test retailer B',{exact:true}).check();await expect(page.locator('.product-card')).toHaveCount(1);await page.getByRole('button',{name:'Reset',exact:true}).first().click();await page.getByLabel('Product type',{exact:true}).selectOption('skincare');await expect(page.locator('.product-card')).toHaveCount(10);
});
