import {test,expect} from './test-base';
import {readFileSync} from 'node:fs';
const legacy=JSON.parse(readFileSync(new URL('./fixtures/catalog-before-photos.json',import.meta.url),'utf8'));
const bundled=JSON.parse(readFileSync(new URL('../data/products.json',import.meta.url),'utf8'));

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('shiny-language','"en"'));await page.addInitScript(p=>{if(!sessionStorage.getItem('admin-fixture')){localStorage.setItem('shiny-catalog-v1',JSON.stringify([{...p,dupes:[]}]));sessionStorage.setItem('admin-fixture','1')}},legacy[0]);});
test('edit catalog, upload shade image, persist, and export',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#admin');await expect(page.getByRole('heading',{name:'Product management'})).toBeVisible();
 await page.getByLabel('Product price (AZN)',{exact:true}).fill('56.75');

 await page.locator('.admin-store').first().getByLabel('Price (AZN)',{exact:true}).fill('57.25');
 await page.locator('.admin-store').first().getByLabel('In stock',{exact:true}).uncheck();
 const shade=page.locator('.admin-shade').nth(1);
 await shade.getByLabel('Shade name',{exact:true}).fill('Rose');
 await shade.getByLabel('Shade price (AZN, optional)',{exact:true}).fill('59.25');
 await shade.getByLabel('Color code HEX 2',{exact:true}).fill('#AF4567');
 const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=30;c.height=30;const ctx=c.getContext('2d');ctx.fillStyle='#af4567';ctx.fillRect(0,0,30,30);return c.toDataURL('image/png').split(',')[1]});
 await page.locator('.admin-image-field').first().locator('input[type=file]').setInputFiles({name:'main.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await expect(page.locator('.admin-image-field').first().getByLabel('Image URL (HTTPS)')).toHaveValue(/^data:image\/webp/);
 await shade.locator('input[type=file]').setInputFiles({name:'rose.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
 await expect(shade.getByLabel('Image URL (HTTPS)')).toHaveValue(/^data:image\/webp/);
 await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Changes saved.');
 await page.reload();await expect(page.getByLabel('Product price (AZN)',{exact:true})).toHaveValue('56.75');
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON'}).click();const download=await downloadEvent;expect(download.suggestedFilename()).toBe('products.json');const stream=await download.createReadStream();const chunks=[];for await(const c of stream)chunks.push(c);const data=JSON.parse(Buffer.concat(chunks).toString());expect(data[0].price_azn).toBe(56.75);expect(data[0].shades[1].image).toMatch(/^data:image\/webp/);expect(data[0].stores[0].price_azn).toBe(57.25);
 await page.getByRole('button',{name:'Back to shop'}).click();await expect(page.locator('.product-card').first().locator('.image-open img')).toHaveAttribute('src',/^data:image\/webp/);await page.locator('.product-card').first().locator('.image-open').click();await expect(page.locator('.modal-price')).toContainText('56.75');await page.locator('.modal-details .shade-picker button').nth(1).click();await expect(page.locator('.modal-image img')).toHaveAttribute('src',/^data:image\/webp/);await expect(page.locator('.modal-details h4')).toContainText('Rose');await expect(page.locator('.modal-price')).toContainText('59.25');expect(errors).toEqual([]);
});
test('unsaved guards, shade operations, validation and confirmed restore',async({page})=>{
 await page.goto('/#admin');await page.getByLabel('Product name',{exact:true}).fill('Changed product');
 await page.getByRole('button',{name:'Back to shop'}).click();await expect(page.getByRole('alertdialog')).toBeVisible();await page.getByRole('button',{name:'Keep editing'}).click();await expect(page.getByLabel('Product name',{exact:true})).toHaveValue('Changed product');
 await page.getByRole('button',{name:'Add shade',exact:true}).click();await expect(page.locator('.admin-shade')).toHaveCount(4);await page.locator('.shade-delete').last().click();await expect(page.locator('.admin-shade')).toHaveCount(3);
 await page.getByLabel('Product price (AZN)',{exact:true}).fill('-1');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Check prices');
 await page.getByLabel('Product price (AZN)',{exact:true}).fill('50');await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('button',{name:'Restore sample catalog'}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByLabel('Product price (AZN)',{exact:true})).toHaveValue('50');await page.getByRole('button',{name:'Restore sample catalog'}).click();await page.getByRole('button',{name:'Yes, restore'}).click();await expect(page.getByLabel('Product price (AZN)',{exact:true})).toHaveValue(bundled[0].price_azn===null?'':String(bundled[0].price_azn));
});
test('storage failures keep draft and do not claim success',async({page})=>{
 await page.goto('/#admin');await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='shiny-catalog-v1')throw new DOMException('Quota','QuotaExceededError');return original.call(this,k,v)}});
 await page.getByLabel('Product price (AZN)',{exact:true}).fill('42');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('alert')).toContainText('have not been saved');await expect(page.getByLabel('Product price (AZN)',{exact:true})).toHaveValue('42');
});
test('mobile admin and catalog remain usable in all languages',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Admin panel',exact:true}).click();await expect(page.locator('.admin-editor')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.locator('.language select').selectOption('az');await expect(page.locator('.admin-header h1')).toHaveText('Məhsul idarəetməsi');await page.locator('.language select').selectOption('ru');await expect(page.locator('.admin-header h1')).toHaveText('Управление товарами');await page.screenshot({path:'/tmp/shiny-admin-mobile.png',fullPage:true});
});
test('catalog search, sorting and favorites still work',async({page})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.removeItem('shiny-catalog-v1'));await page.reload();await expect(page.locator('.product-card')).toHaveCount(18);await page.locator('.catalog-search input').fill('Stunna');await expect(page.locator('.product-card')).toHaveCount(1);await page.locator('.favorite-button').click();await page.reload();await page.locator('.catalog-search input').fill('Stunna');await expect(page.locator('.favorite-button.selected')).toHaveCount(1);await page.getByLabel('Sort by',{exact:true}).selectOption('priceAsc');await expect(page.locator('.product-card').first()).toContainText('Stunna');await page.locator('.catalog-search input').fill('Blush');await expect(page.locator('.product-card')).toHaveCount(5);
});
