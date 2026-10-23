// Existing UI regression fixtures represent a database response. No test ever
// contacts or writes to the production Supabase project.
import {test as base,expect} from '@playwright/test';
import {seedProducts,reconcileBundledPhotos,reconcilePublishedCatalog} from '../src/catalog';
import {validateCatalog} from '../src/lib/catalog-schema';
import {quarantineRejectedImages} from '../src/lib/image-review';
export const test=base.extend({
 _catalogAPI:[async({page},use)=>{
  await page.route('https://dmexjkfdvmyrpkclhbpy.supabase.co/rest/v1/products**',async route=>{
   let products=structuredClone(seedProducts);
   try{const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('shiny-catalog-v1')));if(validateCatalog(saved).valid)products=quarantineRejectedImages(reconcilePublishedCatalog(reconcileBundledPhotos(saved)));}catch{/* Malformed local fixtures keep the published default. */}
   const url=new URL(route.request().url()),offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||500);
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(products.slice(offset,offset+limit))});
  });await use();
 },{auto:true}]
});
export {expect};
