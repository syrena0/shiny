import retailers from '../../data/retailers.json' with {type:'json'};
import {isCalendarDate,isHttpsUrl} from './catalog-schema.js';
export function numericPrice(value){
 if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:null;
 if(typeof value!=='string'||!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim()))return null;
 const amount=Number(value.trim().replace(',','.'));return Number.isFinite(amount)?amount:null;
}
export function allVerifiedOffers(product,now=new Date(),{allowGeneral=false}={}){
 const seen=new Set();return (Array.isArray(product.offers)?product.offers:[]).flatMap(o=>{
  if(!o||o.verified!==true||o.market!=='AZ'||o.currency!=='AZN'||typeof o.id!=='string'||!o.id.trim()||seen.has(o.id)||typeof o.name!=='string'||!o.name.trim()||!(o.shade===null||allowGeneral&&o.shade===undefined||typeof o.shade==='string'&&o.shade.trim())||!(typeof o.size==='string'&&o.size.trim()||allowGeneral&&o.size==null)||!isHttpsUrl(o.url)||!isHttpsUrl(o.sourceUrl)||!isCalendarDate(o.last_checked)||new Date(o.last_checked+'T00:00:00Z')>now||numericPrice(o.price_azn)===null||![null,true,false].includes(o.online_available)||![null,true,false].includes(o.physical_available))return [];
  seen.add(o.id);return [{...o,price_azn:numericPrice(o.price_azn)}];
 });
}
export const availableOffer=o=>!(o.online_available===false&&o.physical_available===false);
export function verifiedOffers(product,shade,size){
 if(shade===undefined||!size)return [];
 return allVerifiedOffers(product).filter(o=>o.shade===shade&&o.size===size&&availableOffer(o)).sort((a,b)=>a.price_azn-b.price_azn);
}
// Comparison-only fallback: never change exact-variant pricing on catalog cards.
export function comparisonOffers(product,shade,size){
 const byStore=new Map(),storeKey=name=>name.trim().toLocaleLowerCase();
 const exact=verifiedOffers(product,shade,size);
 for(const offer of exact)if(!byStore.has(storeKey(offer.name)))byStore.set(storeKey(offer.name),{...offer,price_scope:'variant'});
 const general=allVerifiedOffers(product,new Date(),{allowGeneral:true})
  .filter(o=>o.shade==null&&(!o.size||!size||o.size===size)&&availableOffer(o))
  .sort((a,b)=>a.price_azn-b.price_azn);
 for(const offer of general)if(!byStore.has(storeKey(offer.name)))byStore.set(storeKey(offer.name),{...offer,price_scope:'product'});
 // Legacy stores contain general product prices, not verified variant quotes.
 const stores=(Array.isArray(product.stores)?product.stores:[])
  .filter(s=>s&&typeof s.name==='string'&&s.name.trim()&&numericPrice(s.price_azn)!==null
   &&s.shade==null&&(!s.size||!size||s.size===size))
  .sort((a,b)=>numericPrice(a.price_azn)-numericPrice(b.price_azn));
 for(const [index,store] of stores.entries())if(!byStore.has(storeKey(store.name)))byStore.set(storeKey(store.name),{
  ...store,id:`general-store-${index}`,price_azn:numericPrice(store.price_azn),price_scope:'product',verified:false,
  url:isHttpsUrl(store.url)?store.url:null,online_available:null,
  physical_available:typeof store.in_stock==='boolean'?store.in_stock:null,
 });
 const base=numericPrice(product.price_azn);
 // Keep the owner's base price visible without claiming a retailer verified it.
 if(!byStore.size&&base!==null&&base>0){
  const primary=retailers[0];
  byStore.set(storeKey(primary.name),{
   id:'product-base-reference',name:primary.name,price_azn:base,price_scope:'reference',
   verified:false,url:primary.url,online_available:null,physical_available:null,
  });
 }
 return [...byStore.values()].sort((a,b)=>a.price_azn-b.price_azn);
}
// Presentation-only rows: generated prices never enter the catalog or verified pricing.
export function demoComparisonOffers(product,shade,size){
 const offers=comparisonOffers(product,shade,size).filter(o=>o.price_scope!=='reference');
 const base=numericPrice(product.price_azn);
 if(offers.length<3&&base!==null&&base>0){
  const multipliers={birmarket:0.94,olivia:1,rossmann:1.10};
  for(const id of ['birmarket','olivia','rossmann']){
   if(offers.length>=3)break;
   const store=retailers.find(r=>r.id===id);
   if(!store||offers.some(o=>o.name.trim().toLowerCase()===store.name.toLowerCase()))continue;
   const price=Number((base*multipliers[id]).toFixed(2));
   if(!Number.isFinite(price)||price<=0)continue;
   offers.push({id:`demo-${id}`,name:store.name,price_azn:price,price_scope:'demo',
    verified:false,url:store.url,online_available:null,physical_available:null});
  }
 }
 return offers.sort((a,b)=>a.price_azn-b.price_azn);
}
export function productVariants(product){
 if(product.variants?.length)return product.variants.map(v=>({...v,name:v.shade??'',key:v.id}));
 if(product.shades?.length)return product.shades.map((s,index)=>({...s,gtin:s.gtin||((s.name===product.default_shade||!product.default_shade&&index===0)?product.gtin:undefined),shade:s.name,size:s.size||product.size,key:`shade-${index}`}));
 return [{name:'',shade:null,size:product.size,gtin:product.gtin,key:'base',images:product.images,image:product.image}];
}
export function defaultVariant(product){const variants=productVariants(product);return variants.find(v=>v.key===product.default_variant)||variants.find(v=>v.shade===product.default_shade)||variants[0];}
export function variantPrice(product,variant=defaultVariant(product)){
 const offers=verifiedOffers(product,variant.shade,variant.size);
 if(offers.length)return {amount:offers[0].price_azn,from:offers.length>1,verified:true,offers};
 const own=numericPrice(variant.price_azn);
 // A base price never silently applies to a different shade or size.
 const base=variant.key===defaultVariant(product).key||product.pricing_scope==='all_variants'?numericPrice(product.price_azn):null;
 return {amount:own??base,from:false,verified:false,offers:[]};
}
export function catalogPrice(product){return variantPrice(product).amount;}
export function priceAudit(products){return products.map(p=>({id:p.id,brand:p.brand,name:p.name,...variantPrice(p),variants:productVariants(p).map(v=>({key:v.key,shade:v.shade,size:v.size,...variantPrice(p,v)}))}));}
