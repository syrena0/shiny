import imagePolicy from '../../data/image-policy.json' with {type:'json'};
// Shared browser/CLI validation. No fixed product count or hard-coded product IDs.
export const PRODUCT_CATEGORIES=['tonal_krem','blush','concealer','mascara','powder','highlighter','eyeliner','primer','moisturizer','makeup_remover','lipstick','lip_gloss'];
export const MAX_CATALOG_RECORDS=20000;
const placeholderAssets=new Set(['placeholder','cerave','charlotte','dior','elf','essence','fenty','garnier','mac','maybelline','nars','nyx','nyxliner','primer','rare','sheglam'].map(name=>`/products/${name}.svg`));
export function isPlaceholderImage(src){return !src||placeholderAssets.has(src)||rejectedImages.has(src);}
const rejectedImages=new Set(imagePolicy.rejected_urls);
const locales=['az','en','ru'];
const text=v=>typeof v==='string'&&v.trim().length>0;
const nullableNumber=(v,max=Infinity)=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max);
export function isHttpsUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password;}catch{return false;}}
export function isImageUrl(value){return typeof value==='string'&&(isHttpsUrl(value)||/^\/products\/[\w./-]+$/.test(value)&&!value.split('/').includes('..')||/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value));}
export function isCalendarDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;}
function isAsset(asset){
 if(typeof asset==='string')return isImageUrl(asset);
 return !!asset&&typeof asset==='object'&&isImageUrl(asset.url)&&
  (asset.sourceUrl===undefined||isHttpsUrl(asset.sourceUrl))&&
  (asset.detailUrl===undefined||isImageUrl(asset.detailUrl))&&
  (asset.license===undefined||text(asset.license))&&
  (asset.licenseUrl===undefined||isHttpsUrl(asset.licenseUrl))&&
  (asset.width===undefined||Number.isInteger(asset.width)&&asset.width>0)&&
  (asset.height===undefined||Number.isInteger(asset.height)&&asset.height>0)&&
  (asset.sources===undefined||Array.isArray(asset.sources)&&asset.sources.every(s=>s&&isImageUrl(s.url)&&Number.isInteger(s.width)&&s.width>0));
}
export function validateCatalog(input,{requireProvenance=false,checkReferences=true}={}){
 const errors=[];const add=(index,field)=>{if(errors.length<50)errors.push({index,field});};
 if(!Array.isArray(input)||!input.length||input.length>MAX_CATALOG_RECORDS)return {valid:false,errors:[{index:-1,field:'catalog'}]};
 const ids=new Set();
 input.forEach((p,index)=>{
  if(!p||typeof p!=='object'||Array.isArray(p)){add(index,'product');return;}
  for(const key of ['id','name','brand'])if(!text(p[key]))add(index,key);
  if(ids.has(p.id))add(index,'duplicate_id');ids.add(p.id);
  if(p.brand_tier!==undefined&&!['premium','affordable'].includes(p.brand_tier))add(index,'brand_tier');
  if(!PRODUCT_CATEGORIES.includes(p.category))add(index,'category');
  if(!nullableNumber(p.price_azn))add(index,'price_azn');
  if(!nullableNumber(p.rating,5))add(index,'rating');
  if(typeof p.image!=='string'||p.image!==''&&!isImageUrl(p.image))add(index,'image');
  if(p.images!==undefined&&(!Array.isArray(p.images)||!p.images.every(isAsset)))add(index,'images');
  if(!p.description||!locales.every(l=>typeof p.description[l]==='string'))add(index,'description');
  if(!Array.isArray(p.skin_type)||!p.skin_type.every(s=>['quru','yağlı','qarışıq','həssas'].includes(s)))add(index,'skin_type');
  if(p.finish!==null&&!['natural','radiant','glossy','matte'].includes(p.finish))add(index,'finish');
  if(p.size!==undefined&&!text(p.size))add(index,'size');
  if(!Array.isArray(p.shades))add(index,'shades');
  else {
   const names=new Set();
   p.shades.forEach(s=>{
    if(!s||!text(s.name)||(s.hex!==null&&!/^#[0-9a-f]{6}$/i.test(s.hex))||!['neutral','warm','cool','unknown'].includes(s.undertone)||names.has(s.name)){add(index,'shades');return;}
    names.add(s.name);
    if(s.price_azn!==undefined&&!nullableNumber(s.price_azn))add(index,'shade.price_azn');
    if(s.image!==undefined&&s.image!==''&&!isImageUrl(s.image))add(index,'shade.image');
    if(s.images!==undefined&&(!Array.isArray(s.images)||!s.images.every(isAsset)))add(index,'shade.images');
    if(s.size!==undefined&&!text(s.size))add(index,'shade.size');
   });
  }
  if(p.variants!==undefined&&(!Array.isArray(p.variants)||!p.variants.length||p.variants.some(v=>!v||!text(v.id)||!(v.shade===null||text(v.shade))||v.size!==undefined&&!text(v.size)||v.images!==undefined&&(!Array.isArray(v.images)||!v.images.every(isAsset))||v.price_azn!==undefined&&!nullableNumber(v.price_azn))||new Set(p.variants.map(v=>v.id)).size!==p.variants.length||new Set(p.variants.map(v=>JSON.stringify([v.shade,v.size]))).size!==p.variants.length))add(index,'variants');
  if(p.default_variant!==undefined&&(!Array.isArray(p.variants)||!p.variants.some(v=>v.id===p.default_variant)))add(index,'default_variant');
  if(!Array.isArray(p.stores)||!p.stores.every(s=>s&&text(s.name)&&typeof s.price_azn==='number'&&nullableNumber(s.price_azn)&&typeof s.in_stock==='boolean'&&isCalendarDate(s.last_checked)))add(index,'stores');
  if(!Array.isArray(p.dupes)||!p.dupes.every(d=>d&&text(d.dupe_product_id)&&typeof d.match_percentage==='number'&&nullableNumber(d.match_percentage,100)&&d.reason&&locales.every(l=>typeof d.reason[l]==='string')))add(index,'dupes');
  if(p.offers!==undefined&&(!Array.isArray(p.offers)||!p.offers.every(o=>o&&typeof o==='object'&&!Array.isArray(o))))add(index,'offers');
  if(p.provenance!==undefined||requireProvenance){
   const source=p.provenance;
   if(!source||!isHttpsUrl(source.source_url)||!isCalendarDate(source.retrieved_at)||!text(source.license)||!['manufacturer','retailer','community'].includes(source.kind))add(index,'provenance');
   // Source-backed imports may not silently reuse arbitrary photos with no rights metadata.
   if(requireProvenance){
    const assets=[...(Array.isArray(p.images)?p.images:[]),...[...(Array.isArray(p.shades)?p.shades:[]),...(Array.isArray(p.variants)?p.variants:[])].flatMap(s=>Array.isArray(s?.images)?s.images:[])];
    const direct=[p.image,...[...(Array.isArray(p.shades)?p.shades:[]),...(Array.isArray(p.variants)?p.variants:[])].map(s=>s?.image)].filter(url=>typeof url==='string'&&url&&!isPlaceholderImage(url));
    if(assets.some(a=>typeof a==='string'||!a||!isHttpsUrl(a.sourceUrl)||!text(a.license))||direct.some(url=>!assets.some(a=>a&&typeof a==='object'&&a.url===url)))add(index,'image_rights');
   }
  }
 });
 if(checkReferences)input.forEach((p,index)=>{if(Array.isArray(p?.dupes))p.dupes.forEach(d=>{if(!ids.has(d?.dupe_product_id))add(index,'dupe_reference');});});
 return {valid:errors.length===0,errors};
}
export function mergeCatalog(existing,incoming){
 const inputCheck=validateCatalog(incoming,{checkReferences:false});if(!inputCheck.valid)return {...inputCheck,products:null};
 const existingIds=new Set(existing.map(p=>p.id));
 const merged=new Map(existing.map(p=>[p.id,p]));incoming.forEach(p=>merged.set(p.id,p));
 const products=[...merged.values()],result=validateCatalog(products);
 return {...result,products:result.valid?products:null,added:incoming.filter(p=>!existingIds.has(p.id)).length,updated:incoming.filter(p=>existingIds.has(p.id)).length};
}
